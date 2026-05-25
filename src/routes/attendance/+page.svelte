<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome, mdiChevronLeft, mdiChevronRight } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { userProfile } from '$lib/stores'

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAY_ABBR    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const DAY_FULL    = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
  const CELL = 14
  const GAP  = 2
  const COL  = CELL + GAP
  const DAY_COL = 32

  const currentYear = new Date().getFullYear()
  let selectedYear  = $state(currentYear)
  let sessionMap    = $state({})
  let attendedMap   = {}
  let loading       = $state(true)
  let loadingYear   = $state(false)

  // Admin user search
  const isAdmin    = $userProfile?.permissions?.includes('attendance')
  let allUsers     = $state([])   // { uid, name } — only populated for admins
  let userSearch   = $state('')
  let showDropdown = $state(false)

  // The uid being viewed
  let viewUid  = $state($userProfile.uid)
  let viewName = $state($userProfile.name)

  let filteredUsers = $derived(
    userSearch.trim()
      ? allUsers.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()))
      : allUsers
  )

  function dateKey(d) {
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  function buildWeeks(year) {
    const jan1  = new Date(year, 0, 1)
    const dec31 = new Date(year, 11, 31)
    const dow   = jan1.getDay()
    const offset = dow === 0 ? -6 : 1 - dow
    const start  = new Date(jan1)
    start.setDate(start.getDate() + offset)
    const weeks = []
    const d = new Date(start)
    while (d <= dec31) {
      const week = []
      for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1) }
      weeks.push(week)
    }
    return weeks
  }

  function monthLabels(weeks, year) {
    const labels  = []
    let lastMonth = -1
    weeks.forEach((week, i) => {
      const inYear = week.find(d => d.getFullYear() === year)
      if (!inYear) return
      const m = inYear.getMonth()
      if (m !== lastMonth) { labels.push({ name: MONTH_NAMES[m], col: i }); lastMonth = m }
    })
    return labels
  }

  async function loadAttended(uid) {
    attendedMap = {}
    const snap = await getDocs(collection(db, 'attendance', uid, 'sessions'))
    snap.forEach(d => { attendedMap[d.id] = d.data().t?.toDate() ?? null })
  }

  async function loadYear(year) {
    const yearStart = Timestamp.fromDate(new Date(year, 0, 1))
    const yearEnd   = Timestamp.fromDate(new Date(year + 1, 0, 1))
    const snap = await getDocs(
      query(collection(db, 'session'), where('start', '>=', yearStart), where('start', '<', yearEnd))
    )
    const map = {}
    snap.forEach(d => {
      const data  = d.data()
      const start = data.start.toDate()
      map[dateKey(start)] = {
        id:          d.id,
        start,
        end:         data.end.toDate(),
        attended:    d.id in attendedMap,
        checkinTime: attendedMap[d.id] ?? null,
      }
    })
    sessionMap = map
  }

  async function switchUser(uid, name) {
    viewUid  = uid
    viewName = name
    userSearch   = ''
    showDropdown = false
    goto(`/attendance?userId=${uid}`, { replaceState: true })
    loading = true
    await loadAttended(uid)
    await loadYear(selectedYear)
    loading = false
  }

  onMount(async () => {
    const paramUid = $page.url.searchParams.get('userId')

    if (isAdmin) {
      const snap = await getDocs(collection(db, 'user'))
      allUsers = snap.docs
        .map(d => ({ uid: d.id, name: d.data().name }))
        .sort((a, b) => a.name.localeCompare(b.name))

      if (paramUid && paramUid !== $userProfile.uid) {
        const found = allUsers.find(u => u.uid === paramUid)
        if (found) { viewUid = found.uid; viewName = found.name }
      }
    }

    await loadAttended(viewUid)
    await loadYear(selectedYear)
    loading = false
  })

  async function selectYear(year) {
    if (year === selectedYear || loadingYear) return
    selectedYear = year
    loadingYear  = true
    await loadYear(year)
    loadingYear  = false
  }

  function cellState(date, year) {
    if (date.getFullYear() !== year) return 'outside'
    const s = sessionMap[dateKey(date)]
    if (!s) return 'none'
    return s.attended ? 'attended' : 'none'
  }

  function fmtTime(d) {
    if (!d) return ''
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }

  function dayLabel(sessionId) {
    const abbr = sessionId.split('-').at(-1)
    return DAY_FULL[abbr] ?? abbr
  }

  let weeks  = $derived(buildWeeks(selectedYear))
  let labels = $derived(monthLabels(weeks, selectedYear))
  let totalAttended = $derived(Object.values(sessionMap).filter(s => s.attended).length)
  let sessionList   = $derived(
    Object.values(sessionMap)
      .filter(s => s.start <= new Date())
      .sort((a, b) => b.start - a.start)
  )
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>

  <!-- Title + admin user search -->
  <div class="flex items-start gap-4 mt-4 mb-6 flex-wrap">
    <div class="text-2xl font-bold">
      {viewUid === $userProfile.uid ? 'My Attendance' : `${viewName}'s Attendance`}
    </div>

    {#if isAdmin}
      <div class="relative">
        <input
          class="border rounded px-3 py-1.5 text-sm w-52 bg-white shadow-sm"
          placeholder="Search member…"
          bind:value={userSearch}
          onfocus={() => showDropdown = true}
          onblur={() => setTimeout(() => showDropdown = false, 150)}
        />
        {#if showDropdown && filteredUsers.length > 0}
          <div class="absolute top-full mt-1 left-0 w-52 bg-white border rounded shadow-lg z-10 max-h-60 overflow-y-auto">
            {#each filteredUsers as u}
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 {u.uid === viewUid ? 'font-bold text-blue-600' : ''}"
                onmousedown={() => switchUser(u.uid, u.name)}
              >{u.name}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="text-gray-400 text-center mt-16">Loading...</div>
  {:else}

    <!-- Year selector + stats -->
    <div class="flex items-center gap-3 mb-4">
      <button
        class="text-gray-500 disabled:opacity-30"
        onclick={() => selectYear(selectedYear - 1)}
        disabled={loadingYear}
      >
        <AIcon path={mdiChevronLeft} size="24" />
      </button>
      <span class="font-bold text-xl w-16 text-center">{selectedYear}</span>
      <button
        class="text-gray-500 disabled:opacity-30"
        onclick={() => selectYear(selectedYear + 1)}
        disabled={loadingYear || selectedYear >= currentYear}
      >
        <AIcon path={mdiChevronRight} size="24" />
      </button>
      {#if !loadingYear}
        <span class="text-sm text-gray-500 ml-2">{totalAttended} sessions attended</span>
      {:else}
        <span class="text-sm text-gray-400 ml-2">Loading…</span>
      {/if}
    </div>

    <!-- Heatmap -->
    <div class="bg-white rounded shadow p-4 overflow-x-auto lg:inline-block">
      <div class="relative mb-1" style="margin-left:{DAY_COL}px; height:16px;">
        {#each labels as label}
          <span
            class="absolute text-xs text-gray-400 whitespace-nowrap"
            style="left:{label.col * COL}px"
          >{label.name}</span>
        {/each}
      </div>

      <div class="flex" style="gap:{GAP}px;">
        <div class="flex flex-col shrink-0" style="gap:{GAP}px; width:{DAY_COL - GAP}px; margin-right:{GAP}px;">
          {#each DAY_ABBR as day}
            <div class="text-xs text-gray-400 flex items-center justify-end pr-1" style="height:{CELL}px;">{day}</div>
          {/each}
        </div>

        {#each weeks as week}
          <div class="flex flex-col shrink-0" style="gap:{GAP}px;">
            {#each week as date}
              {@const state = cellState(date, selectedYear)}
              <div
                class="rounded-sm"
                style="width:{CELL}px; height:{CELL}px; background:{
                  state === 'outside'  ? 'transparent' :
                  state === 'attended' ? '#22c55e' :
                                        '#e5e7eb'
                };"
                title="{state !== 'outside' ? dateKey(date) + (state === 'attended' ? ' ✓' : '') : ''}"
              ></div>
            {/each}
          </div>
        {/each}
      </div>

      <div class="flex items-center gap-4 mt-3 text-xs text-gray-400" style="margin-left:{DAY_COL}px;">
        <div class="flex items-center gap-1">
          <div class="rounded-sm" style="width:{CELL}px;height:{CELL}px;background:#e5e7eb;"></div>
          <span>No / missed</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="rounded-sm" style="width:{CELL}px;height:{CELL}px;background:#22c55e;"></div>
          <span>Attended</span>
        </div>
      </div>
    </div>

    <!-- Session list -->
    {#if sessionList.length > 0}
      <div class="mt-6 flex flex-col gap-2 md:flex-row md:flex-wrap">
        {#each sessionList as s}
          <div class="bg-white rounded shadow-sm px-4 py-2.5 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 {s.attended ? 'bg-green-100' : 'bg-gray-100'}">
              <div class="w-2.5 h-2.5 rounded-full {s.attended ? 'bg-green-500' : 'bg-gray-300'}"></div>
            </div>
            <div class="grow min-w-0 whitespace-nowrap">
              <div class="font-medium text-sm">{dayLabel(s.id)}, {s.start.getDate()} {MONTH_NAMES[s.start.getMonth()]}</div>
              <div class="text-xs text-gray-400">{fmtTime(s.start)} – {fmtTime(s.end)}</div>
            </div>
            {#if s.attended && s.checkinTime}
              <div class="text-xs text-gray-400 shrink-0">checked in {fmtTime(s.checkinTime)}</div>
            {:else if !s.attended}
              <div class="text-xs text-gray-300 shrink-0">missed</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  {/if}
</div>
