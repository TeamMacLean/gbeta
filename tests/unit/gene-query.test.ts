import { describe, it, expect } from 'vitest';
import { detectGeneTerm, resolveGeneQuery } from '$lib/services/geneQuery';
import type { GeneResult } from '$lib/services/geneLookup';
import type { GenomeAssembly } from '$lib/types/genome';

const human: GenomeAssembly = {
	id: 'grch38',
	name: 'Human GRCh38',
	chromosomes: [{ name: 'chr17', length: 83257441 }],
	source: 'builtin'
};
const custom: GenomeAssembly = {
	id: 'my-genome',
	name: 'My Genome',
	chromosomes: [{ name: 'scaffold1', length: 1000 }],
	source: 'inferred'
};

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

describe('detectGeneTerm', () => {
	it('detects gene targets for navigation commands', () => {
		expect(detectGeneTerm('navigate BRCA1')).toEqual({ command: 'navigate', term: 'BRCA1' });
		expect(detectGeneTerm('go TP53')).toEqual({ command: 'go', term: 'TP53' });
		expect(detectGeneTerm('highlight MYC')).toEqual({ command: 'highlight', term: 'MYC' });
		expect(detectGeneTerm('zoom TP53')).toEqual({ command: 'zoom', term: 'TP53' });
		expect(detectGeneTerm('navigate breast cancer')).toEqual({
			command: 'navigate',
			term: 'breast cancer'
		});
	});

	it('strips a leading "to" (NAVIGATE TO / go to phrasing)', () => {
		expect(detectGeneTerm('navigate to TP53')).toEqual({ command: 'navigate', term: 'TP53' });
		expect(detectGeneTerm('go to BRCA1')).toEqual({ command: 'go', term: 'BRCA1' });
	});

	it('ignores coordinate targets', () => {
		expect(detectGeneTerm('navigate chr17:1-1000')).toBeNull();
		expect(detectGeneTerm('navigate NC_000913.3:1-1000000')).toBeNull();
		expect(detectGeneTerm('highlight chr1:5,000-6,000')).toBeNull();
	});

	it('ignores relative/factor zoom and non-nav commands', () => {
		expect(detectGeneTerm('zoom in')).toBeNull();
		expect(detectGeneTerm('zoom out')).toBeNull();
		expect(detectGeneTerm('zoom 2x')).toBeNull();
		expect(detectGeneTerm('select genes')).toBeNull();
		expect(detectGeneTerm('pan left 10kb')).toBeNull();
	});
});

describe('resolveGeneQuery', () => {
	const fakeLookup = (results: GeneResult[]) => async () => results;

	it('passes through non-gene queries', async () => {
		const out = await resolveGeneQuery('navigate chr17:1-1000', human, fakeLookup([brca1]));
		expect(out.status).toBe('not-a-gene-query');
	});

	it('resolves a single match into a navigate query framing the gene with padding', async () => {
		const out = await resolveGeneQuery('navigate BRCA1', human, fakeLookup([brca1]));
		expect(out.status).toBe('resolved');
		if (out.status !== 'resolved') return;
		expect(out.chosen.symbol).toBe('BRCA1');
		expect(out.query.command).toBe('navigate');
		const p = out.query.params as { chromosome: string; start: number; end: number };
		expect(p.chromosome).toBe('chr17');
		// View contains the gene (1-based start 43044292 -> internal 43044291) with margin on each side.
		expect(p.start).toBeLessThan(43044291);
		expect(p.end).toBeGreaterThan(43170245);
	});

	it('builds a highlight query for highlight commands', async () => {
		const out = await resolveGeneQuery('highlight BRCA1', human, fakeLookup([brca1]));
		if (out.status !== 'resolved') throw new Error('expected resolved');
		expect(out.query.command).toBe('highlight');
	});

	it('reports multi-match with chosen + alternatives', async () => {
		const out = await resolveGeneQuery('navigate BRCA', human, fakeLookup([brca1, brca2]));
		expect(out.status).toBe('multi');
		if (out.status !== 'multi') return;
		expect(out.chosen.symbol).toBe('BRCA1');
		expect(out.alternatives.map((a) => a.symbol)).toEqual(['BRCA2']);
		expect(out.query.command).toBe('navigate'); // best guess is executable
	});

	it('returns none when nothing matches', async () => {
		const out = await resolveGeneQuery('navigate zzz', human, fakeLookup([]));
		expect(out).toEqual({ status: 'none', term: 'zzz' });
	});

	it('returns error for an unsupported assembly', async () => {
		const out = await resolveGeneQuery('navigate BRCA1', custom, fakeLookup([brca1]));
		expect(out.status).toBe('error');
		if (out.status !== 'error') return;
		expect(out.error).toMatch(/not available/i);
	});

	it('surfaces lookup errors', async () => {
		const failing = async () => {
			throw new Error('MyGene lookup timed out');
		};
		const out = await resolveGeneQuery('navigate BRCA1', human, failing);
		expect(out.status).toBe('error');
		if (out.status !== 'error') return;
		expect(out.error).toMatch(/timed out/);
	});
});
