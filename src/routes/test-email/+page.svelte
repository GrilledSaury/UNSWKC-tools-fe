<script>
  import { functions } from '$lib/firebase'
  import { httpsCallable } from 'firebase/functions'

  let status = $state('')
  let loading = $state(false)

  async function sendTest() {
    loading = true
    status = ''
    try {
      const fn = httpsCallable(functions, 'sendTestEmail')
      await fn()
      status = 'Email sent!'
    } catch (err) {
      status = 'Error: ' + err.message
    }
    loading = false
  }
</script>

<div class="min-h-screen bg-gray-100 flex items-center justify-center">
  <div class="bg-white rounded shadow p-8 flex flex-col items-center gap-4">
    <div class="text-lg font-bold">Email Function Test</div>
    <button
      class="bg-blue-500 text-white font-bold px-6 py-2 rounded disabled:opacity-50"
      onclick={sendTest}
      disabled={loading}
    >
      {loading ? 'Sending…' : 'Send Test Email'}
    </button>
    {#if status}
      <div class="text-sm {status.startsWith('Error') ? 'text-red-500' : 'text-green-600'}">{status}</div>
    {/if}
  </div>
</div>
