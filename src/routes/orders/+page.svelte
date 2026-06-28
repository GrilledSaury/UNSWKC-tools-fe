<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { collection, getDocs, orderBy, query } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome, mdiChevronRight } from '@mdi/js'
  import { goto } from '$app/navigation'

  let events  = $state([])
  let loading = $state(true)

  function fmt(ts) {
    if (!ts) return '—'
    return ts.toDate().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  onMount(async () => {
    const snap = await getDocs(query(collection(db, 'events'), orderBy('dueDate', 'asc')))
    events = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1
        return (a.dueDate?.toMillis() ?? 0) - (b.dueDate?.toMillis() ?? 0)
      })
    loading = false
  })
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>
  <div class="text-2xl font-bold mt-4 mb-6">My Orders</div>

  {#if loading}
    <div class="text-gray-500 text-center mt-16">Loading...</div>

  {:else if events.length === 0}
    <div class="text-gray-400 text-center mt-16">No order events yet.</div>

  {:else}
    <div class="flex flex-col gap-2">
      {#each events as ev}
        <button
          class="bg-white rounded shadow px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors w-full"
          onclick={() => goto('/orders/' + ev.id)}
        >
          <div class="grow min-w-0">
            <div class="font-bold text-gray-800 truncate">{ev.title}</div>
            <div class="text-sm text-gray-500 mt-0.5">Due {fmt(ev.dueDate)}</div>
          </div>
          <span class="text-xs font-bold px-4 py-1 rounded-full shrink-0
            {ev.status === 'open' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}">
            {ev.status}
          </span>
          <AIcon path={mdiChevronRight} size="20" class="text-gray-300 shrink-0" />
        </button>
      {/each}
    </div>
  {/if}

</div>
