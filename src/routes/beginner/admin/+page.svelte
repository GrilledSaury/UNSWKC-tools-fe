<script>
  import { onAuthStateChanged } from "firebase/auth"
	import { auth, db, storage } from '$lib/firebase'
	import { goto } from '$app/navigation'
  import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore"
	import { AIcon } from "ace.svelte"
  import { mdiAccount, mdiImageSearch, mdiQrcode, mdiTagCheck, mdiCheck } from "@mdi/js"
	import Swal from "sweetalert2"
	import { getDownloadURL, ref } from "firebase/storage"

	let adminUser = $state({})
	let beginnerList = $state([])
	let users = $state({})

	onAuthStateChanged(auth, async u => {
		if (u === null) goto('/')
		const adminRef = doc(db, 'user', u.uid)
    const adminSnap = await getDoc(adminRef)
    if (adminSnap.exists()) adminUser = adminSnap.data()

		const usersSnap = await getDocs(collection(db, 'user'))
		usersSnap.forEach(doc => {
			const u = doc.data()
			users[doc.id] = u
		})

		const beginnersSnap = await getDocs(collection(db, 'beginner'))
		beginnersSnap.forEach(doc => {
			if (doc.data().join) beginnerList.push({ uid: doc.id, data: doc.data() })
		})
	})

	async function goProfile (id) {
		goto('/profile/?uid=' + id)
	}

	async function previewReceipt (path) {
		if (!path) return
		try {
      const previewUrl = await getDownloadURL(ref(storage, path))
      Swal.fire({
        imageUrl: previewUrl
      })
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
	}

	async function activate (beginner) {
		try {
			await Swal.fire({
				title: 'Are you sure?',
				text: (beginner.data.activated ? 'Unactivating' : 'Activating') + ` beginner ${users[beginner.uid].name}`,
				confirmButtonText: 'Yes',
				showCancelButton: true,
			}).then(async res => {
				if (res.isConfirmed) {
					const beginnerDoc = doc(db, 'beginner', beginner.uid)
					await updateDoc(beginnerDoc, { activated: !beginner.data.activated })
					beginner.data.activated = !beginner.data.activated
				}
			})
		} catch (err) {
			Swal.fire('Error', err.message, 'error')
		}
	}
</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
	<div class="text-2xl font-bold my-4">Beginners' Data</div>
	{#if adminUser.admin}
		<button class="text-white bg-green-500 px-2 py-1 font-bold rounded shadow my-4 flex items-center" onclick={() => goto('/beginner/admin/scan')}>
			<AIcon path={mdiQrcode} class="mr-2"></AIcon>
			Scan
		</button>
		{#each beginnerList as beginner}
			<div class="px-4 py-2 bg-white shadow rounded my-2 flex items-center">
				<div class="font-bold">{users[beginner.uid].name}</div>
				<div class="grow"></div>
				{#if beginner.data.progress}
					<div class="flex items-center">
						{#each beginner.data.progress as p}
							<AIcon class={p ? 'text-green-500 mx-1' : 'text-gray-500 mx-1'} path={mdiCheck}></AIcon>
						{/each}
					</div>
				{/if}
				<button class="text-blue-500 mx-1" onclick={() => goProfile(beginner.uid)}><AIcon path={mdiAccount} /></button>
				<button class={beginner.data.filePath ? 'text-blue-500 mx-1' : 'text-gray-500 mx-1'} onclick={() => previewReceipt(beginner.data.filePath)}><AIcon path={mdiImageSearch} /></button>
				<button class={beginner.data.activated ? 'text-green-500' : 'text-gray-500'} onclick={() => activate(beginner)}><AIcon path={mdiTagCheck} /></button>
			</div>
		{/each}
	{:else}
		No authority!
	{/if}
</div>