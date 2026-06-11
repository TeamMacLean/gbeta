<script lang="ts">
	import { useViewport } from '$lib/stores/viewport.svelte';
	import { useQueryHistory } from '$lib/stores/queryHistory.svelte';
	import { useAssembly } from '$lib/stores/assembly.svelte';
	import { useTracks } from '$lib/stores/tracks.svelte';
	import { useGenePicker } from '$lib/stores/genePicker.svelte';
	import {
		executeQuery,
		executeQueryWithTracks,
		getAvailableGenes,
		type QueryResult,
		type ListResultItem
	} from '$lib/services/queryLanguage';
	import { routeQuery, geneToNavigateQuery } from '$lib/services/queryRouter';
	import { buildBrowserContext } from '$lib/services/ai';
	import { highlightGene } from '$lib/stores/geneHighlight.svelte';
	import type { GeneResult } from '$lib/services/geneLookup';
	import QueryResultPanel from './QueryResultPanel.svelte';
	import GenePicker from './GenePicker.svelte';

	const viewport = useViewport();
	const queryHistory = useQueryHistory();
	const assembly = useAssembly();
	const tracks = useTracks();
	const genePicker = useGenePicker();

	let query = $state('');
	let isLoading = $state(false);
	let lastResult = $state<QueryResult | null>(null);
	let note = $state<string | null>(null);
	let multiInfo = $state<{ term: string; chosen: GeneResult; all: GeneResult[] } | null>(null);
	let needsAIKey = $state(false);
	let showSuggestions = $state(false);
	let showHistory = $state(false);
	let showResultPanel = $state(false);
	let resultPanelData = $state<{ title: string; query: string; results: ListResultItem[] } | null>(null);

	function aiContext() {
		return buildBrowserContext(
			tracks.all.map((t) => ({ name: t.name, typeId: t.typeId, features: t.features })),
			{
				chromosome: viewport.current.chromosome,
				start: viewport.current.start,
				end: viewport.current.end
			},
			getAvailableGenes(tracks.all)
		);
	}

	function geneCoords(g: GeneResult): string {
		return `${g.chromosome}:${g.start.toLocaleString()}-${g.end.toLocaleString()}`;
	}

	// Compute suggestions based on input
	const suggestions = $derived(() => {
		if (!query.trim()) return [];

		const lower = query.toLowerCase();
		const genes = getAvailableGenes(tracks.all);

		// Gene name suggestions
		const geneMatches = genes
			.filter(g => g.toLowerCase().startsWith(lower) || g.toLowerCase().includes(lower))
			.slice(0, 5);

		// Command suggestions
		const commands = ['navigate', 'search', 'zoom', 'pan'];
		const cmdMatches = commands.filter(c => c.startsWith(lower));

		return [...cmdMatches, ...geneMatches.map(g => `search gene ${g}`)];
	});

	let searchSeq = 0;

	async function handleSearch(event: Event) {
		event.preventDefault();
		if (!query.trim()) return;

		const seq = ++searchSeq;
		isLoading = true;
		showSuggestions = false;
		note = null;
		multiInfo = null;
		needsAIKey = false;

		try {
			// Track-aware execution so SELECT/INTERSECT/WITHIN data queries work here too.
			const outcome = await routeQuery(query, assembly.current, aiContext, {
				exec: (q) => executeQueryWithTracks(q, tracks.all),
				trackGenes: new Set(getAvailableGenes(tracks.all).map((g) => g.toUpperCase()))
			});
			// A newer search was started while we awaited — drop this stale result
			// so it can't overwrite the newer one.
			if (seq !== searchSeq) return;
			const result = outcome.result;

			note = outcome.note ?? null;
			multiInfo = outcome.multi ?? null;
			needsAIKey = outcome.needsAIKey ?? false;
			if (outcome.naturalLanguage) result.naturalLanguage = outcome.naturalLanguage;
			if (outcome.chosen) highlightGene(outcome.chosen);

			lastResult = result;
			queryHistory.addToHistory(result);

			// Show result panel for list queries
			if (result.showResultPanel && result.results) {
				resultPanelData = {
					title: result.message,
					query: result.query.raw,
					results: result.results
				};
				showResultPanel = true;
			}

			if (result.success) {
				query = '';
			}
		} finally {
			// Only the latest in-flight search controls the loading state.
			if (seq === searchSeq) isLoading = false;
		}
	}

	// Switch away from the best-guess match via the gene picker.
	async function changeGene() {
		if (!multiInfo) return;
		const choice = await genePicker.open(multiInfo.all);
		if (!choice) return;
		const result = executeQuery(geneToNavigateQuery(choice));
		lastResult = result;
		highlightGene(choice);
		const name = choice.name && choice.name !== choice.symbol ? ` — ${choice.name}` : '';
		const src = choice.source === 'ensembl' ? 'Ensembl' : 'MyGene.info';
		note = `Showing ${choice.symbol}${name} · ${geneCoords(choice)} (via ${src})`;
		// Keep the picker available in case they want to switch again.
		multiInfo = { ...multiInfo, chosen: choice };
		queryHistory.addToHistory(result);
	}

	function handleSuggestionClick(suggestion: string) {
		query = suggestion;
		showSuggestions = false;
		// Auto-submit
		handleSearch(new Event('submit'));
	}

	function handleHistoryItemClick(item: QueryResult) {
		query = item.query.raw;
		showHistory = false;
		handleSearch(new Event('submit'));
	}

	function formatTimestamp(ts: number): string {
		const diff = Date.now() - ts;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);

		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'just now';
	}
</script>

<div class="relative flex items-center gap-2 w-full max-w-xl">
	<form onsubmit={handleSearch} class="relative flex-1">
		<input
			type="text"
			bind:value={query}
			onfocus={() => showSuggestions = true}
			onblur={() => setTimeout(() => showSuggestions = false, 200)}
			placeholder="Search genes, coordinates, or use GQL..."
			disabled={isLoading}
			class="w-full px-4 py-1.5 pl-10 pr-16 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-full focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] disabled:opacity-50"
		/>
		<!-- Search icon -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
		<!-- GQL indicator -->
		<span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-accent)] font-mono">
			GQL
		</span>

		<!-- Suggestions dropdown -->
		{#if showSuggestions && suggestions().length > 0 && query.trim()}
			<div class="absolute top-full left-0 right-0 mt-1 py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
				{#each suggestions() as suggestion}
					<button
						type="button"
						onclick={() => handleSuggestionClick(suggestion)}
						class="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-border)] text-[var(--color-text-primary)] font-mono"
					>
						{suggestion}
					</button>
				{/each}
			</div>
		{/if}
	</form>

	<!-- History button -->
	<button
		onclick={() => showHistory = !showHistory}
		class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors relative"
		title="Query history"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		{#if queryHistory.count > 0}
			<span class="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-accent)] text-white text-[10px] rounded-full flex items-center justify-center">
				{queryHistory.count > 9 ? '9+' : queryHistory.count}
			</span>
		{/if}
	</button>

	<!-- History dropdown -->
	{#if showHistory}
		<div class="absolute top-full right-0 mt-1 w-80 py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
			<div class="px-3 py-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] flex justify-between items-center">
				<span>Query History</span>
				{#if queryHistory.count > 0}
					<button
						onclick={() => queryHistory.clearHistory()}
						class="text-red-400 hover:text-red-300"
					>
						Clear
					</button>
				{/if}
			</div>
			{#if queryHistory.items.length === 0}
				<div class="px-3 py-4 text-sm text-[var(--color-text-muted)] text-center">
					No queries yet
				</div>
			{:else}
				{#each queryHistory.items.slice(0, 20) as item}
					<button
						onclick={() => handleHistoryItemClick(item)}
						class="w-full px-3 py-2 text-left hover:bg-[var(--color-border)] transition-colors"
					>
						<div class="flex items-center gap-2">
							<span class={item.success ? 'text-green-400' : 'text-red-400'}>
								{item.success ? '✓' : '✗'}
							</span>
							<code class="text-xs text-[var(--color-text-primary)] flex-1 truncate">
								{item.query.raw}
							</code>
							<span class="text-[10px] text-[var(--color-text-muted)]">
								{formatTimestamp(item.timestamp)}
							</span>
						</div>
						{#if item.naturalLanguage}
							<div class="text-[10px] text-[var(--color-text-muted)] mt-0.5 pl-5 truncate">
								"{item.naturalLanguage}"
							</div>
						{/if}
						{#if item.reasoning}
							<div class="text-[10px] text-[var(--color-text-secondary)] mt-0.5 pl-5 italic">
								💭 {item.reasoning}
							</div>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<!-- Result message with GQL visibility -->
{#if lastResult}
	<div class="ml-2 flex flex-wrap items-center gap-2 text-xs">
		<!-- Inline gene/AI note (lighter-touch): "Showing BRCA1 · chr17:…" -->
		{#if note}
			<span class="text-[var(--color-text-secondary)]">{note}</span>
			{#if multiInfo}
				<button
					type="button"
					onclick={changeGene}
					class="text-[var(--color-accent)] hover:underline"
				>
					change?
				</button>
			{/if}
		{:else}
			<span class={lastResult.success ? 'text-green-400' : 'text-amber-400'}>
				{lastResult.message}
			</span>
		{/if}

		{#if needsAIKey}
			<span class="text-[var(--color-text-muted)]">— open Settings → AI to add a key</span>
		{/if}

		<!-- Always show the GQL that was executed -->
		<code class="text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded font-mono">
			{lastResult.query.raw}
		</code>
		{#if lastResult.naturalLanguage}
			<span class="text-[var(--color-text-muted)]">from "{lastResult.naturalLanguage}"</span>
		{/if}
	</div>
{/if}

<!-- Gene picker (multi-match switch) -->
<GenePicker />

<!-- Query Result Panel -->
{#if showResultPanel && resultPanelData}
	<QueryResultPanel
		title={resultPanelData.title}
		query={resultPanelData.query}
		results={resultPanelData.results}
		onClose={() => { showResultPanel = false; resultPanelData = null; }}
	/>
{/if}
