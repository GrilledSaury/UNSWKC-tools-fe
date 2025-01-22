<script>
  import { getAuth } from "firebase/auth";
  import { collection, getDocs } from "firebase/firestore";
  import { db } from "../../lib/firebase";

  import { goto } from '$app/navigation'

  const auth = getAuth();
  const authUser = auth.currentUser;
  let user = $state({ name: '' })
  if (authUser === null) goto('/')
  getDocs(collection(db, 'user'))
    .then(querySnapshot => {
      user = querySnapshot.docs[0].data()
    })
    .catch(err => {
      console.log(err)
    })
</script>

<p>Welcome, {user.name}</p>