<script>
  import { getAuth } from "firebase/auth";

  const auth = getAuth();
  const user = auth.currentUser;
  if (user !== null) {
    console.log(user)
  }
</script>

<p>home</p>