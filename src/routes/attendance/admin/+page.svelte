<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import {
    mdiHome, mdiPlus, mdiUpload, mdiDownload, mdiContentSave,
    mdiChevronLeft, mdiChevronRight
  } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'
  import Swal from 'sweetalert2'

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const now = new Date()
  let selectedYear  = $state(now.getFullYear())
  let selectedMonth = $state(now.getMonth()) // 0-indexed

  let trainingDates = $state([])  // 'YYYY/MM/DD' strings
  let rows          = $state([])  // { name, userId, data: Record<string,0|1>, locked }
  let allUsers      = $state([])  // { uid, name } — for name matching

  let loaded  = $state(false)
  let loading = $state(false)
  let saving  = $state(false)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getTrainingDates(year, month) {
    const dates = []
    const d = new Date(year, month, 1)
    while (d.getMonth() === month) {
      if ([1, 3, 5].includes(d.getDay())) { // Mon, Wed, Fri
        const y  = d.getFullYear()
        const m  = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        dates.push(`${y}/${m}/${dd}`)
      }
      d.setDate(d.getDate() + 1)
    }
    return dates
  }

  function formatHeader(dateStr) {
    const [y, m, d] = dateStr.split('/').map(Number)
    const date = new Date(y, m - 1, d)
    return { day: DAY_ABBR[date.getDay()], date: d }
  }

  function matchUser(name) {
    return allUsers.find(
      u => u.name.trim().toLowerCase() === name.trim().toLowerCase()
    )?.uid ?? null
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadMonth() {
    loading = true
    trainingDates = getTrainingDates(selectedYear, selectedMonth)
    try {
      const snap = await getDocs(collection(db, 'attendance'))
      const newRows = []
      snap.forEach(docSnap => {
        const data = docSnap.data()
        const monthData = Object.fromEntries(
          trainingDates.map(date => [date, data.data?.[date] ?? 0])
        )
        newRows.push({
          name:   docSnap.id,
          userId: data.userId ?? null,
          data:   monthData,
          locked: true,
        })
      })
      rows   = newRows
      loaded = true
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    loading = false
  }

  // ── Month navigation ───────────────────────────────────────────────────────

  async function prevMonth() {
    if (selectedMonth === 0) { selectedMonth = 11; selectedYear-- }
    else selectedMonth--
    await loadMonth()
  }

  async function nextMonth() {
    if (selectedMonth === 11) { selectedMonth = 0; selectedYear++ }
    else selectedMonth++
    await loadMonth()
  }

  // ── Table interactions ─────────────────────────────────────────────────────

  function toggle(row, date) {
    row.data[date] = row.data[date] ? 0 : 1
  }

  function addRow() {
    const emptyData = Object.fromEntries(trainingDates.map(d => [d, 0]))
    rows.push({ name: '', userId: null, data: emptyData, locked: false })
  }

  function onNameInput(row) {
    if (row.name.trim()) row.userId = matchUser(row.name)
  }

  // ── CSV import ─────────────────────────────────────────────────────────────

  function importCSV() {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.csv,text/csv'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const text  = await file.text()
      const lines = text.trim().split('\n')
      let imported = 0
      for (const line of lines) {
        const parts  = line.split(',').map(s => s.trim())
        const name   = parts[0]
        if (!name) continue
        const values = parts.slice(1).map(v => (parseInt(v) >= 1 ? 1 : 0))
        const data   = Object.fromEntries(
          trainingDates.map((d, i) => [d, values[i] ?? 0])
        )
        const existing = rows.find(
          r => r.name.trim().toLowerCase() === name.toLowerCase()
        )
        if (existing) {
          Object.assign(existing.data, data)
          if (!existing.userId) existing.userId = matchUser(name)
        } else {
          rows.push({ name, userId: matchUser(name), data, locked: false })
        }
        imported++
      }
      Swal.fire('Imported', `${imported} row${imported !== 1 ? 's' : ''} processed`, 'success')
    }
    input.click()
  }

  // ── CSV template download ──────────────────────────────────────────────────

  function downloadTemplate() {
    const header   = ['Name', ...trainingDates].join(',')
    const dataRows = rows.map(r =>
      [r.name, ...trainingDates.map(d => r.data[d] ?? 0)].join(',')
    )
    const csv  = [header, ...dataRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `Attendance ${MONTH_NAMES[selectedMonth]} ${selectedYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save() {
    if (saving) return
    saving = true
    try {
      for (const row of rows) {
        if (!row.name.trim()) continue
        const docRef  = doc(db, 'attendance', row.name.trim())
        const existing = await getDoc(docRef)
        const existingData = existing.exists() ? (existing.data().data ?? {}) : {}
        await setDoc(docRef, {
          userId: row.userId ?? null,
          data:   { ...existingData, ...row.data },
        })
      }
      Swal.fire('Saved!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    saving = false
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  onMount(async () => {
    if (!$userProfile?.permissions?.includes('attendance')) {
      goto('/home')
      return
    }
    const snap = await getDocs(collection(db, 'user'))
    snap.forEach(d => allUsers.push({ uid: d.id, name: d.data().name }))
    await loadMonth()
  })
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <!-- Top bar -->
  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>
  <div class="text-2xl font-bold my-4">Attendance</div>

  <!-- Controls -->
  <div class="flex items-center flex-wrap gap-2 mb-4">

    <!-- Month navigator -->
    <div class="flex items-center bg-white rounded shadow px-1 py-1">
      <button
        class="text-gray-600 hover:text-gray-900 disabled:opacity-40 p-1"
        onclick={prevMonth}
        disabled={loading}
      >
        <AIcon path={mdiChevronLeft} />
      </button>
      <span class="font-bold mx-2 w-44 text-center">
        {MONTH_NAMES[selectedMonth]} {selectedYear}
      </span>
      <button
        class="text-gray-600 hover:text-gray-900 disabled:opacity-40 p-1"
        onclick={nextMonth}
        disabled={loading}
      >
        <AIcon path={mdiChevronRight} />
      </button>
    </div>

    {#if loaded && !loading}
      <button
        class="bg-purple-500 text-white font-bold px-3 py-1 rounded shadow flex items-center"
        onclick={importCSV}
      >
        <AIcon path={mdiUpload} class="mr-1" />Import CSV
      </button>
      <button
        class="bg-gray-500 text-white font-bold px-3 py-1 rounded shadow flex items-center"
        onclick={downloadTemplate}
      >
        <AIcon path={mdiDownload} class="mr-1" />Template
      </button>
      <button
        class="bg-green-500 text-white font-bold px-3 py-1 rounded shadow flex items-center"
        onclick={addRow}
      >
        <AIcon path={mdiPlus} class="mr-1" />Add Row
      </button>
      <div class="grow"></div>
      <button
        class="bg-blue-600 text-white font-bold px-3 py-1 rounded shadow flex items-center disabled:opacity-50"
        onclick={save}
        disabled={saving}
      >
        <AIcon path={mdiContentSave} class="mr-1" />
        {saving ? 'Saving...' : 'Save'}
      </button>
    {/if}
  </div>

  <!-- Table -->
  {#if loading}
    <div class="text-gray-500 mt-8 text-center">Loading...</div>
  {:else if loaded}
    <div class="overflow-x-auto rounded shadow">
      <table class="border-collapse bg-white text-sm w-max">
        <thead>
          <tr>
            <th class="sticky left-0 z-10 bg-gray-200 px-4 py-2 text-left font-bold border-r border-gray-300 min-w-52">
              Name
            </th>
            {#each trainingDates as date}
              {@const h = formatHeader(date)}
              <th class="bg-gray-200 px-2 py-1 text-center font-semibold border-r border-gray-300 min-w-14">
                <div class="text-xs text-gray-500 font-normal">{h.day}</div>
                <div>{h.date}</div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr class="border-t border-gray-100 hover:bg-gray-50">

              <!-- Name cell -->
              <td class="sticky left-0 z-10 bg-white px-3 py-1.5 border-r border-gray-200 hover:bg-gray-50">
                {#if row.locked}
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{row.name}</span>
                    {#if row.userId}
                      <span class="text-xs text-green-700 bg-green-100 px-1.5 rounded-full">linked</span>
                    {:else}
                      <span class="text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full">unlinked</span>
                    {/if}
                  </div>
                {:else}
                  <input
                    class="border rounded px-2 py-0.5 w-full text-sm"
                    placeholder="Enter name..."
                    bind:value={row.name}
                    oninput={() => onNameInput(row)}
                  />
                {/if}
              </td>

              <!-- Attendance cells -->
              {#each trainingDates as date}
                <td
                  class="text-center border-r border-gray-100 cursor-pointer select-none transition-colors"
                  class:bg-green-400={row.data[date]}
                  class:text-white={row.data[date]}
                  class:hover:bg-green-300={row.data[date]}
                  class:hover:bg-green-50={!row.data[date]}
                  onclick={() => toggle(row, date)}
                >
                  <div class="py-2 px-2 font-bold">
                    {row.data[date] ? '✓' : ''}
                  </div>
                </td>
              {/each}
            </tr>
          {/each}

          {#if rows.length === 0}
            <tr>
              <td
                colspan={trainingDates.length + 1}
                class="text-center py-8 text-gray-400"
              >
                No data yet. Add a row or import a CSV.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
      <div class="flex items-center gap-1">
        <div class="w-4 h-4 rounded bg-green-400"></div>
        Present
      </div>
      <div class="flex items-center gap-1">
        <div class="w-4 h-4 rounded border border-gray-300"></div>
        Absent
      </div>
      <div class="flex items-center gap-1">
        <span class="text-green-700 bg-green-100 px-1.5 rounded-full">linked</span>
        Name matched to an app user
      </div>
    </div>
  {/if}
</div>
