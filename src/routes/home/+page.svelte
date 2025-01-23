<script>
  import { getDoc, doc } from "firebase/firestore"
  import { db } from "../../lib/firebase"
  import Icon from "heroicons-for-svelte"
  import { UserCircle, AcademicCap } from "heroicons-for-svelte/icons/solid"
  import user from '../../lib/auth'

  import { goto } from '$app/navigation'
  
  let profile = $state({ name: '' })

  async function loadUser () {
    if ($user === null) goto('/')
    const docRef = doc(db, 'user', $user.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) profile = docSnap.data()
    else goto('/')
  }

  loadUser()

</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col p-3 sm:p-10">
  <h1 class="text-gray-700 font-bold text-3xl m-3">Welcome, {profile.name}</h1>
  <div class="flex flex-col sm:flex-row">
    <button class="m-2 px-3 py-2 rounded shadow bg-white transition-all hover:bg-blue-100 flex items-center sm:justify-center" onclick={() => goto('/profile')}>
      <Icon icon={UserCircle} class="text-2xl text-blue-500 mr-3 sm:mr-1"/>
      My Profile
    </button>
    <button class="m-2 px-3 py-2 rounded shadow bg-white transition-all hover:bg-blue-100 flex items-center sm:justify-center" onclick={() => goto('/beginner')}>
      <Icon icon={AcademicCap} class="text-2xl text-yellow-500 mr-3 sm:mr-1"/>
      Beginner Course
    </button>
  </div>
</div>
