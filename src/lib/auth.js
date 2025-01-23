import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { writable } from 'svelte/store'

const auth = getAuth()
const user = writable(null)
onAuthStateChanged(auth, u => {
  user.set(u)
})

export default user
