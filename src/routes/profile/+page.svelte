<script>
  import { getDoc, doc, updateDoc } from "firebase/firestore"
  import { page } from '$app/stores'
  import Swal from "sweetalert2"
  import { goto } from '$app/navigation'
  import { db, auth } from '$lib/firebase'
  import { onAuthStateChanged } from "firebase/auth"

  const user = auth.currentUser

  let profile = $state({})
  let profileId = $state($page.url.searchParams.get('uid'))
  let uid = $state('')

  onAuthStateChanged(auth, async u => {
    if (u === null) goto('/')
    uid = u.uid
    const docRef = doc(db, 'user', $page.url.searchParams.get('uid'))
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) profile = docSnap.data()
    else {
      Swal.fire('Profile not found', '', 'error')
      goto('/home')
    }
  })

  async function update () {
    try {
      const profileDoc = doc(db, 'user', profileId)
      await updateDoc(profileDoc, profile)
      Swal.fire('Successfully updated!', '', 'success')
    } catch (err) {
      console.log(err)
    }
  }
  
</script>

<div class="w-screen h-screen bg-gray-100 p-4 md:px-16 md:py-8">
  <div class="text-2xl font-bold my-2">Profile</div>
  <div class="text-gray-500 font-mono my-2">ID: {profileId}</div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Name</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.name}>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Email</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.email} disabled>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Email2</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.email2}>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Phone</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.phone}>
  </div>
  <button class="bg-blue-500 font-bold hover:shadow rounded px-4 py-1 text-white my-4" onclick={update}>Update</button>
</div>