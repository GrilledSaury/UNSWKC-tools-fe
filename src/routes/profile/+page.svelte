<script>
  import { getAuth } from "firebase/auth"
  import { getDoc, doc, updateDoc } from "firebase/firestore"
  import { db } from "../../lib/firebase"
  import user from "../../lib/auth"
  import Swal from "sweetalert2"

  let profile = $state({})

  async function loadProfile () {
    if ($user === null) goto('/')
    const docRef = doc(db, 'user', $user.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) profile = docSnap.data()
    else goto('/')
  }

  loadProfile()

  async function update () {
    try {
      const profileDoc = doc(db, 'user', $user.uid)
      await updateDoc(profileDoc, profile)
    } catch (err) {
      console.log(err)
    }
  }
  
</script>

<div class="w-screen h-screen bg-gray-100 px-16 py-8">
  <div class="text-2xl font-bold my-8">My Profile</div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Name</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.name}>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Email</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.email}>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Email2</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.email2}>
  </div>
  <button class="bg-blue-500 font-bold hover:shadow rounded px-4 py-1 text-white my-4" onclick={update}>Update</button>
</div>