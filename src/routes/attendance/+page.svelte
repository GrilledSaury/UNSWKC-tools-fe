<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { collection, getDocs, query, orderBy } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome, mdiCheck, mdiClose } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAY_FULL    = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }

  let sessions  = $state([])  // all sessions from /session, sorted desc
  let attended  = $state({})  // sessionId → { t: Date }
  let loading   = $state(true)

  // Group sessions by 'Month YYYY'
  let grouped = $derived.by(() => {
    const map = new Map()
    for (const s of sessions) {
      const d   = s.start
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return [...map.entries()]  // [['Apr 2026', [...sessions]], ...]
  })

  let totalAttended = $derived(sessions.filter(s => attended[s.id]).length)
  let totalSessions = $derived(sessions.length)

  onMount(async () => {
    const uid = $userProfile.uid
    const [sessionsSnap, attendedSnap] = await Promise.all([
      getDocs(query(collection(db, 'session'), orderBy('start', 'desc'))),
      getDocs(collection(db, 'attendance', uid, 'sessions')),
    ])

    const now = new Date()
    sessions = sessionsSnap.docs
      .map(d => ({ id: d.id, start: d.data().start.toDate(), end: d.data().end.toDate() }))
      .filter(s => s.end < now)

    attendedSnap.forEach(d => {
      attended[d.id] = { t: d.data().t?.toDate() ?? null }
    })

    loading = false
  })

  function fmtTime(d) {
    if (!d) return ''
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }

  function dayLabel(session) {
    const abbr = session.id.split('-').at(-1)
    return DAY_FULL[abbr] ?? abbr
  }

  function dateLabel(session) {
    const d = session.start
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
  }

  function pct(a, b) {
    return b === 0 ? 0 : Math.round((a / b) * 100)
  }

  function barColor(p) {
    if (p < 33) return '#ef4444'
    if (p < 67) return '#eab308'
    return '#22c55e'
  }
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>
  <div class="text-2xl font-bold mt-4 mb-6">My Attendance</div>

  {#if loading}
    <div class="text-gray-400 text-center mt-16">Loading...</div>
  {:else}

    <!-- Summary bar -->
    {#if totalSessions > 0}
      {@const p = pct(totalAttended, totalSessions)}
      <div class="bg-white rounded shadow px-4 py-3 mb-6">
        <div class="flex justify-between text-sm text-gray-500 mb-1">
          <span>Overall attendance</span>
          <span class="font-bold" style="color:{barColor(p)}">{totalAttended} / {totalSessions} ({p}%)</span>
        </div>
        <div class="h-3 rounded-full bg-gray-200 overflow-hidden">
          <div class="h-full rounded-full transition-all" style="width:{p}%; background:{barColor(p)}"></div>
        </div>
      </div>
    {/if}

    <!-- Month groups -->
    {#each grouped as [month, monthSessions]}
      {@const mo = monthSessions.filter(s => attended[s.id]).length}
      {@const mt = monthSessions.length}
      {@const mp = pct(mo, mt)}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <div class="font-bold text-gray-700">{month}</div>
          <div class="text-xs font-medium" style="color:{barColor(mp)}">{mo}/{mt}</div>
        </div>
        <div class="flex flex-col gap-1.5">
          {#each monthSessions as session}
            {@const present = !!attended[session.id]}
            <div class="bg-white rounded shadow-sm px-4 py-2.5 flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                class:bg-green-100={present}
                class:bg-gray-100={!present}
              >
                <AIcon
                  path={present ? mdiCheck : mdiClose}
                  size="20"
                  class={present ? 'text-green-500' : 'text-gray-300'}
                />
              </div>
              <div class="grow min-w-0">
                <div class="font-medium text-sm">{dayLabel(session)}, {dateLabel(session)}</div>
                <div class="text-xs text-gray-400">{fmtTime(session.start)} – {fmtTime(session.end)}</div>
              </div>
              {#if present && attended[session.id].t}
                <div class="text-xs text-gray-400 shrink-0">checked in {fmtTime(attended[session.id].t)}</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/each}

    {#if totalSessions === 0}
      <div class="text-gray-400 text-center mt-16">No sessions recorded yet.</div>
    {/if}

  {/if}
</div>
