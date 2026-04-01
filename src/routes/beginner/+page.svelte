<script>
  import { auth, storage, db } from '$lib/firebase'
  import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
  import { ACheckbox, AIcon } from 'ace.svelte'
  import Swal from 'sweetalert2'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { mdiAccount, mdiCheck, mdiHome, mdiImageSearch } from '@mdi/js'
  import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
  import QRCode from 'qrcode'
  import { userProfile } from '$lib/stores'

  const DEFAULT_CONFIG = {
    title: 'Beginner Course 26T2.',
    content:
`Thank you for your interest in our club! Our upcoming Beginners Course is expected to commence on Wednesday 19th Feburary (Term 1 week 1). Classes will be held on Wednesday weekly from 7:30 pm to 9:00 pm.
This course is mandatory for any beginners intending to take up Kendo.
During the course, you will learn the fundamental footwork, swinging/cutting techniques and etiquette in Kendo.

Proposed schedule:
. 7:30pm - 9:00pm
. 7:30pm - 9:00pm
. 7:30pm - 9:00pm
. 7:30pm - 9:00pm

Location:
UNSW Fitness and Aquatic Centre (B5), Gate 2, High St, UNSW Sydney, Kensington NSW 2052
Group Fitness Room 1 (Courtside Studio), Level 1

Cost:
$. - UNSW Students
$. - UNSW Alumni/Staff/Other Students
$. - Members of the Public

Uniforms are not required - just come in loose, comfortable clothes.
All equipment is provided to students at no additional cost.

BANK DETAILS:
Please make your payment to the following account:
NAME: UNSW KENDO CLUB
BSB: 062 303
ACCOUNT NUMBER: 1088 6082
BANK: Commonwealth Bank
DESCRIPTION: 'Beginner Course [your initials]' (eg. "Beginners Course JS" for John Smith)

Any further information regarding the course will be sent through email prior to the trainings

As usual, please don't hesitate to contact us by 𝒊𝒏𝒇𝒐𝒓𝒎𝒂𝒕𝒊𝒐𝒏@𝒖𝒏𝒔𝒘𝒌𝒆𝒏𝒅𝒐.𝒐𝒓𝒈 if you have any questions.`
  }

  let config = $state({ ...DEFAULT_CONFIG })
  let beginner = $state({ join: false })
  let files = $state()
  let previewUrl = $state('')
  let uploading = $state(false)
  let loadingMessage = $state('')
  const getUid = () => $userProfile.uid

  onMount(async () => {
    const uid = $userProfile.uid

    const [configSnap, beginnerSnap] = await Promise.all([
      getDoc(doc(db, 'config', 'beginner')),
      getDoc(doc(db, 'beginner', uid)),
    ])

    if (configSnap.exists()) config = configSnap.data()

    if (beginnerSnap.exists()) beginner = beginnerSnap.data()
    else {
      await setDoc(doc(db, 'beginner', uid), {
        join: false,
        activated: false,
        progress: [false, false, false, false]
      })
      beginner = (await getDoc(doc(db, 'beginner', uid))).data()
    }
  })

  async function upload () {
    if (!files[0] || uploading) return
    uploading = true
    loadingMessage = 'Uploading receipt...'
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
    loadingMessage = ''
  }

  async function preview () {
    loadingMessage = 'Loading image...'
    try {
      if (!previewUrl) previewUrl = await getDownloadURL(ref(storage, beginner.filePath))
      await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = reject
        img.src = previewUrl
      })
      loadingMessage = ''
      Swal.fire({ imageUrl: previewUrl })
    } catch (err) {
      loadingMessage = ''
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

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">
  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500"></AIcon>
  </button>
  <div class="text-2xl font-bold my-4">Beginner Course</div>
  <button class="px-4 py-2 font-bold bg-white rounded shadow text-blue-500 my-4 flex items-center" onclick={() => goto('/profile/?uid=' + $userProfile.uid)}>
    <AIcon path={mdiAccount} class="mr-2"></AIcon>
    Update my details
  </button>
  <div class="h-96 my-2 overflow-scroll bg-white p-4 rounded whitespace-pre-wrap">{config.content}</div>
  <div class="flex items-center">
    <ACheckbox bind:value={beginner.join} />
    <div class="ml-2">Yes, I will come to {config.title}</div>
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

{#if loadingMessage}
  <div class="fixed inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-50">
    <div class="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
    <div class="text-white font-bold text-lg">{loadingMessage}</div>
    <div class="text-white text-sm mt-1">Please do not close this page</div>
  </div>
{/if}
