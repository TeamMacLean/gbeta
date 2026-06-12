/**
 * Decide whether a loaded track's data belongs to the current assembly.
 *
 * A name-only "does any chromosome match" check is fooled by shared `chrN`
 * naming across species (human chr7 data "matches" maize chr7). So we flag a
 * track when a meaningful share of its chromosomes are ABSENT from the assembly,
 * or when features run past a chromosome's length (which can only be the wrong
 * genome). Used for the reactive per-track warning in the sidebar.
 */

/** Minimal chromosome info we need from the assembly. */
export interface ChromInfo {
	length?: number;
}

export interface MismatchResult {
	/** True when the track looks like it's from a different genome. */
	bad: boolean;
	/** A short human-readable reason (unmatched chromosome names, or a note). */
	sample: string;
}

/** Above this fraction of absent chromosomes, the track is flagged. */
const UNMATCHED_FRACTION_THRESHOLD = 0.34;

/** How many features to scan at most (bounds cost on large tracks). */
const SCAN_LIMIT = 5000;

export function chromosomeMismatch(
	features: ReadonlyArray<{ chromosome: string; end: number }>,
	getChromosome: (name: string) => ChromInfo | undefined
): MismatchResult {
	if (!features || features.length === 0) return { bad: false, sample: '' };

	// distinct chromosome -> furthest coordinate seen
	const maxEnd = new Map<string, number>();
	const limit = Math.min(features.length, SCAN_LIMIT);
	for (let i = 0; i < limit; i++) {
		const f = features[i];
		const cur = maxEnd.get(f.chromosome);
		if (cur === undefined || f.end > cur) maxEnd.set(f.chromosome, f.end);
	}

	const unmatched: string[] = [];
	let outOfBounds = false;
	for (const [chr, end] of maxEnd) {
		const info = getChromosome(chr);
		if (!info) unmatched.push(chr);
		else if (info.length && end > info.length) outOfBounds = true;
	}

	const fractionUnmatched = unmatched.length / maxEnd.size;
	const bad = fractionUnmatched > UNMATCHED_FRACTION_THRESHOLD || outOfBounds;
	const sample = unmatched.length
		? unmatched.slice(0, 3).join(', ')
		: 'positions beyond chromosome length';
	return { bad, sample };
}
