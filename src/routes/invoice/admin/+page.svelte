<script>
  import { onMount } from 'svelte'
  import { AIcon } from 'ace.svelte'
  import {
    mdiHome, mdiPlus, mdiDelete, mdiPencil, mdiChevronDown, mdiChevronUp,
    mdiUpload, mdiPrinter, mdiClose, mdiCheck, mdiEye, mdiDownload,
  } from '@mdi/js'
  import { goto } from '$app/navigation'
  import { userProfile } from '$lib/stores'

  // ── Default config ────────────────────────────────────────────────────────
  const DEFAULT_CONFIG = {
    orgName:          'UNSW Kendo Club',
    orgEmail:         'unswkendotreasurer@gmail.com',
    shipTo:           'Fitness and Aquatic Centre (B5), Gate 2, High St, UNSW Sydney, Kensington NSW 2052',
    bankAccountName:  'UNSW KENDO CLUB',
    bsb:              '062 303',
    accountNumber:    '1088 6082',
    bankName:         'Commonwealth Bank',
    terms:            'Please send payment receipt to unswkendotreasurer@gmail.com',
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let cfg      = $state({ ...DEFAULT_CONFIG })
  let showCfg  = $state(false)

  function toDateStr(d) { return d.toISOString().slice(0, 10) }
  const todayDate  = new Date()
  const dueDefault = new Date(); dueDefault.setDate(dueDefault.getDate() + 15)

  let ev = $state({
    prefix:      'INV',  // Invoice ID = prefix + startNum (eg. INVOICE001)
    startNum:    1,
    payDesc:     'social',
    date:        toDateStr(todayDate),
    dueDate:     toDateStr(dueDefault),
    globalDisc:  0,
  })

  function applyGlobalDiscount() {
    people = people.map(p => ({ ...p, items: [...p.items], discountPct: Number(ev.globalDisc) }))
  }

  // people: [{ name, discountPct, items: [{desc, qty, rate}] }]
  let people      = $state([])
  let showModal   = $state(false)
  let editIdx     = $state(-1)
  let editPerson  = $state(null)
  let importError = $state('')
  let showFmt     = $state(false)

  onMount(() => {
    if (!$userProfile?.permissions?.includes('invoice')) goto('/home')
    const pending = localStorage.getItem('pendingInvoiceImport')
    if (pending) {
      const data = JSON.parse(pending)
      parseCSV(data.csv)
      if (data.payDesc) ev.payDesc = data.payDesc
      localStorage.removeItem('pendingInvoiceImport')
    }
  })

  // ── CSV import ────────────────────────────────────────────────────────────
  // Format:
  //   name,discount_pct,item,quantity,rate
  //   Matthew Qiao,20,Dinner at Moyashi Hotpot,1,48.72
  //   Henry Black,0,Same Dinner,1,48.72
  //   Henry Black,0,Extra Item,1,10.00
  // Multiple rows with the same name → merged into one invoice

  function parseCSVLine(line) {
    const result = []
    let cur = '', inQ = false
    for (const c of line) {
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { result.push(cur); cur = '' }
      else { cur += c }
    }
    result.push(cur)
    return result
  }

  function parseCSV(text) {
    importError = ''
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) { importError = 'Need a header row and at least one data row.'; return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    for (const r of ['name', 'discount_pct', 'item', 'quantity', 'rate']) {
      if (!headers.includes(r)) { importError = `Missing column: "${r}"`; return }
    }
    const [iN, iD, iI, iQ, iR] = ['name','discount_pct','item','quantity','rate'].map(c => headers.indexOf(c))

    const map = new Map()
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const name = cols[iN]?.trim()
      if (!name) continue
      if (!map.has(name)) map.set(name, { name, discountPct: parseFloat(cols[iD]) || 0, items: [] })
      map.get(name).items.push({
        desc: cols[iI]?.trim() || '',
        qty:  parseFloat(cols[iQ]) || 1,
        rate: parseFloat(cols[iR]) || 0,
      })
    }
    people = [...map.values()]
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => parseCSV(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Manual add / edit ─────────────────────────────────────────────────────
  function openAdd() {
    editIdx    = -1
    editPerson = { name: '', discountPct: 0, items: [{ desc: '', qty: 1, rate: 0 }] }
    showModal  = true
  }

  function openEdit(i) {
    editIdx    = i
    editPerson = JSON.parse(JSON.stringify(people[i]))
    showModal  = true
  }

  function addItem() {
    editPerson.items = [...editPerson.items, { desc: '', qty: 1, rate: 0 }]
  }

  function removeItem(i) {
    editPerson.items = editPerson.items.filter((_, j) => j !== i)
  }

  function saveModal() {
    if (!editPerson.name.trim() || !editPerson.items.length) return
    const p = JSON.parse(JSON.stringify(editPerson))
    if (editIdx === -1) people = [...people, p]
    else { const copy = [...people]; copy[editIdx] = p; people = copy }
    showModal = false
  }

  function removePerson(i) {
    people = people.filter((_, j) => j !== i)
  }

  // ── Calculations ───────────────────────────────────────────────────────────
  function totals(p) {
    const subtotal = p.items.reduce((s, it) => s + it.qty * it.rate, 0)
    const discount = subtotal * (p.discountPct / 100)
    return { subtotal, discount, total: subtotal - discount }
  }

  function fmt(n) { return 'A$' + n.toFixed(2) }

  function invoiceId(i) { return ev.prefix + (Number(ev.startNum) + i) }

  function fmtDate(str) {
    if (!str) return ''
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function paymentDesc(name) {
    const parts = name.trim().split(/\s+/)
    const first = parts[0]
    const rest  = parts.slice(1).join('_')
    return rest ? `${first}_${rest}_${ev.payDesc}` : `${first}_${ev.payDesc}`
  }

  // ── Invoice HTML (for print) ───────────────────────────────────────────────
  function invoiceHTML(person, idx) {
    const { subtotal, discount, total } = totals(person)
    const id = invoiceId(idx)
    const shipLines = cfg.shipTo.split(',').map(s => s.trim()).join('<br>')

    const rows = person.items.map(it => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:13px;">${it.desc}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;">${it.qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">${fmt(it.rate)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">${fmt(it.qty * it.rate)}</td>
      </tr>`).join('')

    const logoSrc = `${location.origin}/logo.png`

    return `<div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:44px;color:#333;box-sizing:border-box;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;">
    <img src="${logoSrc}" alt="Logo" style="height:84px;" onerror="this.style.display='none'"/>
    <div style="text-align:right;">
      <div style="font-size:42px;font-weight:900;letter-spacing:4px;color:#111;">INVOICE</div>
      <div style="font-size:16px;color:#555;margin-top:2px;"># ${id}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:36px;gap:24px;">
    <div>
      <div style="font-weight:bold;font-size:16px;margin-bottom:8px;">${person.name}</div>
      <div style="color:#666;font-size:13px;">${cfg.orgName} :</div>
      <div style="color:#1a56db;font-size:13px;margin-bottom:16px;">${cfg.orgEmail}</div>
      <div style="color:#999;font-size:12px;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Ship To:</div>
      <div style="font-weight:bold;font-size:13px;line-height:1.7;">${shipLines}</div>
    </div>
    <div>
      <table style="border-collapse:collapse;min-width:220px;">
        <tr>
          <td style="padding:5px 24px 5px 8px;color:#666;font-size:13px;">Date:</td>
          <td style="padding:5px 0;font-size:13px;white-space:nowrap;">${fmtDate(ev.date)}</td>
        </tr>
        <tr>
          <td style="padding:5px 24px 5px 8px;color:#666;font-size:13px;">Due Date:</td>
          <td style="padding:5px 0;font-size:13px;white-space:nowrap;">${fmtDate(ev.dueDate)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:4px 0;"></td>
        </tr>
        <tr>
          <td style="background:#222;color:#fff;font-weight:bold;padding:9px 24px 9px 12px;font-size:13px;white-space:nowrap;">Balance Due:</td>
          <td style="background:#222;color:#fff;font-weight:bold;padding:9px 14px;font-size:15px;white-space:nowrap;">${fmt(total)}</td>
        </tr>
      </table>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
    <thead>
      <tr style="background:#333;color:#fff;">
        <th style="padding:11px 8px;text-align:left;font-size:13px;font-weight:600;">Item</th>
        <th style="padding:11px 8px;text-align:center;font-size:13px;font-weight:600;width:80px;">Quantity</th>
        <th style="padding:11px 8px;text-align:right;font-size:13px;font-weight:600;width:100px;">Rate</th>
        <th style="padding:11px 8px;text-align:right;font-size:13px;font-weight:600;width:110px;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:36px;">
    <table style="border-collapse:collapse;min-width:250px;">
      <tr>
        <td style="padding:5px 24px 5px 0;color:#666;font-size:13px;text-align:right;">Subtotal:</td>
        <td style="padding:5px 0;font-size:13px;text-align:right;">${fmt(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:5px 24px 5px 0;color:#666;font-size:13px;text-align:right;">Discount:</td>
        <td style="padding:5px 0;font-size:13px;text-align:right;">${fmt(discount)}</td>
      </tr>
      <tr>
        <td style="padding:5px 24px 5px 0;color:#666;font-size:13px;text-align:right;">Tax (0%):</td>
        <td style="padding:5px 0;font-size:13px;text-align:right;">A$0.00</td>
      </tr>
      <tr style="border-top:2px solid #333;">
        <td style="padding:9px 24px 5px 0;font-weight:bold;font-size:14px;text-align:right;">Total:</td>
        <td style="padding:9px 0 5px;font-weight:bold;font-size:14px;text-align:right;">${fmt(total)}</td>
      </tr>
    </table>
  </div>

  <div style="margin-bottom:24px;">
    <div style="font-size:12px;color:#aaa;margin-bottom:8px;">Notes:</div>
    <div style="font-size:13px;line-height:1.9;">
      Please transfer online to:<br>
      NAME: ${cfg.bankAccountName}<br>
      BSB: ${cfg.bsb}<br>
      ACCOUNT NUMBER: ${cfg.accountNumber}<br>
      BANK: ${cfg.bankName}<br>
      DESCRIPTION: &lt;${paymentDesc(person.name)}&gt;
    </div>
  </div>
  <div>
    <div style="font-size:12px;color:#aaa;margin-bottom:8px;">Terms:</div>
    <div style="font-size:13px;">${cfg.terms}</div>
  </div>
</div>`
  }

  function openPrint(html, title) {
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>@media print{@page{margin:10mm}body{margin:0}}body{margin:0}</style>
</head><body>${html}</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  function printAll() {
    if (!people.length) return
    const content = people.map((p, i) => invoiceHTML(p, i))
      .join('<div style="page-break-after:always;"></div>')
    openPrint(content, 'Invoices')
  }

  function printOne(person, idx) {
    openPrint(invoiceHTML(person, idx), `Invoice ${invoiceId(idx)}`)
  }

  const CSV_SAMPLE = `name,discount_pct,item,quantity,rate
Matthew Qiao,20,"Dinner at Moyashi Hotpot, 26 Oct",1,48.72
Henry Black,0,Event Dinner,1,48.72
Henry Black,0,Extra item,1,10.00`
</script>

<div class="w-screen min-h-screen bg-gray-100 p-4 md:px-16 md:py-8">

  <!-- Header -->
  <div class="flex items-center gap-4 mb-6">
    <button onclick={() => goto('/home')}>
      <AIcon path={mdiHome} size="36" class="text-gray-500" />
    </button>
    <div class="text-2xl font-bold grow">Invoice Generator</div>
    {#if people.length > 0}
      <button
        class="flex items-center gap-1.5 bg-gray-800 text-white font-bold px-4 py-2 rounded shadow text-sm"
        onclick={printAll}
      >
        <AIcon path={mdiPrinter} size="18" />
        Print All ({people.length})
      </button>
    {/if}
  </div>

  <!-- Event Settings -->
  <div class="bg-white rounded shadow p-4 mb-4">
    <div class="font-bold text-sm text-gray-600 mb-3 uppercase tracking-wide">Event Settings</div>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <label class="flex flex-col col-span-1">
        <span class="text-xs text-gray-500 mb-1">Invoice Prefix</span>
        <input class="border rounded px-2 py-1.5 text-sm font-mono" placeholder="INVOICE_PREFIX" bind:value={ev.prefix} />
      </label>
      <label class="flex flex-col">
        <span class="text-xs text-gray-500 mb-1">Start Number</span>
        <input class="border rounded px-2 py-1.5 text-sm" type="number" min="1" bind:value={ev.startNum} />
      </label>
      <label class="flex flex-col">
        <span class="text-xs text-gray-500 mb-1">Pay Description</span>
        <input class="border rounded px-2 py-1.5 text-sm" placeholder="description" bind:value={ev.payDesc} />
      </label>
      <label class="flex flex-col">
        <span class="text-xs text-gray-500 mb-1">Invoice Date</span>
        <input class="border rounded px-2 py-1.5 text-sm" type="date" bind:value={ev.date} />
      </label>
      <label class="flex flex-col">
        <span class="text-xs text-gray-500 mb-1">Due Date</span>
        <input class="border rounded px-2 py-1.5 text-sm" type="date" bind:value={ev.dueDate} />
      </label>
      <div class="flex flex-col">
        <span class="text-xs text-gray-500 mb-1">Global Discount (%)</span>
        <div class="flex gap-1">
          <input class="border rounded px-2 py-1.5 text-sm w-20" type="number" min="0" max="100" step="0.01" bind:value={ev.globalDisc} />
          <button
            class="px-3 py-1.5 rounded bg-orange-500 text-white text-sm font-bold disabled:opacity-40"
            onclick={applyGlobalDiscount}
            disabled={!people.length}
          >Apply to all</button>
        </div>
      </div>
    </div>

    {#if people.length > 0}
      <div class="mt-3 text-xs text-gray-400">
        IDs: {invoiceId(0)} → {invoiceId(people.length - 1)}
      </div>
    {/if}
  </div>

  <!-- Default Config (collapsible) -->
  <div class="bg-white rounded shadow mb-4 overflow-hidden">
    <button
      class="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-600"
      onclick={() => showCfg = !showCfg}
    >
      <span class="uppercase tracking-wide">Default Config</span>
      <AIcon path={showCfg ? mdiChevronUp : mdiChevronDown} size="20" />
    </button>
    {#if showCfg}
      <div class="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
        <label class="flex flex-col">
          <span class="text-xs text-gray-500 mb-1">Organisation Name</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.orgName} />
        </label>
        <label class="flex flex-col">
          <span class="text-xs text-gray-500 mb-1">Organisation Email</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.orgEmail} />
        </label>
        <label class="flex flex-col md:col-span-2">
          <span class="text-xs text-gray-500 mb-1">Ship To Address</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.shipTo} />
        </label>
        <label class="flex flex-col">
          <span class="text-xs text-gray-500 mb-1">Bank Account Name</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.bankAccountName} />
        </label>
        <label class="flex flex-col">
          <span class="text-xs text-gray-500 mb-1">Bank Name</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.bankName} />
        </label>
        <label class="flex flex-col">
          <span class="text-xs text-gray-500 mb-1">BSB</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.bsb} />
        </label>
        <label class="flex flex-col">
          <span class="text-xs text-gray-500 mb-1">Account Number</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.accountNumber} />
        </label>
        <label class="flex flex-col md:col-span-2">
          <span class="text-xs text-gray-500 mb-1">Terms</span>
          <input class="border rounded px-2 py-1.5 text-sm" bind:value={cfg.terms} />
        </label>
        <button
          class="text-xs text-gray-400 underline text-left"
          onclick={() => cfg = { ...DEFAULT_CONFIG }}
        >Reset to defaults</button>
      </div>
    {/if}
  </div>

  <!-- Import / Add -->
  <div class="flex items-center gap-3 mb-4 flex-wrap">
    <label class="flex items-center gap-2 bg-white border rounded shadow-sm px-3 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50">
      <AIcon path={mdiUpload} size="18" class="text-gray-500" />
      Import CSV
      <input type="file" accept=".csv,.txt" class="hidden" onchange={handleFile} />
    </label>
    <button
      class="flex items-center gap-2 bg-green-500 text-white rounded shadow-sm px-3 py-2 text-sm font-bold"
      onclick={openAdd}
    >
      <AIcon path={mdiPlus} size="18" />Add Person
    </button>
    <button
      class="text-xs text-gray-400 underline"
      onclick={() => showFmt = !showFmt}
    >CSV format</button>
  </div>

  {#if showFmt}
    <div class="bg-gray-800 text-gray-100 rounded p-3 mb-4 text-xs font-mono whitespace-pre overflow-x-auto">{CSV_SAMPLE}</div>
  {/if}

  {#if importError}
    <div class="text-red-500 text-sm mb-3">{importError}</div>
  {/if}

  <!-- People list -->
  {#if people.length === 0}
    <div class="text-gray-400 text-center mt-16">No people added yet. Import a CSV or add manually.</div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each people as person, i}
        {@const { subtotal, discount, total } = totals(person)}
        <div class="bg-white rounded shadow px-4 py-3 flex items-start gap-4">
          <!-- Left: details -->
          <div class="grow min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-bold text-gray-800">{person.name}</span>
              <span class="text-xs text-gray-400 font-mono"># {invoiceId(i)}</span>
              {#if person.discountPct > 0}
                <span class="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{person.discountPct}% off</span>
              {/if}
            </div>
            <div class="text-xs text-gray-400">
              {#each person.items as it, j}
                <span>{it.desc} ({it.qty}×{fmt(it.rate)}){j < person.items.length - 1 ? ' · ' : ''}</span>
              {/each}
            </div>
          </div>

          <!-- Right: totals + actions -->
          <div class="shrink-0 text-right">
            <div class="font-bold text-gray-800">{fmt(total)}</div>
            {#if discount > 0}
              <div class="text-xs text-gray-400 line-through">{fmt(subtotal)}</div>
            {/if}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button class="text-gray-400 p-1 hover:text-gray-600" title="Preview" onclick={() => openPrint(invoiceHTML(person, i), `Invoice ${invoiceId(i)}`)}>
              <AIcon path={mdiEye} size="20" />
            </button>
            <button class="text-gray-400 p-1 hover:text-gray-600" title="Print" onclick={() => printOne(person, i)}>
              <AIcon path={mdiPrinter} size="20" />
            </button>
            <button class="text-blue-500 p-1" title="Edit" onclick={() => openEdit(i)}>
              <AIcon path={mdiPencil} size="20" />
            </button>
            <button class="text-red-400 p-1" title="Delete" onclick={() => removePerson(i)}>
              <AIcon path={mdiDelete} size="20" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

</div>

<!-- Add / Edit modal -->
{#if showModal && editPerson}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded shadow-lg w-full max-w-lg flex flex-col max-h-[90vh]">
      <div class="px-4 py-3 font-bold text-lg border-b shrink-0">
        {editIdx === -1 ? 'Add Person' : 'Edit Person'}
      </div>

      <div class="p-4 flex flex-col gap-4 overflow-y-auto">
        <!-- Name -->
        <label class="flex flex-col">
          <span class="text-sm font-bold mb-1">Name <span class="text-red-400">*</span></span>
          <input class="border rounded px-2 py-1.5 text-sm" placeholder="Full Name" bind:value={editPerson.name} />
          {#if editPerson.name}
            <span class="text-xs text-gray-400 mt-1">Pay description: &lt;{paymentDesc(editPerson.name)}&gt;</span>
          {/if}
        </label>

        <!-- Discount -->
        <label class="flex flex-col">
          <span class="text-sm font-bold mb-1">Discount (%)</span>
          <input class="border rounded px-2 py-1.5 text-sm w-32" type="number" min="0" max="100" step="0.01" bind:value={editPerson.discountPct} />
        </label>

        <!-- Items -->
        <div>
          <div class="flex items-center mb-2">
            <span class="text-sm font-bold">Items <span class="text-red-400">*</span></span>
            <div class="grow"></div>
            <button
              class="flex items-center gap-1 text-xs text-green-600 font-bold"
              onclick={addItem}
            >
              <AIcon path={mdiPlus} size="16" />Add Item
            </button>
          </div>
          <div class="flex flex-col gap-2">
            <!-- Header -->
            <div class="grid grid-cols-[1fr_60px_80px_28px] gap-1 text-xs text-gray-400 px-1">
              <span>Description</span><span class="text-center">Qty</span><span class="text-right">Rate (A$)</span><span></span>
            </div>
            {#each editPerson.items as item, j}
              <div class="grid grid-cols-[1fr_60px_80px_28px] gap-1 items-center">
                <input
                  class="border rounded px-2 py-1.5 text-sm min-w-0"
                  placeholder="Item description"
                  bind:value={item.desc}
                />
                <input
                  class="border rounded px-2 py-1.5 text-sm text-center"
                  type="number" min="0" step="1"
                  bind:value={item.qty}
                />
                <input
                  class="border rounded px-2 py-1.5 text-sm text-right"
                  type="number" min="0" step="0.01"
                  bind:value={item.rate}
                />
                <button
                  class="text-red-300 hover:text-red-500 flex items-center justify-center"
                  onclick={() => removeItem(j)}
                  disabled={editPerson.items.length === 1}
                >
                  <AIcon path={mdiClose} size="16" />
                </button>
              </div>
            {/each}
          </div>

          <!-- Subtotal preview -->
          {#if editPerson.items.length > 0}
            {@const sub = editPerson.items.reduce((s, it) => s + it.qty * it.rate, 0)}
            {@const disc = sub * (editPerson.discountPct / 100)}
            <div class="mt-2 text-xs text-gray-500 text-right">
              Subtotal: {fmt(sub)}
              {#if disc > 0}
                · Discount: {fmt(disc)}
                · Total: {fmt(sub - disc)}
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <div class="px-4 py-3 border-t flex justify-end gap-2 shrink-0">
        <button
          class="px-4 py-1.5 rounded border font-bold flex items-center gap-1 text-sm"
          onclick={() => showModal = false}
        >
          <AIcon path={mdiClose} size="16" />Cancel
        </button>
        <button
          class="px-4 py-1.5 rounded bg-blue-500 text-white font-bold flex items-center gap-1 text-sm disabled:opacity-40"
          onclick={saveModal}
          disabled={!editPerson.name.trim() || !editPerson.items.length}
        >
          <AIcon path={mdiCheck} size="16" />Save
        </button>
      </div>
    </div>
  </div>
{/if}
