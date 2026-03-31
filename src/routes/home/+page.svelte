<script>
  import { mdiAccount, mdiLogout, mdiSchool, mdiAccountGroup } from '@mdi/js'
  import { AIcon } from 'ace.svelte'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  // Apps visible to everyone
  const baseApps = [
    { label: 'My Profile', icon: mdiAccount, color: 'text-blue-500', href: () => '/profile/?uid=' + $userProfile.uid },
    { label: 'Beginner Course', icon: mdiSchool, color: 'text-yellow-500', href: () => '/beginner' },
  ]

  // Apps shown only when user has the matching permission
  const permissionApps = [
    { permission: 'beginner', label: "Beginners' Admin", icon: mdiSchool, color: 'text-orange-500', href: '/beginner/admin' },
    { permission: 'profile', label: "Users' Admin", icon: mdiAccountGroup, color: 'text-blue-700', href: '/profile/admin' },
  ]
</script>

<div class="h-screen w-screen bg-gray-100 flex flex-col p-3 sm:p-10">
  <div class="flex items-center mb-4">
    <h1 class="text-gray-700 font-bold text-3xl m-3">Welcome, {$userProfile.name}</h1>
    <div class="grow"></div>
    <button onclick={() => goto('/')}><AIcon class="text-red-500" path={mdiLogout}></AIcon></button>
  </div>
  <div class="flex flex-wrap items-center">
    {#each baseApps as app}
      <button
        class="border border-2 border-gray-100 m-2 px-3 py-2 rounded shadow bg-white transition-all flex items-center sm:justify-center"
        onclick={() => goto(app.href())}
      >
        <AIcon path={app.icon} class="{app.color} mr-3 sm:mr-1"/>
        {app.label}
      </button>
    {/each}
    {#each permissionApps.filter(a => $userProfile.permissions?.includes(a.permission)) as app}
      <button
        class="border border-2 border-gray-100 m-2 px-3 py-2 rounded shadow bg-white transition-all flex items-center sm:justify-center"
        onclick={() => goto(app.href)}
      >
        <AIcon path={app.icon} class="{app.color} mr-3 sm:mr-1"/>
        {app.label}
      </button>
    {/each}
  </div>
</div>
