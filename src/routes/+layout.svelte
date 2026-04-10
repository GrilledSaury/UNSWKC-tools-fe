<script>
  import '../index.css'
  import { auth, db } from '$lib/firebase'
  import { onAuthStateChanged } from 'firebase/auth'
  import { doc, getDoc } from 'firebase/firestore'
  import { goto } from '$app/navigation'
  import { get } from 'svelte/store'
  import { page } from '$app/stores'
  import { userProfile } from '$lib/stores'

  let authLoading = $state(true)

  function redirectToLogin() {
    const p = get(page)
    if (p.url.pathname === '/') return
    const returnTo = p.url.pathname + p.url.search
    goto('/?app=' + encodeURIComponent(returnTo))
  }

  onAuthStateChanged(auth, async u => {
    authLoading = true
    if (u === null) {
      userProfile.set(null)
      authLoading = false
      redirectToLogin()
    } else {
      const docSnap = await getDoc(doc(db, 'user', u.uid))
      if (docSnap.exists()) {
        userProfile.set({ ...docSnap.data(), uid: u.uid })
      } else {
        userProfile.set(null)
        redirectToLogin()
      }
      authLoading = false
    }
  })
</script>

<svelte:head>
  <title>UNSWKC</title>
</svelte:head>

{#if !authLoading}
  <slot />
{/if}
