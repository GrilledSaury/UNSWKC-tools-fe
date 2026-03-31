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

  onAuthStateChanged(auth, async u => {
    authLoading = true
    if (u === null) {
      userProfile.set(null)
      authLoading = false
      if (get(page).url.pathname !== '/') goto('/')
    } else {
      const docSnap = await getDoc(doc(db, 'user', u.uid))
      if (docSnap.exists()) {
        userProfile.set({ ...docSnap.data(), uid: u.uid })
      } else {
        userProfile.set(null)
        if (get(page).url.pathname !== '/') goto('/')
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
