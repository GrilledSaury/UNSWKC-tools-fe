<script>
	import { db, auth } from '$lib/firebase'
	import { getDoc, doc, getDocs, collection } from 'firebase/firestore'
	import { goto } from '$app/navigation'

	let adminUser = $state({})
	let userList = $state([])

	async function init () {
		if (!auth.currentUser) goto('/')
		const docRef = doc(db, 'user', auth.currentUser.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) adminUser = docSnap.data()
    else goto('/')

		const usersSnap = await getDocs(collection(db, 'user'))
		usersSnap.forEach(doc => {
			userList.push(doc.data())
		})
	}

	init()

	async function goProfile (id) {
		goto('/profile/?uid=' + id)
	}

</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
	<div class="text-2xl font-bold my-4">Users' Profile</div>
	{#if adminUser.admin}
		{#each userList as u}
			<div class="px-4 py-2 bg-white shadow rounded my-2 cursor-pointer" onclick={() => goProfile(u._id)}>
				<div class="font-bold">{u.name}</div>
				<div class="text-sm">{u.email}, {u.phone}</div>
				<div class="text-sm text-gray-500">{u._id}</div>
			</div>
		{/each}
	{:else}
		No authority!
	{/if}
</div>