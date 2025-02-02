<script>
	import { db, auth } from '$lib/firebase'
	import { getDoc, doc, getDocs, collection } from 'firebase/firestore'
	import { goto } from '$app/navigation'
  import { onAuthStateChanged } from 'firebase/auth'
	import { AIcon } from 'ace.svelte'
	import { mdiAccount } from '@mdi/js'

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
			userList.push({ uid: doc.id, data: doc.data() })
		})
	})

	async function goProfile (id) {
		goto('/profile/?uid=' + id)
	}

</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">
	<div class="text-2xl font-bold my-4">Users' Profile</div>
	{#if adminUser.admin}
		{#each userList as u}
			<div class="px-4 py-2 bg-white shadow rounded my-2 flex items-center">
				<div>
					<div class="font-bold whitespace-nowrap">{u.data.name}</div>
					<div class="text-sm">{u.data.email}, {u.data.phone}</div>
					<div class="text-sm text-gray-500">{u.uid}</div>
				</div>
				<div class="grow"></div>
				<button class="text-blue-500" onclick={() => goProfile(u.uid)}><AIcon path={mdiAccount} /></button>
			</div>
		{/each}
	{:else}
		No authority!
	{/if}
</div>