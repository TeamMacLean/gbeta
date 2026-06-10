<script lang="ts">
	import { useTracks } from '$lib/stores/tracks.svelte';
	import { useViewport } from '$lib/stores/viewport.svelte';
	import { useRemoteTracks } from '$lib/stores/remoteTracks.svelte';
	import { useLocalBinaryTracks } from '$lib/stores/localBinaryTracks.svelte';
	import { getSupportedExtensions } from '$lib/services/trackRegistry';
	import { useTheme } from '$lib/stores/theme.svelte';
	import { SIGNAL_RAMPS } from '$lib/services/palette';
	import {
		detectLocalBinaryType,
		requiresIndexFile,
		getIndexExtension,
		matchIndexFile,
		type LocalBinaryTrackType
	} from '$lib/services/localBinaryTracks';
	import CoverageQualityControls from '$lib/components/CoverageQualityControls.svelte';

	const tracks = useTracks();
	const viewport = useViewport();
	const remoteTracks = useRemoteTracks();
	const localBinaryTracks = useLocalBinaryTracks();
	const theme = useTheme();

	// Combined tracks array for coverage controls (all track types)
	const allTracksForControls = $derived([
		...tracks.all.map(track => ({
			id: track.id,
			type: track.typeId,
			name: track.name,
			visible: track.visible
		})),
		...remoteTracks.all.map(track => ({
			id: track.id,
			type: track.type,
			name: track.name,
			visible: track.visible
		})),
		...localBinaryTracks.all.map(track => ({
			id: track.id,
			type: track.type,
			name: track.name,
			visible: track.visible
		}))
	]);

	/**
	 * Get track indicator color that matches canvas rendering
	 * Colors are derived from the current theme palette to ensure consistency
	 */
	function getTrackIndicatorColor(trackType: string): string {
		const palette = theme.palette;
		switch (trackType.toLowerCase()) {
			case 'bigbed':
			case 'bed':
				return palette.exon;
			case 'bigwig':
			case 'bedgraph':
				// Use dark end of Blues ramp (same as signal track rendering)
				return SIGNAL_RAMPS.blues.colors[4]; // #084594
			case 'vcf':
				// SNP blue from variant colors
				return '#3b82f6';
			case 'gff':
			case 'gtf':
				return palette.cds;
			case 'bam':
			case 'cram':
				// Forward read indigo (matches BAM rendering)
				return '#6366f1';
			default:
				return palette.gene;
		}
	}

	// Get supported extensions for file input (text formats + binary formats)
	const textExtensions = getSupportedExtensions().map(ext => `.${ext}`);
	const binaryExtensions = ['.bb', '.bigbed', '.bw', '.bigwig', '.bam', '.bai', '.cram', '.crai', '.vcf.gz', '.gff.gz', '.gff3.gz', '.bed.gz', '.tbi'];
	const supportedExtensions = [...textExtensions, ...binaryExtensions].join(',');

	let isCollapsed = $state(false);
	let fileInputEl: HTMLInputElement;
	let indexFileInputEl: HTMLInputElement;

	// Add track mode: 'file' or 'url'
	let addTrackMode = $state<'file' | 'url'>('file');
	let urlInput = $state('');
	let urlError = $state<string | null>(null);
	let isAddingUrl = $state(false);

	// Pending binary file that needs an index
	let pendingBinaryFile = $state<{ file: File; type: LocalBinaryTrackType } | null>(null);

	// Track colors by type
	const binaryTrackColors: Record<string, string> = {
		bigwig: '#10b981',  // Green for signal
		bigbed: '#8b5cf6',  // Purple for intervals
		vcf: '#f59e0b',     // Amber for variants
		gff: '#3b82f6',     // Blue for gene models
		bed: '#ec4899',     // Pink for BED intervals
		bam: '#06b6d4',     // Cyan for BAM alignments
		cram: '#14b8a6',    // Teal for CRAM alignments
	};

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;

		const fileArray = Array.from(files);

		// Separate files by type
		const dataFiles: Array<{ file: File; type: LocalBinaryTrackType }> = [];
		const indexFiles: File[] = [];
		const textFiles: File[] = [];

		for (const file of fileArray) {
			const binaryType = detectLocalBinaryType(file.name);
			if (binaryType) {
				dataFiles.push({ file, type: binaryType });
			} else if (file.name.endsWith('.bai') || file.name.endsWith('.tbi') || file.name.endsWith('.crai')) {
				indexFiles.push(file);
			} else {
				textFiles.push(file);
			}
		}

		// Handle text files with existing track system
		for (const file of textFiles) {
			await tracks.addTrackFromFile(file);
		}

		// Handle binary files
		for (const { file, type } of dataFiles) {
			if (requiresIndexFile(type)) {
				// Try to auto-match index file from selected files
				const indexFile = matchIndexFile(file, [...indexFiles, ...fileArray]);

				if (indexFile) {
					// Found matching index - add track immediately
					await addLocalBinaryTrack(file, type, indexFile);
				} else {
					// No matching index - prompt user
					pendingBinaryFile = { file, type };
					// Open index file picker
					setTimeout(() => indexFileInputEl?.click(), 100);
				}
			} else {
				// Self-indexed format (BigBed, BigWig) - add immediately
				await addLocalBinaryTrack(file, type);
			}
		}

		// Reset input so same file can be selected again
		input.value = '';
	}

	function handleIndexFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0 || !pendingBinaryFile) {
			pendingBinaryFile = null;
			return;
		}

		const indexFile = files[0];
		addLocalBinaryTrack(pendingBinaryFile.file, pendingBinaryFile.type, indexFile);

		pendingBinaryFile = null;
		input.value = '';
	}

	function cancelPendingBinary() {
		pendingBinaryFile = null;
	}

	async function addLocalBinaryTrack(file: File, type: LocalBinaryTrackType, indexFile?: File) {
		const trackName = file.name
			.replace(/\.(bb|bw|bigbed|bigwig|vcf\.gz|gff\.gz|gff3\.gz|bed\.gz|bam|cram)$/i, '');

		localBinaryTracks.addLocalBinaryTrack({
			id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			name: trackName,
			type,
			file,
			indexFile,
			color: binaryTrackColors[type] || '#8b5cf6',
		});

		// Trigger fetch for current viewport
		localBinaryTracks.updateForViewport(viewport.current);
	}

	async function handleUrlSubmit() {
		const url = urlInput.trim();
		if (!url) return;

		urlError = null;

		// Validate URL format
		try {
			new URL(url);
		} catch {
			urlError = 'Invalid URL format';
			return;
		}

		// Detect type from extension
		const lowerUrl = url.toLowerCase();
		let trackType: 'bigbed' | 'bigwig' | 'vcf' | 'gff' | 'bed' | 'bam' | 'cram' | null = null;

		if (lowerUrl.endsWith('.bb') || lowerUrl.endsWith('.bigbed')) {
			trackType = 'bigbed';
		} else if (lowerUrl.endsWith('.bw') || lowerUrl.endsWith('.bigwig')) {
			trackType = 'bigwig';
		} else if (lowerUrl.endsWith('.vcf.gz')) {
			trackType = 'vcf';
		} else if (lowerUrl.endsWith('.gff.gz') || lowerUrl.endsWith('.gff3.gz')) {
			trackType = 'gff';
		} else if (lowerUrl.endsWith('.bed.gz')) {
			trackType = 'bed';
		} else if (lowerUrl.endsWith('.bam')) {
			trackType = 'bam';
		} else if (lowerUrl.endsWith('.cram')) {
			trackType = 'cram';
		} else {
			urlError = 'Unsupported format. Use .bb, .bw, .vcf.gz, .gff.gz, .bed.gz, .bam, or .cram';
			return;
		}

		// Extract filename for track name
		const filename = url.split('/').pop()?.split('?')[0] || 'Remote Track';
		const trackName = filename.replace(/\.(bb|bw|bigbed|bigwig|vcf\.gz|gff\.gz|gff3\.gz|bed\.gz|bam|cram)$/i, '');

		isAddingUrl = true;

		try {
			// Add to remote tracks store
			const { useAssembly } = await import('$lib/stores/assembly.svelte');
			const assembly = useAssembly();

			// Choose color based on track type
			const trackColors: Record<string, string> = {
				bigwig: '#10b981',  // Green for signal
				bigbed: '#8b5cf6',  // Purple for intervals
				vcf: '#f59e0b',     // Amber for variants
				gff: '#3b82f6',     // Blue for gene models
				bed: '#ec4899',     // Pink for BED intervals
				bam: '#06b6d4',     // Cyan for BAM alignments
				cram: '#14b8a6',    // Teal for CRAM alignments
			};

			remoteTracks.addRemoteTrack({
				id: `url-${Date.now()}`,
				name: trackName,
				type: trackType,
				url: url,
				assemblyId: assembly.current.id,
				color: trackColors[trackType] || '#8b5cf6',
			});

			// Trigger fetch for current viewport
			const { useViewport } = await import('$lib/stores/viewport.svelte');
			const viewport = useViewport();
			remoteTracks.updateForViewport(viewport.current);

			// Clear input on success
			urlInput = '';
		} catch (err) {
			urlError = err instanceof Error ? err.message : 'Failed to add track';
		} finally {
			isAddingUrl = false;
		}
	}

	function getTrackStats(track: { features: { chromosome: string }[] }) {
		const chromosomes = new Set(track.features.map(f => f.chromosome));
		return {
			featureCount: track.features.length,
			chromosomeCount: chromosomes.size,
		};
	}

	function navigateToTrack(track: { features: { chromosome: string; start: number; end: number }[] }) {
		if (track.features.length === 0) return;

		// Find the extent of all features
		const features = track.features;
		const chr = features[0].chromosome;
		const chrFeatures = features.filter(f => f.chromosome === chr);

		if (chrFeatures.length === 0) return;

		const minStart = Math.min(...chrFeatures.map(f => f.start));
		const maxEnd = Math.max(...chrFeatures.map(f => f.end));

		// Add some padding
		const padding = Math.round((maxEnd - minStart) * 0.1);
		viewport.navigateTo(chr, Math.max(0, minStart - padding), maxEnd + padding);
	}
</script>

<aside
	class="flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] transition-all duration-200"
	class:w-64={!isCollapsed}
	class:w-12={isCollapsed}
>
	<!-- Toggle button -->
	<button
		onclick={() => isCollapsed = !isCollapsed}
		class="p-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
		title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="w-5 h-5 transition-transform"
			class:rotate-180={isCollapsed}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
		</svg>
	</button>

	{#if !isCollapsed}
		<!-- Tracks section -->
		<div class="flex-1 p-3 overflow-y-auto">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
					Tracks ({tracks.all.length + remoteTracks.all.length + localBinaryTracks.all.length})
				</h3>
				{#if tracks.all.length > 0}
					<button
						onclick={() => tracks.clearAllTracks()}
						class="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
						title="Remove all tracks"
					>
						Clear
					</button>
				{/if}
			</div>

			<div class="space-y-2">
				{#if tracks.all.length === 0 && remoteTracks.all.length === 0 && localBinaryTracks.all.length === 0}
					<!-- Empty state -->
					<div class="p-3 bg-[var(--color-bg-tertiary)] rounded border border-dashed border-[var(--color-border)] text-center">
						<p class="text-sm text-[var(--color-text-muted)]">No tracks loaded</p>
						<p class="text-xs text-[var(--color-text-muted)] mt-1">Drop files on canvas or use button below</p>
					</div>
				{:else}
					<!-- Remote tracks (genes, etc.) -->
					{#each remoteTracks.all as track (track.id)}
						{@const indicatorColor = getTrackIndicatorColor(track.type)}
						<div
							class="p-2 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)] group"
							style="border-left: 3px solid {indicatorColor}"
						>
							<div class="flex items-center gap-2">
								<!-- Visibility toggle -->
								<button
									onclick={() => remoteTracks.toggleRemoteTrackVisibility(track.id)}
									class="w-4 h-4 rounded flex items-center justify-center transition-colors"
									style="background-color: {track.visible ? indicatorColor : 'transparent'}; border: 2px solid {indicatorColor}"
									title={track.visible ? 'Hide track' : 'Show track'}
								>
									{#if track.visible}
										<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</button>

								<!-- Track name -->
								<span class="flex-1 text-sm text-[var(--color-text-primary)] truncate">
									{track.name}
								</span>

								<!-- Loading indicator -->
								{#if track.isLoading}
									<span class="text-xs text-[var(--color-accent)]">Loading...</span>
								{/if}

								<!-- Delete button (only for user-added tracks, not built-in gene/transcript tracks) -->
								{#if track.id !== 'genes' && track.id !== 'transcripts'}
									<button
										onclick={() => remoteTracks.removeRemoteTrack(track.id)}
										class="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
										title="Remove track"
									>
										<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</div>

							<!-- Track info -->
							<div class="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
								<span class="uppercase">{track.type}</span>
								<span>·</span>
								<span>{track.features.length.toLocaleString()} features</span>
								{#if track.error}
									<span class="text-red-400" title={track.error}>Error</span>
								{/if}
							</div>

							<!-- Height control -->
							<div class="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<span class="text-[10px] text-[var(--color-text-muted)] w-8">
									{track.userHeight ?? 'Auto'}
								</span>
								<input
									type="range"
									min="50"
									max="300"
									step="10"
									value={track.userHeight ?? 150}
									oninput={(e) => remoteTracks.setRemoteTrackHeight(track.id, parseInt(e.currentTarget.value))}
									class="flex-1 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
									title="Track height"
								/>
								<button
									onclick={() => remoteTracks.setRemoteTrackHeight(track.id, null)}
									class="text-[10px] px-1.5 py-0.5 rounded transition-colors"
									class:bg-[var(--color-accent)]={track.userHeight === null}
									class:text-white={track.userHeight === null}
									class:bg-[var(--color-bg-secondary)]={track.userHeight !== null}
									class:text-[var(--color-text-muted)]={track.userHeight !== null}
									class:hover:bg-[var(--color-border)]={track.userHeight !== null}
									title="Auto-size track height"
								>
									Auto
								</button>
							</div>
						</div>
					{/each}
					<!-- Local binary tracks (BigBed, BigWig, BAM, etc.) -->
					{#each localBinaryTracks.all as track (track.id)}
						{@const indicatorColor = getTrackIndicatorColor(track.type)}
						<div
							class="p-2 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)] group"
							style="border-left: 3px solid {indicatorColor}"
						>
							<div class="flex items-center gap-2">
								<!-- Visibility toggle -->
								<button
									onclick={() => localBinaryTracks.toggleLocalBinaryTrackVisibility(track.id)}
									class="w-4 h-4 rounded flex items-center justify-center transition-colors"
									style="background-color: {track.visible ? indicatorColor : 'transparent'}; border: 2px solid {indicatorColor}"
									title={track.visible ? 'Hide track' : 'Show track'}
								>
									{#if track.visible}
										<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</button>

								<!-- Track name -->
								<span class="flex-1 text-sm text-[var(--color-text-primary)] truncate">
									{track.name}
								</span>

								<!-- Loading indicator -->
								{#if track.isLoading}
									<span class="text-xs text-[var(--color-accent)]">Loading...</span>
								{/if}

								<!-- Delete button -->
								<button
									onclick={() => localBinaryTracks.removeLocalBinaryTrack(track.id)}
									class="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
									title="Remove track"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							<!-- Track info -->
							<div class="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
								<span class="uppercase">{track.type}</span>
								<span>·</span>
								<span>{track.features.length.toLocaleString()} features</span>
								<span>·</span>
								<span class="text-[var(--color-text-muted)] italic">local</span>
								{#if track.error}
									<span class="text-red-400" title={track.error}>Error</span>
								{/if}
							</div>

							<!-- Height control -->
							<div class="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
								<span class="text-[10px] text-[var(--color-text-muted)] w-8">
									{track.userHeight ?? 'Auto'}
								</span>
								<input
									type="range"
									min="50"
									max="300"
									step="10"
									value={track.userHeight ?? 150}
									oninput={(e) => localBinaryTracks.setLocalBinaryTrackHeight(track.id, parseInt(e.currentTarget.value))}
									class="flex-1 h-1 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
									title="Track height"
								/>
								<button
									onclick={() => localBinaryTracks.setLocalBinaryTrackHeight(track.id, null)}
									class="text-[10px] px-1.5 py-0.5 rounded transition-colors"
									class:bg-[var(--color-accent)]={track.userHeight === null}
									class:text-white={track.userHeight === null}
									class:bg-[var(--color-bg-secondary)]={track.userHeight !== null}
									class:text-[var(--color-text-muted)]={track.userHeight !== null}
									class:hover:bg-[var(--color-border)]={track.userHeight !== null}
									title="Auto-size track height"
								>
									Auto
								</button>
							</div>
						</div>
					{/each}
					<!-- Track list (text files) -->
					{#each tracks.all as track (track.id)}
						{@const stats = getTrackStats(track)}
						{@const indicatorColor = getTrackIndicatorColor(track.typeId)}
						<div
							class="p-2 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)] group"
							style="border-left: 3px solid {indicatorColor}"
						>
							<div class="flex items-center gap-2">
								<!-- Visibility toggle -->
								<button
									onclick={() => tracks.toggleTrackVisibility(track.id)}
									class="w-4 h-4 rounded flex items-center justify-center transition-colors"
									style="background-color: {track.visible ? indicatorColor : 'transparent'}; border: 2px solid {indicatorColor}"
									title={track.visible ? 'Hide track' : 'Show track'}
								>
									{#if track.visible}
										<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</button>

								<!-- Track name -->
								<button
									onclick={() => navigateToTrack(track)}
									class="flex-1 text-left text-sm text-[var(--color-text-primary)] hover:text-[var(--color-accent)] truncate transition-colors"
									title="Navigate to track"
								>
									{track.name}
								</button>

								<!-- Delete button -->
								<button
									onclick={() => tracks.removeTrack(track.id)}
									class="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
									title="Remove track"
								>
									<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							<!-- Track info -->
							<div class="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
								<span class="uppercase">{track.typeId}</span>
								<span>·</span>
								<span>{stats.featureCount.toLocaleString()} features</span>
								{#if stats.chromosomeCount > 1}
									<span>·</span>
									<span>{stats.chromosomeCount} chr</span>
								{/if}
							</div>

							<!-- Move buttons -->
							<div class="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									onclick={() => tracks.moveTrack(track.id, 'up')}
									class="px-2 py-0.5 text-xs bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] rounded transition-colors"
									title="Move up"
								>
									↑
								</button>
								<button
									onclick={() => tracks.moveTrack(track.id, 'down')}
									class="px-2 py-0.5 text-xs bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] rounded transition-colors"
									title="Move down"
								>
									↓
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Coverage Quality Controls -->
		<CoverageQualityControls tracks={allTracksForControls} />

		<!-- Add track section -->
		<div class="p-3 border-t border-[var(--color-border)]">
			<h3 class="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
				Add Tracks
			</h3>
			<!-- Tab buttons -->
			<div class="flex mb-3 bg-[var(--color-bg-tertiary)] rounded-lg p-0.5">
				<button
					onclick={() => addTrackMode = 'file'}
					class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
					class:bg-[var(--color-bg-secondary)]={addTrackMode === 'file'}
					class:text-[var(--color-text-primary)]={addTrackMode === 'file'}
					class:shadow-sm={addTrackMode === 'file'}
					class:text-[var(--color-text-muted)]={addTrackMode !== 'file'}
				>
					File
				</button>
				<button
					onclick={() => addTrackMode = 'url'}
					class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
					class:bg-[var(--color-bg-secondary)]={addTrackMode === 'url'}
					class:text-[var(--color-text-primary)]={addTrackMode === 'url'}
					class:shadow-sm={addTrackMode === 'url'}
					class:text-[var(--color-text-muted)]={addTrackMode !== 'url'}
				>
					URL
				</button>
			</div>

			{#if addTrackMode === 'file'}
				<!-- File input -->
				<input
					bind:this={fileInputEl}
					type="file"
					accept={supportedExtensions}
					multiple
					class="hidden"
					data-testid="sidebar-file-input"
					onchange={handleFileSelect}
				/>
				<!-- Hidden index file input -->
				<input
					bind:this={indexFileInputEl}
					type="file"
					accept=".bai,.tbi,.crai"
					class="hidden"
					onchange={handleIndexFileSelect}
				/>

				{#if pendingBinaryFile}
					<!-- Prompt for index file -->
					<div class="p-3 bg-amber-900/20 border border-amber-600/50 rounded-lg space-y-2">
						<p class="text-xs text-amber-200">
							<strong>{pendingBinaryFile.file.name}</strong> requires an index file ({getIndexExtension(pendingBinaryFile.type)})
						</p>
						<div class="flex gap-2">
							<button
								onclick={() => indexFileInputEl?.click()}
								class="flex-1 px-2 py-1.5 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors"
							>
								Select Index File
							</button>
							<button
								onclick={cancelPendingBinary}
								class="px-2 py-1.5 text-xs text-amber-300 hover:text-amber-100 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => fileInputEl?.click()}
						class="w-full flex flex-col items-center gap-2 p-4 border-2 border-dashed border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
						</svg>
						<span class="text-xs text-[var(--color-text-secondary)]">Drop or browse</span>
						<span class="text-[10px] text-[var(--color-text-secondary)]">.bw, .bb, .bam, .cram, .vcf.gz, .gff.gz, .bed.gz</span>
						<span class="text-[10px] text-[var(--color-text-muted)]">.bed, .gff, .vcf, .bedgraph</span>
					</button>
				{/if}
			{:else}
				<!-- URL input -->
				<div class="space-y-2">
					<div class="flex gap-1">
						<input
							type="url"
							bind:value={urlInput}
							placeholder="https://example.com/track.bw"
							class="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
							onkeydown={(e) => e.key === 'Enter' && handleUrlSubmit()}
							disabled={isAddingUrl}
						/>
						<button
							onclick={handleUrlSubmit}
							disabled={!urlInput.trim() || isAddingUrl}
							class="px-2 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isAddingUrl ? '...' : '+'}
						</button>
					</div>
					{#if urlError}
						<p class="text-[10px] text-red-400">{urlError}</p>
					{/if}
					<p class="text-[10px] text-[var(--color-text-muted)]">
						Supports .bb, .bw, .vcf.gz, .gff.gz, .bed.gz, .bam, .cram
					</p>
				</div>
			{/if}
		</div>
	{/if}
</aside>
