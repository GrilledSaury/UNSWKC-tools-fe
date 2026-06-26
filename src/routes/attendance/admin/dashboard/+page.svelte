<script>
  import { onMount, onDestroy } from 'svelte'
  import { db } from '$lib/firebase'
  import {
    collection, doc, getDoc, getDocs,
    query, where, Timestamp,
  } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiArrowLeft, mdiFullscreen, mdiFullscreenExit } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  let loading    = $state(true)
  let refreshing = $state(false)
  let noSession  = $state(false)
  let attendees  = $state([])
  let progress   = $state(1)

  const TOTAL_MS = 30_000
  const TICK_MS  = 100

  let timer   = null
  let elapsed = 0

  // SVG ring uses viewBox="0 0 100 100" so it scales with container size
  const R  = 47
  const C  = 2 * Math.PI * R
  const dashoffset = $derived(C * (1 - progress))

  async function loadData() {
    refreshing = true
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

      const sessionSnap = await getDocs(query(
        collection(db, 'session'),
        where('start', '>=', Timestamp.fromDate(todayStart)),
        where('start', '<=', Timestamp.fromDate(todayEnd)),
      ))

      if (sessionSnap.empty) { noSession = true; return }
      noSession = false

      const sessionIds = sessionSnap.docs.map(d => d.id)
      const usersSnap  = await getDocs(collection(db, 'user'))
      const users      = usersSnap.docs.map(d => ({ uid: d.id, name: d.data().name }))
      const nameMap    = Object.fromEntries(users.map(u => [u.uid, u.name]))

      const checkedIn = new Set()
      await Promise.all(
        sessionIds.flatMap(sid =>
          users.map(async u => {
            const snap = await getDoc(doc(db, 'attendance', u.uid, 'sessions', sid))
            if (snap.exists()) checkedIn.add(u.uid)
          })
        )
      )

      attendees = [...checkedIn]
        .map(uid => ({ uid, name: nameMap[uid] }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } finally {
      refreshing = false
    }
  }

  function startTimer() {
    elapsed  = 0
    progress = 1
    clearInterval(timer)
    timer = setInterval(() => {
      elapsed  += TICK_MS
      progress  = 1 - elapsed / TOTAL_MS
      if (elapsed >= TOTAL_MS) {
        elapsed = 0
        loadData()
      }
    }, TICK_MS)
  }

  async function refresh() {
    if (refreshing) return
    clearInterval(timer)
    await loadData()
    startTimer()
  }

  let isFullscreen = $state(false)

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  function handleKey(e) {
    if (e.code === 'Space') { e.preventDefault(); refresh() }
    if (e.code === 'KeyF')  { e.preventDefault(); toggleFullscreen() }
  }

  onMount(async () => {
    if (!$userProfile?.permissions?.includes('attendance')) { goto('/home'); return }
    await loadData()
    loading = false
    startTimer()
    window.addEventListener('keydown', handleKey)
    document.addEventListener('fullscreenchange', () => {
      isFullscreen = !!document.fullscreenElement
    })
  })

  onDestroy(() => {
    clearInterval(timer)
    window.removeEventListener('keydown', handleKey)
    document.removeEventListener('fullscreenchange', () => {})
  })
</script>

<div class="min-h-screen bg-gray-900 text-white flex flex-col md:flex-row md:h-screen md:overflow-hidden">

  <button
    class="absolute top-4 left-4 text-gray-600 hover:text-gray-300 z-10"
    onclick={() => goto('/attendance/admin')}
  >
    <AIcon path={mdiArrowLeft} size="28" />
  </button>

  <button
    class="absolute top-4 right-4 text-gray-600 hover:text-gray-300 z-10 hidden md:block"
    onclick={toggleFullscreen}
    title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
  >
    <AIcon path={isFullscreen ? mdiFullscreenExit : mdiFullscreen} size="28" />
  </button>

  {#if loading}
    <div class="flex-1 flex items-center justify-center text-gray-500 text-xl">Loading…</div>

  {:else if noSession}
    <div class="flex-1 flex flex-col items-center justify-center gap-4">
      <div class="text-8xl font-black text-gray-700">—</div>
      <div class="text-gray-500 text-base uppercase tracking-widest">No session today</div>
    </div>

  {:else}
    <!-- Count panel: full width on mobile, 2/3 on desktop -->
    <div class="w-full md:w-2/3 flex flex-col items-center justify-center shrink-0
                py-12 md:py-0 md:h-screen px-8 md:px-12
                border-b border-gray-800 md:border-b-0 md:border-r md:border-gray-800">

      <!-- Ring container: square, scales with vw -->
      <button
        class="relative flex items-center justify-center cursor-pointer select-none
               w-[80vw] h-[80vw] md:w-[50vw] md:h-[50vw]"
        onclick={refresh}
        title="Tap to refresh"
      >
        <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#1f2937" stroke-width="2" />
          <circle
            cx="50" cy="50" r={R}
            fill="none"
            stroke={refreshing ? '#4b5563' : '#10b981'}
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray={C}
            stroke-dashoffset={dashoffset}
            transform="rotate(-90 50 50)"
            style="transition: stroke-dashoffset 0.1s linear, stroke 0.3s"
          />
        </svg>

        <!-- Number: ~2/3 of viewport on desktop, full on mobile -->
        <div class="relative font-black tabular-nums leading-none select-none
                    text-[38vw] md:text-[24vw]">
          {attendees.length}
        </div>
      </button>

      <div class="text-gray-400 text-sm uppercase tracking-widest font-semibold mt-4 md:mt-6">
        checked in
      </div>
      <div class="text-gray-600 text-xs mt-2">
        {refreshing ? 'Refreshing…' : 'Space / tap to refresh'}
      </div>
    </div>

    <!-- Names panel: full width on mobile (scrolls), 1/3 on desktop -->
    <div class="flex-1 p-6 md:overflow-y-auto flex flex-wrap gap-3 content-start">
      {#each attendees as { name }}
        <div class="bg-green-800 text-green-100 rounded-lg px-4 py-2 text-sm font-semibold tracking-wide">
          {name}
        </div>
      {/each}
      {#if attendees.length === 0}
        <div class="text-gray-700 text-base italic mt-6 w-full text-center md:text-left">
          No one checked in yet…
        </div>
      {/if}
    </div>
  {/if}

</div>
