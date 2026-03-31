<script>
  import { mdiAccount, mdiLogout, mdiSchool } from '@mdi/js'
  import { AIcon, ASwitch } from 'ace.svelte'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  let adminMode = $state(false)

  function goProfile() {
    if (adminMode) goto('/profile/admin')
    else goto('/profile/?uid=' + $userProfile.uid)
  }

  function goBeginner() {
    if (adminMode) goto('/beginner/admin')
    else goto('/beginner')
  }
</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col p-3 sm:p-10">
  <div class="flex items-center">
    <h1 class="text-gray-700 font-bold text-3xl m-3">Welcome, {$userProfile.name}</h1>
    <div class="grow"></div>
    <button onclick={() => goto('/')}><AIcon class="text-red-500" path={mdiLogout}></AIcon></button>
  </div>
  <div class="flex flex-wrap items-center">
    <button
      class={(adminMode ? 'border-blue-500 ' : 'border-gray-100 ') + 'border border-2 m-2 px-3 py-2 rounded shadow bg-white transition-all flex items-center sm:justify-center'}
      onclick={goProfile}
    >
      <AIcon path={mdiAccount} class="text-blue-500 mr-3 sm:mr-1"/>
      My Profile
    </button>
    <button
      class={(adminMode ? 'border-blue-500 ' : 'border-gray-100 ') + 'border border-2 m-2 px-3 py-2 rounded shadow bg-white transition-all flex items-center sm:justify-center'}
      onclick={goBeginner}
    >
      <AIcon path={mdiSchool} class="text-yellow-500 mr-3 sm:mr-1"/>
      Beginner Course
    </button>
    {#if $userProfile.admin}
      <label class="flex items-center m-2">
        <ASwitch bind:value={adminMode} />
        <div class="ml-2">Admin Mode</div>
      </label>
    {/if}
  </div>
</div>
