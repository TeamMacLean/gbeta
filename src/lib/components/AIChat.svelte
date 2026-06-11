<!--
  Conversational AI panel — multi-turn natural language → GQL.
  The AI can ask follow-up clarifications; replies carry conversation context.
  Resolved queries run through the shared engine (gene + track aware) and land
  in the unified query history.
-->
<script lang="ts">
	import { useViewport } from '$lib/stores/viewport.svelte';
	import { useTracks } from '$lib/stores/tracks.svelte';
	import { useAssembly } from '$lib/stores/assembly.svelte';
	import { executeQueryWithTracks, getAvailableGenes } from '$lib/services/queryLanguage';
	import { routeQuery } from '$lib/services/queryRouter';
	import { highlightGene } from '$lib/stores/geneHighlight.svelte';
	import { translateToGQL, buildBrowserContext, isAIConfigured } from '$lib/services/ai';
	import type { ConversationTurn } from '$lib/services/ai/types';

	const viewport = useViewport();
	const tracks = useTracks();
	const assembly = useAssembly();

	type Msg =
		| { role: 'user'; text: string }
		| { role: 'assistant'; kind: 'gql'; gql: string; reasoning?: string; message: string }
		| { role: 'assistant'; kind: 'clarify'; text: string }
		| { role: 'assistant'; kind: 'error'; text: string };

	let isOpen = $state(false);
	let input = $state('');
	let thinking = $state(false);
	let messages = $state<Msg[]>([]);
	// What we feed back to the model for context (user inputs + assistant outputs).
	let aiHistory: ConversationTurn[] = [];
	let threadEl = $state<HTMLDivElement | null>(null);

	function aiContext() {
		return buildBrowserContext(tracks.all, viewport.current, getAvailableGenes(tracks.all));
	}

	function scrollDown() {
		queueMicrotask(() => {
			if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;
		});
	}

	async function send() {
		const text = input.trim();
		if (!text || thinking) return;
		input = '';
		messages = [...messages, { role: 'user', text }];
		aiHistory = [...aiHistory, { role: 'user', content: text }];
		thinking = true;
		scrollDown();

		try {
			const res = await translateToGQL(text, aiContext(), aiHistory.slice(0, -1));

			if (res.clarificationNeeded && res.clarificationQuestion) {
				messages = [...messages, { role: 'assistant', kind: 'clarify', text: res.clarificationQuestion }];
				aiHistory = [...aiHistory, { role: 'assistant', content: `CLARIFY: ${res.clarificationQuestion}` }];
			} else if (res.success && res.gql) {
				aiHistory = [...aiHistory, { role: 'assistant', content: res.gql }];
				// Execute through the shared engine (resolves genes, runs over loaded tracks).
				const outcome = await routeQuery(res.gql, assembly.current, aiContext, {
					exec: (q) => executeQueryWithTracks(q, tracks.all),
					trackGenes: new Set(getAvailableGenes(tracks.all).map((g) => g.toUpperCase()))
				});
				if (outcome.chosen) highlightGene(outcome.chosen);
				messages = [
					...messages,
					{
						role: 'assistant',
						kind: 'gql',
						gql: res.gql,
						reasoning: res.explanation,
						message: outcome.result.message
					}
				];
			} else {
				messages = [...messages, { role: 'assistant', kind: 'error', text: res.error ?? "I couldn't translate that." }];
			}
		} catch (e) {
			messages = [...messages, { role: 'assistant', kind: 'error', text: e instanceof Error ? e.message : String(e) }];
		} finally {
			thinking = false;
			scrollDown();
		}
	}

	function clearChat() {
		messages = [];
		aiHistory = [];
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}
</script>

<!-- Toggle button (floating, bottom-right) -->
<button
	onclick={() => (isOpen = !isOpen)}
	class="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg bg-[var(--color-accent)] text-white text-sm hover:opacity-90 transition-opacity"
	title="Ask the AI (natural language)"
>
	<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
	</svg>
	Ask AI
</button>

{#if isOpen}
	<div class="fixed bottom-20 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] h-[28rem] flex flex-col bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl">
		<!-- Header -->
		<div class="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
			<span class="text-sm font-semibold text-[var(--color-text-primary)]">Ask AI</span>
			<div class="flex items-center gap-2">
				{#if messages.length > 0}
					<button onclick={clearChat} class="text-[10px] text-[var(--color-text-muted)] hover:text-red-400">Clear</button>
				{/if}
				<button onclick={() => (isOpen = false)} class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Close">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>
		</div>

		<!-- Thread -->
		<div bind:this={threadEl} class="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
			{#if !isAIConfigured()}
				<div class="text-[var(--color-text-muted)]">
					Add an AI API key in Settings → AI to chat. You can still navigate by typing a gene
					or coordinate in the search bar.
				</div>
			{:else if messages.length === 0}
				<div class="text-[var(--color-text-muted)]">
					Ask in plain English, e.g. <em>"take me to the breast cancer gene"</em> or
					<em>"which genes here have variants?"</em>. I'll ask if anything's ambiguous.
				</div>
			{/if}

			{#each messages as m}
				{#if m.role === 'user'}
					<div class="flex justify-end">
						<div class="max-w-[85%] rounded-lg px-2.5 py-1.5 bg-[var(--color-accent)] text-white">{m.text}</div>
					</div>
				{:else if m.kind === 'gql'}
					<div class="max-w-[90%] rounded-lg px-2.5 py-1.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]">
						{#if m.reasoning}<div class="text-[var(--color-text-secondary)] italic mb-1">💭 {m.reasoning}</div>{/if}
						<code class="font-mono text-[var(--color-accent)]">{m.gql}</code>
						<div class="text-[10px] text-[var(--color-text-muted)] mt-0.5">{m.message}</div>
					</div>
				{:else if m.kind === 'clarify'}
					<div class="max-w-[90%] rounded-lg px-2.5 py-1.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]">
						<span class="text-amber-400">?</span> {m.text}
					</div>
				{:else}
					<div class="max-w-[90%] rounded-lg px-2.5 py-1.5 bg-[var(--color-bg-tertiary)] text-amber-400">{m.text}</div>
				{/if}
			{/each}

			{#if thinking}
				<div class="text-[var(--color-text-muted)] italic">thinking…</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="border-t border-[var(--color-border)] p-2 flex gap-2">
			<input
				type="text"
				bind:value={input}
				onkeydown={onKeydown}
				disabled={thinking || !isAIConfigured()}
				placeholder="Ask in plain English…"
				class="flex-1 px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] disabled:opacity-50"
			/>
			<button
				onclick={send}
				disabled={thinking || !input.trim() || !isAIConfigured()}
				class="px-3 py-1 text-xs bg-[var(--color-accent)] text-white rounded disabled:opacity-50"
			>
				Send
			</button>
		</div>
	</div>
{/if}
