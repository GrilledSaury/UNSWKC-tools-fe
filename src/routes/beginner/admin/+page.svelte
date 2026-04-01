<script>
  import { db, storage } from '$lib/firebase'
	import { goto } from '$app/navigation'
  import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore"
	import { AIcon } from "ace.svelte"
  import { mdiAccount, mdiImageSearch, mdiQrcode, mdiTagCheck, mdiCheck, mdiDownloadBox, mdiHome, mdiPencil } from "@mdi/js"
	import Swal from "sweetalert2"
	import { getDownloadURL, ref } from "firebase/storage"
  import { onMount } from 'svelte'
  import { userProfile } from '$lib/stores'

	let beginnerList = $state([])
	let users = $state({})

	let showModal = $state(false)
	let editConfig = $state({ title: '', content: '' })
	let savingConfig = $state(false)
	let loadingMessage = $state('')

	onMount(async () => {
		const [usersSnap, beginnersSnap, configSnap] = await Promise.all([
			getDocs(collection(db, 'user')),
			getDocs(collection(db, 'beginner')),
			getDoc(doc(db, 'config', 'beginner')),
		])

		usersSnap.forEach(doc => {
			users[doc.id] = doc.data()
		})
		beginnersSnap.forEach(doc => {
			if (doc.data().join) beginnerList.push({ uid: doc.id, data: doc.data() })
		})
		if (configSnap.exists()) editConfig = configSnap.data()
	})

	async function saveConfig () {
		if (savingConfig) return
		savingConfig = true
		try {
			await setDoc(doc(db, 'config', 'beginner'), editConfig)
			showModal = false
			Swal.fire('Saved!', '', 'success')
		} catch (err) {
			Swal.fire('Error', err.message, 'error')
		}
		savingConfig = false
	}

	async function goProfile (id) {
		goto('/profile/?uid=' + id)
	}

	async function previewReceipt (path) {
		if (!path) return
		loadingMessage = 'Loading image...'
		try {
			const previewUrl = await getDownloadURL(ref(storage, path))
			await new Promise((resolve, reject) => {
				const img = new Image()
				img.onload = resolve
				img.onerror = reject
				img.src = previewUrl
			})
			loadingMessage = ''
			Swal.fire({ imageUrl: previewUrl })
		} catch (err) {
			loadingMessage = ''
			Swal.fire('Error', err.message, 'error')
		}
	}

	async function activate (beginner) {
		try {
			const { isConfirmed } = await Swal.fire({
				title: 'Are you sure?',
				text: (beginner.data.activated ? 'Unactivating' : 'Activating') + ` beginner ${users[beginner.uid].name}`,
				confirmButtonText: 'Yes',
				showCancelButton: true,
			})

			if (isConfirmed) {
				const beginnerDoc = doc(db, 'beginner', beginner.uid)
				await updateDoc(beginnerDoc, { activated: !beginner.data.activated })
				beginner.data.activated = !beginner.data.activated
			}
		} catch (err) {
			Swal.fire('Error', err.message, 'error')
		}
	}

	function downloadData () {
		const csvContent = `"Name","Email","Phone","Session 1","Session 2","Session 3","Session 4"\r\n` + beginnerList.map(b => {
			const row = []
			row.push(users[b.uid].name)
			row.push(users[b.uid].email)
			row.push(users[b.uid].phone)
			for (const p of b.data.progress) row.push(p ? 'attended' : '-')
			return row.map(v => `"${v}"`).join(',')
		}).join('\r\n')

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);

		const pom = document.createElement('a')
		pom.href = url
		pom.setAttribute('download', 'Beginner Course Data.csv')
		pom.click()
	}
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">
	<button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500"></AIcon>
  </button>
	<div class="text-2xl font-bold my-4">Beginners' Data</div>
	{#if $userProfile.permissions?.includes('beginner')}
		<div class="flex items-center">
			<button class="text-white bg-blue-500 px-2 py-1 font-bold rounded shadow my-4 flex items-center mr-2" onclick={() => goto('/beginner/admin/scan')}>
				<AIcon path={mdiQrcode} class="mr-2"></AIcon>
				Scan
			</button>
			<button class="text-white bg-green-500 px-2 py-1 font-bold rounded shadow my-4 flex items-center mr-2" onclick={downloadData}>
				<AIcon path={mdiDownloadBox} class="mr-2"></AIcon>
				Data
			</button>
			<button class="text-white bg-gray-500 px-2 py-1 font-bold rounded shadow my-4 flex items-center" onclick={() => showModal = true}>
				<AIcon path={mdiPencil} class="mr-2"></AIcon>
				Edit Content
			</button>
		</div>
		{#each beginnerList as beginner}
			<div class="px-4 py-2 bg-white shadow rounded my-2 flex items-center">
				<div class="font-bold whitespace-nowrap grow overflow-x-scroll">{users[beginner.uid].name}</div>
				{#if beginner.data.progress}
					<div class="flex items-center">
						{#each beginner.data.progress as p}
							<AIcon class={p ? 'text-green-500 mx-1' : 'text-gray-500 mx-1'} path={mdiCheck}></AIcon>
						{/each}
					</div>
				{/if}
				<div class="flex items-center">
					<button class="text-blue-500 mx-1" onclick={() => goProfile(beginner.uid)}><AIcon path={mdiAccount} /></button>
					<button class={beginner.data.filePath ? 'text-blue-500 mx-1' : 'text-gray-500 mx-1'} onclick={() => previewReceipt(beginner.data.filePath)}><AIcon path={mdiImageSearch} /></button>
					<button class={beginner.data.activated ? 'text-green-500 mx-1' : 'text-gray-500 mx-1'} onclick={() => activate(beginner)}><AIcon path={mdiTagCheck} /></button>
				</div>
			</div>
		{/each}
	{:else}
		No authority!
	{/if}
</div>

{#if loadingMessage}
  <div class="fixed inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-50">
    <div class="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
    <div class="text-white font-bold text-lg">{loadingMessage}</div>
  </div>
{/if}

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-2xl flex flex-col" style="max-height: 90vh">
      <div class="p-4 font-bold text-xl border-b">Edit Beginner Course Content</div>
      <div class="p-4 flex flex-col gap-4 overflow-y-auto grow">
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Checkbox Label</span>
          <input class="border rounded px-2 py-1" bind:value={editConfig.title} />
        </label>
        <label class="flex flex-col grow">
          <span class="font-bold text-sm mb-1">Course Description</span>
          <textarea class="border rounded px-2 py-1 resize-none" rows="16" bind:value={editConfig.content}></textarea>
        </label>
      </div>
      <div class="p-4 border-t flex justify-end gap-2">
        <button class="px-4 py-1 rounded border font-bold" onclick={() => showModal = false}>Cancel</button>
        <button class="px-4 py-1 rounded bg-blue-500 text-white font-bold" onclick={saveConfig}>
          {savingConfig ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}
