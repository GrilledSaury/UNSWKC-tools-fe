<script>
  import { auth } from "$lib/firebase"

  import {
    signInWithPopup,
    GoogleAuthProvider,
    setPersistence,
    browserLocalPersistence,
  } from "firebase/auth"

  import { setDoc, doc, getDoc, getFirestore } from "firebase/firestore"

  import { goto } from '$app/navigation'

  // let hint = $state('')
  // let email = $state('')
  // let password = $state('')
  // let confirmPasswrod = $state('')
  // let signInMode = $state(0) // 0 for start, 1 for signing up, 2 for signing in

  let loading = $state(false)

  async function loginWithGoogle () {
    if (loading) return
    loading = true
    const provider = new GoogleAuthProvider();
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Local persistence enabled.')
      })
      .catch(err => {
        console.log(err)
      })
    
    signInWithPopup(auth, provider)
      .then(async res => {
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(res);
        const token = credential.accessToken;
        // The signed-in user info.
        const resUser = res.user;
        // IdP data available using getAdditionalUserInfo(result)
        // ...
        const db = getFirestore()
        const docRef = doc(db, 'user', resUser.uid)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) return goto('/home')
        else {
          await setDoc(docRef, {
            name: resUser.displayName,
            email: resUser.email,
            admin: false
          })
          loading = false
          goto('/home')
        }
      }).catch((error) => {
        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorMessage)
        loading = false
      });
  }

</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center">
  <div class="text-2xl font-bold my-8 w-4/5 sm:w-1/2">UNSWKC-tools</div>
  <div class="flex flex-col w-4/5 sm:w-1/2 justify-center">
    <button class="rounded my-2 p-4 bg-blue-500 text-white shadow transition-all hover:shadow-md flex items-center justify-center whitespace-nowrap font-bold text-xl" onclick={loginWithGoogle}>Sign in with Google</button>
    <button class="rounded my-2 text-gray-500 whitespace-nowrap">Continue without Signing in</button>
  </div>
</div>
