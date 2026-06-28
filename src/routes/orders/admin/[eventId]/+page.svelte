<script>
  import { goto } from '$app/navigation'
  import { AIcon } from 'ace.svelte'
  import { mdiArrowLeft } from '@mdi/js'
</script>

<div class="min-h-screen bg-gray-100 p-4 sm:p-8">
  <button onclick={() => goto('/orders/admin')} class="text-gray-400 hover:text-gray-600 mb-6 block">
    <AIcon path={mdiArrowLeft} size="28" />
  </button>
  <div class="text-gray-400 text-center py-16">Coming soon…</div>
</div>
