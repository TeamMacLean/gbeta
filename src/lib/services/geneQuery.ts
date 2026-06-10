/**
 * Gene-aware query resolution.
 *
 * Bridges the synchronous GQL parser/executor and the async gene lookup
 * service: when a navigation-style command targets a gene name instead of
 * coordinates (e.g. `NAVIGATE BRCA1`, `ZOOM TP53`, `HIGHLIGHT MYC`), resolve the
 * name to coordinates and produce a ready-to-execute ParsedQuery.
 *
 * The AI emits gene SYMBOLS; resolution to coordinates happens here against real
 * data sources — the model never fabricates positions.
 */

import type { GenomeAssembly } from '$lib/types/genome';
import { lookupGene, isCoordinate, supportsGeneLookup, type GeneResult } from './geneLookup';
import type { ParsedQuery } from './queryLanguage';

/** Commands that take a coordinate target and can therefore take a gene name. */
const NAV_COMMANDS = new Set(['navigate', 'goto', 'go', 'highlight', 'zoom']);

export type GeneQueryOutcome =
	/** Not a gene-targeting query — caller should parse/execute it normally. */
	| { status: 'not-a-gene-query' }
	/** Lookup ran but found nothing. */
	| { status: 'none'; term: string }
	/** Lookup failed (network/API/unsupported assembly). */
	| { status: 'error'; term: string; error: string }
	/** Exactly one match — execute `query`. */
	| { status: 'resolved'; term: string; chosen: GeneResult; query: ParsedQuery }
	/**
	 * Multiple matches — `chosen` is the best guess (execute `query`), but the
	 * caller MUST report the guess and offer `alternatives`.
	 */
	| {
			status: 'multi';
			term: string;
			chosen: GeneResult;
			alternatives: GeneResult[];
			query: ParsedQuery;
	  };

/**
 * Detect a navigation-style command whose target is a gene name (not a
 * coordinate). Returns null for coordinate targets, `zoom in/out`, `zoom 2x`,
 * and non-navigation commands.
 */
export function detectGeneTerm(input: string): { command: string; term: string } | null {
	const parts = input.trim().split(/\s+/);
	const command = parts[0]?.toLowerCase();
	if (!command || !NAV_COMMANDS.has(command)) return null;

	let argParts = parts.slice(1);
	if (command === 'zoom') {
		const first = argParts[0]?.toLowerCase();
		if (first === 'in' || first === 'out') return null; // relative zoom
		if (argParts.length === 1 && /^\d*\.?\d+x?$/.test(first ?? '')) return null; // zoom 2x
	}
	// Allow "NAVIGATE TO <gene>" / "go to <gene>" phrasing.
	if (argParts.length > 1 && argParts[0]?.toLowerCase() === 'to') {
		argParts = argParts.slice(1);
	}

	const term = argParts.join(' ').trim();
	if (!term) return null;
	if (isCoordinate(term.replace(/\s+/g, ''))) return null; // already coordinates

	return { command, term };
}

/**
 * Build the ParsedQuery to execute for a resolved gene. ZOOM/NAVIGATE frame the
 * gene's region (navigate); HIGHLIGHT highlights it. Coordinates are converted
 * to the browser's internal 0-based half-open form here, using the gene's
 * already-normalized chromosome name (so we bypass parseCoordinate's bare-number
 * `chr` prefixing, which would mis-handle assemblies like botrytis that use "1").
 */
function buildQuery(command: string, gene: GeneResult, raw: string): ParsedQuery {
	const target = command === 'highlight' ? 'highlight' : 'navigate';
	// Frame the gene with ~15% padding on each side (min 2kb) so the gene's
	// highlighted span reads as a distinct block with flanking context, rather
	// than filling the whole viewport.
	const geneStart = Math.max(0, gene.start - 1); // 1-based -> internal 0-based
	const pad = Math.max(2000, Math.round((gene.end - geneStart) * 0.15));
	return {
		command: target,
		raw,
		params: {
			chromosome: gene.chromosome,
			start: Math.max(0, geneStart - pad),
			end: gene.end + pad
		},
		valid: true
	};
}

/** Build a navigate query that frames a chosen gene (e.g. when switching picks). */
export function geneToNavigateQuery(gene: GeneResult): ParsedQuery {
	return buildQuery('navigate', gene, `navigate ${gene.symbol}`);
}

/**
 * Resolve a (possibly gene-targeting) query. For non-gene queries returns
 * `{ status: 'not-a-gene-query' }` so the caller can fall back to the normal
 * sync parse/execute path.
 *
 * @param lookup Injectable for testing; defaults to the real lookup service.
 */
export async function resolveGeneQuery(
	input: string,
	assembly: GenomeAssembly,
	lookup: typeof lookupGene = lookupGene
): Promise<GeneQueryOutcome> {
	const detected = detectGeneTerm(input);
	if (!detected) return { status: 'not-a-gene-query' };

	const { command, term } = detected;

	if (!supportsGeneLookup(assembly.id)) {
		return { status: 'error', term, error: `Gene lookup not available for ${assembly.name}` };
	}

	let matches: GeneResult[];
	try {
		matches = await lookup(term, assembly);
	} catch (err) {
		return { status: 'error', term, error: err instanceof Error ? err.message : String(err) };
	}

	if (matches.length === 0) return { status: 'none', term };

	const [chosen, ...rest] = matches;
	const query = buildQuery(command, chosen, input.trim());

	if (rest.length === 0) {
		return { status: 'resolved', term, chosen, query };
	}
	return { status: 'multi', term, chosen, alternatives: rest, query };
}
