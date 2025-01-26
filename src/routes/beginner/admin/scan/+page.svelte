<script>
	import { BrowserMultiFormatReader } from '@zxing/library'
	import { doc, getDoc, updateDoc } from 'firebase/firestore'
	import { db } from '$lib/firebase'
  import Swal from 'sweetalert2'

	const reader = new BrowserMultiFormatReader()
	let device = $state(true), video = $state()
	let session = $state(0)
	
	async function init () {
		try {
			const devices = await reader.listVideoInputDevices()
			device = null
			if (!devices?.length) return Swal.fire('Error', 'No camera!', 'error')
			for (const d of devices) {
				if (d.label.match(/back/i) || d.label.match(/rear/i)) {
					device = d
					break
				}
			}
			if (!device) device = devices[devices.length - 1]
		} catch (err) {
			device = null
		}
		if (!device) Swal.fire('Error', 'No camera', 'error')
	}
	async function decode () {
		if (!device) return
		try {
			const { text } = await reader.decodeFromInputVideoDevice(device.deviceId, video)
			setTimeout(() => showBeginner(text))
		} catch {
			return Swal.fire('Error', 'Scan Failed', 'error')
		}
	}
	init().then(decode)

	async function showBeginner (uid) {
    const userRef = doc(db, 'user', uid)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      return Swal.fire('Profile not found', '', 'error')
    }
		const user = userSnap.data()

		const beginnerRef = doc(db, 'beginner', uid)
		const beginnerSnap = await getDoc(beginnerRef)
		if (!beginnerSnap.exists()) {
			return Swal.fire('Beginner not found', '', 'error')
		}
		const beginner = beginnerSnap.data()
		if (!beginner.activated) {
			return Swal.fire('Beginner not activated', '', 'error')
		}

		const { isConfirmed } = await Swal.fire({
			title: user.name,
			text: `Checking in to Beginner Course Session #${session + 1}`,
			showConfirmButton: true,
			confirmButtonText: 'Check in'
		})

		if (isConfirmed) {
			try {
				const beginnerDoc = doc(db, 'beginner', uid)
				beginner.progress[session] = true
				await updateDoc(beginnerDoc, {
					progress: beginner.progress
				})
				await Swal.fire('Successfully checked in!', '', 'success')
			} catch (err) {
				await Swal.fire('Error', err.message, 'error')
			}
		}

		setTimeout(() => decode())
	}
</script>


<div class="bg-black h-screen w-screen flex flex-col justify-center">
	<video bind:this={video} class="w-screen"></video>
	<select class="p-2 w-screen flex justify-center bg-blue-800 text-white font-bold" bind:value={session}>
		{#each [0, 1, 2, 3] as i}
			<option value={i}>{`Session ${i + 1}`}</option>
		{/each}
	</select>
</div>