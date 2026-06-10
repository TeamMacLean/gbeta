<!--
  Gene Picker — modal shown when a gene term has multiple matches.
  Keyboard navigable (Up/Down to move, Enter to select, Esc to cancel).
-->
<script lang="ts">
	import { useGenePicker } from '$lib/stores/genePicker.svelte';
	import type { GeneResult } from '$lib/services/geneLookup';

	const picker = useGenePicker();

	let selectedIndex = $state(0);

	// Reset the cursor whenever a new set of genes is shown.
	$effect(() => {
		if (picker.visible) {
			const _genes = picker.genes;
			selectedIndex = 0;
		}
	});

	function choose(gene: GeneResult) {
		picker.select(gene);
	}

	function formatCoords(g: GeneResult): string {
		return `${g.chromosome}:${g.start.toLocaleString()}-${g.end.toLocaleString()} (${g.strand})`;
	}

	function onKeydown(e: KeyboardEvent) {
		const genes = picker.genes;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % genes.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + genes.length) % genes.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (genes[selectedIndex]) choose(genes[selectedIndex]);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			picker.cancel();
		}
	}
</script>

<svelte:window onkeydown={picker.visible ? onKeydown : undefined} />

{#if picker.visible}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-50"
		onclick={() => picker.cancel()}
		role="presentation"
	></div>

	<!-- Dialog -->
	<div
		class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Select a gene"
	>
		<div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
			<h2 class="text-sm font-semibold text-[var(--color-text-primary)]">
				Multiple matches — pick a gene
			</h2>
			<button
				onclick={() => picker.cancel()}
				class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
				title="Cancel"
				aria-label="Cancel"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<ul class="max-h-80 overflow-y-auto py-1" role="listbox" aria-label="Gene matches">
			{#each picker.genes as gene, i (gene.symbol + gene.chromosome + gene.start)}
				<li role="option" aria-selected={i === selectedIndex}>
					<button
						class="w-full text-left px-4 py-2 transition-colors
							{i === selectedIndex
							? 'bg-[var(--color-accent)] text-white'
							: 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'}"
						onclick={() => choose(gene)}
						onmouseenter={() => (selectedIndex = i)}
					>
						<div class="font-medium">{gene.symbol}</div>
						<div
							class="text-xs {i === selectedIndex
								? 'text-white/80'
								: 'text-[var(--color-text-secondary)]'}"
						>
							{gene.name}
						</div>
						<div
							class="text-xs font-mono {i === selectedIndex
								? 'text-white/80'
								: 'text-[var(--color-text-muted)]'}"
						>
							{formatCoords(gene)}
						</div>
					</button>
				</li>
			{/each}
		</ul>

		<div class="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
			↑/↓ to navigate · Enter to select · Esc to cancel
		</div>
	</div>
{/if}
