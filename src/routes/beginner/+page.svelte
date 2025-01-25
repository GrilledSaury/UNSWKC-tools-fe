<script>
  import { auth } from '$lib/firebase'
  import { doc, getDoc, setDoc } from "firebase/firestore"
  import { db } from "../../lib/firebase"
  import { onAuthStateChanged } from 'firebase/auth'

  let beginner = $state({})
  let user = $state({})

  onAuthStateChanged(auth, async u => {
    if (u === null) goto('/')
		const userRef = doc(db, 'user', u.uid)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) user = userSnap.data()
    else goto('/')

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
</script>

<div class="w-screen min-h-screen bg-gray-100 px-16 py-8">
  <div class="text-2xl font-bold my-4">Beginner Course</div>
  {beginner.uid}, {beginner.join}
</div>