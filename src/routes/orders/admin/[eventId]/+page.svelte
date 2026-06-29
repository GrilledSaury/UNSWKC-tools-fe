<script>
  import { onMount } from 'svelte'
  import { db, storage } from '$lib/firebase'
  import {
    doc, getDoc, getDocs, updateDoc, collection, serverTimestamp, Timestamp,
  } from 'firebase/firestore'
  import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
  import { slide } from 'svelte/transition'
  import { AIcon } from 'ace.svelte'
  import { mdiArrowLeft, mdiLockOpen, mdiChevronDown, mdiChevronUp } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { userProfile } from '$lib/stores'
  import Swal from 'sweetalert2'
  import ItemList from '$lib/components/ItemList.svelte'

  const eventId = $page.params.eventId

  let event    = $state(null)
  let orders   = $state([])   // [{ uid, userName, ...orderData }]
  let loading  = $state(true)
  let expanded = $state(new Set())

  function toggleExpanded(uid) {
    const next = new Set(expanded)
    next.has(uid) ? next.delete(uid) : next.add(uid)
    expanded = next
  }

  function fmtDatetime(ts) {
    if (!ts) return null
    return ts.toDate().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const STATUSES = ['pending', 'rejected', 'confirmed', 'ordered', 'awaiting_payment', 'closed']

  const STATUS_LABELS = {
    pending:          'Pending',
    rejected:         'Rejected',
    confirmed:        'Confirmed',
    ordered:          'Ordered',
    awaiting_payment: 'Awaiting Payment',
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
    const [evSnap, ordersSnap, usersSnap] = await Promise.all([
      getDoc(doc(db, 'events', eventId)),
      getDocs(collection(db, 'events', eventId, 'orders')),
      getDocs(collection(db, 'user')),
    ])
    if (!evSnap.exists()) { goto('/orders/admin'); return }
    event = { id: evSnap.id, ...evSnap.data() }

    const nameMap = Object.fromEntries(usersSnap.docs.map(d => [d.id, d.data().name]))

    orders = ordersSnap.docs
      .map(d => ({ uid: d.id, userName: nameMap[d.id] ?? d.id, ...d.data() }))
      .sort((a, b) => a.userName.localeCompare(b.userName))
  }

  async function updateStatus(uid, status) {
    try {
      await updateDoc(doc(db, 'events', eventId, 'orders', uid), { status, updatedAt: serverTimestamp() })
      orders = orders.map(o => o.uid === uid ? { ...o, status, updatedAt: Timestamp.now() } : o)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  async function unlock(uid) {
    const { isConfirmed } = await Swal.fire({
      title: 'Unlock order?',
      text: 'User will be able to edit their items again.',
      confirmButtonText: 'Unlock',
      confirmButtonColor: '#374151',
      showCancelButton: true,
    })
    if (!isConfirmed) return
    try {
      await updateDoc(doc(db, 'events', eventId, 'orders', uid), { locked: false, updatedAt: serverTimestamp() })
      orders = orders.map(o => o.uid === uid ? { ...o, locked: false, updatedAt: Timestamp.now() } : o)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  async function handleItemsChange(uid, newItems) {
    try {
      await updateDoc(doc(db, 'events', eventId, 'orders', uid), { items: newItems, updatedAt: serverTimestamp() })
      orders = orders.map(o => o.uid === uid ? { ...o, items: newItems, updatedAt: Timestamp.now() } : o)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  async function handlePriceChange(uid, index, value) {
    const price = value === '' ? null : Number(value)
    const existing = orders.find(o => o.uid === uid)?.itemPrices ?? {}
    const newPrices = { ...existing, [index]: price }
    try {
      await updateDoc(doc(db, 'events', eventId, 'orders', uid), { itemPrices: newPrices, updatedAt: serverTimestamp() })
      orders = orders.map(o => o.uid === uid ? { ...o, itemPrices: newPrices, updatedAt: Timestamp.now() } : o)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  function csvField(s) {
    s = String(s ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }

  function sendToInvoice(order) {
    const lines = ['name,discount_pct,item,quantity,rate']
    ;(order.items ?? []).forEach((item, i) => {
      const price = order.itemPrices?.[i] ?? 0
      lines.push([csvField(order.userName), 0, csvField(item.name), 1, price].join(','))
    })
    localStorage.setItem('pendingInvoiceImport', JSON.stringify({
      csv:     lines.join('\n'),
      payDesc: event.title ?? '',
    }))
    goto('/invoice/admin')
  }

  async function setInvoice(uid, url) {
    try {
      await updateDoc(doc(db, 'events', eventId, 'orders', uid), { invoice: url, updatedAt: serverTimestamp() })
      orders = orders.map(o => o.uid === uid ? { ...o, invoice: url, updatedAt: Timestamp.now() } : o)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  let fileInput        = $state(null)
  let pendingUploadUid = $state(null)
  let uploading        = $state(false)

  function triggerInvoiceUpload(uid) {
    pendingUploadUid = uid
    fileInput.click()
  }

  async function handleInvoiceFile(e) {
    const file = e.target.files[0]
    if (!file || !pendingUploadUid) return
    uploading = true
    try {
      const storageRef = ref(storage, `orders/${eventId}/${pendingUploadUid}/invoice/${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await setInvoice(pendingUploadUid, url)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
    uploading = false
    e.target.value = ''
    pendingUploadUid = null
  }

  onMount(async () => {
    if (!$userProfile?.permissions?.includes('orders')) { goto('/home'); return }
    await load()
    loading = false
  })
</script>

<input
  type="file"
  bind:this={fileInput}
  class="hidden"
  accept=".pdf,.jpg,.jpeg,.png"
  onchange={handleInvoiceFile}
/>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <button onclick={() => goto('/orders/admin')}>
    <AIcon path={mdiArrowLeft} size="36" class="text-gray-500" />
  </button>

  {#if loading}
    <div class="text-gray-500 text-center mt-16">Loading...</div>

  {:else if event}
    <div class="mt-4 mb-6">
      <div class="text-2xl font-bold">{event.title}</div>
      {#if event.description}
        <div class="text-gray-500 mt-1">{event.description}</div>
      {/if}
    </div>

    {#if orders.length === 0}
      <div class="text-gray-400 text-center mt-16">No orders yet.</div>
    {:else}
      <div class="flex flex-col gap-4">
        {#each orders as order (order.uid)}
          <div class="bg-white rounded shadow px-4 py-4">

            <!-- Order header -->
            <button
              class="flex items-center gap-3 w-full text-left flex-wrap"
              onclick={() => toggleExpanded(order.uid)}
            >
              <div class="grow min-w-0">
                <div class="font-bold text-gray-800">{order.userName}</div>
                {#if fmtDatetime(order.updatedAt)}
                  <div class="text-xs text-gray-400 mt-0.5">Updated {fmtDatetime(order.updatedAt)}</div>
                {/if}
              </div>
              {#if order.locked}
                <span class="text-xs bg-gray-800 text-white px-2 py-0.5 rounded font-semibold">Locked</span>
              {:else}
                <span class="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">Unlocked</span>
              {/if}
              <span class="text-xs font-bold px-3 py-1 rounded-full {STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}">
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
              <span class="text-xs text-gray-400 shrink-0">
                {order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? '' : 's'}
              </span>
              <AIcon path={expanded.has(order.uid) ? mdiChevronUp : mdiChevronDown} size="20" class="text-gray-400 shrink-0" />
            </button>

            {#if expanded.has(order.uid)}
            <!-- Items -->
            <div class="mt-3 pt-3 border-t border-gray-100" transition:slide={{ duration: 200 }}>
            <ItemList
              items={order.items ?? []}
              itemPrices={order.itemPrices ?? {}}
              editable={true}
              priceEditable={true}
              onItemsChange={(items) => handleItemsChange(order.uid, items)}
              onPriceChange={(i, v) => handlePriceChange(order.uid, i, v)}
              onSendToInvoice={() => sendToInvoice(order)}
            />

            <!-- Admin actions -->
            <div class="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <!-- Status -->
              <select
                value={order.status}
                class="border rounded px-2 py-1.5 text-sm bg-white"
                onchange={e => updateStatus(order.uid, e.currentTarget.value)}
              >
                {#each STATUSES as s}
                  <option value={s}>{STATUS_LABELS[s]}</option>
                {/each}
              </select>

              <!-- Unlock -->
              {#if order.locked}
                <button
                  class="flex items-center gap-1 bg-gray-700 text-white font-bold px-3 py-1.5 rounded shadow text-sm"
                  onclick={() => unlock(order.uid)}
                >
                  <AIcon path={mdiLockOpen} size="16" />Unlock
                </button>
              {/if}

              <!-- Invoice -->
              <div class="flex items-center gap-2 ml-auto">
                {#if order.payment}
                  <a href={order.payment} target="_blank" rel="noopener noreferrer"
                     class="text-sm text-green-600 hover:underline font-semibold">Receipt ↗</a>
                {/if}
                {#if order.invoice}
                  <a href={order.invoice} target="_blank" rel="noopener noreferrer"
                     class="text-sm text-blue-500 hover:underline">Invoice ↗</a>
                  <button
                    class="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
                    onclick={() => triggerInvoiceUpload(order.uid)}
                    disabled={uploading}
                  >{uploading && pendingUploadUid === order.uid ? 'Uploading…' : 'replace'}</button>
                {:else}
                  <button
                    class="text-sm text-blue-500 hover:underline font-semibold disabled:opacity-50"
                    onclick={() => triggerInvoiceUpload(order.uid)}
                    disabled={uploading}
                  >{uploading && pendingUploadUid === order.uid ? 'Uploading…' : '+ Add invoice'}</button>
                {/if}
              </div>
            </div>
            </div>
            {/if}

          </div>
        {/each}
      </div>
    {/if}
  {/if}

</div>
