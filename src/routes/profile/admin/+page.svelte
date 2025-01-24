<script>
	import { db, auth } from '$lib/firebase'
	import { getDoc, doc, getDocs, collection } from 'firebase/firestore'
	import { goto } from '$app/navigation'
  import { onAuthStateChanged } from 'firebase/auth';

	let adminUser = $state({})
	let userList = $state([])

	onAuthStateChanged(auth, async u => {
		if (u === null) goto('/')
		const docRef = doc(db, 'user', u.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) adminUser = docSnap.data()
    else goto('/')

		const usersSnap = await getDocs(collection(db, 'user'))
		usersSnap.forEach(doc => {
			userList.push(doc.data())
		})
	})

</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
	{#if adminUser.admin}
		{#each userList as u}
			<div>{u._id}</div>
		{/each}
	{:else}
		No authority!
	{/if}
</div>