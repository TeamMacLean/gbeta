/**
 * Coverage-warning store + sparsity detection for zoomed-out BAM density view.
 *
 * When a BAM track is viewed zoomed-out, a windowed coverage histogram is drawn.
 * If the visible region has very few reads, the histogram is essentially blank,
 * which looks identical to a failed load. We detect that situation and surface a
 * dismissable, informational dialog instead of leaving the user staring at an
 * empty track.
 */

/**
 * Decide whether windowed coverage will render essentially blank.
 *
 * Coverage values here are per-bin MEAN depths (see `computeBinMeanCoverage`),
 * not raw read counts, so they're typically fractional. The histogram
 * auto-scales to its own maximum, which means any non-zero window becomes a
 * visible peak regardless of how small the mean is. The only situation that
 * actually renders blank — and therefore looks like a failed load — is when no
 * window has any coverage at all. We deliberately do NOT warn on low-but-present
 * coverage: that draws visible peaks and a warning there would be misleading.
 *
 * @param coverage Per-window mean-depth values from `getBamCoverageData().coverage`.
 * @returns true only when the region has no coverage to draw.
 */
export function isCoverageSparse(coverage: readonly number[]): boolean {
	if (coverage.length === 0) {
		// Genuinely no data is handled elsewhere (treated as a load result, not a
		// "sparse but present" situation); don't warn here.
		return false;
	}

	for (const value of coverage) {
		if (value > 0) return false;
	}
	return true;
}

interface WarningState {
	visible: boolean;
	/** Human-readable region label shown in the dialog. */
	region: string;
}

/**
 * Singleton store for the sparse-coverage dialog.
 *
 * Anti-nag strategy: we remember a key for every (track + region) we've already
 * warned about in this session. Panning around a sparse area or re-rendering the
 * same view never re-shows the dialog; only a new track/region combination can.
 * The user dismissing the dialog also marks the current key as warned.
 */
function createCoverageWarningStore() {
	let state = $state<WarningState>({ visible: false, region: '' });
	const warnedKeys = new Set<string>();

	/**
	 * Report a (possibly sparse) coverage render. Shows the dialog at most once
	 * per unique key.
	 *
	 * @param key   Stable identifier for the track+region (e.g. `${url}|${chr}:${start}-${end}`).
	 * @param region Human-readable region label for the dialog body.
	 */
	function notifySparse(key: string, region: string): void {
		if (warnedKeys.has(key)) return;
		warnedKeys.add(key);
		state.region = region;
		state.visible = true;
	}

	function dismiss(): void {
		state.visible = false;
	}

	return {
		get visible() {
			return state.visible;
		},
		get region() {
			return state.region;
		},
		notifySparse,
		dismiss,
	};
}

let store: ReturnType<typeof createCoverageWarningStore> | undefined;

export function useCoverageWarning() {
	if (!store) store = createCoverageWarningStore();
	return store;
}
