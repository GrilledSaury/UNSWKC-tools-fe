<script>
  import { getAuth } from 'firebase/auth'
	import { db } from '../../../lib/firebase'
	import { getDoc, doc } from 'firebase/firestore'
	import { goto } from '$app/navigation'

	const auth = getAuth()
	let adminUser = $state({})

	async function load () {
		if (auth.currentUser === null) goto('/')
    const docRef = doc(db, 'user', auth.currentUser.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) adminUser = docSnap.data()
    else goto('/')
	}

	load()
</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
	{#if adminUser.admin}
		admin page
	{:else}
		No authority!
	{/if}
</div>