<script>
  import { onMount } from 'svelte'
  import { db, storage } from '$lib/firebase'
  import {
    doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp,
  } from 'firebase/firestore'
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
  import { AIcon } from 'ace.svelte'
  import { mdiArrowLeft, mdiLock, mdiLockOpen } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { userProfile } from '$lib/stores'
  import Swal from 'sweetalert2'
  import ItemList from '$lib/components/ItemList.svelte'

  const eventId = $page.params.eventId
  const uid     = $derived($userProfile?.uid)

  let event   = $state(null)
  let order   = $state(null)   // null = no order doc yet
  let loading = $state(true)
  let saving  = $state(false)

  function fmtDatetime(ts) {
    if (!ts) return null
    return ts.toDate().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const STATUS_LABELS = {
    pending:          'Pending review',
    rejected:         'Rejected',
    confirmed:        'Confirmed',
    ordered:          'Ordered',
    awaiting_payment: 'Awaiting payment',
    closed:           'Closed',
  }

  const STATUS_COLORS = {
    pending:          'bg-yellow-100 text-yellow-700',
    rejected:         'bg-red-100 text-red-700',
    confirmed:        'bg-blue-100 text-blue-700',
    ordered:          'bg-indigo-100 text-indigo-700',
    awaiting_payment: 'bg-orange-100 text-orange-700',
    closed:           'bg-gray-100 text-gray-500',
  }

  async function load() {
    const [evSnap, ordSnap] = await Promise.all([
      getDoc(doc(db, 'events', eventId)),
      getDoc(doc(db, 'events', eventId, 'orders', uid)),
    ])
    if (!evSnap.exists()) { goto('/orders'); return }
    event = { id: evSnap.id, ...evSnap.data() }
    order = ordSnap.exists() ? ordSnap.data() : null
  }

  async function handleItemsChange(newItems) {
    if (saving) return
    saving = true
    try {
      const orderRef = doc(db, 'events', eventId, 'orders', uid)
      if (order === null) {
        const data = { items: newItems, status: 'pending', locked: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
        await setDoc(orderRef, data)
        order = { ...data, updatedAt: Timestamp.now() }
      } else {
        await updateDoc(orderRef, { items: newItems, updatedAt: serverTimestamp() })
        order = { ...order, items: newItems, updatedAt: Timestamp.now() }
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    saving = false
  }

  async function lockOrder() {
    const { isConfirmed } = await Swal.fire({
      title: 'Lock your order?',
      text: 'Admin will begin reviewing once locked. You cannot make changes until admin unlocks it.',
      confirmButtonText: 'Lock Order',
      confirmButtonColor: '#374151',
      showCancelButton: true,
    })
    if (!isConfirmed) return
    saving = true
    try {
      await updateDoc(doc(db, 'events', eventId, 'orders', uid), { locked: true, updatedAt: serverTimestamp() })
      order = { ...order, locked: true, updatedAt: Timestamp.now() }
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    saving = false
  }

  let paymentInput  = $state(null)
  let uploading     = $state(false)

  async function handlePaymentFile(e) {
    const file = e.target.files[0]
    if (!file) return
    uploading = true
    try {
      const storageRef = ref(storage, `orders/${eventId}/${uid}/payment/${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'events', eventId, 'orders', uid), { payment: url, updatedAt: serverTimestamp() })
      order = { ...order, payment: url, updatedAt: Timestamp.now() }
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    uploading = false
    e.target.value = ''
  }

  onMount(async () => {
    if (!$userProfile) { goto('/'); return }
    await load()
    loading = false
  })

  const canEdit = $derived(
    event?.status === 'open' && order?.locked === false
  )
</script>

<input
  type="file"
  bind:this={paymentInput}
  class="hidden"
  accept=".pdf,.jpg,.jpeg,.png"
  onchange={handlePaymentFile}
/>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/orders')}>
    <AIcon path={mdiArrowLeft} size="36" class="text-gray-500" />
  </button>

  {#if loading}
    <div class="text-gray-500 text-center mt-16">Loading...</div>

  {:else if event}
    <!-- Event header -->
    <div class="mt-4 mb-6">
      <div class="text-2xl font-bold">{event.title}</div>
      {#if event.description}
        <div class="text-gray-500 mt-1">{event.description}</div>
      {/if}
    </div>

    <!-- Order status banner (if order exists) -->
    {#if order}
      <div class="bg-white rounded shadow px-4 py-3 mb-4 sm:flex items-center gap-3">
        <span class="text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap {STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
        {#if order.locked}
          <span class="flex mt-2 items-center gap-1 text-xs text-gray-500 whitespace-nowrap overflow-scroll">
            <AIcon path={mdiLock} size="14" />Locked — contact admin to make changes
          </span>
        {:else}
          <span class="flex mt-2 items-center gap-1 text-xs text-gray-400 whitespace-nowrap overflow-scroll">
            <AIcon path={mdiLockOpen} size="14" />Unlocked
          </span>
        {/if}
        {#if order.status === 'rejected'}
          <span class="text-xs text-red-500 ml-auto">If you don't know why, please contact the armourer.</span>
        {:else if fmtDatetime(order.updatedAt)}
          <span class="text-xs text-gray-400 ml-auto">Updated {fmtDatetime(order.updatedAt)}</span>
        {/if}
      </div>

      <!-- Payment section -->
      {#if order.status === 'awaiting_payment'}
        <div class="bg-orange-50 border border-orange-200 rounded shadow px-4 py-3 mb-4">
          <div class="font-bold text-orange-800 mb-2">Payment Required</div>
          {#if order.invoice}
            <a href={order.invoice} target="_blank" rel="noopener noreferrer"
               class="text-sm text-blue-600 hover:underline block mb-2">View Invoice</a>
          {/if}
          <button
            class="bg-orange-500 text-white font-bold px-3 py-1.5 rounded shadow text-sm disabled:opacity-50"
            onclick={() => paymentInput.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : order.payment ? 'Replace Receipt' : 'Upload Payment Receipt'}
          </button>
          {#if order.payment}
            <a href={order.payment} target="_blank" rel="noopener noreferrer"
               class="text-sm text-green-600 hover:underline block mt-2">Receipt submitted ✓</a>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Items -->
    <div class="bg-white rounded shadow px-4 py-3 mb-4">
      <div class="font-bold text-gray-700 mb-3">Items</div>
      <ItemList
        items={order?.items ?? []}
        itemPrices={order?.itemPrices ?? {}}
        editable={canEdit || order === null}
        onItemsChange={handleItemsChange}
      />
    </div>

    <!-- Lock button -->
    {#if order && !order.locked && order.items?.length > 0 && event.status === 'open'}
      <button
        class="bg-gray-800 text-white font-bold px-4 py-2 rounded shadow flex items-center gap-2 disabled:opacity-50"
        onclick={lockOrder}
        disabled={saving}
      >
        <AIcon path={mdiLock} size="18" />Lock & Submit Order
      </button>
      <p class="text-xs text-gray-400 mt-2">Locking tells admin your order is ready to review.</p>
    {/if}
  {/if}

</div>
