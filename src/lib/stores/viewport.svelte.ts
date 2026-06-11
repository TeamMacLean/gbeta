/**
 * Viewport state management using Svelte 5 runes
 * Supports URL state persistence for shareable links
 */

import type { Viewport } from '$lib/types/genome';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

/**
 * A highlighted region on the canvas
 */
export interface HighlightRegion {
	id: string;
	chromosome: string;
	start: number;
	end: number;
	color?: string;      // Default: semi-transparent yellow
	label?: string;      // Optional label to display
	persistent?: boolean; // If true, survives clear() calls
}

// Default viewport: shows a region of chromosome 1
const DEFAULT_VIEWPORT: Viewport = {
	chromosome: 'chr1',
	start: 0,
	end: 100000
};

// Reactive viewport state
let viewport = $state<Viewport>({ ...DEFAULT_VIEWPORT });

// Highlight state
let highlights = $state<HighlightRegion[]>([]);
let highlightIdCounter = 0;

// Track whether we've initialized from URL
let initialized = false;

// Debounce timer for URL updates
let urlUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Parse viewport from URL search params
 */
function parseViewportFromURL(): Viewport | null {
	if (!browser) return null;

	const params = new URLSearchParams(window.location.search);
	const chr = params.get('chr');
	const startStr = params.get('start');
	const endStr = params.get('end');

	// Also support compact format: ?loc=chr17:7668421-7687490
	const loc = params.get('loc');
	if (loc) {
		const match = loc.match(/^([^:]+):([\d,]+)-([\d,]+)$/);
		if (match) {
			const start = parseInt(match[2].replace(/,/g, ''), 10);
			const end = parseInt(match[3].replace(/,/g, ''), 10);
			// Same validation as the expanded ?chr&start&end form.
			if (!isNaN(start) && !isNaN(end) && end > start) {
				return { chromosome: match[1], start, end };
			}
		}
	}

	if (chr && startStr && endStr) {
		const start = parseInt(startStr, 10);
		const end = parseInt(endStr, 10);
		if (!isNaN(start) && !isNaN(end) && end > start) {
			return { chromosome: chr, start, end };
		}
	}

	return null;
}

// Session persistence timer
let sessionPersistTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Update URL with current viewport state (debounced)
 */
function syncViewportToURL(): void {
	if (!browser || !initialized) return;

	// Debounce URL updates to avoid history spam during pan/zoom
	if (urlUpdateTimeout) {
		clearTimeout(urlUpdateTimeout);
	}

	urlUpdateTimeout = setTimeout(() => {
		const params = new URLSearchParams(window.location.search);
		params.set('chr', viewport.chromosome);
		params.set('start', String(Math.round(viewport.start)));
		params.set('end', String(Math.round(viewport.end)));

		// Remove loc param if present (we use expanded format)
		params.delete('loc');

		const newUrl = `?${params.toString()}`;
		goto(newUrl, { replaceState: true, noScroll: true, keepFocus: true });
	}, 150);

	// Also persist to localStorage (more debounced)
	if (sessionPersistTimeout) {
		clearTimeout(sessionPersistTimeout);
	}
	sessionPersistTimeout = setTimeout(() => {
		// Trigger session save via tracks store
		import('./tracks.svelte').then(({ useTracks }) => {
			useTracks().persistSession();
		});
	}, 500);
}

/**
 * Initialize viewport from URL params (call once on mount)
 * If assembly is specified but no location, uses assembly's default viewport
 */
function initializeFromURL(assemblyInfo?: {
	defaultViewport?: Viewport;
	chromosomes: Array<{ name: string; length: number }>
}): void {
	if (initialized) return;

	const urlViewport = parseViewportFromURL();
	if (urlViewport) {
		// Explicit viewport in URL - use it
		viewport.chromosome = urlViewport.chromosome;
		viewport.start = urlViewport.start;
		viewport.end = urlViewport.end;
	} else if (assemblyInfo) {
		// No viewport in URL but assembly specified - use assembly default
		if (assemblyInfo.defaultViewport) {
			viewport.chromosome = assemblyInfo.defaultViewport.chromosome;
			viewport.start = assemblyInfo.defaultViewport.start;
			viewport.end = assemblyInfo.defaultViewport.end;
		} else if (assemblyInfo.chromosomes.length > 0) {
			// Fall back to first chromosome
			const firstChr = assemblyInfo.chromosomes[0];
			viewport.chromosome = firstChr.name;
			viewport.start = 0;
			viewport.end = Math.min(firstChr.length, 100000);
		}
	}
	// If no assembly info and no URL viewport, keep the DEFAULT_VIEWPORT (chr1)

	initialized = true;
}

// Derived values
const viewportWidth = $derived(viewport.end - viewport.start);
const viewportCenter = $derived(viewport.start + viewportWidth / 2);

// Viewport actions
function setViewport(newViewport: Viewport): void {
	// Central guard: never let NaN/Infinity coordinates corrupt viewport state.
	if (!isFinite(newViewport.start) || !isFinite(newViewport.end)) {
		console.warn('Ignoring viewport update with non-finite coordinates:', newViewport);
		return;
	}
	viewport.chromosome = newViewport.chromosome;
	viewport.start = Math.max(0, Math.round(newViewport.start));
	viewport.end = Math.max(viewport.start + 1, Math.round(newViewport.end));
	syncViewportToURL();
}

function navigateTo(chromosome: string, start: number, end: number): void {
	setViewport({ chromosome, start, end });
}

function pan(deltaPixels: number, pixelsPerBase: number): void {
	// Can't pan without a valid pixel scale (0/NaN -> Infinity/NaN deltaBases).
	if (!isFinite(pixelsPerBase) || pixelsPerBase === 0) return;
	const deltaBases = Math.round(deltaPixels / pixelsPerBase);
	if (!isFinite(deltaBases)) return;
	const newStart = Math.max(0, viewport.start - deltaBases);
	const newEnd = newStart + viewportWidth;
	setViewport({ ...viewport, start: newStart, end: newEnd });
}

function zoom(factor: number, centerBase?: number): void {
	if (!isFinite(factor) || factor <= 0) return; // invalid zoom factor
	const center = centerBase ?? viewportCenter;
	const newWidth = Math.max(1, Math.round(viewportWidth * factor));
	const newStart = Math.max(0, Math.round(center - newWidth / 2));
	const newEnd = newStart + newWidth;
	setViewport({ ...viewport, start: newStart, end: newEnd });
}

function zoomIn(): void {
	zoom(0.5);
}

function zoomOut(): void {
	zoom(2);
}

function reset(): void {
	setViewport({ ...DEFAULT_VIEWPORT });
}

// ============================================================
// HIGHLIGHT FUNCTIONS
// ============================================================

/**
 * Add a highlight region
 */
function addHighlight(
	chromosome: string,
	start: number,
	end: number,
	options?: { color?: string; label?: string; persistent?: boolean }
): string {
	const id = `highlight_${++highlightIdCounter}`;
	// Normalize the range: swap inverted start/end, clamp to >= 0, ensure non-zero
	// width — so overlap tests and goToHighlight can't misbehave on bad input.
	let s = Math.min(start, end);
	let e = Math.max(start, end);
	if (!isFinite(s) || !isFinite(e)) {
		s = 0;
		e = 1;
	}
	s = Math.max(0, Math.round(s));
	e = Math.max(s + 1, Math.round(e));
	const region: HighlightRegion = {
		id,
		chromosome,
		start: s,
		end: e,
		color: options?.color,
		label: options?.label,
		persistent: options?.persistent ?? false
	};
	highlights = [...highlights, region];
	return id;
}

/**
 * Remove a specific highlight by ID
 */
function removeHighlight(id: string): void {
	highlights = highlights.filter(h => h.id !== id);
}

/**
 * Clear all non-persistent highlights
 */
function clearHighlights(): void {
	highlights = highlights.filter(h => h.persistent);
}

/**
 * Clear ALL highlights including persistent ones
 */
function clearAllHighlights(): void {
	highlights = [];
}

/**
 * Get highlights visible in current viewport
 */
function getVisibleHighlights(): HighlightRegion[] {
	return highlights.filter(h =>
		h.chromosome === viewport.chromosome &&
		h.start < viewport.end &&
		h.end > viewport.start
	);
}

/**
 * Check if there are any active highlights
 */
function hasHighlights(): boolean {
	return highlights.length > 0;
}

/**
 * Navigate to a highlight and optionally zoom to fit it
 */
function goToHighlight(id: string, padding: number = 0.1): void {
	const highlight = highlights.find(h => h.id === id);
	if (!highlight) return;

	const width = highlight.end - highlight.start;
	const paddingBp = Math.round(width * padding);

	navigateTo(
		highlight.chromosome,
		Math.max(0, highlight.start - paddingBp),
		highlight.end + paddingBp
	);
}

// Export as a reactive store object
export function useViewport() {
	return {
		get current() { return viewport; },
		get width() { return viewportWidth; },
		get center() { return viewportCenter; },
		get highlights() { return highlights; },
		setViewport,
		navigateTo,
		pan,
		zoom,
		zoomIn,
		zoomOut,
		reset,
		initializeFromURL,
		// Highlight methods
		addHighlight,
		removeHighlight,
		clearHighlights,
		clearAllHighlights,
		getVisibleHighlights,
		hasHighlights,
		goToHighlight
	};
}
