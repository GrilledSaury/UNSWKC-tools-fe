<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome, mdiChevronLeft, mdiChevronRight, mdiRss, mdiContentCopy, mdiCheck } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const COLORS_MAP = {
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    pink:   'bg-pink-100 text-pink-700',
    teal:   'bg-teal-100 text-teal-700',
  }
  function labelTw(color)       { return COLORS_MAP[color] ?? 'bg-gray-100 text-gray-600' }
  function labelInitials(label) { return label.split(' ').map(w => w[0]).join('') }

  const now = new Date()
  const todayKey = dateKey(now)

  let selectedYear   = $state(now.getFullYear())
  let selectedMonth  = $state(now.getMonth())
  let sessionMap     = $state({})
  let loading        = $state(true)
  let showSubscribe  = $state(false)
  let copied         = $state(false)

  function icsUrl()    { return window.location.origin + '/api/calendar.ics' }
  function webcalUrl() { return icsUrl().replace(/^https?/, 'webcal') }

  async function copyIcsUrl() {
    await navigator.clipboard.writeText(icsUrl())
    copied = true
    setTimeout(() => copied = false, 2000)
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  function buildCalendar(year, month) {
    const firstDay = new Date(year, month, 1)
    const lastDay  = new Date(year, month + 1, 0)
    const startDow = (firstDay.getDay() + 6) % 7  // Mon=0 … Sun=6
    const days = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    while (days.length % 7 !== 0) days.push(null)
    const weeks = []
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i+7))
    return weeks
  }

  async function loadMonth(year, month) {
    loading = true
    const start = Timestamp.fromDate(new Date(year, month, 1))
    const end   = Timestamp.fromDate(new Date(year, month + 1, 1))
    const snap  = await getDocs(
      query(collection(db, 'session'), where('start', '>=', start), where('start', '<', end), orderBy('start'))
    )
    const map = {}
    snap.forEach(d => {
      const data = d.data()
      const s    = data.start.toDate()
      const e    = data.end.toDate()
      map[dateKey(s)] = {
        trainingStart: data.trainingStart?.toDate() ?? new Date(s.getTime() + 30*60*1000),
        trainingEnd:   data.trainingEnd?.toDate()   ?? new Date(e.getTime() - 30*60*1000),
        label: data.label ?? '',
        color: data.color ?? '',
        type:  data.type  ?? 'training',
      }
    })
    sessionMap = map
    loading    = false
  }

  function fmtTime(d) {
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }

  async function prevMonth() {
    if (selectedMonth === 0) { selectedMonth = 11; selectedYear-- } else selectedMonth--
    await loadMonth(selectedYear, selectedMonth)
  }
  async function nextMonth() {
    if (selectedMonth === 11) { selectedMonth = 0; selectedYear++ } else selectedMonth++
    await loadMonth(selectedYear, selectedMonth)
  }

  let weeks = $derived(buildCalendar(selectedYear, selectedMonth))
  let usedColors = $derived(
    [...new Set(Object.values(sessionMap).filter(s => s.label).map(s => ({ label: s.label, color: s.color })).map(JSON.stringify))].map(s => JSON.parse(s))
  )

  onMount(async () => {
    if (!$userProfile) { goto('/'); return }
    await loadMonth(selectedYear, selectedMonth)
  })
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36px" class="text-gray-500" />
  </button>

  <div class="flex items-center gap-2 mt-4 mb-4">
    <div class="text-2xl font-bold grow">Training Schedule</div>
    <div class="relative">
      <button
        class="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
        onclick={() => showSubscribe = !showSubscribe}
      >
        <AIcon path={mdiRss} size="18px" />Subscribe
      </button>
      {#if showSubscribe}
        <div class="absolute right-0 top-full mt-1 bg-white rounded shadow-lg border p-3 z-30 w-72">
          <div class="text-xs font-bold text-gray-500 mb-2">Calendar Subscription</div>
          <a
            href={webcalUrl()}
            class="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm px-3 py-1.5 rounded mb-2 transition-colors"
          >Open in Calendar App</a>
          <div class="flex items-center gap-1">
            <input
              readonly
              class="border rounded px-2 py-1 text-xs text-gray-500 bg-gray-50 grow min-w-0 font-mono"
              value={icsUrl()}
            />
            <button
              class="shrink-0 p-1.5 rounded border hover:bg-gray-50 transition-colors text-gray-500"
              onclick={copyIcsUrl}
              title="Copy URL"
            >
              <AIcon path={copied ? mdiCheck : mdiContentCopy} size="16px" class={copied ? 'text-green-500' : ''} />
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-1.5">Paste the URL into Google Calendar → "Add by URL"</p>
        </div>
      {/if}
    </div>
    <button class="text-gray-500 disabled:opacity-30 p-1" onclick={prevMonth} disabled={loading}>
      <AIcon path={mdiChevronLeft} size="24px" />
    </button>
    <span class="font-bold w-44 text-center">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
    <button class="text-gray-500 disabled:opacity-30 p-1" onclick={nextMonth} disabled={loading}>
      <AIcon path={mdiChevronRight} size="24px" />
    </button>
  </div>

  <div class="bg-white rounded shadow overflow-hidden">

    <!-- Day headers -->
    <div class="grid grid-cols-7 border-b bg-gray-50">
      {#each DAY_HEADERS as day}
        <div class="text-xs font-semibold text-gray-400 text-center py-2">{day}</div>
      {/each}
    </div>

    {#if loading}
      <div class="py-16 text-center text-gray-400">Loading...</div>
    {:else}
      {#each weeks as week}
        <div class="grid grid-cols-7 divide-x border-b last:border-b-0">
          {#each week as day}
            {@const key  = day ? dateKey(day) : ''}
            {@const s    = day ? sessionMap[key] : null}
            {@const isToday = key === todayKey}
            <div class="min-h-16 p-1.5 {!day || day.getMonth() !== selectedMonth ? 'bg-gray-50' : ''}">
              {#if day}
                <div class="flex items-center gap-1 mb-1">
                  <span class="text-xs {isToday ? 'bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold' : 'text-gray-400'}">
                    {day.getDate()}
                  </span>
                </div>
                {#if s}
                  {#if s.type === 'event'}
                    <div class="text-xs font-medium text-sky-600 leading-tight">{fmtTime(s.trainingStart)}</div>
                    <div class="relative group mt-1">
                      <span class="inline-block text-xs font-bold px-1.5 py-0.5 rounded cursor-default select-none {s.label ? labelTw(s.color) : 'bg-sky-100 text-sky-700'}">
                        {s.label ? labelInitials(s.label) : 'E'}
                      </span>
                      <div class="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 pointer-events-none">
                        <div class="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                          {s.label || 'Event'}
                        </div>
                      </div>
                    </div>
                  {:else}
                    <div class="text-xs font-medium text-gray-700 leading-tight">
                      {fmtTime(s.trainingStart)}
                    </div>
                    {#if s.label}
                      <div class="relative group mt-1">
                        <span class="inline-block text-xs font-bold px-1.5 py-0.5 rounded cursor-default select-none {labelTw(s.color)}">
                          {labelInitials(s.label)}
                        </span>
                        <div class="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 pointer-events-none">
                          <div class="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                            {s.label}
                          </div>
                        </div>
                      </div>
                    {/if}
                  {/if}
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    {/if}

  </div>

  <!-- Legend: only show colors that actually appear this month -->
  {#if usedColors.length > 0}
    <div class="flex flex-wrap gap-3 mt-3">
      {#each usedColors as entry}
        <div class="flex items-center gap-1.5 text-xs text-gray-500">
          <span class="font-bold px-1.5 py-0.5 rounded {labelTw(entry.color)}">{labelInitials(entry.label)}</span>
          <span>{entry.label}</span>
        </div>
      {/each}
    </div>
  {/if}

</div>
