<script>
  import { AIcon } from 'ace.svelte'
  import { mdiPlus, mdiPencil, mdiDelete, mdiCheck, mdiClose, mdiOpenInNew } from '@mdi/js'

  let {
    items           = [],
    itemPrices      = {},
    editable        = false,
    priceEditable   = false,
    urlRequired     = true,
    onItemsChange   = () => {},
    onPriceChange   = () => {},
    onPricesChange  = () => {},
    onSendToInvoice = null,
  } = $props()

  let showModal  = $state(false)
  let editIndex  = $state(null)   // null = add, number = edit
  let form       = $state({ name: '', url: '', description: '' })

  function openAdd() {
    editIndex = null
    form = { name: '', url: '', description: '' }
    showModal = true
  }

  function openEdit(i) {
    editIndex = i
    form = { name: items[i].name, url: items[i].url ?? '', description: items[i].description ?? '' }
    showModal = true
  }

  function save() {
    if (!form.name.trim() || (urlRequired && !form.url.trim())) return
    const rawUrl = form.url.trim()
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl
    const item = { name: form.name.trim(), url, description: form.description.trim() }
    if (editIndex === null) {
      onItemsChange([...items, item])
    } else {
      const updated = items.map((it, i) => i === editIndex ? item : it)
      onItemsChange(updated)
    }
    showModal = false
  }

  function remove(i) {
    const newItems = items.filter((_, idx) => idx !== i)
    const newPrices = {}
    Object.entries(itemPrices).forEach(([k, v]) => {
      const ki = Number(k)
      if (ki < i) newPrices[ki] = v
      else if (ki > i) newPrices[ki - 1] = v
    })
    onItemsChange(newItems)
    onPricesChange(newPrices)
  }

  function fmtPrice(i) {
    const p = itemPrices[i]
    if (p === undefined || p === null || p === '') return '—'
    return '$' + Number(p).toFixed(2)
  }

  const allPriced = $derived(
    items.length > 0 && items.every((_, i) => {
      const p = itemPrices[i]
      return p !== undefined && p !== null && p !== ''
    })
  )

  const total = $derived(
    items.reduce((sum, _, i) => sum + Number(itemPrices[i] ?? 0), 0)
  )
</script>

<div>
  {#if items.length === 0}
    <div class="text-gray-400 text-sm italic py-3">
      {editable ? 'No items yet. Click + to add one.' : 'No items.'}
    </div>
  {:else}
    <div class="flex flex-col gap-2">
      {#each items as item, i}
        <div class="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
          <div class="grow min-w-0">
            <div class="font-semibold text-gray-800 text-sm">{item.name}</div>
            {#if item.url}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:underline mt-0.5"
                onclick={e => e.stopPropagation()}
              >
                <AIcon path={mdiOpenInNew} size="12" />Link
              </a>
            {/if}
            {#if item.description}
              <div class="text-xs text-gray-400 mt-0.5">{item.description}</div>
            {/if}
          </div>
          <!-- Price -->
          {#if priceEditable}
            <div class="flex items-center shrink-0">
              <span class="text-gray-400 text-xs mr-1">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemPrices[i] ?? ''}
                class="border rounded px-1.5 py-0.5 text-sm text-gray-500 w-20"
                placeholder="0.00"
                onblur={e => onPriceChange(i, e.currentTarget.value)}
              />
            </div>
          {:else}
            <span class="text-sm text-gray-400 shrink-0 tabular-nums">{fmtPrice(i)}</span>
          {/if}
          <!-- Edit / delete -->
          {#if editable}
            <button class="text-blue-400 p-0.5 shrink-0" onclick={() => openEdit(i)}>
              <AIcon path={mdiPencil} size="16" />
            </button>
            <button class="text-red-400 p-0.5 shrink-0" onclick={() => remove(i)}>
              <AIcon path={mdiDelete} size="16" />
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="flex items-center gap-3 pt-2 mt-1 {allPriced || onSendToInvoice ? 'border-t border-gray-200' : ''}">
    {#if onSendToInvoice}
      <button
        class="text-xs text-indigo-500 font-semibold hover:underline"
        onclick={onSendToInvoice}
      >→ Send to Invoice Generator</button>
    {/if}
    {#if allPriced}
      <span class="text-sm text-gray-500 font-semibold ml-auto">Total</span>
      <span class="text-sm font-bold text-gray-800 tabular-nums">${total.toFixed(2)}</span>
    {/if}
  </div>

  {#if editable}
    <button
      class="mt-2 flex items-center gap-1 text-sm text-green-600 font-semibold hover:text-green-700"
      onclick={openAdd}
    >
      <AIcon path={mdiPlus} size="18" />Add item
    </button>
  {/if}
</div>

<!-- Add / Edit modal -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-md flex flex-col">
      <div class="p-4 font-bold text-xl border-b">
        {editIndex === null ? 'Add Item' : 'Edit Item'}
      </div>
      <div class="p-4 flex flex-col gap-4">
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Name <span class="text-red-400">*</span></span>
          <input bind:value={form.name} class="border rounded px-2 py-1.5" placeholder="e.g. Shinai Bag" />
        </label>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">URL {#if urlRequired}<span class="text-red-400">*</span>{:else}<span class="text-gray-400 font-normal">(optional)</span>{/if}</span>
          <input bind:value={form.url} class="border rounded px-2 py-1.5" placeholder="e.g. https://tozandoshop.com/collections/shinai-bags/products/kanmuri-shinai-bag" />
        </label>
        <label class="flex flex-col">
          <span class="font-bold text-sm mb-1">Description <span class="text-gray-400 font-normal">(optional)</span></span>
          <textarea bind:value={form.description} rows="3" class="border rounded px-2 py-1.5 resize-none min-h-48" placeholder="Size, colour, notes…"></textarea>
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
          disabled={!form.name.trim() || (urlRequired && !form.url.trim())}
        >
          <AIcon path={mdiCheck} size="18" />{editIndex === null ? 'Add' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}
