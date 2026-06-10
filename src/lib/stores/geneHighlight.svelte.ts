/**
 * Shared "currently-resolved gene" highlight.
 *
 * Both the search bar and the GQL console resolve genes through the same
 * engine; this keeps a single labelled highlight over the most recently
 * resolved gene's span (replacing the previous one), so the gene is
 * identifiable among other features in the view.
 */

import { useViewport } from './viewport.svelte';
import type { GeneResult } from '$lib/services/geneLookup';

let lastHighlightId: string | null = null;

export function highlightGene(gene: GeneResult): void {
	const viewport = useViewport();
	if (lastHighlightId) viewport.removeHighlight(lastHighlightId);
	lastHighlightId = viewport.addHighlight(
		gene.chromosome,
		Math.max(0, gene.start - 1), // 1-based -> internal 0-based
		gene.end,
		{ label: gene.symbol, color: 'rgba(124, 58, 237, 0.18)' } // accent-tinted band
	);
}
