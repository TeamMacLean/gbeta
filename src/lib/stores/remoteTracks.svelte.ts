/**
 * Remote Track Store
 *
 * Manages tracks loaded from remote indexed files (BigBed, BigWig, etc.)
 * Features are fetched on-demand based on the current viewport.
 */

import { browser } from '$app/environment';
import {
	queryBigBed,
	searchBigBedByName,
	hasGeneBigBed,
	getGeneBigBedUrl,
	hasTranscriptBigBed,
	getTranscriptBigBedUrl,
	clearBigBedCache,
} from '$lib/services/bigbed';
import { queryBigWig, clearBigWigCache } from '$lib/services/bigwig';
import { queryTabixVcf, queryTabixGff, queryTabixBed, clearTabixCache, getTabixChromosomes } from '$lib/services/tabix';
import { queryBam, queryCram, clearBamCache, getBamChromosomes } from '$lib/services/bam';
import { getBigBedChromosomes } from '$lib/services/bigbed';
import { getBigWigChromosomes } from '$lib/services/bigwig';
import { useAssembly } from '$lib/stores/assembly.svelte';
import type { BedFeature, GffFeature, Viewport } from '$lib/types/genome';
import type { SignalFeature, VariantFeature } from '$lib/types/tracks';

// Types
type RemoteTrackType = 'bigbed' | 'bigwig' | 'vcf' | 'gff' | 'bed' | 'bam' | 'cram';
type RemoteFeature = BedFeature | SignalFeature | VariantFeature | GffFeature;

interface RemoteTrack {
	id: string;
	name: string;
	type: RemoteTrackType;
	url: string;
	assemblyId: string;
	visible: boolean;
	color: string;
	height: number;
	userHeight: number | null; // null = auto-height, number = user-set fixed height
	isLoading: boolean;
	error: string | null;
	features: RemoteFeature[];
	lastViewport: Viewport | null;
	// Chromosome validation
	validatedChromosomes: boolean;
	chromosomeMismatchWarning: string | null;
}

interface RemoteTrackConfig {
	id: string;
	name: string;
	type?: RemoteTrackType;
	url: string;
	assemblyId: string;
	color?: string;
	height?: number;
}

// State
let remoteTracks = $state<RemoteTrack[]>([]);
let activeAssemblyId = $state<string | null>(null);
let remoteRenderVersion = $state(0);

// PERFORMANCE: Store features OUTSIDE of $state to avoid Svelte 5 proxy overhead
// This Map stores raw (non-proxied) arrays of features keyed by track ID
// This is critical for BigWig tracks which can have 50,000+ features
const rawFeaturesStore = new Map<string, RemoteFeature[]>();

/**
 * Get raw (non-proxied) features for a track
 * Use this instead of track.features for performance-critical operations
 */
export function getRawFeatures(trackId: string): RemoteFeature[] {
	return rawFeaturesStore.get(trackId) || [];
}

// Debounce timer for viewport changes
let fetchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const FETCH_DEBOUNCE_MS = 150;

/**
 * Add a remote track
 */
function addRemoteTrack(config: RemoteTrackConfig): RemoteTrack {
	const track: RemoteTrack = {
		id: config.id,
		name: config.name,
		type: config.type || 'bigbed',
		url: config.url,
		assemblyId: config.assemblyId,
		visible: true,
		color: config.color || '#22c55e',
		height: config.height || 100,
		userHeight: null, // null = auto-height by default
		isLoading: false,
		error: null,
		features: [],
		lastViewport: null,
		validatedChromosomes: false,
		chromosomeMismatchWarning: null,
	};

	remoteTracks = [...remoteTracks, track];
	return track;
}

/**
 * Remove a remote track
 */
function removeRemoteTrack(trackId: string): void {
	rawFeaturesStore.delete(trackId);
	remoteTracks = remoteTracks.filter((t) => t.id !== trackId);
}

/**
 * Toggle track visibility
 */
function toggleRemoteTrackVisibility(trackId: string): void {
	remoteTracks = remoteTracks.map((t) =>
		t.id === trackId ? { ...t, visible: !t.visible } : t
	);
}

/**
 * Set track height
 * Set to null for auto-height, or a number for fixed height
 */
function setRemoteTrackHeight(trackId: string, height: number | null): void {
	remoteTracks = remoteTracks.map((t) =>
		t.id === trackId ? { ...t, userHeight: height } : t
	);
}

/**
 * Clear chromosome mismatch warning for a remote track
 */
function clearRemoteTrackWarning(trackId: string): void {
	remoteTracks = remoteTracks.map((t) =>
		t.id === trackId ? { ...t, chromosomeMismatchWarning: null } : t
	);
}

/**
 * Get chromosome names from a remote track file based on its type
 */
async function getChromosomesForTrack(track: RemoteTrack): Promise<string[]> {
	switch (track.type) {
		case 'bigbed':
			const bbChroms = await getBigBedChromosomes(track.url);
			return bbChroms.map(c => c.name);
		case 'bigwig':
			const bwChroms = await getBigWigChromosomes(track.url);
			return bwChroms.map(c => c.name);
		case 'vcf':
		case 'gff':
		case 'bed':
			return await getTabixChromosomes(track.url);
		case 'bam':
		case 'cram':
			return await getBamChromosomes(track.url);
		default:
			return [];
	}
}

/**
 * Validate track chromosomes against current assembly
 * Sets a warning if there's no overlap between file chromosomes and assembly
 */
async function validateTrackChromosomes(track: RemoteTrack): Promise<void> {
	// Skip validation for built-in gene/transcript tracks (they're assembly-matched)
	if (track.id === 'genes' || track.id === 'transcripts') {
		remoteTracks = remoteTracks.map((t) =>
			t.id === track.id ? { ...t, validatedChromosomes: true } : t
		);
		return;
	}

	try {
		const assembly = useAssembly();
		const fileChromosomes = await getChromosomesForTrack(track);

		if (fileChromosomes.length === 0) {
			// Couldn't get chromosomes from file - skip validation
			remoteTracks = remoteTracks.map((t) =>
				t.id === track.id ? { ...t, validatedChromosomes: true } : t
			);
			return;
		}

		// Get assembly chromosome names (including aliases)
		const assemblyChromNames = new Set<string>();
		for (const chr of assembly.current.chromosomes) {
			assemblyChromNames.add(chr.name.toLowerCase());
			// Also add common variations
			assemblyChromNames.add(chr.name.toLowerCase().replace(/^chr/i, ''));
			assemblyChromNames.add('chr' + chr.name.toLowerCase().replace(/^chr/i, ''));
			// Add aliases if present
			if (chr.aliases) {
				for (const alias of chr.aliases) {
					assemblyChromNames.add(alias.toLowerCase());
				}
			}
		}

		// Check for overlap
		const matchingChromosomes = fileChromosomes.filter(chr => {
			const lowerChr = chr.toLowerCase();
			return assemblyChromNames.has(lowerChr) ||
				assemblyChromNames.has(lowerChr.replace(/^chr/i, '')) ||
				assemblyChromNames.has('chr' + lowerChr.replace(/^chr/i, ''));
		});

		let warning: string | null = null;
		if (matchingChromosomes.length === 0) {
			// No overlap - warn user
			const sampleChroms = fileChromosomes.slice(0, 3).join(', ');
			const suffix = fileChromosomes.length > 3 ? '...' : '';
			warning = `Loaded, but its chromosomes (${sampleChroms}${suffix}) aren't in "${assembly.current.name}", so it won't appear. Pick the matching genome in the assembly selector (top-left).`;
		}

		remoteTracks = remoteTracks.map((t) =>
			t.id === track.id
				? { ...t, validatedChromosomes: true, chromosomeMismatchWarning: warning }
				: t
		);
	} catch (error) {
		console.error(`Error validating chromosomes for track ${track.id}:`, error);
		// Don't block on validation errors
		remoteTracks = remoteTracks.map((t) =>
			t.id === track.id ? { ...t, validatedChromosomes: true } : t
		);
	}
}

/**
 * Check if viewport has changed enough to warrant a refetch
 */
function viewportChanged(track: RemoteTrack, viewport: Viewport): boolean {
	// Always refetch if we have no features (e.g., after assembly switch or returning to view)
	const currentFeatures = rawFeaturesStore.get(track.id);
	if (!currentFeatures || currentFeatures.length === 0) return true;

	if (!track.lastViewport) return true;
	if (track.lastViewport.chromosome !== viewport.chromosome) return true;

	// Refetch if we've panned more than 50% of the view, or zoomed significantly
	const lastWidth = track.lastViewport.end - track.lastViewport.start;
	const currentWidth = viewport.end - viewport.start;

	// Zoom changed significantly
	if (Math.abs(lastWidth - currentWidth) / lastWidth > 0.3) return true;

	// Panned outside the previously fetched region
	const pannedLeft = viewport.start < track.lastViewport.start;
	const pannedRight = viewport.end > track.lastViewport.end;

	if (pannedLeft || pannedRight) return true;

	return false;
}

/**
 * Fetch features for a track based on current viewport
 * Fetches a larger region than the viewport for smoother panning
 */
async function fetchTrackFeatures(
	track: RemoteTrack,
	viewport: Viewport,
	signal?: AbortSignal
): Promise<void> {
	// Calculate fetch region (2x viewport width for panning buffer)
	const viewWidth = viewport.end - viewport.start;
	const buffer = viewWidth * 0.5;
	const fetchStart = Math.max(0, Math.floor(viewport.start - buffer));
	const fetchEnd = Math.ceil(viewport.end + buffer);

	// Update track loading state
	remoteTracks = remoteTracks.map((t) =>
		t.id === track.id ? { ...t, isLoading: true, error: null } : t
	);

	try {
		// Query based on track type
		let features: RemoteFeature[];
		switch (track.type) {
			case 'bigwig':
				features = await queryBigWig(
					track.url,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal, assemblyId: track.assemblyId }
				);
				break;
			case 'vcf':
				features = await queryTabixVcf(
					track.url,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'gff':
				features = await queryTabixGff(
					track.url,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'bed':
				features = await queryTabixBed(
					track.url,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'bam':
				features = await queryBam(
					track.url,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal, assemblyId: track.assemblyId }
				);
				break;
			case 'cram':
				features = await queryCram(
					track.url,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal, assemblyId: track.assemblyId }
				);
				break;
			case 'bigbed':
			default:
				features = await queryBigBed(
					track.url,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal, assemblyId: track.assemblyId }
				);
				break;
		}

		// Update track with features
		// PERFORMANCE: Store raw features outside of $state to avoid proxy overhead
		// This is critical for BigWig tracks which can have 50,000+ features
		rawFeaturesStore.set(track.id, features);
		remoteRenderVersion++; // Trigger re-render for components watching this

		// Update track metadata (features array in $state is just for reactivity/count display)
		remoteTracks = remoteTracks.map((t) =>
			t.id === track.id
				? {
						...t,
						features, // Keep in sync for sidebar display, but use rawFeaturesStore for rendering
						isLoading: false,
						lastViewport: { chromosome: viewport.chromosome, start: fetchStart, end: fetchEnd },
					}
				: t
		);

		// Validate chromosomes on first successful fetch (fire-and-forget)
		if (!track.validatedChromosomes) {
			validateTrackChromosomes(track);
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return; // Ignore aborted requests
		}

		const message = error instanceof Error ? error.message : 'Unknown error';
		remoteTracks = remoteTracks.map((t) =>
			t.id === track.id ? { ...t, isLoading: false, error: message } : t
		);
	}
}

/**
 * Update all visible remote tracks for the current viewport
 */
let currentAbortController: AbortController | null = null;

function updateForViewport(viewport: Viewport): void {
	if (!browser) return;

	// Cancel any pending fetch
	if (fetchDebounceTimer) {
		clearTimeout(fetchDebounceTimer);
	}

	// CRITICAL: Capture viewport values NOW, not when timeout fires
	// This fixes the stale closure bug where the viewport object could be mutated
	const capturedViewport: Viewport = {
		chromosome: viewport.chromosome,
		start: viewport.start,
		end: viewport.end
	};

	// Debounce to avoid excessive fetches during pan/zoom
	fetchDebounceTimer = setTimeout(() => {
		// Abort any in-flight requests
		if (currentAbortController) {
			currentAbortController.abort();
		}
		currentAbortController = new AbortController();

		// Fetch for all visible tracks that need updating
		// Use capturedViewport (immutable copy) instead of viewport (potentially stale reference)
		const tracksToUpdate = remoteTracks.filter(
			(t) => t.visible && viewportChanged(t, capturedViewport)
		);

		for (const track of tracksToUpdate) {
			fetchTrackFeatures(track, capturedViewport, currentAbortController.signal);
		}
	}, FETCH_DEBOUNCE_MS);
}

/**
 * Search for a gene by name across all remote tracks
 */
async function searchGeneByName(name: string): Promise<BedFeature | null> {
	for (const track of remoteTracks) {
		try {
			const results = await searchBigBedByName(track.url, name);
			if (results.length > 0) {
				// Return the first exact match, or first partial match
				const exactMatch = results.find(
					(f) => f.name?.toLowerCase() === name.toLowerCase()
				);
				return exactMatch || results[0];
			}
		} catch {
			// Continue to next track
		}
	}
	return null;
}

/**
 * Set up gene and transcript tracks for an assembly
 */
function setupGeneTrackForAssembly(assemblyId: string): void {
	// Clear rawFeaturesStore and caches for tracks being removed (different assembly)
	for (const track of remoteTracks) {
		if ((track.id === 'genes' || track.id === 'transcripts') && track.assemblyId !== assemblyId) {
			rawFeaturesStore.delete(track.id);
		}
	}
	clearBigBedCache();
	clearBigWigCache();

	// Remove existing tracks for other assemblies
	remoteTracks = remoteTracks.filter(
		(t) => (t.id !== 'genes' && t.id !== 'transcripts') || t.assemblyId === assemblyId
	);

	// Check if we already have tracks for this assembly
	const existingGeneTrack = remoteTracks.find(
		(t) => t.id === 'genes' && t.assemblyId === assemblyId
	);
	const existingTranscriptTrack = remoteTracks.find(
		(t) => t.id === 'transcripts' && t.assemblyId === assemblyId
	);

	// Add gene track if needed
	if (!existingGeneTrack && hasGeneBigBed(assemblyId)) {
		const geneUrl = getGeneBigBedUrl(assemblyId);
		if (geneUrl) {
			addRemoteTrack({
				id: 'genes',
				name: 'Genes',
				url: geneUrl,
				assemblyId,
				color: '#22c55e',
				height: 100,
			});
		}
	}

	// Add transcript track if needed (different from genes - has exon structure)
	if (!existingTranscriptTrack && hasTranscriptBigBed(assemblyId)) {
		const transcriptUrl = getTranscriptBigBedUrl(assemblyId);
		if (transcriptUrl) {
			addRemoteTrack({
				id: 'transcripts',
				name: 'Transcripts',
				url: transcriptUrl,
				assemblyId,
				color: '#3b82f6',
				height: 120,
			});
		}
	}

	activeAssemblyId = assemblyId;
}

/**
 * Clear all remote tracks and caches
 */
function clearAll(): void {
	remoteTracks = [];
	activeAssemblyId = null;
	clearBigBedCache();
	clearBigWigCache();
	clearTabixCache();
	clearBamCache();
}

/**
 * Get all features from all visible remote tracks
 */
function getAllFeatures(): BedFeature[] {
	return remoteTracks
		.filter((t) => t.visible)
		.flatMap((t) => t.features);
}

// Export as a reactive store
export function useRemoteTracks() {
	return {
		get all() {
			return remoteTracks;
		},
		get visible() {
			return remoteTracks.filter((t) => t.visible);
		},
		get isLoading() {
			return remoteTracks.some((t) => t.isLoading);
		},
		get activeAssemblyId() {
			return activeAssemblyId;
		},
		get renderVersion() {
			return remoteRenderVersion;
		},
		addRemoteTrack,
		removeRemoteTrack,
		toggleRemoteTrackVisibility,
		setRemoteTrackHeight,
		clearRemoteTrackWarning,
		updateForViewport,
		searchGeneByName,
		setupGeneTrackForAssembly,
		getAllFeatures,
		clearAll,
	};
}
