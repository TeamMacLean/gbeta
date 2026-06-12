/**
 * Local Binary Track Store
 *
 * Manages tracks loaded from local binary files (BigBed, BigWig, BAM, tabix).
 * Features are fetched on-demand based on the current viewport.
 *
 * Unlike the remote track store, this one stores File references (not URLs).
 */

import { browser } from '$app/environment';
import {
	queryLocalBigBed,
	queryLocalBigWig,
	queryLocalBam,
	queryLocalCram,
	queryLocalTabixVcf,
	queryLocalTabixGff,
	queryLocalTabixBed,
	getLocalBigBedChromosomes,
	getLocalBigWigChromosomes,
	getLocalBamChromosomes,
	getLocalCramChromosomes,
	getLocalTabixChromosomes,
	type LocalBinaryTrackType,
} from '$lib/services/localBinaryTracks';
import { useAssembly } from '$lib/stores/assembly.svelte';
import type { BedFeature, GffFeature, Viewport } from '$lib/types/genome';
import type { SignalFeature, VariantFeature } from '$lib/types/tracks';

// Types
type LocalFeature = BedFeature | SignalFeature | VariantFeature | GffFeature;

interface LocalBinaryTrack {
	id: string;
	name: string;
	type: LocalBinaryTrackType;
	file: File;           // Main data file
	indexFile?: File;     // Index file (for BAM/tabix)
	visible: boolean;
	color: string;
	height: number;
	userHeight: number | null;
	isLoading: boolean;
	error: string | null;
	features: LocalFeature[];
	lastViewport: Viewport | null;
	// Chromosome validation
	validatedChromosomes: boolean;
	chromosomeMismatchWarning: string | null;
}

interface LocalBinaryTrackConfig {
	id: string;
	name: string;
	type: LocalBinaryTrackType;
	file: File;
	indexFile?: File;
	color?: string;
	height?: number;
}

// State
let localBinaryTracks = $state<LocalBinaryTrack[]>([]);
let localBinaryRenderVersion = $state(0);

// PERFORMANCE: Store features OUTSIDE of $state to avoid Svelte 5 proxy overhead
const rawFeaturesStore = new Map<string, LocalFeature[]>();

/**
 * Get raw (non-proxied) features for a track
 */
export function getLocalBinaryRawFeatures(trackId: string): LocalFeature[] {
	return rawFeaturesStore.get(trackId) || [];
}

// Debounce timer for viewport changes
let fetchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const FETCH_DEBOUNCE_MS = 150;

// Color palette for local binary tracks
const TRACK_COLORS = [
	'#8b5cf6', // violet
	'#10b981', // emerald
	'#f59e0b', // amber
	'#ec4899', // pink
	'#06b6d4', // cyan
	'#ef4444', // red
	'#14b8a6', // teal
	'#6366f1', // indigo
];
let colorIndex = 0;

function getNextColor(): string {
	const color = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
	colorIndex++;
	return color;
}

/**
 * Add a local binary track
 */
function addLocalBinaryTrack(config: LocalBinaryTrackConfig): LocalBinaryTrack {
	const track: LocalBinaryTrack = {
		id: config.id,
		name: config.name,
		type: config.type,
		file: config.file,
		indexFile: config.indexFile,
		visible: true,
		color: config.color || getNextColor(),
		height: config.height || 100,
		userHeight: null,
		isLoading: false,
		error: null,
		features: [],
		lastViewport: null,
		validatedChromosomes: false,
		chromosomeMismatchWarning: null,
	};

	localBinaryTracks = [...localBinaryTracks, track];
	return track;
}

/**
 * Remove a local binary track
 */
function removeLocalBinaryTrack(trackId: string): void {
	rawFeaturesStore.delete(trackId);
	localBinaryTracks = localBinaryTracks.filter((t) => t.id !== trackId);
}

/**
 * Toggle track visibility
 */
function toggleLocalBinaryTrackVisibility(trackId: string): void {
	localBinaryTracks = localBinaryTracks.map((t) =>
		t.id === trackId ? { ...t, visible: !t.visible } : t
	);
}

/**
 * Set track height
 */
function setLocalBinaryTrackHeight(trackId: string, height: number | null): void {
	localBinaryTracks = localBinaryTracks.map((t) =>
		t.id === trackId ? { ...t, userHeight: height } : t
	);
}

/**
 * Clear chromosome mismatch warning
 */
function clearLocalBinaryTrackWarning(trackId: string): void {
	localBinaryTracks = localBinaryTracks.map((t) =>
		t.id === trackId ? { ...t, chromosomeMismatchWarning: null } : t
	);
}

/**
 * Get chromosome names from a local binary track file
 */
async function getChromosomesForTrack(track: LocalBinaryTrack): Promise<string[]> {
	switch (track.type) {
		case 'bigbed':
			const bbChroms = await getLocalBigBedChromosomes(track.file);
			return bbChroms.map(c => c.name);
		case 'bigwig':
			const bwChroms = await getLocalBigWigChromosomes(track.file);
			return bwChroms.map(c => c.name);
		case 'bam':
			if (!track.indexFile) return [];
			return await getLocalBamChromosomes(track.file, track.indexFile);
		case 'cram':
			if (!track.indexFile) return [];
			return await getLocalCramChromosomes(track.file, track.indexFile);
		case 'vcf':
		case 'gff':
		case 'bed':
			if (!track.indexFile) return [];
			return await getLocalTabixChromosomes(track.file, track.indexFile);
		default:
			return [];
	}
}

/**
 * Validate track chromosomes against current assembly
 */
async function validateTrackChromosomes(track: LocalBinaryTrack): Promise<void> {
	try {
		const assembly = useAssembly();
		const fileChromosomes = await getChromosomesForTrack(track);

		if (fileChromosomes.length === 0) {
			localBinaryTracks = localBinaryTracks.map((t) =>
				t.id === track.id ? { ...t, validatedChromosomes: true } : t
			);
			return;
		}

		// Get assembly chromosome names (including aliases)
		const assemblyChromNames = new Set<string>();
		for (const chr of assembly.current.chromosomes) {
			assemblyChromNames.add(chr.name.toLowerCase());
			assemblyChromNames.add(chr.name.toLowerCase().replace(/^chr/i, ''));
			assemblyChromNames.add('chr' + chr.name.toLowerCase().replace(/^chr/i, ''));
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
			const sampleChroms = fileChromosomes.slice(0, 3).join(', ');
			const suffix = fileChromosomes.length > 3 ? '...' : '';
			warning = `Loaded, but its chromosomes (${sampleChroms}${suffix}) aren't in "${assembly.current.name}", so it won't appear. Pick the matching genome in the assembly selector (top-left).`;
		}

		localBinaryTracks = localBinaryTracks.map((t) =>
			t.id === track.id
				? { ...t, validatedChromosomes: true, chromosomeMismatchWarning: warning }
				: t
		);
	} catch (error) {
		console.error(`Error validating chromosomes for track ${track.id}:`, error);
		localBinaryTracks = localBinaryTracks.map((t) =>
			t.id === track.id ? { ...t, validatedChromosomes: true } : t
		);
	}
}

/**
 * Check if viewport has changed enough to warrant a refetch
 */
function viewportChanged(track: LocalBinaryTrack, viewport: Viewport): boolean {
	const currentFeatures = rawFeaturesStore.get(track.id);
	if (!currentFeatures || currentFeatures.length === 0) return true;

	if (!track.lastViewport) return true;
	if (track.lastViewport.chromosome !== viewport.chromosome) return true;

	const lastWidth = track.lastViewport.end - track.lastViewport.start;
	const currentWidth = viewport.end - viewport.start;

	if (Math.abs(lastWidth - currentWidth) / lastWidth > 0.3) return true;

	const pannedLeft = viewport.start < track.lastViewport.start;
	const pannedRight = viewport.end > track.lastViewport.end;

	if (pannedLeft || pannedRight) return true;

	return false;
}

/**
 * Fetch features for a track based on current viewport
 */
async function fetchTrackFeatures(
	track: LocalBinaryTrack,
	viewport: Viewport,
	signal?: AbortSignal
): Promise<void> {
	// Get assembly for CRAM reference sequence lookup
	const assembly = useAssembly();

	// Calculate fetch region (2x viewport width for panning buffer)
	const viewWidth = viewport.end - viewport.start;
	const buffer = viewWidth * 0.5;
	const fetchStart = Math.max(0, Math.floor(viewport.start - buffer));
	const fetchEnd = Math.ceil(viewport.end + buffer);

	// Update track loading state
	localBinaryTracks = localBinaryTracks.map((t) =>
		t.id === track.id ? { ...t, isLoading: true, error: null } : t
	);

	try {
		let features: LocalFeature[];

		switch (track.type) {
			case 'bigwig':
				features = await queryLocalBigWig(
					track.file,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'bam':
				if (!track.indexFile) {
					throw new Error('BAM file requires an index file (.bai)');
				}
				features = await queryLocalBam(
					track.file,
					track.indexFile,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'cram':
				if (!track.indexFile) {
					throw new Error('CRAM file requires an index file (.crai)');
				}
				features = await queryLocalCram(
					track.file,
					track.indexFile,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal, assemblyId: assembly.current.id }
				);
				break;
			case 'vcf':
				if (!track.indexFile) {
					throw new Error('VCF.gz file requires an index file (.tbi)');
				}
				features = await queryLocalTabixVcf(
					track.file,
					track.indexFile,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'gff':
				if (!track.indexFile) {
					throw new Error('GFF.gz file requires an index file (.tbi)');
				}
				features = await queryLocalTabixGff(
					track.file,
					track.indexFile,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'bed':
				if (!track.indexFile) {
					throw new Error('BED.gz file requires an index file (.tbi)');
				}
				features = await queryLocalTabixBed(
					track.file,
					track.indexFile,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
			case 'bigbed':
			default:
				features = await queryLocalBigBed(
					track.file,
					viewport.chromosome,
					fetchStart,
					fetchEnd,
					{ signal }
				);
				break;
		}

		// Store raw features outside of $state
		rawFeaturesStore.set(track.id, features);
		localBinaryRenderVersion++;

		// Update track metadata
		localBinaryTracks = localBinaryTracks.map((t) =>
			t.id === track.id
				? {
						...t,
						features,
						isLoading: false,
						lastViewport: { chromosome: viewport.chromosome, start: fetchStart, end: fetchEnd },
					}
				: t
		);

		// Validate chromosomes on first successful fetch
		if (!track.validatedChromosomes) {
			validateTrackChromosomes(track);
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return;
		}

		const message = error instanceof Error ? error.message : 'Unknown error';
		localBinaryTracks = localBinaryTracks.map((t) =>
			t.id === track.id ? { ...t, isLoading: false, error: message } : t
		);
	}
}

/**
 * Update all visible local binary tracks for the current viewport
 */
let currentAbortController: AbortController | null = null;

function updateForViewport(viewport: Viewport): void {
	if (!browser) return;

	if (fetchDebounceTimer) {
		clearTimeout(fetchDebounceTimer);
	}

	// Capture viewport values NOW
	const capturedViewport: Viewport = {
		chromosome: viewport.chromosome,
		start: viewport.start,
		end: viewport.end
	};

	fetchDebounceTimer = setTimeout(() => {
		if (currentAbortController) {
			currentAbortController.abort();
		}
		currentAbortController = new AbortController();

		const tracksToUpdate = localBinaryTracks.filter(
			(t) => t.visible && viewportChanged(t, capturedViewport)
		);

		for (const track of tracksToUpdate) {
			fetchTrackFeatures(track, capturedViewport, currentAbortController.signal);
		}
	}, FETCH_DEBOUNCE_MS);
}

/**
 * Clear all local binary tracks
 */
function clearAll(): void {
	rawFeaturesStore.clear();
	localBinaryTracks = [];
	colorIndex = 0;
}

/**
 * Get all features from all visible local binary tracks
 */
function getAllFeatures(): LocalFeature[] {
	return localBinaryTracks
		.filter((t) => t.visible)
		.flatMap((t) => t.features);
}

// Export as a reactive store
export function useLocalBinaryTracks() {
	return {
		get all() {
			return localBinaryTracks;
		},
		get visible() {
			return localBinaryTracks.filter((t) => t.visible);
		},
		get isLoading() {
			return localBinaryTracks.some((t) => t.isLoading);
		},
		get renderVersion() {
			return localBinaryRenderVersion;
		},
		addLocalBinaryTrack,
		removeLocalBinaryTrack,
		toggleLocalBinaryTrackVisibility,
		setLocalBinaryTrackHeight,
		clearLocalBinaryTrackWarning,
		updateForViewport,
		getAllFeatures,
		clearAll,
	};
}
