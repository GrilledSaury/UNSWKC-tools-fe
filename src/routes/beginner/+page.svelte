<script>
  import { auth, storage, db } from '$lib/firebase'
  import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
  import { ACheckbox, AIcon } from 'ace.svelte'
  import Swal from 'sweetalert2'
  import { goto } from '$app/navigation'
  import { onAuthStateChanged } from 'firebase/auth'
  import { mdiImageSearch } from '@mdi/js'
  import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'

  let beginner = $state({ join: false })
  let files = $state()
  let uploading = $state(false)

  onAuthStateChanged(auth, async u => {
    if (u === null) goto('/')
    const beginnerRef = doc(db, 'beginner', u.uid)
    const beginnerSnap = await getDoc(beginnerRef)
    if (beginnerSnap.exists()) beginner = beginnerSnap.data()
    else {
      await setDoc(beginnerRef, {
        uid: u.uid,
        join: false,
        activated: false,
      })
      beginner = (await getDoc(beginnerRef)).data()
    }
  })

  async function upload () {
    if (!files[0]) return
    uploading = true
    const url = `/${beginner.uid}/beginner/receipt-${files[0].name}`
    const receiptRef = ref(storage, url)
    try {
      await uploadBytes(receiptRef, files[0])
      beginner.fileUrl = await getDownloadURL(ref(storage, url))
      await submit()
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    uploading = false
  }

  function preview () {
    Swal.fire({
      imageUrl: beginner.fileUrl
    })
  }

  async function submit () {
    try {
      const beginnerRef = doc(db, 'beginner', beginner.uid)
      await updateDoc(beginnerRef, beginner)
      Swal.fire('Submission Saved!', '', 'success')
    } catch (err) {
      console.log(err)
    }
  }
</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
  <div class="text-2xl font-bold my-4">Beginner Course</div>
  <div class="h-1/2 w-4/5 my-2">
    beginner course details
  </div>
  <div class="flex items-center">
    <ACheckbox bind:value={beginner.join} />
    <div class="ml-2">Yes, I will come to Beginner Course 25T1.</div>
  </div>
  <div class="my-2 flex items-center">
    <label class="px-4 py-2 font-bold bg-white rounded shadow text-blue-500 my-4 mr-2">
      <input class="hidden" accept="image/png, image/jpeg" bind:files id="avatar" name="avatar" type="file" onchange={upload}/>
      {uploading ? 'Uploading' : 'Upload Receipt'}
    </label>
    {#if beginner.fileUrl }
      <button class="text-blue-500 text-sm flex items-center" onclick={preview}>
        <AIcon class="mr-1" path={mdiImageSearch}/>
        Preview
      </button>
    {/if}
  </div>
  <button class="px-4 py-1 font-bold bg-blue-500 rounded shadow text-white my-4" onclick={submit}>Submit</button>
  <button class={(beginner.activated ? 'bg-green-500 text-white' : 'bg-green-100 text-gray-300') + ' px-4 py-1 font-bold rounded shadow my-4 ml-4'}>
    {beginner.activated ? 'Entry Pass' : 'Unactivated'}
  </button>
</div>