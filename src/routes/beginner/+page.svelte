<script>
  import { auth, storage, db } from '$lib/firebase'
  import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
  import { ACheckbox, AIcon } from 'ace.svelte'
  import Swal from 'sweetalert2'
  import { goto } from '$app/navigation'
  import { onAuthStateChanged } from 'firebase/auth'
  import { mdiCheck, mdiImageSearch } from '@mdi/js'
  import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
  import QRCode from 'qrcode'

  let beginner = $state({ join: false })
  let files = $state()
  let previewUrl = $state('')
  let uploading = $state(false)
  const getUid = () => auth.currentUser.uid

  onAuthStateChanged(auth, async u => {
    if (u === null) goto('/')
    const beginnerRef = doc(db, 'beginner', u.uid)
    const beginnerSnap = await getDoc(beginnerRef)
    if (beginnerSnap.exists()) beginner = beginnerSnap.data()
    else {
      await setDoc(beginnerRef, {
        join: false,
        activated: false,
        progress: [false, false, false, false]
      })
      beginner = (await getDoc(beginnerRef)).data()
    }
  })

  async function upload () {
    if (!files[0] || uploading) return
    uploading = true
    const path = `/${getUid()}/beginner/receipt-${files[0].name}`
    const receiptRef = ref(storage, path)
    try {
      await uploadBytes(receiptRef, files[0])
      beginner.filePath = path
      await submit()
      previewUrl = ''
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    uploading = false
  }

  async function preview () {
    try {
      if (!previewUrl) previewUrl = await getDownloadURL(ref(storage, beginner.filePath))
      Swal.fire({
        imageUrl: previewUrl
      })
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  async function submit () {
    try {
      const beginnerRef = doc(db, 'beginner', getUid())
      await updateDoc(beginnerRef, beginner)
      Swal.fire('Submission Saved!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

async function showQRCode () {
  if (!beginner.activated) return
  try {
    Swal.fire({
      imageUrl: await QRCode.toDataURL(getUid()),
      imageHeight: 360
    })
  } catch (err) {
    console.error(err)
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
    {#if beginner.filePath }
      <button class="text-blue-500 text-sm flex items-center" onclick={preview}>
        <AIcon class="mr-1" path={mdiImageSearch}/>
        Preview
      </button>
    {/if}
  </div>
  <button class="px-4 py-1 font-bold bg-blue-500 rounded shadow text-white my-4" onclick={submit}>Submit</button>
  <button
    class={(beginner.activated ? 'bg-green-500 text-white' : 'bg-green-100 text-gray-300') + ' px-4 py-1 font-bold rounded shadow my-4 ml-4'}
    onclick={showQRCode}
  >
    {beginner.activated ? 'Entry Pass' : 'Unactivated'}
  </button>
  {#if beginner.progress}
    <div class="flex items-center">
      <div class="text-xl mr-2">Progress</div>
      {#each beginner.progress as p}
        <AIcon class={p ? 'text-green-500 mx-1' : 'text-gray-500 mx-1'} path={mdiCheck}></AIcon>
      {/each}
    </div>
  {/if}
</div>