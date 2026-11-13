<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import {
    collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
    query, where, orderBy, Timestamp, documentId, serverTimestamp,
  } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import {
    mdiHome, mdiPlus, mdiDelete, mdiQrcode, mdiPencil,
    mdiEye, mdiEyeOff, mdiChevronLeft, mdiChevronRight, mdiRefresh, mdiPrinter,
    mdiAccountMultiple, mdiCheck, mdiMonitor, mdiClose,
  } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'
  import Swal from 'sweetalert2'
  import QRCode from 'qrcode'
  import { jsPDF } from 'jspdf'

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_ABBR    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const DEFAULT_LOCATION = 'UNSW Fitness & Aquatic Centre (B5), Gate 2, High St, UNSW Sydney, Kensington NSW 2033, Australia'

  // Actual training times for standard days (Mon=1, Wed=3, Fri=5)
  // QR window is automatically ±30 min around these
  const TRAINING_DEFAULTS = {
    1: { trainingStart: '19:30', trainingEnd: '21:30' },
    3: { trainingStart: '19:30', trainingEnd: '21:30' },
    5: { trainingStart: '20:00', trainingEnd: '21:30' },
  }

  function addMins(date, mins) { return new Date(date.getTime() + mins * 60 * 1000) }

  // Falls back to QR window ±30 min for sessions created before trainingStart/trainingEnd were added
  function displayStart(s) { return s.trainingStart ?? addMins(s.start,  30) }
  function displayEnd(s)   { return s.trainingEnd   ?? addMins(s.end,   -30) }

  const now = new Date()
  let selectedYear  = $state(now.getFullYear())
  let selectedMonth = $state(now.getMonth())

  let salt        = $state('')
  let saltVisible = $state(false)
  let savingSalt  = $state(false)

  let sessions = $state([])  // { id, start: Date, end: Date, passcode, label }

  let editingLabel     = $state(null)  // sessionId | null
  let labelInput       = $state('')
  let labelColorInput  = $state('purple')

  let editingLocation = $state(null)  // sessionId | null
  let locationInput   = $state('')

  const COLORS = [
    { key: 'purple', tw: 'bg-purple-100 text-purple-700', swatch: 'bg-purple-500' },
    { key: 'orange', tw: 'bg-orange-100 text-orange-700', swatch: 'bg-orange-500' },
    { key: 'blue',   tw: 'bg-blue-100 text-blue-700',     swatch: 'bg-blue-500'   },
    { key: 'green',  tw: 'bg-green-100 text-green-700',   swatch: 'bg-green-500'  },
    { key: 'red',    tw: 'bg-red-100 text-red-700',       swatch: 'bg-red-500'    },
    { key: 'yellow', tw: 'bg-yellow-100 text-yellow-700', swatch: 'bg-yellow-400' },
    { key: 'pink',   tw: 'bg-pink-100 text-pink-700',     swatch: 'bg-pink-500'   },
    { key: 'teal',   tw: 'bg-teal-100 text-teal-700',     swatch: 'bg-teal-500'   },
  ]
  const COLORS_MAP = Object.fromEntries(COLORS.map(c => [c.key, c]))
  function labelTw(color) { return COLORS_MAP[color]?.tw ?? 'bg-gray-100 text-gray-600' }

  const DEFAULT_LABEL_COLORS = { 'Bokuto Waza': 'purple', 'Hybrid Bokuto Waza': 'orange' }

  // Returns the date number of the nth occurrence of weekday (0=Sun…6=Sat) in the given month
  function nthWeekday(year, month, weekday, n) {
    const d = new Date(year, month, 1)
    let count = 0
    while (d.getMonth() === month) {
      if (d.getDay() === weekday) { count++; if (count === n) return d.getDate() }
      d.setDate(d.getDate() + 1)
    }
    return null
  }

  function defaultLabel(year, month, dateNum, dayOfWeek) {
    if (dayOfWeek === 3 && dateNum === nthWeekday(year, month, 3, 1)) return 'Bokuto Waza'
    if (dayOfWeek === 1 && dateNum === nthWeekday(year, month, 1, 3)) return 'Hybrid Bokuto Waza'
    return ''
  }

  function startEditLabel(session) {
    editingLabel    = session.id
    labelInput      = session.label ?? ''
    labelColorInput = session.color ?? 'purple'
  }

  function focusEl(node) { node.focus() }

  function startEditLocation(session) {
    editingLocation = session.id
    locationInput   = session.location ?? ''
  }

  async function saveLocation(session) {
    const location = locationInput.trim()
    try {
      await updateDoc(doc(db, 'session', session.id), { location })
      sessions = sessions.map(s => s.id === session.id ? { ...s, location } : s)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    editingLocation = null
  }

  async function saveLabel(session) {
    const label = labelInput.trim()
    const color = label ? labelColorInput : ''
    try {
      await updateDoc(doc(db, 'session', session.id), { label, color })
      sessions = sessions.map(s => s.id === session.id ? { ...s, label, color } : s)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    editingLabel = null
  }
  let loading  = $state(true)

  let showAddModal  = $state(false)
  let addForm       = $state({ date: '', trainingStart: '19:30', trainingEnd: '21:30', type: 'training', label: '', labelColor: 'purple', location: DEFAULT_LOCATION })
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
      const secretSnaps = await Promise.all(
        snap.docs.map(d => getDoc(doc(db, 'sessionSecret', d.id)))
      )
      sessions = snap.docs.map((d, i) => ({
        id:           d.id,
        start:        d.data().start.toDate(),
        end:          d.data().end.toDate(),
        trainingStart: d.data().trainingStart?.toDate() ?? null,
        trainingEnd:   d.data().trainingEnd?.toDate()   ?? null,
        passcode:     secretSnaps[i].exists() ? secretSnaps[i].data().passcode : '',
        label:        d.data().label ?? '',
        color:        d.data().color ?? '',
        type:         d.data().type ?? 'training',
        location:     d.data().location ?? '',
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
          const label = defaultLabel(selectedYear, selectedMonth, d.getDate(), day)
          toCreate.push({ id, date: `${selectedYear}-${mm}-${dd}`, ...TRAINING_DEFAULTS[day], label })

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
        const trainStart = new Date(`${s.date}T${s.trainingStart}:00`)
        const trainEnd   = new Date(`${s.date}T${s.trainingEnd}:00`)
        await setDoc(doc(db, 'session', s.id), {
          start:         Timestamp.fromDate(addMins(trainStart, -30)),
          end:           Timestamp.fromDate(addMins(trainEnd,    30)),
          trainingStart: Timestamp.fromDate(trainStart),
          trainingEnd:   Timestamp.fromDate(trainEnd),
          location:      DEFAULT_LOCATION,
          ...(s.label ? { label: s.label, color: DEFAULT_LABEL_COLORS[s.label] ?? 'purple' } : {}),
        })
        await setDoc(doc(db, 'sessionSecret', s.id), { passcode })
      }
      Swal.fire('Generated!', `${toCreate.length} sessions created`, 'success')
      await loadSessions()
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
      loading = false
    }
  }

  async function saveCustomSession() {
    if (!addForm.date || !addForm.trainingStart || !addForm.trainingEnd) return
    if (addForm.type === 'training' && !salt) { Swal.fire('No salt set', 'Set a salt first.', 'warning'); return }
    if (savingSession) return
    savingSession = true
    try {
      const dateObj    = new Date(addForm.date + 'T12:00:00')
      const dayOfWeek  = dateObj.getDay()
      const dayAbbr    = DAY_ABBR[dayOfWeek]
      const id         = `${addForm.date}-${dayAbbr}`
      const trainStart = new Date(`${addForm.date}T${addForm.trainingStart}:00`)
      const trainEnd   = new Date(`${addForm.date}T${addForm.trainingEnd}:00`)
      const labelTrim  = addForm.label.trim()

      if (addForm.type === 'event') {
        await setDoc(doc(db, 'session', id), {
          start:         Timestamp.fromDate(trainStart),
          end:           Timestamp.fromDate(trainEnd),
          trainingStart: Timestamp.fromDate(trainStart),
          trainingEnd:   Timestamp.fromDate(trainEnd),
          type:          'event',
          location:      addForm.location.trim(),
          ...(labelTrim ? { label: labelTrim, color: addForm.labelColor } : {}),
        })
      } else {
        const autoLabel = labelTrim || defaultLabel(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), dayOfWeek)
        const autoColor = labelTrim ? addForm.labelColor : (DEFAULT_LABEL_COLORS[autoLabel] ?? 'purple')
        const passcode  = await generatePasscode(salt, id)
        await setDoc(doc(db, 'session', id), {
          start:         Timestamp.fromDate(addMins(trainStart, -30)),
          end:           Timestamp.fromDate(addMins(trainEnd,    30)),
          trainingStart: Timestamp.fromDate(trainStart),
          trainingEnd:   Timestamp.fromDate(trainEnd),
          location:      addForm.location.trim(),
          ...(autoLabel ? { label: autoLabel, color: autoColor } : {}),
        })
        await setDoc(doc(db, 'sessionSecret', id), { passcode })
      }
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
      await Promise.all([
        deleteDoc(doc(db, 'session', session.id)),
        deleteDoc(doc(db, 'sessionSecret', session.id)),
      ])
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
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, H = 297
    const qrSize = 160
    const qrX = (W - qrSize) / 2
    const qrY = (H - qrSize) / 2 - 15

    const trainingSessions = sessions.filter(s => s.type !== 'event')
    for (let i = 0; i < trainingSessions.length; i++) {
      const session = trainingSessions[i]
      if (i > 0) pdf.addPage()

      const url     = `${window.location.origin}/attend?s=${session.id}&p=${session.passcode}`
      const dataUrl = await QRCode.toDataURL(url, { width: 800, margin: 1 })
      const label   = fmtDate(session.start)
      const time    = `${fmtTime(displayStart(session))} – ${fmtTime(displayEnd(session))}`

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.text(label, W / 2, session.label ? qrY - 24 : qrY - 20, { align: 'center' })

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(14)
      pdf.setTextColor(100)
      pdf.text(time, W / 2, session.label ? qrY - 14 : qrY - 10, { align: 'center' })

      if (session.label) {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(12)
        const PDF_RGB = { purple:[120,60,200], orange:[194,80,10], blue:[29,100,210], green:[22,120,60], red:[190,30,30], yellow:[160,100,0], pink:[190,24,93], teal:[15,118,110] }
        const [r,g,b] = PDF_RGB[session.color] ?? PDF_RGB.purple
        pdf.setTextColor(r, g, b)
        pdf.text(session.label, W / 2, qrY - 5, { align: 'center' })
      }
      pdf.setTextColor(0)

      pdf.addImage(dataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      pdf.setFontSize(11)
      pdf.setTextColor(150)
      pdf.text('Scan to mark attendance', W / 2, qrY + qrSize + 10, { align: 'center' })
      pdf.setTextColor(0)
    }

    if (trainingSessions.length > 0) pdf.save(`QR-${MONTH_NAMES[selectedMonth]}-${selectedYear}.pdf`)
  }

  // ── Session attendance view ────────────────────────────────────────────────

  let viewModal    = $state(null)  // { session, rows: [{ uid, name, checkedIn, time }] }
  let viewLoading  = $state(false)
  let markModal    = $state(null)  // { row, session } — confirmation + time picker
  let markTime     = $state('')
  let marking      = $state(false)

  async function openView(session) {
    viewLoading = true
    viewModal   = { session, rows: [] }
    try {
      const usersSnap = await getDocs(collection(db, 'user'))

      const checkins  = {}
      const memberSet = new Set()
      await Promise.all([
        ...usersSnap.docs.map(async u => {
          const sessionDoc = await getDoc(doc(db, 'attendance', u.id, 'sessions', session.id))
          if (sessionDoc.exists()) checkins[u.id] = sessionDoc.data().t?.toDate() ?? null
        }),
        ...usersSnap.docs.map(async u => {
          const memberDoc = await getDoc(doc(db, 'membership', u.id))
          if (memberDoc.exists() && memberDoc.data().expiresAt?.toDate() > new Date()) memberSet.add(u.id)
        }),
      ])

      const rows = []
      usersSnap.forEach(u => {
        rows.push({
          uid:       u.id,
          name:      u.data().name,
          checkedIn: u.id in checkins,
          time:      checkins[u.id] ?? null,
          member:    memberSet.has(u.id),
        })
      })

      rows.sort((a, b) => {
        if (a.checkedIn !== b.checkedIn) return a.checkedIn ? -1 : 1
        if (a.time && b.time) return a.time - b.time
        return a.name.localeCompare(b.name)
      })

      viewModal = { session, rows }
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
      viewModal = null
    }
    viewLoading = false
  }

  function openMark(row) {
    const s = viewModal.session.start
    markTime  = `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`
    markModal = { row, session: viewModal.session }
  }

  async function confirmMark() {
    if (marking || !markTime) return
    marking = true
    try {
      const [h, m]  = markTime.split(':').map(Number)
      const date    = new Date(markModal.session.start)
      date.setHours(h, m, 0, 0)
      const ts = Timestamp.fromDate(date)
      await setDoc(
        doc(db, 'attendance', markModal.row.uid, 'sessions', markModal.session.id),
        { t: ts, p: 'manual' },
      )
      // Update row in place so the list re-renders
      markModal.row.checkedIn = true
      markModal.row.time = date
      // Re-sort
      viewModal.rows.sort((a, b) => {
        if (a.checkedIn !== b.checkedIn) return a.checkedIn ? -1 : 1
        if (a.time && b.time) return a.time - b.time
        return a.name.localeCompare(b.name)
      })
      markModal = null
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    marking = false
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

  <div class="flex items-center justify-between mb-6 mt-0">
    <button onclick={() => goto('/home')}>
      <AIcon path={mdiHome} size="36px" class="text-gray-500" />
    </button>
    <button
      class="flex items-center gap-2 bg-gray-800 text-white font-bold px-4 py-2 rounded shadow text-sm"
      onclick={() => goto('/attendance/admin/dashboard')}
    >
      <AIcon path={mdiMonitor} size="20px" />
      Today's Dashboard
    </button>
  </div>
  <div class="text-2xl font-bold mb-6">Attendance Sessions</div>

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
        <AIcon path={mdiRefresh} size="18px" />Regenerate
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
      <AIcon path={mdiRefresh} size="18px" />Generate Standard
    </button>
    <button
      class="bg-green-500 text-white font-bold px-3 py-1.5 rounded shadow text-sm flex items-center gap-1 disabled:opacity-50"
      onclick={() => { addForm = { date: '', trainingStart: '19:30', trainingEnd: '21:30', type: 'training', label: '', labelColor: 'purple', location: DEFAULT_LOCATION }; showAddModal = true }}
    >
      <AIcon path={mdiPlus} size="18px" />Add Custom
    </button>
    {#if sessions.length > 0}
      <button
        class="bg-gray-700 text-white font-bold px-3 py-1.5 rounded shadow text-sm flex items-center gap-1"
        onclick={printBook}
      >
        <AIcon path={mdiPrinter} size="18px" />Print Book
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
            <div class="flex items-center gap-2">
              <div class="font-bold">{fmtDate(session.start)}</div>
              {#if session.type === 'event'}
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">Event</span>
              {/if}
            </div>
            <div class="text-sm text-gray-500">{fmtTime(displayStart(session))} – {fmtTime(displayEnd(session))}</div>
            {#if session.type !== 'event'}
              <div class="font-mono text-xs text-gray-400 mt-0.5">passcode: {session.passcode}</div>
            {/if}
            <div class="mt-1.5 flex items-center gap-1.5">
              {#if editingLabel === session.id}
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1">
                    <input
                      class="border rounded px-2 py-0.5 text-xs w-36"
                      bind:value={labelInput}
                      onkeydown={e => { if (e.key === 'Enter') saveLabel(session); if (e.key === 'Escape') editingLabel = null }}
                      use:focusEl
                    />
                    <button class="text-green-600 p-0.5" onclick={() => saveLabel(session)}>
                      <AIcon path={mdiCheck} size="14px" />
                    </button>
                    <button class="text-gray-400 p-0.5" onclick={() => editingLabel = null}>
                      <AIcon path={mdiClose} size="14px" />
                    </button>
                  </div>
                  <div class="flex gap-1">
                    {#each COLORS as c}
                      <button
                        class="w-4 h-4 rounded-full {c.swatch} {labelColorInput === c.key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}"
                        onclick={() => labelColorInput = c.key}
                        aria-label={c.key}
                      ></button>
                    {/each}
                  </div>
                </div>
              {:else if session.label}
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full {labelTw(session.color)}">{session.label}</span>
                <button class="text-gray-300 hover:text-gray-500 p-0.5" onclick={() => startEditLabel(session)}>
                  <AIcon path={mdiPencil} size="12px" />
                </button>
              {:else}
                <button class="text-xs text-gray-300 hover:text-gray-500 flex items-center gap-0.5" onclick={() => startEditLabel(session)}>
                  <AIcon path={mdiPencil} size="12px" />label
                </button>
              {/if}
            </div>
            <!-- Location -->
            <div class="mt-1 flex items-center gap-1 min-w-0">
              {#if editingLocation === session.id}
                <input
                  class="border rounded px-2 py-0.5 text-xs grow min-w-0"
                  bind:value={locationInput}
                  onkeydown={e => { if (e.key === 'Enter') saveLocation(session); if (e.key === 'Escape') editingLocation = null }}
                  use:focusEl
                />
                <button class="text-green-600 p-0.5 shrink-0" onclick={() => saveLocation(session)}>
                  <AIcon path={mdiCheck} size="14px" />
                </button>
                <button class="text-gray-400 p-0.5 shrink-0" onclick={() => editingLocation = null}>
                  <AIcon path={mdiClose} size="14px" />
                </button>
              {:else if session.location}
                <span class="text-xs text-gray-400 truncate">{session.location}</span>
                <button class="text-gray-300 hover:text-gray-500 p-0.5 shrink-0" onclick={() => startEditLocation(session)}>
                  <AIcon path={mdiPencil} size="12px" />
                </button>
              {:else}
                <button class="text-xs text-gray-300 hover:text-gray-500 flex items-center gap-0.5" onclick={() => startEditLocation(session)}>
                  <AIcon path={mdiPencil} size="12px" />location
                </button>
              {/if}
            </div>
          </div>
          {#if session.type !== 'event'}
            <button class="text-green-600 p-1 shrink-0" onclick={() => openView(session)} title="View attendance">
              <AIcon path={mdiAccountMultiple} />
            </button>
            <button class="text-indigo-500 p-1 shrink-0" onclick={() => openQR(session)} title="QR Code">
              <AIcon path={mdiQrcode} />
            </button>
          {/if}
          <button class="text-red-400 p-1 shrink-0" onclick={() => deleteSession(session)}>
            <AIcon path={mdiDelete} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Session Attendance Modal -->
{#if viewModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-md flex flex-col" style="max-height:90vh">
      <div class="p-4 border-b">
        <div class="font-bold text-xl">{fmtDate(viewModal.session.start)}</div>
        <div class="text-sm text-gray-500">{fmtTime(viewModal.session.start)} – {fmtTime(viewModal.session.end)}</div>
      </div>

      {#if viewLoading}
        <div class="p-8 text-center text-gray-400">Loading...</div>
      {:else}
        {@const attended = viewModal.rows.filter(r => r.checkedIn).length}
        <div class="px-4 py-2 text-sm text-gray-500 border-b">
          {attended} / {viewModal.rows.length} checked in
        </div>
        <div class="overflow-y-auto grow">
          {#each viewModal.rows as row}
            <div class="flex items-center px-4 py-2.5 border-b border-gray-50 last:border-0">
              <button
                class="w-6 h-6 rounded-full flex items-center justify-center mr-3 shrink-0 transition-colors"
                class:bg-green-100={row.checkedIn && row.member}
                class:bg-yellow-100={row.checkedIn && !row.member}
                class:bg-gray-100={!row.checkedIn}
                class:cursor-default={row.checkedIn}
                class:hover:bg-gray-200={!row.checkedIn}
                onclick={() => !row.checkedIn && openMark(row)}
                title={row.checkedIn ? (row.member ? '' : 'Non-member') : 'Mark as attended'}
              >
                {#if row.checkedIn}
                  <AIcon path={mdiCheck} size="16px" class={row.member ? 'text-green-500' : 'text-yellow-500'} />
                {/if}
              </button>
              <div class="grow font-medium text-sm">{row.name}</div>
              {#if row.time}
                <div class="text-xs text-gray-400 shrink-0">{fmtTime(row.time)}</div>
              {:else}
                <div class="text-xs text-gray-300 shrink-0">absent</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="p-4 border-t flex justify-end">
        <button class="px-4 py-1.5 rounded border font-bold" onclick={() => viewModal = null}>Close</button>
      </div>
    </div>
  </div>
{/if}

<!-- Manual Mark Modal -->
{#if markModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-sm">
      <div class="p-4 border-b font-bold text-xl">Mark Attendance</div>
      <div class="p-4 flex flex-col gap-3">
        <div class="text-sm text-gray-600">
          Manually marking <span class="font-bold text-gray-800">{markModal.row.name}</span> as attended for
          <span class="font-bold text-gray-800">{fmtDate(markModal.session.start)}</span>.
        </div>
        <div class="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-700">
          This cannot be undone. Only mark if you are sure this person attended.
        </div>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Check-in time</span>
          <input type="time" class="border rounded px-2 py-1.5" bind:value={markTime} />
        </label>
      </div>
      <div class="p-4 border-t flex justify-end gap-2">
        <button class="px-4 py-1.5 rounded border font-bold" onclick={() => markModal = null}>Cancel</button>
        <button
          class="px-4 py-1.5 rounded bg-green-500 text-white font-bold disabled:opacity-50 flex items-center gap-1"
          onclick={confirmMark}
          disabled={marking || !markTime}
        >
          <AIcon path={mdiCheck} size="18px" />{marking ? 'Saving...' : 'Confirm'}
        </button>
      </div>
    </div>
  </div>
{/if}

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
          <AIcon path={mdiQrcode} size="18px" />Download
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
        <!-- Type toggle -->
        <div class="flex rounded border overflow-hidden text-sm font-bold">
          <button
            class="flex-1 py-1.5 transition-colors {addForm.type === 'training' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}"
            onclick={() => { addForm.type = 'training'; if (!addForm.location) addForm.location = DEFAULT_LOCATION }}
          >Training</button>
          <button
            class="flex-1 py-1.5 transition-colors {addForm.type === 'event' ? 'bg-sky-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}"
            onclick={() => { addForm.type = 'event'; if (addForm.location === DEFAULT_LOCATION) addForm.location = '' }}
          >Event</button>
        </div>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Date</span>
          <input type="date" class="border rounded px-2 py-1.5" bind:value={addForm.date} />
        </label>
        <div class="flex gap-3">
          <label class="flex flex-col grow">
            <span class="font-bold text-sm mb-1">{addForm.type === 'event' ? 'Start' : 'Training Start'}</span>
            <input type="time" class="border rounded px-2 py-1.5" bind:value={addForm.trainingStart} />
          </label>
          <label class="flex flex-col grow">
            <span class="font-bold text-sm mb-1">{addForm.type === 'event' ? 'End' : 'Training End'}</span>
            <input type="time" class="border rounded px-2 py-1.5" bind:value={addForm.trainingEnd} />
          </label>
        </div>
        {#if addForm.type === 'training'}
          <p class="text-xs text-gray-400 -mt-2">QR window is ±30 min around training time</p>
        {/if}
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Label <span class="font-normal text-gray-400">(optional)</span></span>
          <input
            class="border rounded px-2 py-1.5 text-sm"
            placeholder={addForm.type === 'event' ? 'e.g. Grading, Seminar' : 'e.g. Bokuto Waza'}
            bind:value={addForm.label}
          />
        </label>
        {#if addForm.label.trim()}
          <div class="flex gap-1.5 -mt-2">
            {#each COLORS as c}
              <button
                class="w-5 h-5 rounded-full {c.swatch} {addForm.labelColor === c.key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}"
                onclick={() => addForm.labelColor = c.key}
                aria-label={c.key}
              ></button>
            {/each}
          </div>
        {/if}
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Location <span class="font-normal text-gray-400">(optional)</span></span>
          <input
            class="border rounded px-2 py-1.5 text-sm"
            placeholder="Venue"
            bind:value={addForm.location}
          />
        </label>
      </div>
      <div class="p-4 border-t flex justify-end gap-2">
        <button class="px-4 py-1.5 rounded border font-bold" onclick={() => showAddModal = false}>Cancel</button>
        <button
          class="px-4 py-1.5 rounded bg-blue-500 text-white font-bold disabled:opacity-50"
          onclick={saveCustomSession} disabled={savingSession || !addForm.date || !addForm.trainingStart || !addForm.trainingEnd}
        >{savingSession ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  </div>
{/if}
