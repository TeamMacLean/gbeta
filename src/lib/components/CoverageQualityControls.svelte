<!--
  Coverage Quality Controls Component

  3-point discrete slider for Fast/Medium/Detailed quality settings
  Shows for BAM and quantitative tracks only
-->
<script lang="ts">
	import { useCoverageQuality, type CoverageQuality } from '$lib/stores/coverageQuality.svelte';
	import { shouldShowCoverageControls, type TrackType } from '$lib/utils/coverageControls';

	// Props
	let { tracks = [] }: { tracks?: TrackType[] } = $props();

	// Store
	const coverageQuality = useCoverageQuality();

	// Quality options with labels and descriptions
	const qualityOptions: Array<{
		value: CoverageQuality;
		label: string;
		description: string;
	}> = [
		{
			value: 'fast',
			label: 'Fast',
			description: 'Faster loading, less detail (~75 samples)'
		},
		{
			value: 'medium',
			label: 'Medium',
			description: 'Balanced performance and detail (~125 samples)'
		},
		{
			value: 'detailed',
			label: 'Detailed',
			description: 'More detail, slower loading (~175 samples)'
		}
	];

	// Reactive visibility
	const showControls = $derived(shouldShowCoverageControls(tracks));

	// Get current quality for BAM tracks (most common use case)
	const currentBamQuality = $derived(coverageQuality.bamQuality);

	function handleQualityChange(newQuality: CoverageQuality): void {
		// Update quality for all quantitative track types
		// This is simplified - could be more granular per track type
		coverageQuality.setBamQuality(newQuality);
		coverageQuality.setBigwigQuality(newQuality);
	}

	// Export types for testing
	export type { CoverageQuality, TrackType };
</script>

{#if showControls}
	<div class="track-section coverage-controls">
		<div class="section-header">
			<h4>Coverage Quality</h4>
			<p class="text-xs text-gray-600 dark:text-gray-400">
				Adjust detail vs performance for coverage tracks
			</p>
		</div>

		<div class="slider-container">
			<!-- Quality slider -->
			<div class="quality-slider">
				<input
					type="range"
					min="0"
					max="2"
					step="1"
					value={qualityOptions.findIndex(opt => opt.value === currentBamQuality)}
					oninput={(e) => {
						const index = parseInt(e.currentTarget.value);
						const quality = qualityOptions[index]?.value;
						if (quality) {
							handleQualityChange(quality);
						}
					}}
					class="w-full accent-blue-500"
					aria-label="Coverage quality"
				/>

				<!-- Quality labels -->
				<div class="quality-labels">
					{#each qualityOptions as option, index}
						<button
							type="button"
							class="quality-option"
							class:active={option.value === currentBamQuality}
							onclick={() => handleQualityChange(option.value)}
							aria-label="Set quality to {option.label}"
						>
							<span class="label">{option.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Performance hint -->
			<div class="performance-hint">
				{#each qualityOptions as option}
					{#if option.value === currentBamQuality}
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{option.description}
						</p>
					{/if}
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.coverage-controls {
		border-top: 1px solid rgb(229 231 235);
		padding-top: 1rem;
		margin-top: 1rem;
	}

	:global(.dark) .coverage-controls {
		border-color: rgb(75 85 99);
	}

	.section-header h4 {
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
		color: rgb(17 24 39);
	}

	:global(.dark) .section-header h4 {
		color: rgb(243 244 246);
	}

	.slider-container {
		margin-top: 0.75rem;
	}

	.quality-slider {
		position: relative;
		margin-bottom: 1rem;
	}

	.quality-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
	}

	.quality-option {
		background: none;
		border: none;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 0.75rem;
		color: rgb(107 114 128);
		transition: all 0.2s ease;
	}

	.quality-option:hover {
		background-color: rgb(243 244 246);
		color: rgb(17 24 39);
	}

	.quality-option.active {
		background-color: rgb(59 130 246);
		color: white;
		font-weight: 500;
	}

	:global(.dark) .quality-option {
		color: rgb(156 163 175);
	}

	:global(.dark) .quality-option:hover {
		background-color: rgb(55 65 81);
		color: rgb(243 244 246);
	}

	:global(.dark) .quality-option.active {
		background-color: rgb(59 130 246);
		color: white;
	}

	.performance-hint {
		text-align: center;
		min-height: 1.25rem;
	}

	.track-section {
		/* Inherit existing sidebar section styles */
	}
</style>