<script>
  import { onAuthStateChanged } from "firebase/auth"
	import { auth } from '$lib/firebase'
	import { goto } from '$app/navigation'

	let adminUser = $state({})

	onAuthStateChanged(auth, async u => {
		if (u === null) goto('/')
		const docRef = doc(db, 'user', u.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) adminUser = docSnap.data()
	})
</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
	<div class="text-2xl font-bold my-4">Beginners' Data</div>

</div>