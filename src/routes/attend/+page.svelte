<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiCheck, mdiClose, mdiHome } from '@mdi/js'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  let sessionId = $state('')
  let passcode  = $state('')
  let session   = $state(null)  // { start: Date, end: Date }

  // 'loading' | 'ready' | 'submitting' | 'done' | 'already' | 'error'
  let status   = $state('loading')
  let errorMsg = $state('')

  onMount(async () => {
    sessionId = $page.url.searchParams.get('s') ?? ''
    passcode  = $page.url.searchParams.get('p') ?? ''

    if (!sessionId || !passcode) {
      errorMsg = 'Invalid QR code.'
      status = 'error'
      return
    }

    try {
      const [sessionSnap, attSnap] = await Promise.all([
        getDoc(doc(db, 'session', sessionId)),
        getDoc(doc(db, 'attendance', $userProfile.uid, 'sessions', sessionId)),
      ])

      if (!sessionSnap.exists()) {
        errorMsg = 'Session not found.'
        status = 'error'
        return
      }

      session = {
        start: sessionSnap.data().start.toDate(),
        end:   sessionSnap.data().end.toDate(),
      }

      if (attSnap.exists()) {
        status = 'already'
        return
      }

      status = 'ready'
    } catch (err) {
      errorMsg = err.message
      status = 'error'
    }
  })

  async function markAttendance() {
    if (status !== 'ready') return
    status = 'submitting'
    try {
      await setDoc(
        doc(db, 'attendance', $userProfile.uid, 'sessions', sessionId),
        { t: serverTimestamp(), p: passcode },
      )
      status = 'done'
    } catch (err) {
      errorMsg = err.code === 'permission-denied'
        ? 'The attendance window is closed or this QR code is invalid.'
        : err.message
      status = 'error'
    }
  }

  function fmtDate(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  function fmtTime(d) {
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }
</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center p-6">
  <div class="bg-white rounded shadow w-full max-w-sm p-6 text-center">

    {#if status === 'loading'}
      <div class="text-gray-400">Loading...</div>

    {:else if status === 'error'}
      <div class="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <AIcon path={mdiClose} class="text-red-500" size="32" />
      </div>
      <div class="font-bold text-xl mb-2">Something went wrong</div>
      <div class="text-gray-500 text-sm">{errorMsg}</div>

    {:else if status === 'already'}
      <div class="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
        <AIcon path={mdiCheck} class="text-blue-500" size="32" />
      </div>
      <div class="font-bold text-xl mb-1">Already marked</div>
      <div class="text-gray-500 text-sm">{fmtDate(session.start)}</div>
      <button class="mt-6 text-blue-500 text-sm flex items-center gap-1 mx-auto" onclick={() => goto('/home')}>
        <AIcon path={mdiHome} size="18" />Home
      </button>

    {:else if status === 'done'}
      <div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <AIcon path={mdiCheck} class="text-green-500" size="32" />
      </div>
      <div class="font-bold text-xl text-green-600 mb-1">Attendance marked!</div>
      <div class="text-gray-500 text-sm">{fmtDate(session.start)}</div>
      <button class="mt-6 text-blue-500 text-sm flex items-center gap-1 mx-auto" onclick={() => goto('/home')}>
        <AIcon path={mdiHome} size="18" />Home
      </button>

    {:else}
      <!-- ready | submitting -->
      <div class="text-gray-400 text-xs mb-1 uppercase tracking-wide">Training</div>
      <div class="font-bold text-xl mb-0.5">{fmtDate(session.start)}</div>
      <div class="text-gray-500 text-sm mb-1">{fmtTime(session.start)} – {fmtTime(session.end)}</div>
      <div class="text-gray-600 mb-6">Hi, {$userProfile.name}</div>
      <button
        class="w-full py-3 bg-green-500 text-white font-bold rounded-lg text-lg disabled:opacity-50 transition-opacity"
        onclick={markAttendance}
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? 'Marking...' : 'Mark Attendance'}
      </button>
    {/if}

  </div>
</div>
