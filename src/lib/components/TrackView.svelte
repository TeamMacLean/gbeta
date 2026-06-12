<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { useViewport } from '$lib/stores/viewport.svelte';
	import { useTracks } from '$lib/stores/tracks.svelte';
	import { useRemoteTracks, getRawFeatures } from '$lib/stores/remoteTracks.svelte';
	import { useLocalBinaryTracks, getLocalBinaryRawFeatures } from '$lib/stores/localBinaryTracks.svelte';
	import { useAssembly } from '$lib/stores/assembly.svelte';
	import { useReferenceSequence } from '$lib/stores/referenceSequence.svelte';
	import { useTheme } from '$lib/stores/theme.svelte';
	import { useCoverageQuality } from '$lib/stores/coverageQuality.svelte';
	import { useCoverageWarning, isCoverageSparse } from '$lib/stores/coverageWarning.svelte';
	import SparseCoverageDialog from './SparseCoverageDialog.svelte';
	import { formatCoordinate } from '$lib/types/genome';
	import type { SignalFeature, BAMReadFeature, VariantFeature } from '$lib/types/tracks';
	import { getTrackType } from '$lib/services/trackRegistry';
	import { createRenderContext } from '$lib/types/tracks';
	import {
		getCurrentTheme,
		roundedRect,
		drawPill,
		drawIntronConnector,
		drawInnerChevrons,
	} from '$lib/services/trackTypes/geneModel';
	import {
		ZOOM_THRESHOLDS,
		BASE_COLORS,
		shouldShowSequence,
		qualityToOpacity,
		getReadRenderingMode,
	} from '$lib/constants/zoom';
	import { getSignalColor, getSignalRampColor } from '$lib/services/palette';

	// Theme for canvas colors
	const themeStore = useTheme();

	// Helper to get canvas colors based on current theme
	function getCanvasColors() {
		const isDark = themeStore.isDark;
		return {
			// Backgrounds
			canvasBg: isDark ? '#0f0f1a' : '#ffffff',
			trackBg: isDark ? '#1a1a2e' : '#fafafa',
			rulerBg: isDark ? '#252535' : '#f1f3f5',
			// Text
			textPrimary: isDark ? '#e2e8f0' : '#212529',
			textSecondary: isDark ? '#a0aec0' : '#495057',
			textMuted: isDark ? '#718096' : '#6c757d',
			// Borders
			border: isDark ? '#333344' : '#dee2e6',
			borderLight: isDark ? '#444455' : '#e9ecef',
			// Accents
			accent: isDark ? '#6366f1' : '#4f46e5',
			error: isDark ? '#ef4444' : '#dc2626',
			// BAM colors
			readForward: isDark ? '#3f3f46' : '#d1d5db',
			readReverse: isDark ? '#44403c' : '#e5e7eb',
			insertion: '#22c55e',
			deletion: isDark ? '#888888' : '#9ca3af',
			mismatch: '#dc2626',
		};
	}

	const viewport = useViewport();
	const tracks = useTracks();
	const remoteTracks = useRemoteTracks();
	const localBinaryTracks = useLocalBinaryTracks();
	const assembly = useAssembly();
	const referenceSequence = useReferenceSequence();
	const coverageWarning = useCoverageWarning();

	// Initialize viewport from URL on mount and set up gene track
	onMount(() => {
		// Pass assembly info so viewport can use assembly's default if no location in URL
		viewport.initializeFromURL({
			defaultViewport: assembly.current.defaultViewport,
			chromosomes: assembly.current.chromosomes
		});

		// Set up gene track for current assembly
		remoteTracks.setupGeneTrackForAssembly(assembly.current.id);

		// Set up reference sequence for current assembly
		referenceSequence.setupForAssembly(assembly.current.id);

		// Support loading BigWig track via URL parameter for testing
		// Usage: ?bigwig=<url>&bigwig_name=<name>
		const params = new URLSearchParams(window.location.search);
		const bigwigUrl = params.get('bigwig');
		if (bigwigUrl) {
			const bigwigName = params.get('bigwig_name') || 'BigWig Track';
			remoteTracks.addRemoteTrack({
				id: `bigwig-${Date.now()}`,
				name: bigwigName,
				type: 'bigwig',
				url: bigwigUrl,
				assemblyId: assembly.current.id,
				color: '#10b981',
				height: 100
			});
		}

		// Immediately fetch features for the viewport (after all tracks are added)
		remoteTracks.updateForViewport(viewport.current);
	});

	// Update remote tracks and local binary tracks when viewport changes
	// IMPORTANT: Use untrack to prevent this effect from depending on track state
	// Otherwise updating isLoading/features triggers a loop that aborts in-flight requests
	// CRITICAL: Must explicitly read .chromosome, .start, .end to track fine-grained changes
	// Just reading viewport.current (the object) won't detect property mutations in Svelte 5
	$effect(() => {
		const vp = viewport.current;
		// Explicitly read properties to create fine-grained dependencies
		const _chr = vp.chromosome;
		const _start = vp.start;
		const _end = vp.end;
		untrack(() => {
			remoteTracks.updateForViewport(vp);
			localBinaryTracks.updateForViewport(vp);
			// Update reference sequence at high zoom
			const ppb = containerWidth / (vp.end - vp.start);
			referenceSequence.updateForViewport(vp.chromosome, vp.start, vp.end, ppb);
		});
	});

	// Update gene track and reference sequence when assembly changes
	$effect(() => {
		const assemblyId = assembly.current.id;
		const activeId = remoteTracks.activeAssemblyId;
		if (assemblyId !== activeId) {
			// Use untrack for the mutations to prevent re-triggering this effect
			untrack(() => {
				remoteTracks.setupGeneTrackForAssembly(assemblyId);
				referenceSequence.setupForAssembly(assemblyId);
				// Force viewport update to fetch data for new track
				remoteTracks.updateForViewport(viewport.current);
			});
		}
	});

	let containerEl: HTMLDivElement;
	let canvasEl: HTMLCanvasElement;
	let isDragging = $state(false);
	let dragStartX = $state(0);
	let panAccumulatorPx = $state(0); // Accumulate fractional pixel movement for high-zoom pan
	let containerWidth = $state(800);
	let containerHeight = $state(400);

	// File drop state
	let isDragOver = $state(false);

	// Track resize state
	interface TrackBorder {
		trackId: string;
		trackType: 'local' | 'remote';
		y: number; // Y position of bottom border
	}
	let trackBorders = $state<TrackBorder[]>([]);
	let isResizing = $state(false);
	let resizeTrackId = $state<string | null>(null);
	let resizeTrackType = $state<'local' | 'remote' | null>(null);
	let resizeStartY = $state(0);
	let resizeStartHeight = $state(0);
	let isNearBorder = $state(false);
	const BORDER_HIT_ZONE = 6; // pixels from border to trigger resize

	// Insertion tooltip state
	let insertionTooltip = $state<{
		x: number;
		y: number;
		insertedBases: string;
		readName: string;
		refPos: number;
	} | null>(null);

	// Track BAM track layout info for hit testing
	interface BamTrackLayout {
		trackId: string;
		trackType: 'remote' | 'local';
		y: number;
		height: number;
	}
	let bamTrackLayouts = $state<BamTrackLayout[]>([]);

	// Calculate pixels per base
	const pixelsPerBase = $derived(containerWidth / viewport.width);

	// Handle resize
	$effect(() => {
		if (!containerEl) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
				containerHeight = entry.contentRect.height;
			}
		});

		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	// Render canvas
	$effect(() => {
		// Wrap in async IIFE to handle async rendering
		(async () => {
			// IMPORTANT: Read reactive dependencies BEFORE any early returns
			// Otherwise Svelte won't track them and the effect won't re-run
			const _version = tracks.renderVersion;
		const _remoteRenderVersion = remoteTracks.renderVersion; // Track rawFeaturesStore changes
		const _localBinaryRenderVersion = localBinaryTracks.renderVersion; // Track local binary track changes
		const visibleRemote = remoteTracks.visible;
		const visibleLocalBinary = localBinaryTracks.visible;
		const _remoteFeatures = visibleRemote.map(t => t.features.length);
		const _remoteHeights = visibleRemote.map(t => t.userHeight); // Track height changes
		const _localBinaryFeatures = visibleLocalBinary.map(t => t.features.length);
		const _localBinaryHeights = visibleLocalBinary.map(t => t.userHeight);
		// Track reference sequence state for reactivity
		const _refSeq = referenceSequence.sequence;
		const _refLoading = referenceSequence.isLoading;
		// Track theme for re-render on theme change
		const _themeMode = themeStore.mode;
		const _palette = themeStore.paletteName;
		// Track coverage quality changes
		const _coverageQuality = useCoverageQuality().bamQuality;

		if (!canvasEl) return;

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		// Get colors for current theme
		const colors = getCanvasColors();

		// Set canvas size with DPR for crisp rendering
		const dpr = window.devicePixelRatio || 1;
		const width = containerWidth;
		const height = containerHeight;

		canvasEl.width = width * dpr;
		canvasEl.height = height * dpr;
		canvasEl.style.width = `${width}px`;
		canvasEl.style.height = `${height}px`;
		ctx.scale(dpr, dpr);

		// Clear with background color
		ctx.fillStyle = colors.canvasBg;
		ctx.fillRect(0, 0, width, height);

		// Draw ruler
		const rulerHeight = drawRuler(ctx, width);

		// Check for content (local tracks, remote tracks, or local binary tracks)
		const visibleLocalTracks = tracks.visible;
		const visibleRemoteTracks = remoteTracks.visible;
		const visibleLocalBinaryTracks = localBinaryTracks.visible;
		const hasLocalContent = visibleLocalTracks.some(t =>
			t.features.some(f => f.chromosome === viewport.current.chromosome)
		);
		const hasRemoteContent = visibleRemoteTracks.some(t => {
			const rawFeatures = getRawFeatures(t.id);
			return rawFeatures && rawFeatures.length > 0;
		});
		const hasLocalBinaryContent = visibleLocalBinaryTracks.some(t => {
			const rawFeatures = getLocalBinaryRawFeatures(t.id);
			return rawFeatures && rawFeatures.length > 0;
		});

		// Reset track borders for resize hit detection
		const newBorders: TrackBorder[] = [];
		// Reset BAM track layouts for tooltip hit testing
		const newBamLayouts: BamTrackLayout[] = [];

		if (hasLocalContent || hasRemoteContent || hasLocalBinaryContent) {
			let currentY = rulerHeight;

			// Render reference sequence at high zoom (before other tracks)
			currentY = renderReferenceSequence(ctx, width, currentY);

			// Render remote tracks first (gene models)
			if (hasRemoteContent) {
				currentY = await renderRemoteTracks(ctx, width, currentY, newBorders, newBamLayouts);
			}

			// Render local binary tracks
			if (hasLocalBinaryContent) {
				currentY = await renderLocalBinaryTracks(ctx, width, currentY, newBorders, newBamLayouts);
			}

			// Render local text tracks
			if (hasLocalContent) {
				const chrTracks = visibleLocalTracks.filter(t =>
					t.features.some(f => f.chromosome === viewport.current.chromosome)
				);
				renderTracksWithRegistry(ctx, chrTracks, width, currentY);
			}
		} else {
			drawPlaceholder(ctx, width, height, rulerHeight);
		}

		// Update track borders state for resize detection
		trackBorders = newBorders;
		// Update BAM track layouts for tooltip hit testing
		bamTrackLayouts = newBamLayouts;

		// Draw highlights on top
		drawHighlights(ctx, width, height, rulerHeight);
		})(); // Close async IIFE
	});

	/**
	 * Calculate the number of rows needed for gene packing
	 */
	function calculateGeneRows(
		features: import('$lib/types/genome').BedFeature[],
		width: number
	): number {
		const rows: Array<{ end: number }> = [];

		const visibleFeatures = features.filter(f =>
			f.end > viewport.current.start && f.start < viewport.current.end
		);

		for (const feature of visibleFeatures) {
			const startX = Math.max(0, (feature.start - viewport.current.start) * pixelsPerBase);
			let rowIndex = 0;

			for (let i = 0; i < rows.length; i++) {
				if (rows[i].end < startX - 5) {
					rowIndex = i;
					break;
				}
				rowIndex = i + 1;
			}

			const endX = Math.min(width, (feature.end - viewport.current.start) * pixelsPerBase);
			if (rows[rowIndex]) {
				rows[rowIndex].end = endX;
			} else {
				rows[rowIndex] = { end: endX };
			}
		}

		return Math.max(1, rows.length);
	}

	/**
	 * Render remote tracks (BigBed gene models)
	 */
	async function renderRemoteTracks(
		ctx: CanvasRenderingContext2D,
		width: number,
		startY: number,
		borders: TrackBorder[],
		bamLayouts: BamTrackLayout[]
	): Promise<number> {
		let currentY = startY;
		const colors = getCanvasColors();

		for (const track of remoteTracks.visible) {
			if (track.features.length === 0 && !track.isLoading) continue;

			// Calculate track height - use user-set height if available, otherwise auto-calculate
			let trackHeight: number;
			if (track.userHeight !== null && track.userHeight !== undefined) {
				// User has set a specific height
				trackHeight = track.userHeight;
			} else {
				// Auto-calculate based on number of gene rows
				// Note: For BigWig tracks, we don't need row packing - use a fixed height
				if (track.type === 'bigwig') {
					trackHeight = track.height || 100;
				} else {
					const labelOffset = 18;
					const featureHeight = 12;
					const rowSpacing = 4;
					const rowCount = calculateGeneRows(track.features as import('$lib/types/genome').BedFeature[], width);
					const minHeight = 50;
					const maxHeight = 300;
					const calculatedHeight = labelOffset + (rowCount * (featureHeight + rowSpacing)) + 20;
					trackHeight = Math.min(maxHeight, Math.max(minHeight, calculatedHeight));
				}
			}

			// Draw track label background
			ctx.fillStyle = colors.trackBg;
			ctx.fillRect(0, currentY, width, trackHeight);

			// Draw track label
			ctx.fillStyle = colors.textMuted;
			ctx.font = '11px Inter, sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(track.name, 8, currentY + 11);

			// Draw loading indicator
			if (track.isLoading) {
				ctx.fillStyle = colors.accent;
				ctx.font = '10px Inter, sans-serif';
				ctx.fillText('Loading...', 8, currentY + 24);
			}

			// Draw error if any
			if (track.error) {
				ctx.fillStyle = colors.error;
				ctx.font = '10px Inter, sans-serif';
				ctx.fillText(`Error: ${track.error}`, 8, currentY + 24);
			}

			// Draw badge (based on track type)
			ctx.fillStyle = colors.borderLight;
			ctx.font = '9px Inter, sans-serif';
			let badge = track.id === 'transcripts' ? 'TRANSCRIPTS' : 'GENES';
			if (track.type === 'bigwig') {
				badge = 'SIGNAL';
			} else if (track.type === 'vcf') {
				badge = 'VCF';
			} else if (track.type === 'bam') {
				badge = 'BAM';
			}
			const badgeWidth = ctx.measureText(badge).width + 8;
			ctx.fillRect(width - badgeWidth - 8, currentY + 2, badgeWidth, 14);
			ctx.fillStyle = colors.textMuted;
			ctx.textAlign = 'center';
			ctx.fillText(badge, width - badgeWidth / 2 - 8, currentY + 11);

			// Render features based on track type
			if (track.features.length > 0) {
				if (track.type === 'bigwig') {
					// CRITICAL: Use getRawFeatures() to get non-proxied array for performance
					// Svelte 5's $state creates deep proxies that cause O(n^2) behavior in tight loops
					const rawFeatures = getRawFeatures(track.id) as SignalFeature[];
					renderSignalFeatures(ctx, rawFeatures, width, currentY, trackHeight, track.color);
				} else if (track.type === 'bam') {
					// BAM tracks use special rendering with sequence at high zoom
					const rawFeatures = getRawFeatures(track.id) as BAMReadFeature[];
					await renderBamReadsWithSequence(ctx, rawFeatures, width, currentY, trackHeight, track.color, track.url);
					// Record BAM track layout for insertion tooltip hit testing
					bamLayouts.push({
						trackId: track.id,
						trackType: 'remote',
						y: currentY,
						height: trackHeight
					});
				} else if (track.type === 'vcf') {
					// VCF tracks use variant rendering (lollipops/detailed)
					const rawFeatures = getRawFeatures(track.id) as VariantFeature[];
					renderVariantFeatures(ctx, rawFeatures, width, currentY, trackHeight, track.color);
				} else {
					renderBedFeatures(ctx, track.features as import('$lib/types/genome').BedFeature[], width, currentY, trackHeight, track.color);
				}
			}

			// Draw bottom border (thicker when being hovered for resize)
			const borderY = currentY + trackHeight;
			const isHoveredBorder = isNearBorder && resizeTrackId === track.id;
			ctx.strokeStyle = isHoveredBorder ? colors.textMuted : colors.border;
			ctx.lineWidth = isHoveredBorder ? 2 : 1;
			ctx.beginPath();
			ctx.moveTo(0, borderY);
			ctx.lineTo(width, borderY);
			ctx.stroke();
			ctx.lineWidth = 1;

			// Record border position for resize hit detection
			borders.push({
				trackId: track.id,
				trackType: 'remote',
				y: borderY
			});

			currentY += trackHeight;
		}

		return currentY;
	}

	/**
	 * Render local binary tracks (BigBed, BigWig, BAM, tabix)
	 */
	async function renderLocalBinaryTracks(
		ctx: CanvasRenderingContext2D,
		width: number,
		startY: number,
		borders: TrackBorder[],
		bamLayouts: BamTrackLayout[]
	): Promise<number> {
		let currentY = startY;
		const colors = getCanvasColors();

		for (const track of localBinaryTracks.visible) {
			if (track.features.length === 0 && !track.isLoading) continue;

			// Calculate track height
			let trackHeight: number;
			if (track.userHeight !== null && track.userHeight !== undefined) {
				trackHeight = track.userHeight;
			} else {
				// Auto-calculate based on track type
				if (track.type === 'bigwig') {
					trackHeight = track.height || 100;
				} else {
					const labelOffset = 18;
					const featureHeight = 12;
					const rowSpacing = 4;
					const rowCount = calculateGeneRows(track.features as import('$lib/types/genome').BedFeature[], width);
					const minHeight = 50;
					const maxHeight = 300;
					const calculatedHeight = labelOffset + (rowCount * (featureHeight + rowSpacing)) + 20;
					trackHeight = Math.min(maxHeight, Math.max(minHeight, calculatedHeight));
				}
			}

			// Draw track label background
			ctx.fillStyle = colors.trackBg;
			ctx.fillRect(0, currentY, width, trackHeight);

			// Draw track label
			ctx.fillStyle = colors.textMuted;
			ctx.font = '11px Inter, sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(track.name, 8, currentY + 11);

			// Draw loading indicator
			if (track.isLoading) {
				ctx.fillStyle = colors.accent;
				ctx.font = '10px Inter, sans-serif';
				ctx.fillText('Loading...', 8, currentY + 24);
			}

			// Draw error if any
			if (track.error) {
				ctx.fillStyle = colors.error;
				ctx.font = '10px Inter, sans-serif';
				ctx.fillText(`Error: ${track.error}`, 8, currentY + 24);
			}

			// Draw badge
			ctx.fillStyle = colors.borderLight;
			ctx.font = '9px Inter, sans-serif';
			const badgeMap: Record<string, string> = {
				bigwig: 'SIGNAL',
				bigbed: 'BIGBED',
				bam: 'BAM',
				cram: 'CRAM',
				vcf: 'VCF',
				gff: 'GFF',
				bed: 'BED',
			};
			const badge = (badgeMap[track.type] || track.type.toUpperCase()) + ' (local)';
			const badgeWidth = ctx.measureText(badge).width + 8;
			ctx.fillRect(width - badgeWidth - 8, currentY + 2, badgeWidth, 14);
			ctx.fillStyle = colors.textMuted;
			ctx.textAlign = 'center';
			ctx.fillText(badge, width - badgeWidth / 2 - 8, currentY + 11);

			// Render features based on track type
			if (track.features.length > 0) {
				if (track.type === 'bigwig') {
					const rawFeatures = getLocalBinaryRawFeatures(track.id) as SignalFeature[];
					renderSignalFeatures(ctx, rawFeatures, width, currentY, trackHeight, track.color);
				} else if (track.type === 'bam' || track.type === 'cram') {
					// BAM/CRAM tracks use special rendering with sequence at high zoom
					const rawFeatures = getLocalBinaryRawFeatures(track.id) as BAMReadFeature[];
					// Local BAM/CRAM tracks are File-based and have no URL, so windowed
					// coverage (which needs an indexable URL) is unavailable for them.
					await renderBamReadsWithSequence(ctx, rawFeatures, width, currentY, trackHeight, track.color, undefined);
					// Record BAM track layout for insertion tooltip hit testing
					bamLayouts.push({
						trackId: track.id,
						trackType: 'local',
						y: currentY,
						height: trackHeight
					});
				} else if (track.type === 'vcf') {
					// VCF tracks use variant rendering (lollipops/detailed)
					const rawFeatures = getLocalBinaryRawFeatures(track.id) as VariantFeature[];
					renderVariantFeatures(ctx, rawFeatures, width, currentY, trackHeight, track.color);
				} else {
					renderBedFeatures(ctx, track.features as import('$lib/types/genome').BedFeature[], width, currentY, trackHeight, track.color);
				}
			}

			// Draw bottom border
			const borderY = currentY + trackHeight;
			const isHoveredBorder = isNearBorder && resizeTrackId === track.id;
			ctx.strokeStyle = isHoveredBorder ? colors.textMuted : colors.border;
			ctx.lineWidth = isHoveredBorder ? 2 : 1;
			ctx.beginPath();
			ctx.moveTo(0, borderY);
			ctx.lineTo(width, borderY);
			ctx.stroke();
			ctx.lineWidth = 1;

			// Record border position
			borders.push({
				trackId: track.id,
				trackType: 'local',
				y: borderY
			});

			currentY += trackHeight;
		}

		return currentY;
	}

	/**
	 * Render BED12 features (genes with exons) using gene model theme system
	 */
	function renderBedFeatures(
		ctx: CanvasRenderingContext2D,
		features: import('$lib/types/genome').BedFeature[],
		width: number,
		trackY: number,
		trackHeight: number,
		_color: string
	): void {
		const theme = getCurrentTheme();
		const labelOffset = theme.labelHeight;
		const featureHeight = theme.exonHeight;
		const rowSpacing = 4;

		// Simple row packing
		const rows: Array<{ end: number }> = [];
		const featureRows: Map<string, number> = new Map();

		// Filter to visible features
		const visibleFeatures = features.filter(f =>
			f.end > viewport.current.start && f.start < viewport.current.end
		);

		// Assign rows
		for (const feature of visibleFeatures) {
			const startX = Math.max(0, (feature.start - viewport.current.start) * pixelsPerBase);
			let rowIndex = 0;

			for (let i = 0; i < rows.length; i++) {
				if (rows[i].end < startX - 5) {
					rowIndex = i;
					break;
				}
				rowIndex = i + 1;
			}

			const endX = Math.min(width, (feature.end - viewport.current.start) * pixelsPerBase);
			if (rows[rowIndex]) {
				rows[rowIndex].end = endX;
			} else {
				rows[rowIndex] = { end: endX };
			}

			featureRows.set(feature.id, rowIndex);
		}

		// Render features with theme-aware styling
		for (const feature of visibleFeatures) {
			const rowIndex = featureRows.get(feature.id) ?? 0;
			const rowY = trackY + labelOffset + rowIndex * (featureHeight + rowSpacing + theme.labelHeight);

			if (rowY + featureHeight > trackY + trackHeight) continue;

			const startX = (feature.start - viewport.current.start) * pixelsPerBase;
			const endX = (feature.end - viewport.current.start) * pixelsPerBase;
			const featureWidth = endX - startX;
			const centerY = rowY + featureHeight / 2;
			const strand = (feature.strand === '+' || feature.strand === '-') ? feature.strand : '.';
			const colors = theme.gene;

			// Draw with BED12 block structure (exons) if available
			if (feature.blockCount && feature.blockSizes && feature.blockStarts && feature.blockCount > 1) {
				// Calculate block positions for intron drawing
				const blocks: Array<{ startX: number; endX: number }> = [];

				for (let i = 0; i < feature.blockCount; i++) {
					const blockStart = feature.start + (feature.blockStarts[i] || 0);
					const blockSize = feature.blockSizes[i] || 0;
					const blockStartX = (blockStart - viewport.current.start) * pixelsPerBase;
					const blockEndX = blockStartX + blockSize * pixelsPerBase;

					if (blockEndX > 0 && blockStartX < width) {
						blocks.push({ startX: blockStartX, endX: blockEndX });
					}
				}

				// Draw intron connectors between blocks (peaked style)
				for (let i = 0; i < blocks.length - 1; i++) {
					const intronStart = blocks[i].endX;
					const intronEnd = blocks[i + 1].startX;
					if (intronEnd > intronStart + 2) {
						drawIntronConnector(ctx, intronStart, intronEnd, centerY, featureHeight);
					}
				}

				// Draw exon blocks with theme styling
				for (let i = 0; i < feature.blockCount; i++) {
					const blockStart = feature.start + (feature.blockStarts[i] || 0);
					const blockSize = feature.blockSizes[i] || 0;
					const blockStartX = (blockStart - viewport.current.start) * pixelsPerBase;
					const blockWidth = blockSize * pixelsPerBase;

					if (blockStartX + blockWidth > 0 && blockStartX < width) {
						const clampedStartX = Math.max(0, blockStartX);
						const clampedWidth = Math.min(blockWidth, width - clampedStartX);
						const blockY = centerY - featureHeight / 2;

						drawPill(ctx, clampedStartX, blockY, clampedWidth, featureHeight, colors);
						drawInnerChevrons(ctx, clampedStartX, blockY, clampedWidth, featureHeight, strand);
					}
				}
			} else {
				// No block data or single block - draw as single themed pill
				const clampedStartX = Math.max(0, startX);
				const clampedWidth = Math.min(featureWidth, width - clampedStartX);
				const pillY = centerY - featureHeight / 2;

				drawPill(ctx, clampedStartX, pillY, clampedWidth, featureHeight, colors);
				drawInnerChevrons(ctx, clampedStartX, pillY, clampedWidth, featureHeight, strand);
			}

			// Draw gene label above with theme styling
			if (feature.name && featureWidth > 25) {
				ctx.font = '600 10px Inter, system-ui, sans-serif';
				ctx.textAlign = 'left';

				let label = feature.name;
				const maxWidth = featureWidth - 6;
				const textWidth = ctx.measureText(label).width;

				if (textWidth > maxWidth) {
					while (label.length > 3 && ctx.measureText(label + '…').width > maxWidth) {
						label = label.slice(0, -1);
					}
					label += '…';
				}

				const labelX = Math.max(4, startX + 2);
				const labelY = rowY - 4;
				const measuredWidth = ctx.measureText(label).width;

				// Subtle background pill for label (theme-aware)
				if (measuredWidth > 10) {
					ctx.fillStyle = theme.labelBg;
					roundedRect(ctx, labelX - 3, labelY - 10, measuredWidth + 6, 13, 3);
					ctx.fill();
				}

				ctx.fillStyle = theme.label;
				ctx.fillText(label, labelX, labelY, maxWidth);
			}
		}
	}

	/**
	 * Render signal features (BigWig) as area chart with color ramp
	 * Uses sequential color palette (blues) where low values are light, high values are dark
	 */
	function renderSignalFeatures(
		ctx: CanvasRenderingContext2D,
		features: SignalFeature[],
		width: number,
		trackY: number,
		trackHeight: number,
		_color: string
	): void {
		const colors = getCanvasColors();
		const labelOffset = 16;
		const plotHeight = trackHeight - labelOffset - 8;
		const plotY = trackY + labelOffset;

		// Filter to visible features
		// Note: features should be raw (non-proxied) arrays from getRawFeatures()
		const vpStart = viewport.current.start;
		const vpEnd = viewport.current.end;
		const visible = features.filter(f => f.end > vpStart && f.start < vpEnd);

		if (visible.length === 0) return;

		// Calculate Y scale (auto-scale to visible data)
		let minVal = Infinity;
		let maxVal = -Infinity;
		for (const f of visible) {
			minVal = Math.min(minVal, f.value);
			maxVal = Math.max(maxVal, f.value);
		}

		// Add padding to range
		const range = maxVal - minVal || 1;
		minVal = Math.min(0, minVal); // Always include 0 if data is positive
		maxVal = maxVal + range * 0.1;

		const valueToY = (val: number): number => {
			const normalized = (val - minVal) / (maxVal - minVal);
			return plotY + plotHeight - (normalized * plotHeight);
		};

		// Draw baseline at 0
		const zeroY = valueToY(0);
		ctx.strokeStyle = colors.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, zeroY);
		ctx.lineTo(width, zeroY);
		ctx.stroke();

		// Bin data if too dense
		const basesPerPixel = (viewport.current.end - viewport.current.start) / width;
		const binWidth = Math.max(1, Math.ceil(basesPerPixel));
		const bins = new Map<number, { sum: number; count: number }>();

		for (const f of visible) {
			const startBin = Math.floor(f.start / binWidth);
			const endBin = Math.ceil(f.end / binWidth);

			for (let bin = startBin; bin < endBin; bin++) {
				const existing = bins.get(bin) || { sum: 0, count: 0 };
				existing.sum += f.value;
				existing.count += 1;
				bins.set(bin, existing);
			}
		}

		const sortedBins = Array.from(bins.entries()).sort((a, b) => a[0] - b[0]);

		// Draw filled bars with color ramp (value-based coloring)
		for (const [bin, data] of sortedBins) {
			const binStart = bin * binWidth;
			const binEnd = binStart + binWidth;
			const x1 = (binStart - viewport.current.start) * pixelsPerBase;
			const x2 = (binEnd - viewport.current.start) * pixelsPerBase;
			const avgValue = data.sum / data.count;
			const y = valueToY(avgValue);

			// Get color based on value using the blues ramp
			const barColor = getSignalColor(avgValue, minVal, maxVal, 'blues');

			// Draw filled rectangle from baseline to value
			ctx.fillStyle = barColor;
			ctx.fillRect(x1, y, Math.max(1, x2 - x1), zeroY - y);
		}

		// Draw outline on top for better definition
		ctx.strokeStyle = getSignalRampColor(0.9, 'blues'); // Use dark blue for outline
		ctx.lineWidth = 1;
		ctx.beginPath();
		let started = false;
		let lastX = 0;

		for (const [bin, data] of sortedBins) {
			const binStart = bin * binWidth;
			const binEnd = binStart + binWidth;
			const x1 = (binStart - viewport.current.start) * pixelsPerBase;
			const x2 = (binEnd - viewport.current.start) * pixelsPerBase;
			const avgValue = data.sum / data.count;
			const y = valueToY(avgValue);

			if (!started) {
				ctx.moveTo(x1, y);
				started = true;
			} else if (x1 > lastX + 1) {
				// Gap - draw line to baseline and start new segment
				ctx.lineTo(lastX, zeroY);
				ctx.moveTo(x1, zeroY);
				ctx.lineTo(x1, y);
			} else {
				ctx.lineTo(x1, y);
			}
			ctx.lineTo(x2, y);
			lastX = x2;
		}
		ctx.stroke();

		// Draw Y-axis labels
		ctx.fillStyle = colors.textMuted;
		ctx.font = '9px Inter, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(maxVal.toFixed(1), 4, plotY + 8);
		ctx.fillText(minVal.toFixed(1), 4, plotY + plotHeight - 2);
	}

	// Variant type colors
	const VARIANT_COLORS = {
		snp: '#3b82f6',        // blue
		insertion: '#22c55e',  // green
		deletion: '#ef4444',   // red
		mnp: '#f59e0b',        // amber
		complex: '#8b5cf6',    // violet
	};

	function getVariantType(ref: string, alt: string): keyof typeof VARIANT_COLORS {
		if (ref.length === 1 && alt.length === 1) return 'snp';
		if (ref.length < alt.length) return 'insertion';
		if (ref.length > alt.length) return 'deletion';
		if (ref.length === alt.length && ref.length > 1) return 'mnp';
		return 'complex';
	}

	/**
	 * Render variant features (VCF)
	 * Zoom-dependent: density → lollipops → detailed ref/alt
	 */
	function renderVariantFeatures(
		ctx: CanvasRenderingContext2D,
		features: VariantFeature[],
		width: number,
		trackY: number,
		trackHeight: number,
		color: string
	): void {
		const colors = getCanvasColors();
		const labelOffset = 18;
		const plotHeight = trackHeight - labelOffset - 8;
		const plotY = trackY + labelOffset;
		const centerY = plotY + plotHeight / 2;

		// Calculate zoom level
		const vpStart = viewport.current.start;
		const vpEnd = viewport.current.end;
		const bpp = (vpEnd - vpStart) / width; // bases per pixel
		const ppb = width / (vpEnd - vpStart); // pixels per base

		// Filter to visible
		const visible = features.filter(f =>
			f.chromosome === viewport.current.chromosome &&
			f.end > vpStart &&
			f.start < vpEnd
		);

		if (visible.length === 0) return;

		// Thresholds for display modes
		const LOLLIPOP_THRESHOLD = 5; // bases per pixel

		if (bpp > LOLLIPOP_THRESHOLD) {
			// Lollipop mode
			const stickHeight = plotHeight * 0.4;
			const headRadius = 4;

			// Draw baseline
			ctx.strokeStyle = colors.border;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, centerY);
			ctx.lineTo(width, centerY);
			ctx.stroke();

			// Limit to avoid overdraw
			const maxToRender = 500;
			const toRender = visible.slice(0, maxToRender);

			for (const v of toRender) {
				const x = (v.start - vpStart) * ppb;
				const varType = getVariantType(v.ref, v.alt[0]);
				const varColor = VARIANT_COLORS[varType];

				// Stick
				ctx.strokeStyle = varColor;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(x, centerY);
				ctx.lineTo(x, centerY - stickHeight);
				ctx.stroke();

				// Diamond head for SNPs, circle for others
				ctx.fillStyle = varColor;
				if (varType === 'snp') {
					// Diamond
					ctx.beginPath();
					ctx.moveTo(x, centerY - stickHeight - headRadius);
					ctx.lineTo(x + headRadius, centerY - stickHeight);
					ctx.lineTo(x, centerY - stickHeight + headRadius);
					ctx.lineTo(x - headRadius, centerY - stickHeight);
					ctx.closePath();
					ctx.fill();
				} else {
					// Circle for indels
					ctx.beginPath();
					ctx.arc(x, centerY - stickHeight, headRadius, 0, Math.PI * 2);
					ctx.fill();
				}
			}

			if (visible.length > maxToRender) {
				ctx.fillStyle = colors.textMuted;
				ctx.font = '9px Inter, sans-serif';
				ctx.textAlign = 'right';
				ctx.fillText(`Showing ${maxToRender}/${visible.length}`, width - 4, centerY + 12);
			}
		} else {
			// Detailed mode - show ref>alt
			const fontSize = Math.min(12, Math.max(8, ppb * 0.8));
			ctx.font = `bold ${fontSize}px monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';

			const boxHeight = fontSize + 6;

			for (const v of visible) {
				const x = (v.start - vpStart) * ppb + ppb / 2;
				const varType = getVariantType(v.ref, v.alt[0]);
				const varColor = VARIANT_COLORS[varType];

				// Label (variant type)
				ctx.fillStyle = varColor;
				ctx.font = '8px Inter, sans-serif';
				ctx.fillText(varType.toUpperCase(), x, plotY + 6);

				// Background box
				const text = `${v.ref}>${v.alt[0]}`;
				ctx.font = `bold ${fontSize}px monospace`;
				const textWidth = ctx.measureText(text).width + 10;

				ctx.fillStyle = varColor + '30';
				ctx.fillRect(x - textWidth / 2, centerY - boxHeight / 2, textWidth, boxHeight);

				ctx.strokeStyle = varColor;
				ctx.lineWidth = 2;
				ctx.strokeRect(x - textWidth / 2, centerY - boxHeight / 2, textWidth, boxHeight);

				// Text
				ctx.fillStyle = colors.textPrimary;
				ctx.fillText(text, x, centerY);

				// Variant ID if room and different from ref>alt
				if (v.name && bpp < 1 && v.name !== text && !v.name.startsWith('var_')) {
					ctx.fillStyle = colors.textMuted;
					ctx.font = '9px Inter, sans-serif';
					ctx.fillText(v.name, x, centerY + boxHeight / 2 + 10);
				}
			}
		}
	}

	/**
	 * Render reference sequence at high zoom
	 * Shows nucleotide letters colored by base type
	 */
	function renderReferenceSequence(
		ctx: CanvasRenderingContext2D,
		width: number,
		startY: number
	): number {
		// Only show if zoomed in far enough
		if (!shouldShowSequence(pixelsPerBase)) {
			return startY;
		}

		const colors = getCanvasColors();
		const trackHeight = 30;

		// Check if reference is available
		if (!referenceSequence.isAvailable) {
			// Show message that reference is not available
			ctx.fillStyle = colors.trackBg;
			ctx.fillRect(0, startY, width, trackHeight);
			ctx.fillStyle = colors.textMuted;
			ctx.font = '11px Inter, sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText('Reference sequence not available for this assembly', 8, startY + 18);
			ctx.strokeStyle = colors.border;
			ctx.beginPath();
			ctx.moveTo(0, startY + trackHeight);
			ctx.lineTo(width, startY + trackHeight);
			ctx.stroke();
			return startY + trackHeight;
		}

		const sequence = referenceSequence.sequence;
		if (!sequence) {
			// Loading or not yet fetched
			ctx.fillStyle = colors.trackBg;
			ctx.fillRect(0, startY, width, trackHeight);
			ctx.fillStyle = colors.textMuted;
			ctx.font = '11px Inter, sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText('Loading reference sequence...', 8, startY + 18);
			return startY + trackHeight;
		}

		const labelOffset = 14;

		// Draw track background
		ctx.fillStyle = colors.trackBg;
		ctx.fillRect(0, startY, width, trackHeight);

		// Draw track label
		ctx.fillStyle = colors.textMuted;
		ctx.font = '11px Inter, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText('Reference', 8, startY + 11);

		// Calculate font size based on zoom
		const fontSize = Math.min(14, Math.max(8, pixelsPerBase * 0.8));
		ctx.font = `bold ${fontSize}px monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const centerY = startY + labelOffset + (trackHeight - labelOffset) / 2;

		// Render each base
		const seqStart = referenceSequence.start;
		for (let i = 0; i < sequence.length; i++) {
			const pos = seqStart + i;
			if (pos < viewport.current.start || pos >= viewport.current.end) continue;

			const base = sequence[i].toUpperCase();
			const x = (pos - viewport.current.start + 0.5) * pixelsPerBase;

			// Draw base background
			const bgColor = BASE_COLORS[base] || BASE_COLORS.N;
			ctx.fillStyle = bgColor + '30'; // Semi-transparent
			ctx.fillRect(x - pixelsPerBase / 2, startY + labelOffset, pixelsPerBase, trackHeight - labelOffset);

			// Draw base letter
			ctx.fillStyle = BASE_COLORS[base] || BASE_COLORS.N;
			ctx.fillText(base, x, centerY);
		}

		// Draw bottom border
		ctx.strokeStyle = colors.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, startY + trackHeight);
		ctx.lineTo(width, startY + trackHeight);
		ctx.stroke();

		return startY + trackHeight;
	}

	/**
	 * Render BAM reads with sequence at high zoom
	 * Shows nucleotide letters colored by base and quality
	 */
	async function renderBamReadsWithSequence(
		ctx: CanvasRenderingContext2D,
		features: BAMReadFeature[],
		width: number,
		trackY: number,
		trackHeight: number,
		color: string,
		trackUrl?: string
	): Promise<void> {
		const labelOffset = 18;
		const plotHeight = trackHeight - labelOffset - 4;
		const plotY = trackY + labelOffset;

		// Filter to visible reads
		const visible = features.filter(f =>
			f.end > viewport.current.start && f.start < viewport.current.end
		);

		const renderMode = getReadRenderingMode(pixelsPerBase);

		if (renderMode === 'sequence') {
			// High zoom: show nucleotide letters
			renderReadsAsSequence(ctx, visible, plotY, plotHeight);
		} else if (renderMode === 'blocks') {
			// Medium zoom: show CIGAR blocks
			renderReadsAsBlocks(ctx, visible, plotY, plotHeight, color);
		} else {
			// Low zoom: use windowed coverage for large regions
			const regionSize = viewport.current.end - viewport.current.start;

			// Use windowed coverage for regions > 50KB to prevent hangs
			if (regionSize > 50000 && trackUrl) {
				await renderBamWindowedCoverage(ctx, trackUrl, plotY, plotHeight, color);
			} else {
				// Fallback to traditional coverage for smaller regions
				renderBamCoverage(ctx, visible, plotY, plotHeight, color);
			}
		}
	}

	/**
	 * Render reads showing nucleotide sequences
	 */
	function renderReadsAsSequence(
		ctx: CanvasRenderingContext2D,
		reads: BAMReadFeature[],
		plotY: number,
		plotHeight: number
	): void {
		const colors = getCanvasColors();
		const fontSize = Math.min(12, Math.max(6, pixelsPerBase * 0.7));
		ctx.font = `${fontSize}px monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const readHeight = Math.min(16, fontSize + 4);
		const readSpacing = 2;

		// Simple row packing
		const rows: Array<{ end: number }> = [];
		const readRows: Map<string, number> = new Map();

		for (const read of reads) {
			const startX = (read.start - viewport.current.start) * pixelsPerBase;
			let rowIndex = 0;

			for (let i = 0; i < rows.length; i++) {
				if (rows[i].end < startX - 2) {
					rowIndex = i;
					break;
				}
				rowIndex = i + 1;
			}

			const endX = (read.end - viewport.current.start) * pixelsPerBase;
			if (rows[rowIndex]) {
				rows[rowIndex].end = endX;
			} else {
				rows[rowIndex] = { end: endX };
			}

			readRows.set(read.id, rowIndex);
		}

		// Get reference sequence for mismatch highlighting
		const refSeq = referenceSequence.sequence;
		const refStart = referenceSequence.start;

		// Render reads
		for (const read of reads) {
			const rowIndex = readRows.get(read.id) ?? 0;
			const readY = plotY + rowIndex * (readHeight + readSpacing);

			if (readY + readHeight > plotY + plotHeight) continue;

			// Draw read background
			const startX = (read.start - viewport.current.start) * pixelsPerBase;
			const endX = (read.end - viewport.current.start) * pixelsPerBase;
			const readWidth = endX - startX;

			ctx.fillStyle = read.isReversed ? colors.readReverse : colors.readForward;
			ctx.fillRect(startX, readY, readWidth, readHeight);

			// Draw each base with quality-based opacity
			if (read.seq) {
				let refPos = read.start;
				let queryPos = 0;

				for (const [op, len] of read.parsedCigar) {
					if (op === 'M' || op === '=' || op === 'X') {
						// Match/mismatch - draw bases
						for (let i = 0; i < len && queryPos < read.seq.length; i++) {
							const pos = refPos + i;
							if (pos < viewport.current.start || pos >= viewport.current.end) {
								queryPos++;
								continue;
							}

							const base = read.seq[queryPos].toUpperCase();
							const x = (pos - viewport.current.start + 0.5) * pixelsPerBase;

							// Check for mismatch with reference
							let isMismatch = false;
							if (refSeq && pos >= refStart && pos < refStart + refSeq.length) {
								const refBase = refSeq[pos - refStart].toUpperCase();
								isMismatch = base !== refBase && refBase !== 'N' && base !== 'N';
							}

							// Quality-based opacity
							const qual = read.qual?.[queryPos] ?? 30;
							const alpha = qualityToOpacity(qual);

							if (isMismatch) {
								// Highlight mismatches
								ctx.fillStyle = colors.mismatch;
								ctx.fillRect(x - pixelsPerBase / 2, readY, pixelsPerBase, readHeight);
								ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
							} else {
								// Get base color with quality opacity
								const baseColor = BASE_COLORS[base] || BASE_COLORS.N;
								ctx.fillStyle = baseColor;
								ctx.globalAlpha = alpha;
							}

							ctx.fillText(base, x, readY + readHeight / 2);
							ctx.globalAlpha = 1.0;

							queryPos++;
						}
						refPos += len;
					} else if (op === 'I') {
						// Insertion - two right triangles forming a notch at the insertion point
						const x = (refPos - viewport.current.start) * pixelsPerBase;
						ctx.fillStyle = colors.insertion;
						const triHeight = Math.min(readHeight * 0.8, 12);
						const triWidth = triHeight * 0.58; // Width of each half
						// Left triangle (slopes from top-left down to insertion point)
						ctx.beginPath();
						ctx.moveTo(x - triWidth, readY + 1); // Top left corner
						ctx.lineTo(x, readY + 1); // Top at insertion
						ctx.lineTo(x, readY + 1 + triHeight); // Bottom tip at insertion
						ctx.closePath();
						ctx.fill();
						// Right triangle (slopes from top-right down to insertion point - mirrored)
						ctx.beginPath();
						ctx.moveTo(x, readY + 1); // Top at insertion
						ctx.lineTo(x + triWidth, readY + 1); // Top right corner
						ctx.lineTo(x, readY + 1 + triHeight); // Bottom tip at insertion
						ctx.closePath();
						ctx.fill();
						queryPos += len;
					} else if (op === 'D' || op === 'N') {
						// Deletion/skip - draw gap line
						const x1 = (refPos - viewport.current.start) * pixelsPerBase;
						const x2 = (refPos + len - viewport.current.start) * pixelsPerBase;
						ctx.strokeStyle = colors.deletion;
						ctx.lineWidth = 1;
						ctx.setLineDash([2, 2]);
						ctx.beginPath();
						ctx.moveTo(x1, readY + readHeight / 2);
						ctx.lineTo(x2, readY + readHeight / 2);
						ctx.stroke();
						ctx.setLineDash([]);
						refPos += len;
					} else if (op === 'S') {
						// Soft clip - skip in query
						queryPos += len;
					} else if (op === 'H') {
						// Hard clip - nothing in query
					}
				}
			}
		}
	}

	/**
	 * Render reads as CIGAR blocks (medium zoom)
	 */
	function renderReadsAsBlocks(
		ctx: CanvasRenderingContext2D,
		reads: BAMReadFeature[],
		plotY: number,
		plotHeight: number,
		color: string
	): void {
		const colors = getCanvasColors();
		const readHeight = 8;
		const readSpacing = 2;

		// Simple row packing
		const rows: Array<{ end: number }> = [];
		const readRows: Map<string, number> = new Map();

		for (const read of reads) {
			const startX = (read.start - viewport.current.start) * pixelsPerBase;
			let rowIndex = 0;

			for (let i = 0; i < rows.length; i++) {
				if (rows[i].end < startX - 2) {
					rowIndex = i;
					break;
				}
				rowIndex = i + 1;
			}

			const endX = (read.end - viewport.current.start) * pixelsPerBase;
			if (rows[rowIndex]) {
				rows[rowIndex].end = endX;
			} else {
				rows[rowIndex] = { end: endX };
			}

			readRows.set(read.id, rowIndex);
		}

		// Render reads
		for (const read of reads) {
			const rowIndex = readRows.get(read.id) ?? 0;
			const readY = plotY + rowIndex * (readHeight + readSpacing);

			if (readY + readHeight > plotY + plotHeight) continue;

			// Draw CIGAR blocks
			let refPos = read.start;
			const baseColor = read.isReversed ? '#78716c' : (color || '#6366f1');

			for (const [op, len] of read.parsedCigar) {
				if (op === 'M' || op === '=' || op === 'X') {
					// Match block
					const x1 = (refPos - viewport.current.start) * pixelsPerBase;
					const x2 = (refPos + len - viewport.current.start) * pixelsPerBase;
					ctx.fillStyle = baseColor;
					ctx.fillRect(Math.max(0, x1), readY, Math.min(x2, containerWidth) - Math.max(0, x1), readHeight);
					refPos += len;
				} else if (op === 'I') {
					// Insertion - two right triangles forming a notch at the insertion point
					const x = (refPos - viewport.current.start) * pixelsPerBase;
					ctx.fillStyle = colors.insertion;
					const triHeight = Math.min(readHeight * 0.9, 10);
					const triWidth = triHeight * 0.58; // Width of each half
					// Left triangle
					ctx.beginPath();
					ctx.moveTo(x - triWidth, readY);
					ctx.lineTo(x, readY);
					ctx.lineTo(x, readY + triHeight);
					ctx.closePath();
					ctx.fill();
					// Right triangle (mirrored)
					ctx.beginPath();
					ctx.moveTo(x, readY);
					ctx.lineTo(x + triWidth, readY);
					ctx.lineTo(x, readY + triHeight);
					ctx.closePath();
					ctx.fill();
				} else if (op === 'D' || op === 'N') {
					// Deletion/intron line
					const x1 = (refPos - viewport.current.start) * pixelsPerBase;
					const x2 = (refPos + len - viewport.current.start) * pixelsPerBase;
					ctx.strokeStyle = colors.deletion;
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(x1, readY + readHeight / 2);
					ctx.lineTo(x2, readY + readHeight / 2);
					ctx.stroke();
					refPos += len;
				} else if (op === 'S' || op === 'H') {
					// Clips - no reference consumed
				}
			}
		}
	}

	/**
	 * Render reads as simple rectangles (low zoom, existing behavior)
	 */
	function renderReadsAsRectangles(
		ctx: CanvasRenderingContext2D,
		reads: BAMReadFeature[],
		plotY: number,
		plotHeight: number,
		color: string
	): void {
		// For low zoom, just render as simple intervals
		const readHeight = 4;
		const readSpacing = 1;

		// Simple row packing
		const rows: Array<{ end: number }> = [];
		const readRows: Map<string, number> = new Map();

		for (const read of reads) {
			const startX = (read.start - viewport.current.start) * pixelsPerBase;
			let rowIndex = 0;

			for (let i = 0; i < rows.length; i++) {
				if (rows[i].end < startX - 1) {
					rowIndex = i;
					break;
				}
				rowIndex = i + 1;
			}

			const endX = (read.end - viewport.current.start) * pixelsPerBase;
			if (rows[rowIndex]) {
				rows[rowIndex].end = endX;
			} else {
				rows[rowIndex] = { end: endX };
			}

			readRows.set(read.id, rowIndex);
		}

		// Render reads
		for (const read of reads) {
			const rowIndex = readRows.get(read.id) ?? 0;
			const readY = plotY + rowIndex * (readHeight + readSpacing);

			if (readY + readHeight > plotY + plotHeight) continue;

			const startX = (read.start - viewport.current.start) * pixelsPerBase;
			const endX = (read.end - viewport.current.start) * pixelsPerBase;
			const readWidth = Math.max(1, endX - startX);

			ctx.fillStyle = read.isReversed ? '#78716c' : (color || '#6366f1');
			ctx.fillRect(Math.max(0, startX), readY, Math.min(readWidth, containerWidth - Math.max(0, startX)), readHeight);
		}
	}

	/**
	 * Render BAM coverage using windowed coverage for large regions
	 */
	async function renderBamWindowedCoverage(
		ctx: CanvasRenderingContext2D,
		trackUrl: string,
		plotY: number,
		plotHeight: number,
		color: string
	): Promise<void> {
		try {
			const { getBamCoverageData } = await import('$lib/services/bam');

			const chr = viewport.current.chromosome;
			const start = viewport.current.start;
			const end = viewport.current.end;

			if (!chr) return;

			const coverageData = await getBamCoverageData(
				trackUrl,
				chr,
				start,
				end,
				{ pixelsPerBase }
			);

			// The viewport may have moved while we were fetching (async/network).
			// Don't paint this region's coverage over a now-different view.
			if (
				viewport.current.chromosome !== chr ||
				viewport.current.start !== start ||
				viewport.current.end !== end
			) {
				return;
			}

			const colors = getCanvasColors();
			const coverage = coverageData.coverage;

			if (coverage.length === 0) return;

			// Density/windowed mode only ever reaches here (caller guards
			// regionSize > 50000). If the data is essentially empty/very sparse the
			// histogram paints blank and looks like a failed load — surface a
			// dismissable reassurance instead. The store de-dupes per track+region
			// so panning around a sparse area doesn't spam the dialog.
			if (isCoverageSparse(coverage)) {
				const region = formatCoordinate(chr, start, end);
				coverageWarning.notifySparse(`${trackUrl}|${chr}:${start}-${end}`, region);
			}

			// Auto-scale to the tallest visible value.
			let maxCoverage = 0;
			for (const value of coverage) {
				if (value > maxCoverage) maxCoverage = value;
			}
			if (maxCoverage === 0) return;

			const width = containerWidth;

			// Downsample to at most one point per pixel so the path stays small
			// regardless of how many coverage points we received. Points map
			// proportionally across the viewport width.
			const samplesNeeded = Math.min(width, coverage.length);
			const step = coverage.length / samplesNeeded;

			ctx.fillStyle = color || colors.accent;
			ctx.globalAlpha = 0.7;
			ctx.beginPath();
			ctx.moveTo(0, plotY + plotHeight);

			for (let i = 0; i < samplesNeeded; i++) {
				// Max-pool over each pixel's bucket so peaks aren't lost when there
				// are many more coverage points than pixels (nearest-neighbour
				// sampling would skip between-sample peaks).
				const lo = Math.floor(i * step);
				const hi = Math.max(lo + 1, Math.min(coverage.length, Math.floor((i + 1) * step)));
				let peak = 0;
				for (let j = lo; j < hi; j++) {
					if (coverage[j] > peak) peak = coverage[j];
				}
				const x = (i / samplesNeeded) * width;
				const normalizedHeight = (peak / maxCoverage) * plotHeight;
				ctx.lineTo(x, plotY + plotHeight - normalizedHeight);
			}

			// Close the path to create a filled area.
			ctx.lineTo(width, plotY + plotHeight);
			ctx.fill();
			ctx.globalAlpha = 1.0;
		} catch (error) {
			console.error('[BAM Windowed Coverage] Failed to render:', error);
		}
	}

	/**
	 * Compute binned coverage from BAM reads
	 * Returns an array of {start, end, value} where value is read count
	 */
	function computeBinnedCoverage(
		reads: BAMReadFeature[],
		viewStart: number,
		viewEnd: number,
		binSize: number
	): Array<{ start: number; end: number; value: number }> {
		const bins = new Map<number, number>();

		for (const read of reads) {
			// Calculate which bins this read overlaps
			const readStart = Math.max(read.start, viewStart);
			const readEnd = Math.min(read.end, viewEnd);
			const startBin = Math.floor(readStart / binSize);
			const endBin = Math.ceil(readEnd / binSize);

			for (let bin = startBin; bin < endBin; bin++) {
				bins.set(bin, (bins.get(bin) || 0) + 1);
			}
		}

		return Array.from(bins.entries())
			.map(([bin, count]) => ({
				start: bin * binSize,
				end: (bin + 1) * binSize,
				value: count
			}))
			.sort((a, b) => a.start - b.start);
	}

	/**
	 * Render BAM coverage as histogram (for low zoom / density mode)
	 * Shows read depth as an area chart, similar to BigWig
	 */
	function renderBamCoverage(
		ctx: CanvasRenderingContext2D,
		reads: BAMReadFeature[],
		plotY: number,
		plotHeight: number,
		color: string
	): void {
		const colors = getCanvasColors();
		if (reads.length === 0) return;

		const vpStart = viewport.current.start;
		const vpEnd = viewport.current.end;
		const width = containerWidth;

		// Calculate bin size (one bin per pixel)
		const basesPerPixel = (vpEnd - vpStart) / width;
		const binSize = Math.max(1, Math.ceil(basesPerPixel));

		// Compute coverage
		const coverage = computeBinnedCoverage(reads, vpStart, vpEnd, binSize);

		if (coverage.length === 0) return;

		// Calculate Y scale (auto-scale to visible data)
		let maxCoverage = 0;
		for (const bin of coverage) {
			maxCoverage = Math.max(maxCoverage, bin.value);
		}

		// Add padding to range
		maxCoverage = Math.ceil(maxCoverage * 1.1) || 1;

		const valueToY = (val: number): number => {
			const normalized = val / maxCoverage;
			return plotY + plotHeight - (normalized * plotHeight);
		};

		const zeroY = plotY + plotHeight;

		// Create gradient for fill
		const gradient = ctx.createLinearGradient(0, plotY, 0, plotY + plotHeight);
		gradient.addColorStop(0, color);
		gradient.addColorStop(1, color + '20'); // Fade to transparent

		// Draw as filled area
		ctx.beginPath();
		ctx.moveTo(0, zeroY);

		let lastX = 0;

		for (const bin of coverage) {
			const x1 = (bin.start - vpStart) * pixelsPerBase;
			const x2 = (bin.end - vpStart) * pixelsPerBase;
			const y = valueToY(bin.value);

			if (x1 > lastX + 1) {
				// Gap - go down to zero and back up
				ctx.lineTo(lastX, zeroY);
				ctx.lineTo(x1, zeroY);
			}

			ctx.lineTo(x1, y);
			ctx.lineTo(x2, y);
			lastX = x2;
		}

		ctx.lineTo(lastX, zeroY);
		ctx.closePath();

		ctx.fillStyle = gradient;
		ctx.fill();

		// Draw outline
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;
		ctx.beginPath();
		let started = false;

		for (const bin of coverage) {
			const x1 = (bin.start - vpStart) * pixelsPerBase;
			const x2 = (bin.end - vpStart) * pixelsPerBase;
			const y = valueToY(bin.value);

			if (!started) {
				ctx.moveTo(x1, y);
				started = true;
			} else {
				ctx.lineTo(x1, y);
			}
			ctx.lineTo(x2, y);
		}
		ctx.stroke();

		// Draw Y-axis labels (max coverage)
		ctx.fillStyle = colors.textMuted;
		ctx.font = '9px Inter, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(`${maxCoverage}x`, 4, plotY + 8);
		ctx.fillText('0', 4, plotY + plotHeight - 2);
	}

	/**
	 * Draw highlight regions as semi-transparent overlays
	 */
	function drawHighlights(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		rulerHeight: number
	): void {
		const visibleHighlights = viewport.getVisibleHighlights();
		if (visibleHighlights.length === 0) return;

		for (const highlight of visibleHighlights) {
			// Calculate x positions
			const startX = (highlight.start - viewport.current.start) * pixelsPerBase;
			const endX = (highlight.end - viewport.current.start) * pixelsPerBase;
			const highlightWidth = endX - startX;

			// Skip if completely off-screen
			if (endX < 0 || startX > width) continue;

			// Clamp to visible area
			const clampedStartX = Math.max(0, startX);
			const clampedEndX = Math.min(width, endX);
			const clampedWidth = clampedEndX - clampedStartX;

			if (clampedWidth <= 0) continue;

			// Draw highlight overlay (semi-transparent)
			const color = highlight.color || 'rgba(255, 221, 51, 0.25)'; // Default yellow
			ctx.fillStyle = color;
			ctx.fillRect(clampedStartX, rulerHeight, clampedWidth, height - rulerHeight);

			// Draw highlight borders
			ctx.strokeStyle = highlight.color?.replace(/[\d.]+\)$/, '0.6)') || 'rgba(255, 221, 51, 0.6)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			if (startX >= 0) {
				ctx.moveTo(clampedStartX, rulerHeight);
				ctx.lineTo(clampedStartX, height);
			}
			if (endX <= width) {
				ctx.moveTo(clampedEndX, rulerHeight);
				ctx.lineTo(clampedEndX, height);
			}
			ctx.stroke();

			// Draw label if provided
			if (highlight.label) {
				const labelX = clampedStartX + clampedWidth / 2;
				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 11px Inter, sans-serif';
				ctx.textAlign = 'center';
				ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
				ctx.shadowBlur = 3;
				ctx.fillText(highlight.label, labelX, rulerHeight + 16);
				ctx.shadowBlur = 0;
			}
		}
	}

	function renderTracksWithRegistry(
		ctx: CanvasRenderingContext2D,
		trackList: typeof tracks.visible,
		width: number,
		startY: number
	): void {
		const colors = getCanvasColors();
		let currentY = startY;

		for (const track of trackList) {
			const trackType = getTrackType(track.typeId);
			if (!trackType) {
				console.warn(`Unknown track type: ${track.typeId}`);
				continue;
			}

			// Draw track label background
			ctx.fillStyle = colors.trackBg;
			ctx.fillRect(0, currentY, width, track.height);

			// Draw track label
			ctx.fillStyle = colors.textMuted;
			ctx.font = '11px Inter, sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(track.name, 8, currentY + 11);

			// Draw track type badge
			ctx.fillStyle = colors.borderLight;
			ctx.font = '9px Inter, sans-serif';
			const badge = trackType.name.split(' ')[0].toUpperCase();
			const badgeWidth = ctx.measureText(badge).width + 8;
			ctx.fillRect(width - badgeWidth - 8, currentY + 2, badgeWidth, 14);
			ctx.fillStyle = colors.textMuted;
			ctx.textAlign = 'center';
			ctx.fillText(badge, width - badgeWidth / 2 - 8, currentY + 11);

			// Get filtered features to determine which should be dimmed
			const { dimmed } = tracks.getFilteredFeatures(track);
			const dimmedIds = new Set(dimmed.map(f => f.id));

			// Create render context with dimmed IDs for smart rendering
			const renderCtx = createRenderContext(
				ctx,
				viewport.current,
				width,
				currentY,
				track.height,
				track.color,
				dimmedIds.size > 0 ? dimmedIds : undefined
			);

			// Render all features - renderer handles dimming internally
			trackType.render(track.features, renderCtx);

			// Draw bottom border
			ctx.strokeStyle = colors.border;
			ctx.beginPath();
			ctx.moveTo(0, currentY + track.height);
			ctx.lineTo(width, currentY + track.height);
			ctx.stroke();

			currentY += track.height;
		}
	}

	function drawRuler(ctx: CanvasRenderingContext2D, width: number): number {
		const rulerHeight = 30;
		const colors = getCanvasColors();

		// Background
		ctx.fillStyle = colors.rulerBg;
		ctx.fillRect(0, 0, width, rulerHeight);

		// Chromosome label
		ctx.fillStyle = colors.textSecondary;
		ctx.font = 'bold 11px Inter, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(viewport.current.chromosome, 8, 12);

		// Calculate tick spacing
		const minPixelsBetweenTicks = 80;
		const basesPerPixel = viewport.width / width;
		const minBasesPerTick = minPixelsBetweenTicks * basesPerPixel;

		// Round to nice numbers
		const magnitude = Math.pow(10, Math.floor(Math.log10(minBasesPerTick)));
		let tickInterval = magnitude;
		if (minBasesPerTick > magnitude * 5) tickInterval = magnitude * 10;
		else if (minBasesPerTick > magnitude * 2) tickInterval = magnitude * 5;
		else if (minBasesPerTick > magnitude) tickInterval = magnitude * 2;

		const firstTick = Math.ceil(viewport.current.start / tickInterval) * tickInterval;

		ctx.strokeStyle = colors.borderLight;
		ctx.fillStyle = colors.textMuted;
		ctx.font = '10px Inter, sans-serif';
		ctx.textAlign = 'center';

		for (let pos = firstTick; pos < viewport.current.end; pos += tickInterval) {
			const x = (pos - viewport.current.start) * pixelsPerBase;

			// Tick line
			ctx.beginPath();
			ctx.moveTo(x, rulerHeight - 8);
			ctx.lineTo(x, rulerHeight);
			ctx.stroke();

			// Label - pass tickInterval for appropriate precision
			ctx.fillText(formatTickLabel(pos, tickInterval), x, rulerHeight - 12);
		}

		// Bottom border
		ctx.strokeStyle = colors.border;
		ctx.beginPath();
		ctx.moveTo(0, rulerHeight);
		ctx.lineTo(width, rulerHeight);
		ctx.stroke();

		return rulerHeight;
	}

	function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number, rulerHeight: number): void {
		const colors = getCanvasColors();

		// Background
		ctx.fillStyle = colors.trackBg;
		ctx.fillRect(0, rulerHeight, width, height - rulerHeight);

		// Drop zone indicator
		const centerY = rulerHeight + (height - rulerHeight) / 2;

		ctx.fillStyle = isDragOver ? colors.accent : colors.border;
		ctx.strokeStyle = isDragOver ? colors.accent : colors.borderLight;
		ctx.setLineDash([8, 4]);
		ctx.lineWidth = 2;

		const boxWidth = Math.min(400, width - 40);
		const boxHeight = 120;
		const boxX = (width - boxWidth) / 2;
		const boxY = centerY - boxHeight / 2;

		ctx.beginPath();
		ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
		ctx.stroke();
		ctx.setLineDash([]);

		// Icon
		ctx.fillStyle = isDragOver ? colors.accent : colors.textMuted;
		ctx.font = '32px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('📁', width / 2, centerY - 20);

		// Text
		ctx.fillStyle = isDragOver ? colors.accent : colors.textMuted;
		ctx.font = '14px Inter, sans-serif';
		ctx.fillText(
			isDragOver ? 'Drop to load track' : 'Drop BED or GFF3 files here',
			width / 2,
			centerY + 20
		);

		ctx.fillStyle = colors.textMuted;
		ctx.font = '12px Inter, sans-serif';
		ctx.fillText(
			formatCoordinate(viewport.current.chromosome, viewport.current.start, viewport.current.end),
			width / 2,
			centerY + 45
		);
	}

	function drawNoDataMessage(ctx: CanvasRenderingContext2D, width: number, height: number, rulerHeight: number, message: string): void {
		const colors = getCanvasColors();

		ctx.fillStyle = colors.trackBg;
		ctx.fillRect(0, rulerHeight, width, height - rulerHeight);

		const centerY = rulerHeight + (height - rulerHeight) / 2;
		ctx.fillStyle = colors.textMuted;
		ctx.font = '14px Inter, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(message, width / 2, centerY);
	}

	/**
	 * Format tick label with appropriate precision based on tick interval
	 * The key insight: precision should show the difference between ticks
	 */
	function formatTickLabel(pos: number, tickInterval: number): string {
		// Determine appropriate unit and precision based on tick interval
		if (tickInterval >= 1000000) {
			// Ticks are 1M+ apart, show in M with minimal decimals
			const decimals = tickInterval >= 10000000 ? 0 : 1;
			return (pos / 1000000).toFixed(decimals) + 'M';
		} else if (tickInterval >= 1000) {
			// Ticks are 1K-999K apart
			if (pos >= 1000000) {
				// Position is in millions, need enough precision to show K differences
				const decimals = tickInterval >= 100000 ? 1 : tickInterval >= 10000 ? 2 : 3;
				return (pos / 1000000).toFixed(decimals) + 'M';
			} else {
				const decimals = tickInterval >= 10000 ? 0 : 1;
				return (pos / 1000).toFixed(decimals) + 'K';
			}
		} else if (tickInterval >= 100) {
			// Ticks are 100-999bp apart
			if (pos >= 1000000) {
				return (pos / 1000000).toFixed(4) + 'M';
			} else if (pos >= 1000) {
				return (pos / 1000).toFixed(2) + 'K';
			}
			return pos.toLocaleString();
		} else {
			// Very fine resolution, show exact positions
			if (pos >= 1000000) {
				return (pos / 1000000).toFixed(5) + 'M';
			} else if (pos >= 1000) {
				return (pos / 1000).toFixed(3) + 'K';
			}
			return pos.toLocaleString();
		}
	}

	// Check if mouse Y is near a track border
	function findNearbyBorder(mouseY: number): TrackBorder | null {
		for (const border of trackBorders) {
			if (Math.abs(mouseY - border.y) <= BORDER_HIT_ZONE) {
				return border;
			}
		}
		return null;
	}

	// Get current height of a track
	function getTrackHeight(trackId: string, trackType: 'local' | 'remote'): number {
		if (trackType === 'remote') {
			const track = remoteTracks.all.find(t => t.id === trackId);
			return track?.userHeight ?? track?.height ?? 100;
		}
		// Check local binary tracks first
		const localBinaryTrack = localBinaryTracks.all.find(t => t.id === trackId);
		if (localBinaryTrack) {
			return localBinaryTrack.userHeight ?? localBinaryTrack.height ?? 100;
		}
		// Fall back to text tracks
		const track = tracks.all.find(t => t.id === trackId);
		return track?.height ?? 100;
	}

	// Find insertion marker at mouse position (for tooltip)
	function findInsertionAtPosition(mouseX: number, mouseY: number): {
		insertedBases: string;
		readName: string;
		refPos: number;
	} | null {
		const HIT_DISTANCE = 4; // pixels

		// Only works at sequence or block level zoom
		const renderMode = getReadRenderingMode(pixelsPerBase);
		if (renderMode === 'density') return null;

		// Find which BAM track the mouse is over
		let matchedLayout: BamTrackLayout | null = null;
		for (const layout of bamTrackLayouts) {
			if (mouseY >= layout.y && mouseY < layout.y + layout.height) {
				matchedLayout = layout;
				break;
			}
		}
		if (!matchedLayout) return null;

		// Get reads for this track
		let reads: BAMReadFeature[];
		if (matchedLayout.trackType === 'remote') {
			reads = (getRawFeatures(matchedLayout.trackId) as BAMReadFeature[]) || [];
		} else {
			reads = (getLocalBinaryRawFeatures(matchedLayout.trackId) as BAMReadFeature[]) || [];
		}

		// Filter to visible reads
		const visible = reads.filter(f =>
			f.end > viewport.current.start && f.start < viewport.current.end
		);
		if (visible.length === 0) return null;

		// Recompute row positions (same algorithm as render)
		const labelOffset = 18;
		const plotY = matchedLayout.y + labelOffset;
		const plotHeight = matchedLayout.height - labelOffset - 4;

		const readHeight = renderMode === 'sequence' ? Math.min(16, Math.min(12, Math.max(6, pixelsPerBase * 0.7)) + 4) : 8;
		const readSpacing = 2;

		const rows: Array<{ end: number }> = [];
		const readRows: Map<string, number> = new Map();

		for (const read of visible) {
			const startX = (read.start - viewport.current.start) * pixelsPerBase;
			let rowIndex = 0;

			for (let i = 0; i < rows.length; i++) {
				if (rows[i].end < startX - 2) {
					rowIndex = i;
					break;
				}
				rowIndex = i + 1;
			}

			const endX = (read.end - viewport.current.start) * pixelsPerBase;
			if (rows[rowIndex]) {
				rows[rowIndex].end = endX;
			} else {
				rows[rowIndex] = { end: endX };
			}

			readRows.set(read.id, rowIndex);
		}

		// Check each read for insertion markers near mouse
		for (const read of visible) {
			const rowIndex = readRows.get(read.id) ?? 0;
			const readY = plotY + rowIndex * (readHeight + readSpacing);

			// Check if mouse Y is within this read's bounds
			if (mouseY < readY || mouseY > readY + readHeight) continue;
			if (readY + readHeight > plotY + plotHeight) continue;

			// Walk CIGAR looking for insertions
			if (!read.parsedCigar || !read.seq) continue;

			let refPos = read.start;
			let queryPos = 0;

			for (const [op, len] of read.parsedCigar) {
				if (op === 'M' || op === '=' || op === 'X') {
					refPos += len;
					queryPos += len;
				} else if (op === 'I') {
					// Check if mouse is near this insertion marker
					const markerX = (refPos - viewport.current.start) * pixelsPerBase;
					if (Math.abs(mouseX - markerX) <= HIT_DISTANCE) {
						// Found it! Extract inserted bases
						const insertedBases = read.seq.substring(queryPos, queryPos + len);
						return {
							insertedBases,
							readName: read.name || read.id,
							refPos
						};
					}
					queryPos += len;
				} else if (op === 'D' || op === 'N') {
					refPos += len;
				} else if (op === 'S') {
					queryPos += len;
				}
				// H (hard clip) consumes nothing
			}
		}

		return null;
	}

	// Mouse handlers for panning and resizing
	function handleMouseDown(event: MouseEvent) {
		const rect = canvasEl.getBoundingClientRect();
		const mouseY = event.clientY - rect.top;
		const border = findNearbyBorder(mouseY);

		if (border) {
			// Start resizing
			isResizing = true;
			resizeTrackId = border.trackId;
			resizeTrackType = border.trackType;
			resizeStartY = event.clientY;
			resizeStartHeight = getTrackHeight(border.trackId, border.trackType);
			document.body.style.cursor = 'ns-resize';
		} else {
			// Start panning
			isDragging = true;
			dragStartX = event.clientX;
			panAccumulatorPx = 0; // Reset accumulator on new drag
			document.body.style.cursor = 'grabbing';
		}
	}

	function handleMouseMove(event: MouseEvent) {
		if (isResizing && resizeTrackId && resizeTrackType) {
			// Handle resize drag
			const deltaY = event.clientY - resizeStartY;
			const newHeight = Math.max(50, Math.min(500, resizeStartHeight + deltaY));

			if (resizeTrackType === 'remote') {
				remoteTracks.setRemoteTrackHeight(resizeTrackId, newHeight);
			} else if (resizeTrackType === 'local') {
				// Check if it's a local binary track
				const isLocalBinary = localBinaryTracks.all.some(t => t.id === resizeTrackId);
				if (isLocalBinary) {
					localBinaryTracks.setLocalBinaryTrackHeight(resizeTrackId, newHeight);
				}
			}
			return;
		}

		if (isDragging) {
			// Handle pan drag with fractional accumulation for high-zoom
			const deltaX = event.clientX - dragStartX;
			panAccumulatorPx += deltaX;
			dragStartX = event.clientX;

			// Calculate how many whole bases we can pan
			const deltaBases = Math.trunc(panAccumulatorPx / pixelsPerBase);
			if (deltaBases !== 0) {
				// Consume the pixels used for whole bases, keep the remainder
				panAccumulatorPx -= deltaBases * pixelsPerBase;
				viewport.pan(deltaBases * pixelsPerBase, pixelsPerBase);
			}
			return;
		}

		// Not dragging - check if hovering near a border
		if (!canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const mouseY = event.clientY - rect.top;
		const border = findNearbyBorder(mouseY);

		if (border) {
			isNearBorder = true;
			resizeTrackId = border.trackId;
			canvasEl.style.cursor = 'ns-resize';
			insertionTooltip = null;
		} else {
			isNearBorder = false;
			resizeTrackId = null;
			canvasEl.style.cursor = '';

			// Check for insertion marker hover (for BAM tracks)
			const mouseX = event.clientX - rect.left;
			const insertion = findInsertionAtPosition(mouseX, mouseY);
			if (insertion) {
				insertionTooltip = {
					x: event.clientX,
					y: event.clientY,
					insertedBases: insertion.insertedBases,
					readName: insertion.readName,
					refPos: insertion.refPos
				};
			} else {
				insertionTooltip = null;
			}
		}
	}

	function handleMouseUp() {
		if (isResizing) {
			isResizing = false;
			resizeTrackId = null;
			resizeTrackType = null;
		}
		isDragging = false;
		document.body.style.cursor = '';
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		const rect = canvasEl.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseBase = viewport.current.start + (mouseX / pixelsPerBase);

		// Zoom factor based on scroll direction
		const factor = event.deltaY > 0 ? 1.2 : 0.8;
		viewport.zoom(factor, mouseBase);
	}

	// File drop handlers
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;

		const files = event.dataTransfer?.files;
		if (!files) return;

		for (const file of files) {
			// Let the track store handle validation via registry
			await tracks.addTrackFromFile(file);
		}
	}

	function handleMouseLeave() {
		insertionTooltip = null;
	}
</script>

<svelte:window
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
/>

<div
	bind:this={containerEl}
	role="application"
	aria-label="Genome track viewer - drag to pan, scroll to zoom, drop files to load"
	class="flex-1 relative overflow-hidden cursor-grab"
	class:cursor-grabbing={isDragging}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<canvas
		bind:this={canvasEl}
		onmousedown={handleMouseDown}
		onwheel={handleWheel}
		onmouseleave={handleMouseLeave}
		class="block w-full h-full"
	></canvas>

	{#if tracks.isLoading}
		<div class="absolute inset-0 bg-black/50 flex items-center justify-center">
			<div class="text-[var(--color-text-secondary)]">Loading...</div>
		</div>
	{/if}

	{#if tracks.error}
		<div class="absolute bottom-4 left-4 right-4 bg-red-900/80 text-red-200 px-4 py-2 rounded text-sm">
			{tracks.error}
		</div>
	{/if}

	{#if tracks.chromosomeMismatchWarning}
		<div class="absolute bottom-4 left-4 right-4 bg-amber-900/90 text-amber-200 px-4 py-2 rounded text-sm flex items-start gap-2">
			<svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="flex-1">{tracks.chromosomeMismatchWarning}</span>
			<button
				onclick={() => tracks.clearChromosomeMismatchWarning()}
				class="text-amber-300 hover:text-amber-100 transition-colors"
				title="Dismiss"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Remote track chromosome mismatch warnings -->
	{#each remoteTracks.all.filter(t => t.chromosomeMismatchWarning) as track (track.id)}
		<div class="absolute bottom-4 left-4 right-4 bg-amber-900/90 text-amber-200 px-4 py-2 rounded text-sm flex items-start gap-2" style="bottom: {remoteTracks.all.filter(t => t.chromosomeMismatchWarning).indexOf(track) * 60 + 16}px">
			<svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="flex-1"><strong>{track.name}:</strong> {track.chromosomeMismatchWarning}</span>
			<button
				onclick={() => remoteTracks.clearRemoteTrackWarning(track.id)}
				class="text-amber-300 hover:text-amber-100 transition-colors"
				title="Dismiss"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}

	<!-- Local binary track chromosome mismatch warnings -->
	{#each localBinaryTracks.all.filter(t => t.chromosomeMismatchWarning) as track (track.id)}
		{@const remoteWarningCount = remoteTracks.all.filter(t => t.chromosomeMismatchWarning).length}
		<div class="absolute bottom-4 left-4 right-4 bg-amber-900/90 text-amber-200 px-4 py-2 rounded text-sm flex items-start gap-2" style="bottom: {(remoteWarningCount + localBinaryTracks.all.filter(t => t.chromosomeMismatchWarning).indexOf(track)) * 60 + 16}px">
			<svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span class="flex-1"><strong>{track.name}:</strong> {track.chromosomeMismatchWarning}</span>
			<button
				onclick={() => localBinaryTracks.clearLocalBinaryTrackWarning(track.id)}
				class="text-amber-300 hover:text-amber-100 transition-colors"
				title="Dismiss"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}

	<!-- BAM insertion tooltip -->
	{#if insertionTooltip}
		<div
			class="fixed bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs pointer-events-none z-50 shadow-lg"
			style="left: {insertionTooltip.x + 12}px; top: {insertionTooltip.y - 8}px;"
		>
			<div class="font-medium text-green-400">Insertion: {insertionTooltip.insertedBases}</div>
			<div class="text-gray-400">{insertionTooltip.insertedBases.length} bp at {insertionTooltip.refPos.toLocaleString()}</div>
		</div>
	{/if}

	<SparseCoverageDialog />
</div>
