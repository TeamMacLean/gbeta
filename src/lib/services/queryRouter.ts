/**
 * Query router — the single entry point that turns whatever the user typed into
 * an executed action plus inline-display directives.
 *
 * Deterministic-first: coordinates, GQL commands, and gene names resolve locally
 * and never touch the AI; only genuine natural language is sent to the AI
 * provider. The AI emits gene SYMBOLS, never coordinates, so its output is run
 * back through gene resolution.
 */

import { parseCoordinate, type GenomeAssembly } from '$lib/types/genome';
import { parseQuery, executeQuery, type QueryResult, type ParsedQuery, type SelectParams } from './queryLanguage';
import { resolveGeneQuery, geneToNavigateQuery, type GeneQueryOutcome } from './geneQuery';
import { lookupGene, isCoordinate, supportsGeneLookup, type GeneResult } from './geneLookup';
import { isAIConfigured, translateToGQL } from './ai';
import type { BrowserContext, TranslationResponse } from './ai/types';

const KNOWN_COMMANDS = new Set([
	'navigate',
	'goto',
	'go',
	'search',
	'zoom',
	'pan',
	'filter',
	'highlight',
	'clear',
	'list',
	'find',
	'show',
	'select',
	'count'
]);

// Commands whose argument is a coordinate target and so can take a gene name.
const NAV_COMMANDS = new Set(['navigate', 'goto', 'go', 'highlight', 'zoom']);

export interface RouteOutcome {
	/** Executed query result (navigation already happened), or null for pure messages. */
	result: QueryResult;
	/** One-line inline note (e.g. "Showing BRCA1 · chr17:…", or the AI's explanation). */
	note?: string;
	/** Original natural-language input when the AI translated it. */
	naturalLanguage?: string;
	/** The resolved gene (single or best-guess match) — caller highlights its span. */
	chosen?: GeneResult;
	/** Present when there were multiple gene matches — caller may offer the picker. */
	multi?: { term: string; chosen: GeneResult; all: GeneResult[] };
	/** True when natural language needs the AI but no API key is configured. */
	needsAIKey?: boolean;
}

/** Dependency seams (injectable for testing). */
export interface RouteDeps {
	resolveGene?: typeof resolveGeneQuery;
	exec?: typeof executeQuery;
	aiConfigured?: () => boolean;
	aiTranslate?: (input: string, ctx: BrowserContext) => Promise<TranslationResponse>;
	lookup?: typeof lookupGene;
	/** Uppercase names of genes in loaded tracks — used to skip the API when the
	 *  WITHIN/FIND target is already a loaded gene the executor can resolve. */
	trackGenes?: Set<string>;
}

/**
 * Resolve a gene-name term carried by SEARCH/WITHIN/FIND into coordinates and
 * attach `resolvedRegion`, so the synchronous executor doesn't need a gene map.
 * Track-first: skipped for WITHIN/FIND when the gene is already in a loaded
 * track (the executor uses that). SEARCH always needs concrete coordinates.
 */
async function resolveQueryGeneTerms(
	parsed: ParsedQuery,
	assembly: GenomeAssembly,
	trackGenes: Set<string>,
	lookup: typeof lookupGene
): Promise<void> {
	let term: string | undefined;
	let trackResolvable = false; // executor can resolve it from a loaded track
	if (parsed.command === 'select' || parsed.command === 'count') {
		term = (parsed.params as SelectParams).within;
		trackResolvable = true;
	} else if (parsed.command === 'list' || parsed.command === 'find' || parsed.command === 'show') {
		term = (parsed.params as { gene?: string }).gene;
		trackResolvable = true;
	} else if (parsed.command === 'search') {
		term = (parsed.params as { term?: string }).term;
	}

	if (!term || isCoordinate(term) || !supportsGeneLookup(assembly.id)) return;
	if (trackResolvable && trackGenes.has(term.toUpperCase())) return; // executor handles it

	try {
		const matches = await lookup(term, assembly);
		if (matches.length > 0) {
			const g = matches[0];
			parsed.resolvedRegion = {
				chromosome: g.chromosome,
				start: Math.max(0, g.start - 1), // 1-based -> internal 0-based
				end: g.end
			};
		}
	} catch {
		// Leave resolvedRegion unset; the executor reports "not found"/ignored.
	}
}

function message(raw: string, success: boolean, msg: string): QueryResult {
	return {
		success,
		query: { command: 'unknown', raw, params: {}, valid: false },
		message: msg,
		timestamp: Date.now()
	};
}

function coords(gene: GeneResult): string {
	return `${gene.chromosome}:${gene.start.toLocaleString()}-${gene.end.toLocaleString()}`;
}

function sourceLabel(gene: GeneResult): string {
	return gene.source === 'ensembl' ? 'Ensembl' : 'MyGene.info';
}

/** Identification line: what the gene is and where the coordinates came from. */
function identity(gene: GeneResult): string {
	const name = gene.name && gene.name !== gene.symbol ? ` — ${gene.name}` : '';
	return `${gene.symbol}${name} · ${coords(gene)} (via ${sourceLabel(gene)})`;
}

export async function routeQuery(
	input: string,
	assembly: GenomeAssembly,
	getAIContext: () => BrowserContext,
	deps: RouteDeps = {}
): Promise<RouteOutcome> {
	const resolveGene = deps.resolveGene ?? resolveGeneQuery;
	const exec = deps.exec ?? executeQuery;
	const aiConfigured = deps.aiConfigured ?? isAIConfigured;
	const aiTranslate = deps.aiTranslate ?? translateToGQL;

	const query = input.trim();
	const firstWord = query.split(/\s+/)[0]?.toLowerCase() ?? '';

	// 1. Direct coordinate.
	if (parseCoordinate(query)) {
		return { result: exec(parseQuery(`navigate ${query}`)) };
	}

	const isKnownCommand = KNOWN_COMMANDS.has(firstWord);
	const isNavCommand = NAV_COMMANDS.has(firstWord);
	const isSingleToken = !/\s/.test(query);

	// 2. Direct gene lookup ONLY for an explicit nav command (`navigate BRCA1`)
	//    or a single bare token (a gene symbol like `BRCA1`). Multi-word,
	//    non-command input is natural language — leave it for the AI (step 4),
	//    which emits `NAVIGATE <gene>` that we then resolve. This prevents a
	//    sentence like "take me to the breast cancer gene" from being looked up
	//    literally and dead-ending at "no genes found".
	if (isNavCommand || (!isKnownCommand && isSingleToken)) {
		const geneInput = isNavCommand ? query : `navigate ${query}`;
		const handled = handleGeneOutcome(await resolveGene(geneInput, assembly), exec);
		if (handled) return handled;
	}

	// 3. Known GQL command (non-gene): parse, resolve any gene term in
	//    SEARCH/WITHIN/FIND to coordinates, then execute.
	if (isKnownCommand) {
		const parsed = parseQuery(query);
		if (parsed.valid && parsed.command !== 'unknown') {
			const lookup = deps.lookup ?? lookupGene;
			await resolveQueryGeneTerms(parsed, assembly, deps.trackGenes ?? new Set(), lookup);
			return { result: exec(parsed) };
		}
	}

	// 4. Genuine natural language -> AI.
	if (!aiConfigured()) {
		return { result: message(query, false, 'Add an AI API key in Settings to use natural-language queries.'), needsAIKey: true };
	}

	let ai: TranslationResponse;
	try {
		ai = await aiTranslate(query, getAIContext());
	} catch (err) {
		return { result: message(query, false, `AI request failed: ${err instanceof Error ? err.message : String(err)}`) };
	}

	if (ai.clarificationNeeded && ai.clarificationQuestion) {
		return { result: message(query, false, ai.clarificationQuestion), naturalLanguage: query };
	}
	if (!ai.success || !ai.gql) {
		return { result: message(query, false, ai.error ?? "Couldn't translate that to a query."), naturalLanguage: query };
	}

	// The AI may have produced a gene-targeting command -> resolve it too.
	const aiGeneOutcome = await resolveGene(ai.gql, assembly);
	const aiHandled = handleGeneOutcome(aiGeneOutcome, exec, query, ai.explanation);
	if (aiHandled) return aiHandled;

	const parsed = parseQuery(ai.gql);
	const result = exec(parsed);
	result.naturalLanguage = query;
	result.reasoning = ai.explanation; // surfaced in history, not the inline bar
	return { result, naturalLanguage: query };
}

function handleGeneOutcome(
	outcome: GeneQueryOutcome,
	exec: typeof executeQuery,
	naturalLanguage?: string,
	explanation?: string
): RouteOutcome | null {
	switch (outcome.status) {
		case 'not-a-gene-query':
			return null;
		case 'none':
			return { result: message(outcome.term, false, `No genes matching "${outcome.term}" found`), naturalLanguage };
		case 'error':
			return { result: message(outcome.term, false, outcome.error), naturalLanguage };
		case 'resolved': {
			const result = exec(outcome.query);
			if (explanation) result.reasoning = explanation; // history, not inline bar
			return { result, note: `Showing ${identity(outcome.chosen)}`, chosen: outcome.chosen, naturalLanguage };
		}
		case 'multi': {
			const result = exec(outcome.query);
			if (explanation) result.reasoning = explanation;
			const others = outcome.alternatives.map((a) => a.symbol).join(', ');
			const note = `Showing ${identity(outcome.chosen)} (best match). Also found: ${others}`;
			return {
				result,
				note,
				chosen: outcome.chosen,
				naturalLanguage,
				multi: { term: outcome.term, chosen: outcome.chosen, all: [outcome.chosen, ...outcome.alternatives] }
			};
		}
	}
}

export { geneToNavigateQuery };
