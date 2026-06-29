<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { collection, getDocs, orderBy, query } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome } from '@mdi/js'
  import { goto } from '$app/navigation'
  import EventList from '$lib/components/EventList.svelte'

  let events  = $state([])
  let loading = $state(true)

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
  {:else}
    <EventList {events} onSelect={ev => goto('/orders/' + ev.id)} />
  {/if}

</div>
