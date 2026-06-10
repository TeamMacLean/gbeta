/**
 * Coverage Controls Utilities
 *
 * Shared logic for coverage quality controls
 */

export interface TrackType {
	id: string;
	type: string;
	name: string;
	visible: boolean;
}

// Track types that support coverage quality controls
const QUANTITATIVE_TRACK_TYPES = new Set(['bam', 'cram', 'bigwig', 'bedgraph']);

/**
 * Determine if coverage quality controls should be shown
 * @param trackList - Array of track objects
 * @returns Whether to show coverage controls
 */
export function shouldShowCoverageControls(trackList: TrackType[]): boolean {
	return trackList.some(track =>
		track.visible && QUANTITATIVE_TRACK_TYPES.has(track.type.toLowerCase())
	);
}