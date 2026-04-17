<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome, mdiChevronLeft, mdiChevronRight } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAY_ABBR    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const DAY_FULL    = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
  // Cell size 14px + gap 2px = 16px per column
  const CELL = 14
  const GAP  = 2
  const COL  = CELL + GAP

  const currentYear = new Date().getFullYear()
  let selectedYear  = $state(currentYear)
  let sessionMap    = $state({})   // 'YYYY-MM-DD' → { id, start, end, attended, checkinTime }
  let attendedMap   = {}           // sessionId → checkinTime (Date|null), all years
  let loading       = $state(true)
  let loadingYear   = $state(false)

  function dateKey(d) {
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  // Weeks for the year, Mon-Sun rows, newest week last
  function buildWeeks(year) {
    const jan1  = new Date(year, 0, 1)
    const dec31 = new Date(year, 11, 31)
    const dow   = jan1.getDay()            // 0=Sun,1=Mon,...
    const offset = dow === 0 ? -6 : 1 - dow
    const start  = new Date(jan1)
    start.setDate(start.getDate() + offset)

    const weeks = []
    const d = new Date(start)
    while (d <= dec31) {
      const week = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(d))
        d.setDate(d.getDate() + 1)
      }
      weeks.push(week)
    }
    return weeks
  }

  // Month label positions keyed by week-column index
  function monthLabels(weeks, year) {
    const labels  = []
    let lastMonth = -1
    weeks.forEach((week, i) => {
      const inYear = week.find(d => d.getFullYear() === year)
      if (!inYear) return
      const m = inYear.getMonth()
      if (m !== lastMonth) {
        labels.push({ name: MONTH_NAMES[m], col: i })
        lastMonth = m
      }
    })
    return labels
  }

  async function loadAttended() {
    const snap = await getDocs(collection(db, 'attendance', $userProfile.uid, 'sessions'))
    snap.forEach(d => {
      attendedMap[d.id] = d.data().t?.toDate() ?? null
    })
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
      const key   = dateKey(start)
      map[key] = {
        id:          d.id,
        start,
        end:         data.end.toDate(),
        attended:    d.id in attendedMap,
        checkinTime: attendedMap[d.id] ?? null,
      }
    })
    sessionMap = map
  }

  onMount(async () => {
    await loadAttended()
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
    return s.attended ? 'attended' : 'missed'
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

  // Sessions sorted newest-first, only past ones
  let sessionList = $derived(
    Object.values(sessionMap)
      .filter(s => s.start <= new Date())
      .sort((a, b) => b.start - a.start)
  )

  // Day label column width (px) — keep in sync with template ml
  const DAY_COL = 32
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>
  <div class="text-2xl font-bold mt-4 mb-6">My Attendance</div>

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
      {#if !loadingYear }
        <span class="text-sm text-gray-500 ml-2">
          {totalAttended} sessions attended
        </span>
      {:else if loadingYear}
        <span class="text-sm text-gray-400 ml-2">Loading…</span>
      {/if}
    </div>

    <!-- Heatmap -->
    <div class="bg-white rounded shadow p-4 overflow-x-auto lg:inline-block">
      <!-- Month labels (absolutely positioned over columns) -->
      <div class="relative mb-1" style="margin-left:{DAY_COL}px; height:16px;">
        {#each labels as label}
          <span
            class="absolute text-xs text-gray-400 whitespace-nowrap"
            style="left:{label.col * COL}px"
          >{label.name}</span>
        {/each}
      </div>

      <!-- Grid -->
      <div class="flex" style="gap:{GAP}px;">
        <!-- Day labels -->
        <div class="flex flex-col shrink-0" style="gap:{GAP}px; width:{DAY_COL - GAP}px; margin-right:{GAP}px;">
          {#each DAY_ABBR as day}
            <div
              class="text-xs text-gray-400 flex items-center justify-end pr-1"
              style="height:{CELL}px;"
            >{day}</div>
          {/each}
        </div>

        <!-- Week columns -->
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
                title="{state !== 'outside' ? dateKey(date) + (state === 'attended' ? ' ✓' : state === 'missed' ? ' ✗' : '') : ''}"
              ></div>
            {/each}
          </div>
        {/each}
      </div>

      <!-- Legend -->
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
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 {s.attended ? 'bg-green-100' : 'bg-gray-100'}"
            >
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
