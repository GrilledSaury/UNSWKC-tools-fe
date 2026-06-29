<script>
  import { AIcon } from 'ace.svelte'
  import { mdiChevronRight } from '@mdi/js'

  let { events, onSelect, rowActions } = $props()

  function fmt(ts) {
    if (!ts) return '—'
    return ts.toDate().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function fmtUpdated(ev) {
    const ts = ev.updatedAt ?? ev.createdAt
    if (!ts) return null
    return fmt(ts)
  }
</script>

{#if events.length === 0}
  <div class="text-gray-400 text-center mt-16">No events yet.</div>
{:else}
  <div class="flex flex-col gap-2">
    {#each events as ev}
      <div class="bg-white rounded shadow px-4 py-3 flex items-center gap-3">
        <button class="grow min-w-0 text-left" onclick={() => onSelect(ev)}>
          <div class="font-bold text-gray-800 truncate">{ev.title}</div>
          <div class="text-sm text-gray-500 mt-0.5">Due {fmt(ev.dueDate)}</div>
          {#if fmtUpdated(ev)}
            <div class="text-xs text-gray-400 mt-0.5">Updated {fmtUpdated(ev)}</div>
          {/if}
        </button>
        <span class="text-xs font-bold px-4 py-1 rounded-full shrink-0
          {ev.status === 'open' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}">
          {ev.status}
        </span>
        {@render rowActions?.(ev)}
        <button class="text-gray-300 p-1 shrink-0" onclick={() => onSelect(ev)}>
          <AIcon path={mdiChevronRight} size="20" />
        </button>
      </div>
    {/each}
  </div>
{/if}
