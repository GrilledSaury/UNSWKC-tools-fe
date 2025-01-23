<script>
  import { getAuth } from "firebase/auth"
  import { getDoc, doc } from "firebase/firestore"
  import { db } from "../../lib/firebase"
  import Icon from "heroicons-for-svelte"
  import { UserCircle, AcademicCap } from "heroicons-for-svelte/icons/solid"

  import { goto } from '$app/navigation'

  const auth = getAuth()
  const authUser = auth.currentUser
  if (authUser === null) goto('/')
  
  let user = $state({ name: '' })

  async function loadUser () {
    const docRef = doc(db, 'user', authUser.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) user = docSnap.data()
    else goto('/')
  }

  loadUser()

  async function toProfile () {
    goto('/profile')
  }

  async function toBeginnerCourse () {
    goto('/beginner')
  }

</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col p-3 sm:p-10">
  <h1 class="text-gray-700 font-bold text-3xl m-3">Welcome, {user.name}</h1>
  <div class="flex flex-col sm:flex-row">
    <button class="m-2 px-3 py-2 rounded shadow bg-white transition-all hover:bg-blue-100 flex items-center sm:justify-center" onclick={toProfile}>
      <Icon icon={UserCircle} class="text-2xl text-blue-500 mr-3 sm:mr-1"/>
      My Profile
    </button>
    <button class="m-2 px-3 py-2 rounded shadow bg-white transition-all hover:bg-blue-100 flex items-center sm:justify-center" onclick={toBeginnerCourse}>
      <Icon icon={AcademicCap} class="text-2xl text-yellow-500 mr-3 sm:mr-1"/>
      Beginner Course
    </button>
  </div>
</div>
