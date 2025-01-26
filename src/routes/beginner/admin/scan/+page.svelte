<script>
	import { BrowserMultiFormatReader } from '@zxing/library'
	import { doc, getDoc } from 'firebase/firestore'
	import { db } from '$lib/firebase'
  import Swal from 'sweetalert2'

	const reader = new BrowserMultiFormatReader()
	let device = $state(true), video = $state()
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
    const docRef = doc(db, 'user', uid)
    const docSnap = await getDoc(docRef)
		let user
    if (docSnap.exists()) user = docSnap.data()
    else {
      return Swal.fire('Profile not found', '', 'error')
    }
		const { isConfirmed } = await Swal.fire({
			title: user.name,
			text: 'Checking in...',
			showConfirmButton: true,
			confirmButtonText: 'Check in'
		})

		if (isConfirmed) {
			console.log('checked')
		}

		setTimeout(() => decode())
	}
</script>


<div class="bg-black">
	<video bind:this={video} class="w-screen h-screen"></video>
</div>