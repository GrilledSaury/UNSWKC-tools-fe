<script>
  import { getDoc, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore"
  import { page } from '$app/stores'
  import Swal from "sweetalert2"
  import { goto } from '$app/navigation'
  import { db } from '$lib/firebase'
  import { onMount } from 'svelte'
  import { AIcon } from "ace.svelte"
  import { mdiHome } from "@mdi/js"
  import { userProfile } from '$lib/stores'

  let profile       = $state({})
  let membership    = $state(null)   // null = no doc, else { expiresAt: Timestamp }
  let profileId     = $state($page.url.searchParams.get('uid'))
  let memberExpiry  = $state(defaultExpiry())

  function defaultExpiry() {
    return `${new Date().getFullYear() + 1}-06-30`
  }

  function isMember(m) {
    return !!m?.expiresAt && m.expiresAt.toDate() > new Date()
  }

  function fmtExpiry(m) {
    if (!m?.expiresAt) return null
    return m.expiresAt.toDate().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const canEditMembership = $derived($userProfile?.permissions?.includes('membership'))
  const canViewMembership = $derived(
    canEditMembership
    || $userProfile?.permissions?.includes('profile')
    || $userProfile?.uid === profileId
  )

  onMount(async () => {
    const [userSnap, memberSnap] = await Promise.all([
      getDoc(doc(db, 'user', profileId)),
      getDoc(doc(db, 'membership', profileId)),
    ])
    if (userSnap.exists()) profile = userSnap.data()
    else {
      Swal.fire('Profile not found', '', 'error')
      goto('/home')
    }
    if (memberSnap.exists()) {
      membership   = memberSnap.data()
      const d      = membership.expiresAt?.toDate()
      if (d) memberExpiry = d.toISOString().slice(0, 10)
    }
  })

  async function update () {
    try {
      await updateDoc(doc(db, 'user', profileId), profile)
      Swal.fire('Successfully updated!', '', 'success')
    } catch (err) {
      console.log(err)
    }
  }

  async function saveMembership() {
    if (!canEditMembership || !memberExpiry) return
    try {
      const data = { expiresAt: Timestamp.fromDate(new Date(memberExpiry)), updatedAt: serverTimestamp() }
      await setDoc(doc(db, 'membership', profileId), data)
      membership = data
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  async function removeMembership() {
    if (!canEditMembership) return
    const { isConfirmed } = await Swal.fire({
      title: 'Remove membership?',
      confirmButtonText: 'Remove',
      confirmButtonColor: '#ef4444',
      showCancelButton: true,
    })
    if (!isConfirmed) return
    try {
      await deleteDoc(doc(db, 'membership', profileId))
      membership   = null
      memberExpiry = defaultExpiry()
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }
</script>

<div class="w-screen h-screen bg-gray-100 p-4 md:px-16 md:py-8">
  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36px" class="text-gray-500"></AIcon>
  </button>
  <div class="text-2xl font-bold my-2">Profile</div>
  <div class="text-gray-500 font-mono my-2">ID: {profileId}</div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Name</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.name}>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Email</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.email} disabled>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Email2</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.email2}>
  </div>
  <div class="flex my-2 items-center">
    <div class="w-16 mr-2">Phone</div>
    <input class="w-4/5 px-2 py-1 rounded" bind:value={profile.phone}>
  </div>
  <button class="bg-blue-500 font-bold hover:shadow rounded px-4 py-1 text-white my-4" onclick={update}>Update</button>

  {#if canViewMembership}
    <div class="border-t pt-4 mt-2">
      <div class="font-bold text-gray-700 mb-2">Membership</div>
      {#if canEditMembership}
        <div class="flex items-center gap-3 flex-wrap">
          <input type="date" bind:value={memberExpiry} class="border rounded px-2 py-1.5 text-sm" />
          <button
            class="bg-green-500 text-white font-bold px-3 py-1.5 rounded text-sm"
            onclick={saveMembership}
            disabled={!memberExpiry}
          >Save</button>
          {#if membership}
            <button class="text-red-400 text-sm hover:underline" onclick={removeMembership}>Remove</button>
          {/if}
        </div>
        {#if membership}
          <p class="text-xs mt-1 {isMember(membership) ? 'text-green-600' : 'text-red-400'}">
            {isMember(membership) ? 'Active' : 'Expired'} — expires {fmtExpiry(membership)}
          </p>
        {:else}
          <p class="text-xs text-gray-400 mt-1">No membership on record.</p>
        {/if}
      {:else}
        <span class="px-3 py-1 rounded text-sm font-semibold {isMember(membership) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
          {isMember(membership) ? `Active — expires ${fmtExpiry(membership)}` : 'Not a Member'}
        </span>
      {/if}
    </div>
  {/if}
</div>
