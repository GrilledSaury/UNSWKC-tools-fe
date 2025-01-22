<script>
  import "$lib/firebase.js"

  import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
  } from "firebase/auth";

  import { goto } from '$app/navigation'

  let hint = $state('')
  let email = $state('')
  let password = $state('')
  let confirmPasswrod = $state('')
  let signInMode = $state(0) // 0 for start, 1 for signing up, 2 for signing in

  async function loginWithEmail () {
    const auth = getAuth();

    if (signInMode === 0) {
      // TODO: check if user exists
      return
    }

    // TODO: display password inputs

    if (signInMode === 1) {
      // TODO: check confirmed password
      createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          // Signed up 
          const user = userCredential.user;
          console.log(user)
          goto('/home')
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          console.log(error.message)
        });
    }

    if (signInMode === 2) {
      signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          // Signed in 
          const user = userCredential.user;
          console.log(user)
          goto('/home')
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          console.log(error.message)
        });
    }
  }

  async function loginWithGoogle () {
    const provider = new GoogleAuthProvider();

    const auth = getAuth();
      signInWithPopup(auth, provider)
        .then((result) => {
          // This gives you a Google Access Token. You can use it to access the Google API.
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential.accessToken;
          // The signed-in user info.
          const user = result.user;
          // IdP data available using getAdditionalUserInfo(result)
          // ...
          console.log(token, user)
          goto('/home')
        }).catch((error) => {
          // Handle Errors here.
          const errorCode = error.code;
          const errorMessage = error.message;
          // The email of the user's account used.
          const email = error.customData.email;
          // The AuthCredential type that was used.
          const credential = GoogleAuthProvider.credentialFromError(error);
          console.log(errorMessage)
        });
  }

</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center">
  <div class="text-2xl font-bold my-4 w-4/5 md:w-1/2">UNSWKC-tools</div>
  {#if signInMode}
    <div class="text-gray-500 my-2 w-4/5 md:w-1/2 whitespace-nowrap">{hint}</div>
  {/if}
  <div class="w-4/5 md:w-1/2">
    <input class="my-2 p-1 w-full" placeholder="Email (use Gmail to join our mailing list)" bind:value={email} onchange={() => { signInMode = 0 }}>
    {#if signInMode}
      <input class="my-2 p-1 w-full" placeholder="password" type="password" bind:value={password}>
      {#if signInMode === 1}
        <input class="my-2 p-1 w-full" placeholder="confirm password" type="password" bind:value={confirmPasswrod}>
      {/if}
    {/if}
  </div>
  <div class="flex flex-col w-4/5 md:w-1/2 justify-center">
    <button class="rounded my-2 px-4 py-1 bg-blue-500 text-white shadow whitespace-nowrap" onclick={loginWithEmail}>Sign up / Sign in</button>
    <button class="rounded my-2 px-4 py-1 bg-white text-blue-500 shadow flex items-center justify-center whitespace-nowrap" onclick={loginWithGoogle}>Continue with Google account</button>
    <button class="rounded my-2 px-4 py-1 bg-white text-gray-500 shadow whitespace-nowrap">Continue without signing in</button>
  </div>
</div>
