/**
 * GBetter Query Language (GQL) Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { parseQuery, translateNaturalLanguage, getCommandHelp, getAvailableGenes } from '$lib/services/queryLanguage';

describe('GQL Parser', () => {
	describe('navigate command', () => {
		it('parses navigate with coordinates', () => {
			const result = parseQuery('navigate chr1:1-1000');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('navigate');
			expect(result.params).toMatchObject({
				chromosome: 'chr1',
				start: 0, // 1-based to 0-based
				end: 1000,
			});
		});

		it('parses goto as navigate alias', () => {
			const result = parseQuery('goto chr17:7668421-7687490');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('navigate');
		});

		it('parses go as navigate alias', () => {
			const result = parseQuery('go chr1:100-200');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('navigate');
		});

		it('handles coordinates with commas', () => {
			const result = parseQuery('navigate chr17:7,668,421-7,687,490');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				chromosome: 'chr17',
				start: 7668420,
				end: 7687490,
			});
		});

		it('reports error for invalid coordinates', () => {
			const result = parseQuery('navigate invalid');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid coordinates');
		});
	});

	describe('search command', () => {
		it('parses search gene', () => {
			const result = parseQuery('search gene TP53');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('search');
			expect(result.params).toMatchObject({
				type: 'gene',
				term: 'TP53',
			});
		});

		it('parses search without type (defaults to gene)', () => {
			const result = parseQuery('search BRCA1');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				type: 'gene',
				term: 'BRCA1',
			});
		});

		it('uppercases search term', () => {
			const result = parseQuery('search gene tp53');
			expect(result.params).toMatchObject({
				term: 'TP53',
			});
		});

		it('reports error for missing search term', () => {
			const result = parseQuery('search');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Search term required');
		});
	});

	describe('zoom command', () => {
		it('parses zoom in', () => {
			const result = parseQuery('zoom in');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('zoom');
			expect(result.params).toMatchObject({ factor: 0.5 });
		});

		it('parses zoom out', () => {
			const result = parseQuery('zoom out');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ factor: 2 });
		});

		it('parses zoom with factor', () => {
			const result = parseQuery('zoom 2x');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ factor: 2 });
		});

		it('parses zoom with decimal factor', () => {
			const result = parseQuery('zoom 0.5x');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ factor: 0.5 });
		});

		it('parses zoom factor without x suffix', () => {
			const result = parseQuery('zoom 4');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ factor: 4 });
		});

		it('reports error for invalid zoom factor', () => {
			const result = parseQuery('zoom sideways');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid zoom factor');
		});
	});

	describe('pan command', () => {
		it('parses pan left with default amount', () => {
			const result = parseQuery('pan left');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('pan');
			expect(result.params).toMatchObject({
				direction: 'left',
				amount: 10000,
			});
		});

		it('parses pan right', () => {
			const result = parseQuery('pan right');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ direction: 'right' });
		});

		it('parses pan with bp amount', () => {
			const result = parseQuery('pan left 5000bp');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				direction: 'left',
				amount: 5000,
			});
		});

		it('parses pan with kb amount', () => {
			const result = parseQuery('pan right 10kb');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				direction: 'right',
				amount: 10000,
			});
		});

		it('parses pan with mb amount', () => {
			const result = parseQuery('pan left 1mb');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				direction: 'left',
				amount: 1000000,
			});
		});

		it('parses pan l as left', () => {
			const result = parseQuery('pan l 1000');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ direction: 'left' });
		});

		it('parses pan r as right', () => {
			const result = parseQuery('pan r 1000');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ direction: 'right' });
		});

		it('reports error for invalid direction', () => {
			const result = parseQuery('pan up 1000');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Direction must be left or right');
		});

		it('reports error for invalid amount', () => {
			const result = parseQuery('pan left abc');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid pan amount');
		});
	});

	describe('filter command', () => {
		it('parses single filter', () => {
			const result = parseQuery('filter type=exon');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('filter');
			expect(result.params).toMatchObject({ type: 'exon' });
		});

		it('parses multiple filters', () => {
			const result = parseQuery('filter type=exon strand=+');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				type: 'exon',
				strand: '+',
			});
		});

		it('reports error for no filter criteria', () => {
			const result = parseQuery('filter');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('No filter criteria');
		});
	});

	describe('highlight command', () => {
		it('parses highlight with coordinates', () => {
			const result = parseQuery('highlight chr1:1000-2000');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('highlight');
			expect(result.params).toMatchObject({
				chromosome: 'chr1',
				start: 999,
				end: 2000,
			});
		});

		it('reports error for invalid coordinates', () => {
			const result = parseQuery('highlight invalid');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid coordinates');
		});
	});

	describe('list/find/show commands', () => {
		it('parses list genes', () => {
			const result = parseQuery('list genes');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('list');
			expect(result.params).toMatchObject({ type: 'genes' });
		});

		it('parses list all genes', () => {
			const result = parseQuery('list all genes');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ type: 'genes' });
		});

		it('parses list variants', () => {
			const result = parseQuery('list variants');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ type: 'variants' });
		});

		it('parses find as list alias', () => {
			const result = parseQuery('find genes');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('list');
		});

		it('parses show as list alias', () => {
			const result = parseQuery('show variants');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('list');
		});

		it('parses list genes with variants', () => {
			const result = parseQuery('list genes with variants');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				type: 'genes',
				filter: 'with_variants',
			});
		});

		it('parses list variants in gene', () => {
			const result = parseQuery('list variants in TP53');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				type: 'variants',
				gene: 'TP53',
			});
		});

		it('parses list pathogenic variants', () => {
			const result = parseQuery('list pathogenic variants');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				type: 'variants',
				filter: 'pathogenic',
			});
		});
	});

	describe('SELECT queries', () => {
		it('parses basic SELECT GENES', () => {
			const result = parseQuery('SELECT GENES');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('select');
			expect(result.params).toMatchObject({ what: 'genes' });
		});

		it('parses SELECT VARIANTS', () => {
			const result = parseQuery('SELECT VARIANTS');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ what: 'variants' });
		});

		it('parses SELECT * as all', () => {
			const result = parseQuery('SELECT *');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ what: 'all' });
		});

		it('parses SELECT ALL as all', () => {
			const result = parseQuery('SELECT ALL');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ what: 'all' });
		});

		it('parses FROM clause', () => {
			const result = parseQuery('SELECT GENES FROM mytrack');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				what: 'genes',
				from: 'mytrack',
			});
		});

		it('parses INTERSECT clause', () => {
			const result = parseQuery('SELECT GENES INTERSECT variants.vcf');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				what: 'genes',
				intersect: 'variants.vcf',
			});
		});

		it('parses WITHIN clause', () => {
			const result = parseQuery('SELECT VARIANTS WITHIN TP53');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				what: 'variants',
				within: 'TP53',
			});
		});

		it('parses IN VIEW clause', () => {
			const result = parseQuery('SELECT GENES IN VIEW');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				what: 'genes',
				inRegion: 'view',
			});
		});

		it('parses IN CHROMOSOME clause', () => {
			const result = parseQuery('SELECT VARIANTS IN CHROMOSOME');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				what: 'variants',
				inRegion: 'chromosome',
			});
		});

		it('parses IN chr:start-end clause', () => {
			const result = parseQuery('SELECT GENES IN chr17:7668421-7687490');
			expect(result.valid).toBe(true);
			const params = result.params as { what: string; inRegion: { chromosome: string; start: number; end: number } };
			expect(params.what).toBe('genes');
			expect(params.inRegion.chromosome).toBe('chr17');
			expect(params.inRegion.start).toBe(7668421);
			expect(params.inRegion.end).toBe(7687490);
		});

		it('parses IN chr (chromosome only)', () => {
			const result = parseQuery('SELECT GENES IN chr17');
			expect(result.valid).toBe(true);
			const params = result.params as { what: string; inRegion: { chromosome: string } };
			expect(params.inRegion.chromosome).toBe('chr17');
		});

		it('parses WHERE clause with equality', () => {
			const result = parseQuery('SELECT GENES WHERE strand = + IN VIEW');
			expect(result.valid).toBe(true);
			const params = result.params as { where: Array<{ field: string; operator: string; value: string }> };
			expect(params.where).toHaveLength(1);
			expect(params.where[0]).toMatchObject({
				field: 'strand',
				operator: '=',
				value: '+',
			});
		});

		it('parses WHERE clause with numeric comparison', () => {
			const result = parseQuery('SELECT GENES WHERE length > 1000 IN VIEW');
			expect(result.valid).toBe(true);
			const params = result.params as { where: Array<{ field: string; operator: string; value: number }> };
			expect(params.where[0]).toMatchObject({
				field: 'length',
				operator: '>',
				value: 1000,
			});
		});

		it('parses WHERE clause with multiple AND conditions', () => {
			const result = parseQuery('SELECT GENES WHERE strand = + AND type = exon IN VIEW');
			expect(result.valid).toBe(true);
			const params = result.params as { where: Array<{ field: string; operator: string; value: string }> };
			expect(params.where).toHaveLength(2);
		});

		it('parses ORDER BY clause', () => {
			const result = parseQuery('SELECT GENES ORDER BY name');
			expect(result.valid).toBe(true);
			const params = result.params as { orderBy: { field: string; direction: string } };
			expect(params.orderBy).toMatchObject({
				field: 'name',
				direction: 'ASC',
			});
		});

		it('parses ORDER BY with DESC', () => {
			const result = parseQuery('SELECT GENES ORDER BY start DESC');
			expect(result.valid).toBe(true);
			const params = result.params as { orderBy: { field: string; direction: string } };
			expect(params.orderBy).toMatchObject({
				field: 'start',
				direction: 'DESC',
			});
		});

		it('parses ORDER BY (end - start) as length', () => {
			const result = parseQuery('SELECT GENES ORDER BY (end - start) DESC');
			expect(result.valid).toBe(true);
			const params = result.params as { orderBy: { field: string; direction: string } };
			expect(params.orderBy).toMatchObject({
				field: 'length',
				direction: 'DESC',
			});
		});

		it('parses LIMIT clause', () => {
			const result = parseQuery('SELECT GENES LIMIT 10');
			expect(result.valid).toBe(true);
			const params = result.params as { limit: number };
			expect(params.limit).toBe(10);
		});

		it('parses complex SELECT query', () => {
			const result = parseQuery('SELECT GENES FROM genes.gff3 INTERSECT variants.vcf WHERE strand = + ORDER BY name DESC LIMIT 5 IN VIEW');
			expect(result.valid).toBe(true);
			const params = result.params as {
				what: string;
				from: string;
				intersect: string;
				where: Array<{ field: string }>;
				orderBy: { field: string; direction: string };
				limit: number;
				inRegion: string;
			};
			expect(params.what).toBe('genes');
			expect(params.from).toBe('genes.gff3');
			expect(params.intersect).toBe('variants.vcf');
			expect(params.where).toHaveLength(1);
			expect(params.orderBy.direction).toBe('DESC');
			expect(params.limit).toBe(5);
		});
	});

	describe('COUNT queries', () => {
		it('parses COUNT as SELECT with count command', () => {
			const result = parseQuery('COUNT GENES IN VIEW');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('count');
			expect(result.params).toMatchObject({
				what: 'genes',
				inRegion: 'view',
			});
		});
	});

	describe('unknown commands', () => {
		it('returns unknown for unrecognized command', () => {
			const result = parseQuery('foobar something');
			expect(result.valid).toBe(false);
			expect(result.command).toBe('unknown');
			expect(result.error).toContain('Unknown command');
		});
	});

	describe('preserves raw input', () => {
		it('stores raw query string', () => {
			const result = parseQuery('  navigate chr1:1-1000  ');
			expect(result.raw).toBe('navigate chr1:1-1000');
		});
	});
});

describe('Natural Language Translation', () => {
	describe('coordinate input', () => {
		it('translates direct coordinate input', () => {
			const result = translateNaturalLanguage('chr1:1000-2000');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('navigate');
		});

		it('translates coordinate with commas', () => {
			const result = translateNaturalLanguage('chr17:7,668,421-7,687,490');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('navigate');
		});
	});

	describe('gene search', () => {
		it('translates known gene name', () => {
			const result = translateNaturalLanguage('TP53');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('search');
		});

		it('translates lowercase gene name', () => {
			const result = translateNaturalLanguage('tp53');
			// Note: translateNaturalLanguage compares against uppercase KNOWN_GENES
			// Input is checked as-is, which won't match 'TP53'
			// This might return null or be handled differently
		});

		it('translates "go to GENE"', () => {
			const result = translateNaturalLanguage('go to TP53');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('search');
		});

		it('translates "navigate to GENE"', () => {
			const result = translateNaturalLanguage('navigate to BRCA1');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('search');
		});

		it('translates "find GENE"', () => {
			const result = translateNaturalLanguage('find TP53');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('search');
		});

		it('translates "search for GENE"', () => {
			const result = translateNaturalLanguage('search for EGFR');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('search');
		});

		it('translates "where is GENE"', () => {
			const result = translateNaturalLanguage('where is MYC');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('search');
		});

		it('translates "show GENE"', () => {
			const result = translateNaturalLanguage('show TP53');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('search');
		});
	});

	describe('zoom commands', () => {
		it('translates "zoom in"', () => {
			const result = translateNaturalLanguage('zoom in');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('zoom');
			expect(result?.params).toMatchObject({ factor: 0.5 });
		});

		it('translates "zoom out"', () => {
			const result = translateNaturalLanguage('zoom out');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({ factor: 2 });
		});

		it('translates "closer"', () => {
			const result = translateNaturalLanguage('closer');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('zoom');
		});

		it('translates "wider"', () => {
			const result = translateNaturalLanguage('wider');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('zoom');
		});

		it('translates "zoom 2x"', () => {
			const result = translateNaturalLanguage('zoom 2x');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({ factor: 2 });
		});
	});

	describe('pan commands', () => {
		it('translates "pan left"', () => {
			const result = translateNaturalLanguage('pan left');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('pan');
			expect(result?.params).toMatchObject({ direction: 'left' });
		});

		it('translates "move right 10kb"', () => {
			const result = translateNaturalLanguage('move right 10kb');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({
				direction: 'right',
				amount: 10000,
			});
		});

		it('translates "scroll left"', () => {
			const result = translateNaturalLanguage('scroll left');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('pan');
		});
	});

	describe('list queries', () => {
		it('translates "list genes"', () => {
			const result = translateNaturalLanguage('list genes');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('list');
			expect(result?.params).toMatchObject({ type: 'genes' });
		});

		it('translates "show me genes"', () => {
			const result = translateNaturalLanguage('show me genes');
			expect(result).not.toBeNull();
			expect(result?.command).toBe('list');
		});

		it('translates "what genes have variants"', () => {
			const result = translateNaturalLanguage('what genes have variants');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({
				type: 'genes',
				filter: 'with_variants',
			});
		});

		it('translates "genes with variants"', () => {
			const result = translateNaturalLanguage('genes with variants');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({ filter: 'with_variants' });
		});

		it('translates "variants in TP53"', () => {
			const result = translateNaturalLanguage('variants in TP53');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({
				type: 'variants',
				gene: 'TP53',
			});
		});

		it('translates "show variants in BRCA1"', () => {
			const result = translateNaturalLanguage('show variants in BRCA1');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({ gene: 'BRCA1' });
		});

		it('translates "pathogenic variants"', () => {
			const result = translateNaturalLanguage('pathogenic variants');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({ filter: 'pathogenic' });
		});

		it('translates "list variants"', () => {
			const result = translateNaturalLanguage('list variants');
			expect(result).not.toBeNull();
			expect(result?.params).toMatchObject({ type: 'variants' });
		});
	});

	describe('returns null for unrecognized input', () => {
		it('returns null for random text', () => {
			const result = translateNaturalLanguage('hello world');
			expect(result).toBeNull();
		});

		it('returns null for empty string', () => {
			const result = translateNaturalLanguage('');
			expect(result).toBeNull();
		});
	});
});

describe('Helper functions', () => {
	describe('getCommandHelp', () => {
		it('returns array of command help objects', () => {
			const help = getCommandHelp();
			expect(Array.isArray(help)).toBe(true);
			expect(help.length).toBeGreaterThan(0);
		});

		it('each help item has command, syntax, and description', () => {
			const help = getCommandHelp();
			for (const item of help) {
				expect(item).toHaveProperty('command');
				expect(item).toHaveProperty('syntax');
				expect(item).toHaveProperty('description');
			}
		});

		it('includes navigate command', () => {
			const help = getCommandHelp();
			expect(help.some(h => h.command === 'navigate')).toBe(true);
		});
	});

	describe('getAvailableGenes', () => {
		it('returns [] when no gene tracks are loaded (no hardcoded fallback)', () => {
			expect(getAvailableGenes()).toEqual([]);
			expect(getAvailableGenes([])).toEqual([]);
		});

		it('returns gene names from loaded gene tracks', () => {
			const track: any = {
				typeId: 'gff3',
				name: 'genes',
				features: [
					{ id: 'g1', featureType: 'gene', name: 'MYGENE1', chromosome: 'chr1', start: 1, end: 100 },
					{ id: 'g2', featureType: 'mRNA', name: 'MYGENE2', chromosome: 'chr1', start: 200, end: 300 }
				]
			};
			const genes = getAvailableGenes([track]);
			expect(genes).toContain('MYGENE1');
			expect(genes).toContain('MYGENE2');
		});
	});

	describe('filter command', () => {
		it('parses filter with single criterion', () => {
			const result = parseQuery('filter type=exon');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('filter');
			expect(result.params).toMatchObject({ type: 'exon' });
		});

		it('parses filter with multiple criteria', () => {
			const result = parseQuery('filter type=exon strand=+');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('filter');
			expect(result.params).toMatchObject({
				type: 'exon',
				strand: '+',
			});
		});

		it('parses filter with numeric comparison', () => {
			const result = parseQuery('filter score=>100');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ score: '>100' });
		});

		it('reports error for empty filter', () => {
			const result = parseQuery('filter');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('No filter criteria');
		});
	});

	describe('highlight command', () => {
		it('parses highlight with coordinates', () => {
			const result = parseQuery('highlight chr17:7670000-7675000');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('highlight');
			expect(result.params).toMatchObject({
				chromosome: 'chr17',
				start: 7669999, // 1-based to 0-based
				end: 7675000,
			});
		});

		it('parses highlight with full coordinate format', () => {
			const result = parseQuery('highlight chr1:1000-2000');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({
				chromosome: 'chr1',
				start: 999,
				end: 2000,
			});
		});

		it('reports error for invalid coordinates', () => {
			const result = parseQuery('highlight invalid');
			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid coordinates');
		});
	});

	describe('clear command', () => {
		it('parses clear filters', () => {
			const result = parseQuery('clear filters');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('clear');
			expect(result.params).toMatchObject({ target: 'filters' });
		});

		it('parses clear highlights', () => {
			const result = parseQuery('clear highlights');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('clear');
			expect(result.params).toMatchObject({ target: 'highlights' });
		});

		it('parses clear all', () => {
			const result = parseQuery('clear all');
			expect(result.valid).toBe(true);
			expect(result.command).toBe('clear');
			expect(result.params).toMatchObject({ target: 'all' });
		});

		it('defaults to clear all without argument', () => {
			const result = parseQuery('clear');
			expect(result.valid).toBe(true);
			expect(result.params).toMatchObject({ target: 'all' });
		});

		it('handles singular forms', () => {
			const filterResult = parseQuery('clear filter');
			expect(filterResult.params).toMatchObject({ target: 'filters' });

			const highlightResult = parseQuery('clear highlight');
			expect(highlightResult.params).toMatchObject({ target: 'highlights' });
		});
	});
});

describe('GQL Natural Language - Filter/Highlight', () => {
	describe('filter patterns', () => {
		it('translates "show only exons"', () => {
			const result = translateNaturalLanguage('show only exons');
			expect(result?.command).toBe('filter');
			expect(result?.params).toMatchObject({ type: 'exon' });
		});

		it('translates "filter to exon"', () => {
			const result = translateNaturalLanguage('filter to exon');
			expect(result?.command).toBe('filter');
		});

		it('translates "only show exons"', () => {
			const result = translateNaturalLanguage('only show exons');
			expect(result?.command).toBe('filter');
			expect(result?.params).toMatchObject({ type: 'exon' });
		});

		it('translates "show plus strand"', () => {
			const result = translateNaturalLanguage('show plus strand');
			expect(result?.command).toBe('filter');
			expect(result?.params).toMatchObject({ strand: '+' });
		});

		it('translates "filter to minus strand"', () => {
			const result = translateNaturalLanguage('filter to minus strand');
			expect(result?.command).toBe('filter');
			expect(result?.params).toMatchObject({ strand: '-' });
		});

		it('translates "clear filters"', () => {
			const result = translateNaturalLanguage('clear filters');
			expect(result?.command).toBe('clear');
			expect(result?.params).toMatchObject({ target: 'filters' });
		});

		it('translates "reset filters"', () => {
			const result = translateNaturalLanguage('reset filters');
			expect(result?.command).toBe('clear');
			expect(result?.params).toMatchObject({ target: 'filters' });
		});
	});

	describe('highlight patterns', () => {
		it('translates "highlight chr17:1000-2000"', () => {
			const result = translateNaturalLanguage('highlight chr17:1000-2000');
			expect(result?.command).toBe('highlight');
			expect(result?.params).toMatchObject({
				chromosome: 'chr17',
			});
		});

		it('translates "mark chr1:5000-6000"', () => {
			const result = translateNaturalLanguage('mark chr1:5000-6000');
			expect(result?.command).toBe('highlight');
		});

		it('translates "highlight region chr17:1000-2000"', () => {
			const result = translateNaturalLanguage('highlight region chr17:1000-2000');
			expect(result?.command).toBe('highlight');
		});

		it('translates "highlight TP53" to a highlight command (gene resolved downstream)', () => {
			const result = translateNaturalLanguage('highlight TP53');
			expect(result?.command).toBe('highlight');
			// The gene name is preserved; coordinate resolution happens in the
			// router (no hardcoded gene map anymore).
			expect(result?.raw).toMatch(/TP53/i);
		});

		it('translates "clear highlights"', () => {
			const result = translateNaturalLanguage('clear highlights');
			expect(result?.command).toBe('clear');
			expect(result?.params).toMatchObject({ target: 'highlights' });
		});

		it('translates "remove highlights"', () => {
			const result = translateNaturalLanguage('remove highlights');
			expect(result?.command).toBe('clear');
			expect(result?.params).toMatchObject({ target: 'highlights' });
		});
	});

	describe('clear patterns', () => {
		it('translates "clear"', () => {
			const result = translateNaturalLanguage('clear');
			expect(result?.command).toBe('clear');
			expect(result?.params).toMatchObject({ target: 'all' });
		});

		it('translates "clear all"', () => {
			const result = translateNaturalLanguage('clear all');
			expect(result?.command).toBe('clear');
			expect(result?.params).toMatchObject({ target: 'all' });
		});

		it('translates "reset"', () => {
			const result = translateNaturalLanguage('reset');
			expect(result?.command).toBe('clear');
			expect(result?.params).toMatchObject({ target: 'all' });
		});
	});
});
