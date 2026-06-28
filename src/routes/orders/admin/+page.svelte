<script>
  import { onMount } from 'svelte'
  import { db } from '$lib/firebase'
  import {
    collection, getDocs, addDoc, updateDoc, deleteDoc,
    doc, orderBy, query, serverTimestamp, Timestamp,
  } from 'firebase/firestore'
  import { AIcon } from 'ace.svelte'
  import { mdiHome, mdiPlus, mdiPencil, mdiDelete, mdiChevronRight, mdiClose, mdiCheck } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'
  import Swal from 'sweetalert2'

  let events  = $state([])
  let loading = $state(true)
  let saving  = $state(false)

  let showModal = $state(false)
  let editId    = $state(null)
  let form      = $state({ title: '', description: '', dueDate: '', status: 'open' })

  function fmt(ts) {
    if (!ts) return '—'
    return ts.toDate().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  async function load() {
    const snap = await getDocs(query(collection(db, 'events'), orderBy('dueDate', 'asc')))
    events = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1
        return (a.dueDate?.toMillis() ?? 0) - (b.dueDate?.toMillis() ?? 0)
      })
  }

  function openCreate() {
    editId = null
    form   = { title: '', description: '', dueDate: '', status: 'open' }
    showModal = true
  }

  function openEdit(ev) {
    editId = ev.id
    form   = {
      title:       ev.title       ?? '',
      description: ev.description ?? '',
      dueDate:     ev.dueDate ? ev.dueDate.toDate().toISOString().slice(0, 10) : '',
      status:      ev.status      ?? 'open',
    }
    showModal = true
  }

  async function save() {
    if (!form.title.trim() || !form.dueDate) return
    if (saving) return
    saving = true
    try {
      const data = {
        title:       form.title.trim(),
        description: form.description.trim(),
        dueDate:     Timestamp.fromDate(new Date(form.dueDate)),
        status:      form.status,
      }
      if (editId) {
        await updateDoc(doc(db, 'events', editId), data)
      } else {
        await addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() })
      }
      showModal = false
      await load()
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    saving = false
  }

  async function remove(ev) {
    const { isConfirmed } = await Swal.fire({
      title: 'Delete event?',
      text: ev.title,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444',
      showCancelButton: true,
    })
    if (!isConfirmed) return
    try {
      await deleteDoc(doc(db, 'events', ev.id))
      events = events.filter(e => e.id !== ev.id)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  onMount(async () => {
    if (!$userProfile?.permissions?.includes('orders')) { goto('/home'); return }
    await load()
    loading = false
  })
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/home')}>
    <AIcon path={mdiHome} size="36" class="text-gray-500" />
  </button>
  <div class="flex items-center mt-4 mb-6">
    <div class="text-2xl font-bold">Order Events</div>
    <div class="grow"></div>
    <button
      class="bg-green-500 text-white font-bold px-3 py-1.5 rounded shadow flex items-center gap-1"
      onclick={openCreate}
    >
      <AIcon path={mdiPlus} size="18" />New Event
    </button>
  </div>

  {#if loading}
    <div class="text-gray-500 text-center mt-16">Loading...</div>

  {:else if events.length === 0}
    <div class="text-gray-400 text-center mt-16">No events yet. Create one above.</div>

  {:else}
    <div class="flex flex-col gap-2">
      {#each events as ev}
        <div class="bg-white rounded shadow px-4 py-3 flex items-center gap-3">
          <button class="grow min-w-0 text-left" onclick={() => goto('/orders/admin/' + ev.id)}>
            <div class="font-bold text-gray-800 truncate">{ev.title}</div>
            <div class="text-sm text-gray-500 mt-0.5">Due {fmt(ev.dueDate)}</div>
          </button>
          <span class="text-xs font-bold px-4 py-1 rounded-full shrink-0
            {ev.status === 'open' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}">
            {ev.status}
          </span>
          <button class="text-blue-500 p-1 shrink-0" onclick={() => openEdit(ev)}>
            <AIcon path={mdiPencil} />
          </button>
          <button class="text-red-400 p-1 shrink-0" onclick={() => remove(ev)}>
            <AIcon path={mdiDelete} />
          </button>
          <button class="text-gray-300 p-1 shrink-0" onclick={() => goto('/orders/admin/' + ev.id)}>
            <AIcon path={mdiChevronRight} size="20" />
          </button>
        </div>
      {/each}
    </div>
  {/if}

</div>

{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-md flex flex-col">
      <div class="p-4 font-bold text-xl border-b">
        {editId ? 'Edit Event' : 'New Event'}
      </div>
      <div class="p-4 flex flex-col gap-4">
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Title <span class="text-red-400">*</span></span>
          <input
            bind:value={form.title}
            class="border rounded px-2 py-1.5"
            placeholder="e.g. 2026 Term 2 Club Order"
          />
        </label>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Description</span>
          <textarea
            bind:value={form.description}
            rows="3"
            class="border rounded px-2 py-1.5 resize-none"
            placeholder="Optional details…"
          ></textarea>
        </label>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Due Date <span class="text-red-400">*</span></span>
          <input type="date" bind:value={form.dueDate} class="border rounded px-2 py-1.5" />
        </label>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Status</span>
          <select bind:value={form.status} class="border rounded px-2 py-1.5 bg-white">
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>
      <div class="p-4 border-t flex justify-end gap-2">
        <button
          class="px-4 py-1.5 rounded border font-bold flex items-center gap-1"
          onclick={() => showModal = false}
        >
          <AIcon path={mdiClose} size="18" />Cancel
        </button>
        <button
          class="px-4 py-1.5 rounded bg-blue-500 text-white font-bold flex items-center gap-1 disabled:opacity-50"
          onclick={save}
          disabled={saving || !form.title.trim() || !form.dueDate}
        >
          <AIcon path={mdiCheck} size="18" />
          {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  </div>
{/if}
