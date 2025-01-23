<script>
	import { db, auth } from '$lib/firebase'
	import { getDoc, doc } from 'firebase/firestore'
	import { goto } from '$app/navigation'
  import { onAuthStateChanged } from 'firebase/auth';

	let adminUser = $state({})

	onAuthStateChanged(auth, async u => {
		if (u === null) goto('/')
		const docRef = doc(db, 'user', u.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) adminUser = docSnap.data()
    else goto('/')
	})

</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
	{#if adminUser.admin}
		admin page
	{:else}
		No authority!
	{/if}
</div>