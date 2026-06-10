<script lang="ts">
	import { useViewport } from '$lib/stores/viewport.svelte';
	import { useTracks } from '$lib/stores/tracks.svelte';
	import { useAssembly } from '$lib/stores/assembly.svelte';
	import { useQueryHistory } from '$lib/stores/queryHistory.svelte';
	import { highlightGene } from '$lib/stores/geneHighlight.svelte';
	import {
		parseQuery,
		executeQueryWithTracks,
		translateNaturalLanguage,
		getAvailableGenes,
		type QueryResult,
		type ParsedQuery,
		type ListResultItem
	} from '$lib/services/queryLanguage';
	import { routeQuery } from '$lib/services/queryRouter';
	import {
		translateToGQL,
		buildBrowserContext,
		isAIConfigured
	} from '$lib/services/ai';
	import {
		loadSavedQueries,
		saveQuery,
		deleteQuery,
		exportQueries,
		parseGqlFile,
		importQueries,
		generateQueryUrl,
		getQueryFromUrl,
		type SavedQuery
	} from '$lib/services/savedQueries';
	import { formatCoordinate } from '$lib/types/genome';
	import { onMount } from 'svelte';

	const viewport = useViewport();
	const tracks = useTracks();
	const assembly = useAssembly();
	const queryHistory = useQueryHistory();

	// Console state
	let isOpen = $state(false);
	let isExpanded = $state(false); // For taller view
	let naturalInput = $state('');
	let gqlInput = $state('');
	let showTranslation = $state(false);
	let pendingQuery = $state<ParsedQuery | null>(null);
	let isTranslating = $state(false);
	let translationError = $state('');
	// The most recent NL->GQL translation, so its natural-language text and AI
	// reasoning ride along into the shared history when the GQL is executed.
	let lastTranslation = $state<{ natural: string; reasoning?: string } | null>(null);

	function aiContext() {
		return buildBrowserContext(tracks.all, viewport.current, getAvailableGenes());
	}

	// Current results for display
	let currentResults = $state<ListResultItem[]>([]);
	let currentResultTitle = $state('');

	// Saved queries
	let savedQueries = $state<SavedQuery[]>([]);
	let historyTab = $state<'history' | 'saved'>('history');
	let showSaveDialog = $state(false);
	let savingQueryGql = $state(''); // The GQL being saved from history
	let saveQueryName = $state('');
	let saveQueryDescription = $state('');
	let fileInputEl: HTMLInputElement;

	// Load saved queries on mount and check URL for query
	onMount(() => {
		savedQueries = loadSavedQueries();

		// Check if there's a query in the URL
		const urlQuery = getQueryFromUrl();
		if (urlQuery) {
			gqlInput = urlQuery;
			showTranslation = true;
			isOpen = true;
		}
	});

	function refreshSavedQueries() {
		savedQueries = loadSavedQueries();
	}

	function handleSaveQuery() {
		if (!savingQueryGql.trim() || !saveQueryName.trim()) return;

		saveQuery(saveQueryName, savingQueryGql, saveQueryDescription || undefined);
		refreshSavedQueries();

		// Reset dialog
		showSaveDialog = false;
		savingQueryGql = '';
		saveQueryName = '';
		saveQueryDescription = '';
	}

	function startSaveQuery(gql: string) {
		savingQueryGql = gql;
		showSaveDialog = true;
	}

	function cancelSaveQuery() {
		showSaveDialog = false;
		savingQueryGql = '';
		saveQueryName = '';
		saveQueryDescription = '';
	}

	function handleLoadQuery(query: SavedQuery) {
		gqlInput = query.gql;
		showTranslation = true;
	}

	function handleExportAll() {
		exportQueries(savedQueries);
	}

	function handleImportFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			const parsed = parseGqlFile(content);
			importQueries(parsed);
			refreshSavedQueries();
		};
		reader.readAsText(file);
		input.value = '';
	}

	function handleNaturalInput(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			translateInput();
		}
	}

	async function translateInput() {
		if (!naturalInput.trim()) return;

		translationError = '';

		// Check if AI is configured
		if (isAIConfigured()) {
			// Use AI translation
			isTranslating = true;

			try {
				const context = buildBrowserContext(
					tracks.all,
					viewport.current,
					getAvailableGenes()
				);

				const result = await translateToGQL(naturalInput, context);

				if (result.success && result.gql) {
					gqlInput = result.gql;
					pendingQuery = parseQuery(result.gql);
					showTranslation = true;
					lastTranslation = { natural: naturalInput, reasoning: result.explanation };
				} else if (result.clarificationNeeded) {
					translationError = result.clarificationQuestion || 'Please clarify your request';
					gqlInput = '';
					pendingQuery = null;
				} else {
					// AI failed, fall back to regex
					translationError = result.error || 'AI translation failed';
					fallbackToRegex();
				}
			} catch (e) {
				translationError = 'AI translation error';
				fallbackToRegex();
			} finally {
				isTranslating = false;
			}
		} else {
			// No AI configured, use regex fallback
			fallbackToRegex();
		}
	}

	function fallbackToRegex() {
		// Translate natural language to GQL using regex parser
		const translated = translateNaturalLanguage(naturalInput);

		if (translated) {
			gqlInput = translated.raw;
			pendingQuery = translated;
			showTranslation = true;
		} else {
			// Try parsing as direct GQL
			const parsed = parseQuery(naturalInput);
			if (parsed.valid) {
				gqlInput = parsed.raw;
				pendingQuery = parsed;
				showTranslation = true;
			} else {
				// Show error but allow manual GQL entry
				gqlInput = `# Could not translate. Configure AI in Settings or use GQL directly:\n# SELECT GENES | SELECT VARIANTS | NAVIGATE chr:start-end`;
				pendingQuery = null;
				showTranslation = true;
			}
		}
	}

	function handleGqlInput(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			executeGql();
		}
	}

	async function executeGql() {
		if (!gqlInput.trim() || gqlInput.startsWith('#')) return;

		// Run through the shared engine: resolves gene names, executes GQL with
		// track awareness (SELECT/INTERSECT/WITHIN over loaded data), and can fall
		// through to the AI for free text — the same path the search bar uses.
		const outcome = await routeQuery(gqlInput, assembly.current, aiContext, {
			exec: (q) => executeQueryWithTracks(q, tracks.all)
		});
		const result = outcome.result;

		// Carry the NL + reasoning from the translate step into the shared history.
		if (lastTranslation?.natural) result.naturalLanguage = lastTranslation.natural;
		if (lastTranslation?.reasoning) result.reasoning = lastTranslation.reasoning;
		else if (outcome.naturalLanguage) result.naturalLanguage = outcome.naturalLanguage;

		if (outcome.chosen) highlightGene(outcome.chosen);
		queryHistory.addToHistory(result);

		// Handle results
		if (result.showResultPanel && result.results) {
			currentResults = result.results;
			currentResultTitle = result.message;
		}

		// Reset GQL state but keep naturalInput for reference
		gqlInput = '';
		showTranslation = false;
		pendingQuery = null;
		lastTranslation = null;
	}

	function navigateToResult(item: ListResultItem) {
		const padding = Math.round((item.end - item.start) * 0.2);
		viewport.navigateTo(
			item.chromosome,
			Math.max(0, item.start - padding),
			item.end + padding
		);
		// Don't close - keep results visible
	}

	function replayQuery(item: QueryResult) {
		gqlInput = item.query.raw;
		naturalInput = item.naturalLanguage || '';
		showTranslation = true;
		pendingQuery = parseQuery(item.query.raw);
	}

	function copyGql(gql: string) {
		navigator.clipboard.writeText(gql);
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString();
	}

	function clearResults() {
		currentResults = [];
		currentResultTitle = '';
	}

	function clearHistory() {
		queryHistory.clearHistory();
	}

	// Keyboard shortcut to toggle console
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === '`' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			isOpen = !isOpen;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Bottom dock console -->
<div
	class="fixed bottom-0 left-0 right-0 z-40 transition-transform duration-200"
	class:translate-y-full={!isOpen}
>
	<!-- Tab to open/close -->
	<button
		onclick={() => isOpen = !isOpen}
		class="absolute -top-8 left-1/2 -translate-x-1/2 px-4 py-1 bg-[var(--color-bg-secondary)] border border-b-0 border-[var(--color-border)] rounded-t-lg flex items-center gap-2 hover:bg-[var(--color-bg-tertiary)] transition-colors"
	>
		<svg class="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
		</svg>
		<span class="text-xs text-[var(--color-text-secondary)]">
			{isOpen ? 'Close' : 'GQL Console'}
			<span class="text-[var(--color-text-muted)]">(Cmd+`)</span>
		</span>
		<svg
			class="w-3 h-3 text-[var(--color-text-muted)] transition-transform"
			class:rotate-180={isOpen}
			fill="none" viewBox="0 0 24 24" stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
		</svg>
	</button>

	<!-- Console panel -->
	<div
		class="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] transition-all duration-200"
		class:h-48={!isExpanded}
		class:h-80={isExpanded}
	>
		<div class="h-full flex">
			<!-- Input section (left) -->
			<div class="w-80 border-r border-[var(--color-border)] flex flex-col">
				<div class="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
					<span class="text-xs font-medium text-[var(--color-text-secondary)]">Query Input</span>
					<button
						onclick={() => isExpanded = !isExpanded}
						class="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
					>
						{isExpanded ? 'Collapse' : 'Expand'}
					</button>
				</div>
				<div class="flex-1 p-2 overflow-y-auto space-y-2">
					<!-- Natural language input -->
					<div>
						<div class="flex items-center justify-between mb-1">
							<div class="text-[10px] text-[var(--color-text-muted)]">Natural Language</div>
							{#if isAIConfigured()}
								<span class="text-[10px] text-emerald-400">AI</span>
							{:else}
								<span class="text-[10px] text-amber-400" title="Configure AI in Settings for better translation">regex</span>
							{/if}
						</div>
						<input
							type="text"
							bind:value={naturalInput}
							onkeydown={handleNaturalInput}
							disabled={isTranslating}
							placeholder="e.g., 'show me genes with variants'"
							class="w-full px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] disabled:opacity-50"
						/>
						{#if translationError}
							<div class="mt-1 text-[10px] text-amber-400">{translationError}</div>
						{/if}
						<button
							onclick={translateInput}
							disabled={!naturalInput.trim() || isTranslating}
							class="mt-1 text-[10px] text-[var(--color-accent)] hover:underline disabled:opacity-50"
						>
							{#if isTranslating}
								Translating...
							{:else}
								→ Translate to GQL
							{/if}
						</button>
					</div>

					<!-- GQL input -->
					<div>
						<div class="flex items-center justify-between">
							<div class="text-[10px] text-[var(--color-text-muted)]">GQL Query</div>
							{#if showTranslation && naturalInput}
								<span class="text-[10px] text-emerald-400">translated</span>
							{/if}
						</div>
						<textarea
							bind:value={gqlInput}
							onkeydown={handleGqlInput}
							rows="2"
							placeholder="SELECT GENES INTERSECT variants"
							class="w-full mt-1 px-2 py-1 text-xs font-mono bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] resize-none"
						></textarea>
						<div class="flex justify-between items-center mt-1">
							<span class="text-[10px] text-[var(--color-text-muted)]">Cmd+Enter</span>
							<button
								onclick={executeGql}
								disabled={!gqlInput.trim() || gqlInput.startsWith('#')}
								class="px-2 py-0.5 text-[10px] bg-[var(--color-accent)] text-white rounded disabled:opacity-50"
							>
								Execute
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Results section (middle) -->
			<div class="flex-1 flex flex-col min-w-0">
				<div class="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
					<span class="text-xs font-medium text-[var(--color-text-secondary)]">
						{currentResultTitle || 'Results'}
						{#if currentResults.length > 0}
							<span class="text-[var(--color-text-muted)]">({currentResults.length})</span>
						{/if}
					</span>
					{#if currentResults.length > 0}
						<button onclick={clearResults} class="text-[10px] text-[var(--color-text-muted)] hover:text-red-400">
							Clear
						</button>
					{/if}
				</div>
				<div class="flex-1 overflow-y-auto">
					{#if currentResults.length === 0}
						<div class="p-4 text-center text-xs text-[var(--color-text-muted)]">
							No results. Try: <code class="bg-[var(--color-bg-tertiary)] px-1 rounded">list genes</code>
						</div>
					{:else}
						<div class="divide-y divide-[var(--color-border)]">
							{#each currentResults as item}
								<button
									onclick={() => navigateToResult(item)}
									class="w-full px-3 py-1.5 text-left hover:bg-[var(--color-bg-tertiary)] flex items-center justify-between group"
								>
									<div class="min-w-0">
										<span class="text-xs font-medium text-[var(--color-text-primary)]">{item.name}</span>
										<span class="text-[10px] text-[var(--color-text-muted)] ml-2">
											{formatCoordinate(item.chromosome, item.start, item.end)}
										</span>
										{#if item.details}
											<div class="text-[10px] text-[var(--color-text-muted)] truncate">
												{#each Object.entries(item.details).slice(0, 3) as [k, v]}
													<span class="mr-2">{k}: {v}</span>
												{/each}
											</div>
										{/if}
									</div>
									<span class="text-[10px] text-[var(--color-accent)] opacity-0 group-hover:opacity-100">Go →</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- History/Saved section (right) -->
			<div class="w-72 border-l border-[var(--color-border)] flex flex-col">
				<!-- Tabs -->
				<div class="flex border-b border-[var(--color-border)]">
					<button
						onclick={() => historyTab = 'history'}
						class="flex-1 px-3 py-2 text-xs font-medium transition-colors"
						class:text-[var(--color-accent)]={historyTab === 'history'}
						class:border-b-2={historyTab === 'history'}
						class:border-[var(--color-accent)]={historyTab === 'history'}
						class:text-[var(--color-text-muted)]={historyTab !== 'history'}
					>
						History
						{#if queryHistory.count > 0}
							<span class="ml-1 text-[10px]">({queryHistory.count})</span>
						{/if}
					</button>
					<button
						onclick={() => historyTab = 'saved'}
						class="flex-1 px-3 py-2 text-xs font-medium transition-colors"
						class:text-[var(--color-accent)]={historyTab === 'saved'}
						class:border-b-2={historyTab === 'saved'}
						class:border-[var(--color-accent)]={historyTab === 'saved'}
						class:text-[var(--color-text-muted)]={historyTab !== 'saved'}
					>
						Saved
						{#if savedQueries.length > 0}
							<span class="ml-1 text-[10px]">({savedQueries.length})</span>
						{/if}
					</button>
				</div>

				<!-- Save dialog (shown inline when saving from history) -->
				{#if showSaveDialog}
					<div class="p-2 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
						<div class="text-[10px] text-[var(--color-text-muted)] mb-1">Save Query</div>
						<code class="text-[10px] text-[var(--color-accent)] font-mono block truncate mb-1">{savingQueryGql}</code>
						<input
							type="text"
							bind:value={saveQueryName}
							placeholder="Query name"
							class="w-full px-2 py-1 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded mb-1 text-[var(--color-text-primary)]"
						/>
						<input
							type="text"
							bind:value={saveQueryDescription}
							placeholder="Description (optional)"
							class="w-full px-2 py-1 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded mb-1 text-[var(--color-text-primary)]"
						/>
						<div class="flex gap-1">
							<button
								onclick={handleSaveQuery}
								disabled={!saveQueryName.trim()}
								class="px-2 py-0.5 text-[10px] bg-[var(--color-accent)] text-white rounded disabled:opacity-50"
							>
								Save
							</button>
							<button
								onclick={cancelSaveQuery}
								class="px-2 py-0.5 text-[10px] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] rounded"
							>
								Cancel
							</button>
						</div>
					</div>
				{/if}

				<div class="flex-1 overflow-y-auto">
					{#if historyTab === 'history'}
						<!-- History tab content (shared with the search bar) -->
						{#if queryHistory.count === 0}
							<div class="p-3 text-[10px] text-[var(--color-text-muted)] text-center">
								No history yet
							</div>
						{:else}
							<div class="flex justify-end px-2 py-1">
								<button onclick={clearHistory} class="text-[10px] text-[var(--color-text-muted)] hover:text-red-400">
									Clear all
								</button>
							</div>
							{#each queryHistory.items as item}
								<div class="px-2 py-1.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] group">
									<div class="flex items-center justify-between">
										<code class="text-[10px] text-[var(--color-accent)] font-mono truncate flex-1">{item.query.raw}</code>
										<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
											{#if item.success}
												<button onclick={() => startSaveQuery(item.query.raw)} class="p-0.5 text-[var(--color-text-muted)] hover:text-emerald-400" title="Save">
													<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
													</svg>
												</button>
											{/if}
											<button onclick={() => copyGql(item.query.raw)} class="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" title="Copy">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
												</svg>
											</button>
											<button onclick={() => replayQuery(item)} class="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]" title="Replay">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
												</svg>
											</button>
										</div>
									</div>
									{#if item.naturalLanguage}
										<div class="text-[10px] text-[var(--color-text-muted)] truncate">"{item.naturalLanguage}"</div>
									{/if}
									<div class="text-[10px]" class:text-emerald-400={item.success} class:text-amber-400={!item.success}>
										{item.message}
									</div>
									{#if item.reasoning}
										<div class="text-[10px] text-[var(--color-text-secondary)] italic truncate">💭 {item.reasoning}</div>
									{/if}
								</div>
							{/each}
						{/if}
					{:else}
						<!-- Saved tab content -->
						{#if savedQueries.length === 0}
							<div class="p-3 text-[10px] text-[var(--color-text-muted)] text-center">
								No saved queries
							</div>
						{:else}
							{#each savedQueries as q}
								<div class="px-2 py-1.5 border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] group">
									<div class="flex items-center justify-between">
										<span class="text-xs font-medium text-[var(--color-text-primary)] truncate">{q.name}</span>
										<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100">
											<button onclick={() => handleLoadQuery(q)} class="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]" title="Load">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
												</svg>
											</button>
											<button onclick={() => { navigator.clipboard.writeText(generateQueryUrl(q.gql)); }} class="p-0.5 text-[var(--color-text-muted)] hover:text-blue-400" title="Copy URL">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
												</svg>
											</button>
											<button onclick={() => { deleteQuery(q.id); refreshSavedQueries(); }} class="p-0.5 text-[var(--color-text-muted)] hover:text-red-400" title="Delete">
												<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										</div>
									</div>
									<code class="text-[10px] text-[var(--color-accent)] font-mono truncate block">{q.gql}</code>
									{#if q.description}
										<div class="text-[10px] text-[var(--color-text-muted)] truncate">{q.description}</div>
									{/if}
								</div>
							{/each}
						{/if}
						<!-- Import/Export -->
						<div class="p-2 border-t border-[var(--color-border)] flex gap-2">
							<button
								onclick={handleExportAll}
								disabled={savedQueries.length === 0}
								class="flex-1 px-2 py-1 text-[10px] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded hover:text-emerald-400 disabled:opacity-50"
							>
								Export .gql
							</button>
							<label class="flex-1 px-2 py-1 text-[10px] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded hover:text-blue-400 cursor-pointer text-center">
								Import
								<input
									bind:this={fileInputEl}
									type="file"
									accept=".gql,.txt"
									class="hidden"
									onchange={handleImportFile}
								/>
							</label>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
