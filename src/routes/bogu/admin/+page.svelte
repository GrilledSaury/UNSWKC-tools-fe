<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import {
    collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome, mdiPlus, mdiPencil, mdiDelete, mdiCheck, mdiClose } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'
  import Swal from 'sweetalert2'

  // ── State ──────────────────────────────────────────────────────────────────

  const PIECES = ['Men', 'Kote', 'Do', 'Tare', 'Shinai Bag', 'Bogu Bag']
  const emptyItem = () => ({ men: false, kote: false, do: false, tare: false, 'shinai bag': false, 'bogu bag': false })

  let entries       = $state([])   // { id, name, userId, item, note, score }
  let users         = $state([])   // { uid, name } sorted by name
  let attendanceMap = {}           // userId → { sessionId → data }
  let loading  = $state(true)

  // modal
  let showModal  = $state(false)
  let modalMode  = $state('add')  // 'add' | 'edit'
  let editEntry  = $state({ id: null, userId: '', item: emptyItem(), note: '' })
  let saving     = $state(false)

  function anyItemChecked() {
    return Object.values(editEntry.item).some(Boolean)
  }

  function itemLabels(item) {
    return PIECES.filter(p => item[p.toLowerCase()])
  }

  // ── Attendance helpers ─────────────────────────────────────────────────────

  const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  // Returns the last N Mon/Wed/Fri session keys as 'YYYY-MM-DD-DayAbbr', newest-first
  function lastNTrainingDates(n) {
    const dates = []
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    while (dates.length < n) {
      const day = d.getDay()
      if ([1, 3, 5].includes(day)) {
        const y  = d.getFullYear()
        const m  = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${dd}-${DAY_ABBR[day]}`)
      }
      d.setDate(d.getDate() - 1)
    }
    return dates  // newest first
  }

  const LAST_12 = lastNTrainingDates(12)  // last 4 weeks = 12 sessions

  // Field existence = attended; no field = absent
  function attendanceScore(data) {
    if (!data) return 0
    return LAST_12.reduce((sum, key) => sum + (data[key] != null ? 1 : 0), 0)
  }

  // 0–12 → colour from red → yellow → green
  function scoreColor(score) {
    const pct = score / 12
    if (pct < 0.33) return '#ef4444'  // red-500
    if (pct < 0.67) return '#eab308'  // yellow-500
    return '#22c55e'                   // green-500
  }

  function scoreLabel(score) {
    return `${score} / 12 sessions attended`
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  onMount(async () => {
    if (!$userProfile?.permissions?.includes('bogu')) {
      goto('/home')
      return
    }
    await load()
  })

  async function load() {
    loading = true
    try {
      const [boguSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'bogu')),
        getDocs(collection(db, 'user')),
      ])

      users = usersSnap.docs
        .map(d => ({ uid: d.id, name: d.data().name }))
        .sort((a, b) => a.name.localeCompare(b.name))

      // Collect unique userIds to fetch attendance subcollections in parallel
      const userIds = [...new Set(
        boguSnap.docs.map(d => d.data().userId).filter(Boolean)
      )]
      const attSnaps = await Promise.all(
        userIds.map(uid => getDocs(collection(db, 'attendance', uid, 'sessions')))
      )
      attSnaps.forEach((snap, i) => {
        attendanceMap[userIds[i]] = {}
        snap.forEach(d => { attendanceMap[userIds[i]][d.id] = d.data() })
      })

      const list = []
      boguSnap.forEach(d => {
        const data  = d.data()
        const item  = (data.item && typeof data.item === 'object') ? data.item : emptyItem()
        const score = attendanceScore(data.userId ? attendanceMap[data.userId] : null)
        list.push({ id: d.id, name: data.name, userId: data.userId ?? null, item, note: data.note, score })
      })
      entries = list
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    loading = false
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  function openAdd() {
    editEntry = { id: null, userId: '', item: emptyItem(), note: '' }
    modalMode = 'add'
    showModal = true
  }

  function openEdit(entry) {
    editEntry = { id: entry.id, userId: entry.userId ?? '', item: { ...entry.item }, note: entry.note ?? '' }
    modalMode = 'edit'
    showModal = true
  }

  async function submitModal() {
    if (!editEntry.userId || !anyItemChecked()) return
    if (saving) return
    saving = true
    try {
      const selectedUser = users.find(u => u.uid === editEntry.userId)
      const payload = {
        name:   selectedUser.name,
        userId: editEntry.userId,
        item:   { ...editEntry.item },
        note:   editEntry.note.trim(),
      }
      if (modalMode === 'add') {
        // Fetch attendance for this user if not already loaded
        if (!(editEntry.userId in attendanceMap)) {
          const attSnap = await getDocs(collection(db, 'attendance', editEntry.userId, 'sessions'))
          attendanceMap[editEntry.userId] = {}
          attSnap.forEach(d => { attendanceMap[editEntry.userId][d.id] = d.data() })
        }
        const score = attendanceScore(attendanceMap[editEntry.userId])
        const ref = await addDoc(collection(db, 'bogu'), payload)
        entries.push({ id: ref.id, ...payload, score })
      } else {
        await updateDoc(doc(db, 'bogu', editEntry.id), payload)
        const idx = entries.findIndex(e => e.id === editEntry.id)
        if (idx !== -1) Object.assign(entries[idx], payload)
      }
      showModal = false
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    saving = false
  }

  async function deleteEntry(entry) {
    const { isConfirmed } = await Swal.fire({
      title: 'Delete this entry?',
      text: `${entry.name} — ${itemLabels(entry.item).join(', ')}`,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444',
      showCancelButton: true,
    })
    if (!isConfirmed) return
    try {
      await deleteDoc(doc(db, 'bogu', entry.id))
      entries = entries.filter(e => e.id !== entry.id)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <!-- Header -->
  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>
  <div class="flex items-center mt-4 mb-6">
    <div class="text-2xl font-bold">Bogu Log</div>
    <div class="grow"></div>
    <button
      class="bg-green-500 text-white font-bold px-3 py-1.5 rounded shadow flex items-center"
      onclick={openAdd}
    >
      <AIcon path={mdiPlus} class="mr-1" />Add Entry
    </button>
  </div>

  {#if loading}
    <div class="text-gray-500 text-center mt-16">Loading...</div>

  {:else if entries.length === 0}
    <div class="text-gray-400 text-center mt-16">No entries yet.</div>

  {:else}
    <!-- Attendance period label -->
    <div class="text-xs text-gray-400 mb-3">
      Attendance: last 12 sessions (Mon/Wed/Fri) — {LAST_12[LAST_12.length - 1].replaceAll('/', '-')} → {LAST_12[0].replaceAll('/', '-')}
    </div>

    <!-- Cards -->
    <div class="flex flex-col gap-3">
      {#each entries as entry}
        <div class="bg-white rounded shadow px-4 py-3 flex items-center gap-4">

          <!-- Left: name + item + note -->
          <div class="grow min-w-0">
            <div class="font-bold text-gray-800">{entry.name}</div>
            <div class="flex flex-wrap gap-1 mt-1">
              {#each PIECES as piece}
                <span class="text-xs px-2 py-0.5 rounded-full font-medium
                  {entry.item[piece.toLowerCase()]
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-300 line-through'}">
                  {piece}
                </span>
              {/each}
            </div>
            {#if entry.note}
              <div class="text-xs text-gray-400 mt-1">{entry.note}</div>
            {/if}
          </div>

          <!-- Centre: attendance bar -->
          <div class="w-32 shrink-0">
            <div class="flex justify-between text-xs text-gray-400 mb-1">
              <span>Attendance</span>
              <span>{entry.score}/12</span>
            </div>
            <div class="h-2.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                style="width: {(entry.score / 12) * 100}%; background: {scoreColor(entry.score)}"
              ></div>
            </div>
            <div class="text-xs mt-1" style="color: {scoreColor(entry.score)}">
              {#if entry.score === 0}
                No recent attendance
              {:else if entry.score < 4}
                Low
              {:else if entry.score < 8}
                Moderate
              {:else}
                Active
              {/if}
            </div>
          </div>

          <!-- Right: actions -->
          <div class="flex items-center gap-1 shrink-0">
            <button class="text-blue-500 p-1" onclick={() => openEdit(entry)}>
              <AIcon path={mdiPencil} />
            </button>
            <button class="text-red-400 p-1" onclick={() => deleteEntry(entry)}>
              <AIcon path={mdiDelete} />
            </button>
          </div>

        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-md flex flex-col">
      <div class="p-4 font-bold text-xl border-b">
        {modalMode === 'add' ? 'Add Entry' : 'Edit Entry'}
      </div>
      <div class="p-4 flex flex-col gap-4">
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Member <span class="text-red-400">*</span></span>
          <select class="border rounded px-2 py-1.5 bg-white" bind:value={editEntry.userId}>
            <option value="">Select a member…</option>
            {#each users as user}
              <option value={user.uid}>{user.name}</option>
            {/each}
          </select>
        </label>
        <div class="flex flex-col">
          <span class="font-bold text-sm mb-2">Items <span class="text-red-400">*</span></span>
          <div class="flex gap-3 flex-wrap">
            {#each PIECES as piece}
              <label class="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  class="w-4 h-4 accent-indigo-600"
                  bind:checked={editEntry.item[piece.toLowerCase()]}
                />
                <span class="text-sm font-medium">{piece}</span>
              </label>
            {/each}
          </div>
        </div>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Note</span>
          <input
            class="border rounded px-2 py-1.5"
            placeholder="Optional notes"
            bind:value={editEntry.note}
          />
        </label>
      </div>
      <div class="p-4 border-t flex justify-end gap-2">
        <button
          class="px-4 py-1.5 rounded border font-bold flex items-center gap-1"
          onclick={() => showModal = false}
        >
          <AIcon path={mdiClose} size="18" />Cancel
        </button>
        <button
          class="px-4 py-1.5 rounded bg-blue-500 text-white font-bold flex items-center gap-1 disabled:opacity-50"
          onclick={submitModal}
          disabled={saving || !editEntry.userId || !anyItemChecked()}
        >
          <AIcon path={mdiCheck} size="18" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}
