<script>
  import { auth } from '$lib/firebase'
  import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
  import { db } from "../../lib/firebase"
  import { ACheckbox } from 'ace.svelte'
  import Swal from 'sweetalert2'
  import { goto } from '$app/navigation'

  let beginner = $state({ join: false })
  let user = $state({})

  async function init () {
    if (!auth.currentUser) goto('/')
    const beginnerRef = doc(db, 'beginner', auth.currentUser.uid)
    const beginnerSnap = await getDoc(beginnerRef)
    if (beginnerSnap.exists()) beginner = beginnerSnap.data()
    else {
      await setDoc(beginnerRef, {
        uid: auth.currentUser.uid,
        join: false,
        activated: false,
      })
      beginner = (await getDoc(beginnerRef)).data()
    }
  }

  init()

  async function submit () {
    try {
      const beginnerRef = doc(db, 'beginner', beginner.uid)
      await updateDoc(beginnerRef, beginner)
      Swal.fire('success', '', 'success')
    } catch (err) {
      console.log(err)
    }
  }
</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
  <div class="text-2xl font-bold my-4">Beginner Course</div>
  <div class="flex items-center">
    <ACheckbox bind:value={beginner.join} />
    <div class="ml-2">Yes, I will come to Beginner Course 25T1.</div>
  </div>
  <div>
    <button class="px-4 py-1 font-bold bg-white rounded shadow text-blue-500 my-4 mr-2">Upload Receipt</button>
    <a>no file found</a>
  </div>
  <button class="px-4 py-1 font-bold bg-blue-500 rounded shadow text-white my-4" onclick={submit}>Submit</button>
</div>