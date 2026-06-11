import { describe, it, expect, vi } from 'vitest';
import { routeQuery, type RouteDeps } from '$lib/services/queryRouter';
import type { GeneQueryOutcome } from '$lib/services/geneQuery';
import type { GeneResult } from '$lib/services/geneLookup';
import type { QueryResult } from '$lib/services/queryLanguage';
import type { GenomeAssembly } from '$lib/types/genome';
import type { BrowserContext, TranslationResponse } from '$lib/services/ai/types';

const human: GenomeAssembly = {
	id: 'grch38',
	name: 'Human GRCh38',
	chromosomes: [{ name: 'chr17', length: 83257441 }],
	source: 'builtin'
};
const ctx = () => ({}) as BrowserContext;

const brca1: GeneResult = {
	symbol: 'BRCA1',
	name: 'BRCA1 DNA repair associated',
	chromosome: 'chr17',
	start: 43044292,
	end: 43170245,
	strand: '-',
	source: 'mygene'
};
const brca2: GeneResult = { ...brca1, symbol: 'BRCA2', chromosome: 'chr13', start: 32315086, end: 32400266 };

// exec stub: echoes the query it executed, marking navigation success.
const execStub = vi.fn(
	(q): QueryResult => ({ success: true, query: q, message: 'ok', timestamp: 0 })
);

function deps(overrides: Partial<RouteDeps> = {}): RouteDeps {
	return {
		exec: execStub,
		aiConfigured: () => false,
		aiTranslate: async () => ({ success: false }) as TranslationResponse,
		resolveGene: async () => ({ status: 'not-a-gene-query' }) as GeneQueryOutcome,
		...overrides
	};
}

describe('routeQuery', () => {
	it('navigates directly for coordinates (no gene lookup, no AI)', async () => {
		execStub.mockClear();
		const out = await routeQuery('chr17:1-1000', human, ctx, deps());
		expect(out.result.success).toBe(true);
		expect(execStub).toHaveBeenCalledTimes(1);
		expect(execStub.mock.calls[0][0].command).toBe('navigate');
	});

	it('resolves a single gene match with a "Showing" note', async () => {
		const out = await routeQuery('BRCA1', human, ctx, deps({
			resolveGene: async () => ({ status: 'resolved', term: 'BRCA1', chosen: brca1, query: { command: 'navigate', raw: 'navigate BRCA1', params: {}, valid: true } })
		}));
		expect(out.note).toMatch(/Showing BRCA1/);
		expect(out.multi).toBeUndefined();
	});

	it('reports multi-match (best guess + alternatives + picker data)', async () => {
		const out = await routeQuery('BRCA', human, ctx, deps({
			resolveGene: async () => ({ status: 'multi', term: 'BRCA', chosen: brca1, alternatives: [brca2], query: { command: 'navigate', raw: 'navigate BRCA', params: {}, valid: true } })
		}));
		expect(out.note).toMatch(/best match/);
		expect(out.note).toMatch(/BRCA2/);
		expect(out.multi?.all.map((g) => g.symbol)).toEqual(['BRCA1', 'BRCA2']);
	});

	it('returns a no-match message', async () => {
		const out = await routeQuery('zzz', human, ctx, deps({
			resolveGene: async () => ({ status: 'none', term: 'zzz' })
		}));
		expect(out.result.success).toBe(false);
		expect(out.result.message).toMatch(/No genes matching/);
	});

	it('resolves a gene in SELECT WITHIN to coordinates (no hardcoded map)', async () => {
		execStub.mockClear();
		const lookup = vi.fn(async () => [brca1]);
		await routeQuery('SELECT * WITHIN BRCA1', human, ctx, deps({ lookup }));
		expect(lookup).toHaveBeenCalledWith('BRCA1', human);
		const executed = execStub.mock.calls[0][0];
		expect(executed.resolvedRegion).toMatchObject({ chromosome: 'chr17', start: 43044291, end: 43170245 });
	});

	it('skips the lookup when the WITHIN gene is already in a loaded track', async () => {
		const lookup = vi.fn(async () => [brca1]);
		await routeQuery('SELECT * WITHIN BRCA1', human, ctx, deps({ lookup, trackGenes: new Set(['BRCA1']) }));
		expect(lookup).not.toHaveBeenCalled();
	});

	it('does not look up a WITHIN coordinate', async () => {
		const lookup = vi.fn(async () => [brca1]);
		await routeQuery('SELECT * WITHIN chr1:1-1000', human, ctx, deps({ lookup }));
		expect(lookup).not.toHaveBeenCalled();
	});

	it('resolves a SEARCH gene term to a region', async () => {
		execStub.mockClear();
		const lookup = vi.fn(async () => [brca1]);
		await routeQuery('search gene BRCA1', human, ctx, deps({ lookup }));
		const executed = execStub.mock.calls[0][0];
		expect(executed.command).toBe('search');
		expect(executed.resolvedRegion).toBeTruthy();
	});

	it('executes a known non-gene GQL command', async () => {
		execStub.mockClear();
		const out = await routeQuery('select genes', human, ctx, deps());
		expect(execStub).toHaveBeenCalledTimes(1);
		expect((execStub.mock.calls[0][0]).command).toBe('select');
		expect(out.result.success).toBe(true);
	});

	it('prompts for an API key when NL needs the AI but none is configured', async () => {
		// NL that doesn't start with a GQL command keyword (show/find/go/...).
		// It must NOT be looked up literally as a gene — it goes to the AI path.
		const resolveGene = vi.fn(async () => ({ status: 'none', term: 'x' }) as GeneQueryOutcome);
		const out = await routeQuery('what is the tumour suppressor here', human, ctx, deps({ aiConfigured: () => false, resolveGene }));
		expect(resolveGene).not.toHaveBeenCalled(); // multi-word NL bypasses direct lookup
		expect(out.needsAIKey).toBe(true);
		expect(out.result.message).toMatch(/API key/i);
	});

	it('sends genuine NL to the AI and executes the returned GQL', async () => {
		execStub.mockClear();
		const aiTranslate = vi.fn(async () => ({ success: true, gql: 'select genes', explanation: 'Listing genes' }) as TranslationResponse);
		const out = await routeQuery('what genes are here', human, ctx, deps({ aiConfigured: () => true, aiTranslate }));
		expect(aiTranslate).toHaveBeenCalledTimes(1);
		expect(out.naturalLanguage).toBe('what genes are here');
		expect(out.note).toBeUndefined(); // reasoning lives in history, not the inline bar
		expect(out.result.reasoning).toBe('Listing genes');
		expect(execStub).toHaveBeenCalled();
	});

	it('resolves a gene name the AI emits (AI -> NAVIGATE BRCA1 -> coords)', async () => {
		// Multi-word NL skips the direct lookup (step 2), so resolveGene is only
		// called once — on the AI-produced GQL.
		const resolveGene = vi.fn()
			.mockResolvedValue({ status: 'resolved', term: 'BRCA1', chosen: brca1, query: { command: 'navigate', raw: 'navigate BRCA1', params: {}, valid: true } });
		const aiTranslate = vi.fn(async () => ({ success: true, gql: 'navigate BRCA1', explanation: 'Going to BRCA1' }) as TranslationResponse);
		const out = await routeQuery('take me to the breast cancer gene', human, ctx, deps({ aiConfigured: () => true, aiTranslate, resolveGene }));
		expect(out.note).toMatch(/Showing BRCA1/); // inline = compact identity
		expect(out.result.reasoning).toBe('Going to BRCA1'); // AI summary -> history
		expect(out.chosen?.symbol).toBe('BRCA1'); // surfaced for highlighting
		expect(out.naturalLanguage).toBe('take me to the breast cancer gene');
	});
});
