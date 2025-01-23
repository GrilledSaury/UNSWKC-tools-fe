<script>
  import { db } from '../../lib/firebase'
  import { getDoc, doc } from "firebase/firestore"
  import Icon from "heroicons-for-svelte"
  import { UserCircle, AcademicCap, Adjustments } from "heroicons-for-svelte/icons/solid"

  import { goto } from '$app/navigation'
  import { getAuth } from "firebase/auth"

  const auth = getAuth()
  const user = auth.currentUser
  
  let profile = $state({ name: '' })
  let adminMode = $state(false)

  async function loadUser () {
    if (user === null) goto('/')
    const docRef = doc(db, 'user', user.uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) profile = docSnap.data()
    else goto('/')
  }

  async function goProfile () {
    if (adminMode) goto('/profile/admin')
    else goto('/profile/user/?uid=' + user.uid)
  }

  async function goBeginner () {
    goto('/beginner')
  }

  loadUser()

</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col p-3 sm:p-10">
  <h1 class="text-gray-700 font-bold text-3xl m-3">Welcome, {profile.name}</h1>
  <div class="flex flex-col sm:flex-row">
    <button
      class={(adminMode ? 'border-green-500 hover:bg-green-100 ' : 'border-gray-100 hover:bg-blue-100 ') + 'border border-2 m-2 px-3 py-2 rounded shadow bg-white transition-all flex items-center sm:justify-center'}
      onclick={goProfile}
    >
      <Icon icon={UserCircle} class="text-2xl text-blue-500 mr-3 sm:mr-1"/>
      My Profile
    </button>
    <button
      class={(adminMode ? 'border-green-500 hover:bg-green-100 ' : 'border-gray-100 hover:bg-blue-100 ') + 'border border-2 m-2 px-3 py-2 rounded shadow bg-white transition-all flex items-center sm:justify-center'}
      onclick={goBeginner}
    >
      <Icon icon={AcademicCap} class="text-2xl text-yellow-500 mr-3 sm:mr-1"/>
      Beginner Course
    </button>
    {#if profile.admin}
      <button
        class={(adminMode ? 'text-white bg-green-500 ' : 'text-green-500 bg-white ') + 'font-bold m-2 px-3 py-2 rounded shadow transition-all flex items-center sm:justify-center'}
        onclick={() => { adminMode = !adminMode }}
      >
        <Icon icon={Adjustments} class="text-2xl mr-3 sm:mr-1"/>
        Admin Mode
      </button>
    {/if}
  </div>
</div>
