<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import {
    collection, doc, getDoc, getDocs, setDoc, deleteDoc,
    query, where, orderBy, Timestamp, documentId,
  } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import {
    mdiHome, mdiPlus, mdiDelete, mdiQrcode,
    mdiEye, mdiEyeOff, mdiChevronLeft, mdiChevronRight, mdiRefresh, mdiPrinter,
  } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'
  import Swal from 'sweetalert2'
  import QRCode from 'qrcode'

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_ABBR    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  // Default start/end for standard training days (Mon=1, Wed=3, Fri=5)
  const TRAINING_DEFAULTS = {
    1: { start: '19:00', end: '21:30' },
    3: { start: '19:00', end: '21:30' },
    5: { start: '19:30', end: '21:30' },
  }

  const now = new Date()
  let selectedYear  = $state(now.getFullYear())
  let selectedMonth = $state(now.getMonth())

  let salt        = $state('')
  let saltVisible = $state(false)
  let savingSalt  = $state(false)

  let sessions = $state([])  // { id, start: Date, end: Date, passcode }
  let loading  = $state(true)

  let showAddModal  = $state(false)
  let addForm       = $state({ date: '', startTime: '19:00', endTime: '21:30' })
  let savingSession = $state(false)

  // ── Passcode ───────────────────────────────────────────────────────────────

  async function generatePasscode(saltStr, sessionId) {
    const data       = new TextEncoder().encode(saltStr + sessionId)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8)
  }

  function makeRandomSalt() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // ── Salt ───────────────────────────────────────────────────────────────────

  async function loadSalt() {
    const snap = await getDoc(doc(db, 'config', 'attendance'))
    if (snap.exists()) salt = snap.data().salt ?? ''
  }

  async function saveSalt() {
    if (savingSalt) return
    savingSalt = true
    try {
      await setDoc(doc(db, 'config', 'attendance'), { salt })
      Swal.fire('Salt saved!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    savingSalt = false
  }

  async function regenerateSalt() {
    const { isConfirmed } = await Swal.fire({
      title: 'Regenerate salt?',
      text: 'All existing QR codes will become invalid.',
      confirmButtonText: 'Regenerate',
      confirmButtonColor: '#ef4444',
      showCancelButton: true,
    })
    if (!isConfirmed) return
    salt = makeRandomSalt()
    await saveSalt()
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async function loadSessions() {
    loading = true
    const mm    = String(selectedMonth + 1).padStart(2, '0')
    const start = `${selectedYear}-${mm}-01`
    const end   = `${selectedYear}-${mm}-32`
    try {
      const q    = query(
        collection(db, 'session'),
        where(documentId(), '>=', start),
        where(documentId(), '<=', end),
        orderBy(documentId()),
      )
      const snap = await getDocs(q)
      sessions = snap.docs.map(d => ({
        id:       d.id,
        start:    d.data().start.toDate(),
        end:      d.data().end.toDate(),
        passcode: d.data().passcode,
      }))
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    loading = false
  }

  async function generateStandard() {
    if (!salt) {
      Swal.fire('No salt set', 'Set a salt first.', 'warning')
      return
    }
    const mm      = String(selectedMonth + 1).padStart(2, '0')
    const existing = new Set(sessions.map(s => s.id))
    const toCreate = []
    const d = new Date(selectedYear, selectedMonth, 1)
    while (d.getMonth() === selectedMonth) {
      const day = d.getDay()
      if (day in TRAINING_DEFAULTS) {
        const dd  = String(d.getDate()).padStart(2, '0')
        const id  = `${selectedYear}-${mm}-${dd}-${DAY_ABBR[day]}`
        if (!existing.has(id)) {
          toCreate.push({ id, date: `${selectedYear}-${mm}-${dd}`, ...TRAINING_DEFAULTS[day] })
        }
      }
      d.setDate(d.getDate() + 1)
    }
    if (toCreate.length === 0) {
      Swal.fire('All sessions already exist', '', 'info')
      return
    }
    loading = true
    try {
      for (const s of toCreate) {
        const passcode = await generatePasscode(salt, s.id)
        await setDoc(doc(db, 'session', s.id), {
          start:    Timestamp.fromDate(new Date(`${s.date}T${s.start}:00`)),
          end:      Timestamp.fromDate(new Date(`${s.date}T${s.end}:00`)),
          passcode,
        })
      }
      Swal.fire('Generated!', `${toCreate.length} sessions created`, 'success')
      await loadSessions()
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
      loading = false
    }
  }

  async function saveCustomSession() {
    if (!addForm.date || !addForm.startTime || !addForm.endTime) return
    if (!salt) { Swal.fire('No salt set', 'Set a salt first.', 'warning'); return }
    if (savingSession) return
    savingSession = true
    try {
      const dayAbbr  = DAY_ABBR[new Date(addForm.date + 'T12:00:00').getDay()]
      const id       = `${addForm.date}-${dayAbbr}`
      const passcode = await generatePasscode(salt, id)
      await setDoc(doc(db, 'session', id), {
        start:    Timestamp.fromDate(new Date(`${addForm.date}T${addForm.startTime}:00`)),
        end:      Timestamp.fromDate(new Date(`${addForm.date}T${addForm.endTime}:00`)),
        passcode,
      })
      showAddModal = false
      await loadSessions()
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    savingSession = false
  }

  async function deleteSession(session) {
    const { isConfirmed } = await Swal.fire({
      title: 'Delete session?',
      text: session.id,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444',
      showCancelButton: true,
    })
    if (!isConfirmed) return
    try {
      await deleteDoc(doc(db, 'session', session.id))
      sessions = sessions.filter(s => s.id !== session.id)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  // ── QR ─────────────────────────────────────────────────────────────────────

  let qrModal    = $state(null)  // { session, dataUrl } | null

  async function openQR(session) {
    const url    = `${window.location.origin}/attend?s=${session.id}&p=${session.passcode}`
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 })
    qrModal = { session, dataUrl }
  }

  function downloadQR() {
    const a = document.createElement('a')
    a.href     = qrModal.dataUrl
    a.download = `QR-${qrModal.session.id}.png`
    a.click()
  }

  async function printBook() {
    const pages = await Promise.all(sessions.map(async session => {
      const url     = `${window.location.origin}/attend?s=${session.id}&p=${session.passcode}`
      const dataUrl = await QRCode.toDataURL(url, { width: 800, margin: 2 })
      const label   = fmtDate(session.start)
      const time    = `${fmtTime(session.start)} – ${fmtTime(session.end)}`
      return `
        <div class="page">
          <div class="label">${label}</div>
          <div class="time">${time}</div>
          <img src="${dataUrl}" />
          <div class="hint">Scan to mark attendance</div>
        </div>`
    }))

    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance QR — ${MONTH_NAMES[selectedMonth]} ${selectedYear}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: sans-serif; }
          .page {
            width: 100vw; height: 100vh;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            page-break-after: always;
          }
          .label { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
          .time  { font-size: 1.2rem; color: #555; margin-bottom: 2rem; }
          img    { width: min(80vw, 80vh); height: min(80vw, 80vh); }
          .hint  { font-size: 1rem; color: #888; margin-top: 1.5rem; }
          @media print { .page { page-break-after: always; } }
        </style>
      </head>
      <body>${pages.join('')}</body>
      </html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  // ── Month nav ──────────────────────────────────────────────────────────────

  async function prevMonth() {
    if (selectedMonth === 0) { selectedMonth = 11; selectedYear-- } else selectedMonth--
    await loadSessions()
  }
  async function nextMonth() {
    if (selectedMonth === 11) { selectedMonth = 0; selectedYear++ } else selectedMonth++
    await loadSessions()
  }

  // ── Format ─────────────────────────────────────────────────────────────────

  function fmtDate(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  function fmtTime(d) {
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  onMount(async () => {
    if (!$userProfile?.permissions?.includes('attendance')) { goto('/home'); return }
    await Promise.all([loadSalt(), loadSessions()])
  })
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>
  <div class="text-2xl font-bold mt-4 mb-6">Attendance Sessions</div>

  <!-- Salt config -->
  <div class="bg-white rounded shadow px-4 py-3 mb-6">
    <div class="text-sm font-bold text-gray-500 mb-2">QR Salt</div>
    <div class="flex items-center gap-2">
      <input
        class="border rounded px-2 py-1 font-mono text-sm grow min-w-0"
        type={saltVisible ? 'text' : 'password'}
        bind:value={salt}
        placeholder="No salt set — click Regenerate to create one"
      />
      <button class="text-gray-400 p-1 shrink-0" onclick={() => saltVisible = !saltVisible}>
        <AIcon path={saltVisible ? mdiEyeOff : mdiEye} />
      </button>
      <button
        class="bg-gray-500 text-white font-bold px-3 py-1 rounded text-sm shrink-0 disabled:opacity-50"
        onclick={saveSalt} disabled={savingSalt}
      >Save</button>
      <button
        class="bg-red-500 text-white font-bold px-3 py-1 rounded text-sm flex items-center gap-1 shrink-0"
        onclick={regenerateSalt}
      >
        <AIcon path={mdiRefresh} size="18" />Regenerate
      </button>
    </div>
  </div>

  <!-- Month controls -->
  <div class="flex items-center flex-wrap gap-2 mb-4">
    <div class="flex items-center bg-white rounded shadow px-1 py-1">
      <button class="text-gray-600 p-1 disabled:opacity-40" onclick={prevMonth} disabled={loading}>
        <AIcon path={mdiChevronLeft} />
      </button>
      <span class="font-bold mx-2 w-44 text-center">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
      <button class="text-gray-600 p-1 disabled:opacity-40" onclick={nextMonth} disabled={loading}>
        <AIcon path={mdiChevronRight} />
      </button>
    </div>
    <button
      class="bg-blue-500 text-white font-bold px-3 py-1.5 rounded shadow text-sm flex items-center gap-1 disabled:opacity-50"
      onclick={generateStandard} disabled={loading || !salt}
    >
      <AIcon path={mdiRefresh} size="18" />Generate Standard
    </button>
    <button
      class="bg-green-500 text-white font-bold px-3 py-1.5 rounded shadow text-sm flex items-center gap-1 disabled:opacity-50"
      onclick={() => { addForm = { date: '', startTime: '19:00', endTime: '21:30' }; showAddModal = true }}
      disabled={!salt}
    >
      <AIcon path={mdiPlus} size="18" />Add Custom
    </button>
    {#if sessions.length > 0}
      <button
        class="bg-gray-700 text-white font-bold px-3 py-1.5 rounded shadow text-sm flex items-center gap-1"
        onclick={printBook}
      >
        <AIcon path={mdiPrinter} size="18" />Print Book
      </button>
    {/if}
  </div>

  <!-- Session list -->
  {#if loading}
    <div class="text-gray-400 text-center mt-8">Loading...</div>
  {:else if sessions.length === 0}
    <div class="text-gray-400 text-center mt-8">
      No sessions for {MONTH_NAMES[selectedMonth]} {selectedYear}.<br/>
      Click "Generate Standard" to create Mon/Wed/Fri sessions.
    </div>
  {:else}
    <div class="flex flex-col gap-2">
      {#each sessions as session}
        <div class="bg-white rounded shadow px-4 py-3 flex items-center gap-4">
          <div class="grow min-w-0">
            <div class="font-bold">{fmtDate(session.start)}</div>
            <div class="text-sm text-gray-500">{fmtTime(session.start)} – {fmtTime(session.end)}</div>
            <div class="font-mono text-xs text-gray-400 mt-0.5">passcode: {session.passcode}</div>
          </div>
          <button class="text-indigo-500 p-1 shrink-0" onclick={() => openQR(session)} title="QR Code">
            <AIcon path={mdiQrcode} />
          </button>
          <button class="text-red-400 p-1 shrink-0" onclick={() => deleteSession(session)}>
            <AIcon path={mdiDelete} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- QR Modal -->
{#if qrModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-sm flex flex-col items-center">
      <div class="p-4 font-bold text-xl border-b w-full">{fmtDate(qrModal.session.start)}</div>
      <div class="text-sm text-gray-500 mt-3">{fmtTime(qrModal.session.start)} – {fmtTime(qrModal.session.end)}</div>
      <img src={qrModal.dataUrl} alt="QR Code" class="w-64 h-64 my-4" />
      <div class="p-4 border-t w-full flex justify-end gap-2">
        <button class="px-4 py-1.5 rounded border font-bold" onclick={() => qrModal = null}>Close</button>
        <button class="px-4 py-1.5 rounded bg-indigo-500 text-white font-bold flex items-center gap-1" onclick={downloadQR}>
          <AIcon path={mdiQrcode} size="18" />Download
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Add Custom Modal -->
{#if showAddModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-sm">
      <div class="p-4 font-bold text-xl border-b">Add Custom Session</div>
      <div class="p-4 flex flex-col gap-4">
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Date</span>
          <input type="date" class="border rounded px-2 py-1.5" bind:value={addForm.date} />
        </label>
        <div class="flex gap-3">
          <label class="flex flex-col grow">
            <span class="font-bold text-sm mb-1">Start</span>
            <input type="time" class="border rounded px-2 py-1.5" bind:value={addForm.startTime} />
          </label>
          <label class="flex flex-col grow">
            <span class="font-bold text-sm mb-1">End</span>
            <input type="time" class="border rounded px-2 py-1.5" bind:value={addForm.endTime} />
          </label>
        </div>
      </div>
      <div class="p-4 border-t flex justify-end gap-2">
        <button class="px-4 py-1.5 rounded border font-bold" onclick={() => showAddModal = false}>Cancel</button>
        <button
          class="px-4 py-1.5 rounded bg-blue-500 text-white font-bold disabled:opacity-50"
          onclick={saveCustomSession} disabled={savingSession || !addForm.date}
        >{savingSession ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  </div>
{/if}
