<script>
  import { getAuth } from "firebase/auth";
  import { getDoc, doc } from "firebase/firestore";
  import { db } from "../../lib/firebase";

  import { goto } from '$app/navigation'

  const auth = getAuth();
  const authUser = auth.currentUser;
  let user = $state({ name: '' })
  if (authUser === null) goto('/')

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
  <button class="m-2 px-3 py-2 rounded shadow bg-white flex w-3/4" onclick={toProfile}>profile</button>
  <button class="m-2 px-3 py-2 rounded shadow bg-white flex w-3/4" onclick={toBeginnerCourse}>beginner course</button>
</div>
