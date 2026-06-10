<script lang="ts">
	import { useCoverageWarning } from '$lib/stores/coverageWarning.svelte';

	const warning = useCoverageWarning();

	function close() {
		warning.dismiss();
	}
</script>

{#if warning.visible}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-50"
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="button"
		tabindex="0"
		aria-label="Dismiss sparse coverage notice"
	></div>

	<!-- Dialog -->
	<div
		class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl"
		role="dialog"
		aria-modal="true"
		aria-labelledby="sparse-coverage-title"
	>
		<div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
			<h2 id="sparse-coverage-title" class="text-sm font-semibold text-[var(--color-text-primary)]">
				Very little coverage here
			</h2>
			<button
				onclick={close}
				class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
				title="Close"
				aria-label="Close"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="p-4 space-y-3 text-sm text-[var(--color-text-secondary)]">
			<p>
				This BAM track has little or no read coverage across the visible region{#if warning.region}{' '}({warning.region}){/if} at this zoom level, so the coverage histogram appears
				essentially blank.
			</p>
			<p>
				That usually means the data loaded fine — there just aren't many reads here. Try
				<strong class="text-[var(--color-text-primary)]">zooming in</strong> to see individual
				reads, or navigate to a region with more coverage.
			</p>
			<div class="flex justify-end pt-1">
				<button
					onclick={close}
					class="px-3 py-1.5 text-sm font-medium rounded bg-[var(--color-accent)] text-white transition-colors"
				>
					Got it
				</button>
			</div>
		</div>
	</div>
{/if}
