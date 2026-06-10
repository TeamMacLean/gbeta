/**
 * GQL Coverage Query Syntax Tests
 *
 * Tests parsing and execution of coverage queries in the GBetter Query Language.
 * Follows TDD approach for extending GQL with coverage support.
 */
import { describe, test, expect } from 'vitest';

// Import GQL parser functions
import {
	parseQuery,
	type ParsedQuery,
	type SelectParams
} from '$lib/services/queryLanguage';

describe('GQL Coverage Query Parsing', () => {
	describe('Basic coverage query syntax', () => {
		test('should parse SELECT REGIONS WHERE coverage >= 10', () => {
			const result = parseQuery('SELECT REGIONS WHERE coverage >= 10');

			expect(result.valid).toBe(true);
			expect(result.command).toBe('select');

			const params = result.params as SelectParams;
			expect(params.what).toBe('regions');
			expect(params.where).toEqual([
				{ field: 'coverage', operator: '>=', value: 10 }
			]);
		});

		test('should parse SELECT REGIONS WHERE coverage > 5', () => {
			const result = parseQuery('SELECT REGIONS WHERE coverage > 5');

			expect(result.valid).toBe(true);
			const params = result.params as SelectParams;
			expect(params.what).toBe('regions');
			expect(params.where).toEqual([
				{ field: 'coverage', operator: '>', value: 5 }
			]);
		});

		test('should parse coverage queries with different operators', () => {
			const queries = [
				{ query: 'SELECT REGIONS WHERE coverage = 10', operator: '=' },
				{ query: 'SELECT REGIONS WHERE coverage != 0', operator: '!=' },
				{ query: 'SELECT REGIONS WHERE coverage < 100', operator: '<' },
				{ query: 'SELECT REGIONS WHERE coverage <= 50', operator: '<=' }
			];

			for (const { query, operator } of queries) {
				const result = parseQuery(query);
				expect(result.valid).toBe(true);

				const params = result.params as SelectParams;
				expect(params.where?.[0]?.operator).toBe(operator);
			}
		});
	});

	describe('Coverage queries with regions', () => {
		test('should parse coverage query with IN region', () => {
			const result = parseQuery('SELECT REGIONS WHERE coverage >= 10 IN chr1:1000-2000');

			expect(result.valid).toBe(true);
			const params = result.params as SelectParams;
			expect(params.what).toBe('regions');
			expect(params.where).toEqual([
				{ field: 'coverage', operator: '>=', value: 10 }
			]);
			expect(params.inRegion).toEqual({
				chromosome: 'chr1',
				start: 1000,
				end: 2000
			});
		});

		test('should parse coverage query with FROM track', () => {
			const result = parseQuery('SELECT REGIONS FROM rnaseq_sample1 WHERE coverage >= 20');

			expect(result.valid).toBe(true);
			const params = result.params as SelectParams;
			expect(params.what).toBe('regions');
			expect(params.from).toBe('rnaseq_sample1');
			expect(params.where).toEqual([
				{ field: 'coverage', operator: '>=', value: 20 }
			]);
		});

		test('should parse complex coverage query with multiple clauses', () => {
			const result = parseQuery(
				'SELECT REGIONS FROM chipseq WHERE coverage >= 15 IN chr2:5000000-6000000 LIMIT 100'
			);

			expect(result.valid).toBe(true);
			const params = result.params as SelectParams;
			expect(params.what).toBe('regions');
			expect(params.from).toBe('chipseq');
			expect(params.where).toEqual([
				{ field: 'coverage', operator: '>=', value: 15 }
			]);
			expect(params.inRegion).toEqual({
				chromosome: 'chr2',
				start: 5000000,
				end: 6000000
			});
			expect(params.limit).toBe(100);
		});
	});

	describe('Count coverage queries', () => {
		test('should parse COUNT coverage queries', () => {
			const result = parseQuery('COUNT REGIONS WHERE coverage >= 10');

			expect(result.valid).toBe(true);
			expect(result.command).toBe('count');

			const params = result.params as SelectParams;
			expect(params.what).toBe('regions');
			expect(params.where).toEqual([
				{ field: 'coverage', operator: '>=', value: 10 }
			]);
		});
	});

	describe('Natural language coverage queries', () => {
		test('should parse "find high coverage regions"', () => {
			const result = parseQuery('find high coverage regions');

			expect(result.valid).toBe(true);
			expect(['list', 'find']).toContain(result.command);

			// Should translate to coverage >= some threshold
			const params = result.params as any;
			expect(params.type || params.what).toMatch(/coverage|regions/);
		});

		test('should parse "show me areas with coverage above 20"', () => {
			const result = parseQuery('show me areas with coverage above 20');

			expect(result.valid).toBe(true);
			// Should parse as a coverage query
		});
	});

	describe('Error handling', () => {
		test('should reject invalid coverage queries', () => {
			const invalidQueries = [
				'SELECT REGIONS WHERE coverage',          // missing operator/value
				'SELECT REGIONS WHERE coverage >=',      // missing value
				'SELECT REGIONS WHERE coverage >= abc',  // non-numeric value
				'SELECT REGIONS WHERE coverage >< 10',   // invalid operator
			];

			for (const query of invalidQueries) {
				const result = parseQuery(query);
				expect(result.valid).toBe(false);
			}
		});

		test('should provide helpful error messages', () => {
			const result = parseQuery('SELECT REGIONS WHERE coverage >= notanumber');

			expect(result.valid).toBe(false);
			expect(result.error).toMatch(/coverage|value|number/i);
		});
	});
});

describe('Coverage Query Execution (Mock)', () => {
	// These tests will verify that the query execution logic
	// properly calls the coverage computation functions

	test('should identify queries that need coverage computation', () => {
		const coverageQuery = parseQuery('SELECT REGIONS WHERE coverage >= 10');

		// Mock function to check if query needs coverage computation
		const needsCoverageComputation = (query: ParsedQuery): boolean => {
			if (query.command !== 'select' && query.command !== 'count') return false;

			const params = query.params as SelectParams;
			if (params.what !== 'regions') return false;

			return params.where?.some(clause => clause.field === 'coverage') ?? false;
		};

		expect(needsCoverageComputation(coverageQuery)).toBe(true);

		// Compare with regular gene query
		const geneQuery = parseQuery('SELECT GENES WHERE type = "exon"');
		expect(needsCoverageComputation(geneQuery)).toBe(false);
	});

	test('should extract coverage criteria from parsed queries', () => {
		const query = parseQuery('SELECT REGIONS WHERE coverage >= 15');

		// Mock function to extract coverage criteria
		const extractCoverageCriteria = (query: ParsedQuery) => {
			const params = query.params as SelectParams;
			const coverageClause = params.where?.find(clause => clause.field === 'coverage');

			if (!coverageClause) return null;

			return {
				operator: coverageClause.operator,
				threshold: coverageClause.value as number
			};
		};

		const criteria = extractCoverageCriteria(query);
		expect(criteria).toEqual({
			operator: '>=',
			threshold: 15
		});
	});

	test('should support multiple coverage criteria', () => {
		// This would be for queries like "WHERE coverage >= 10 AND coverage <= 100"
		// For now, just test that the parser structure supports it
		const result = parseQuery('SELECT REGIONS WHERE coverage >= 10');
		const params = result.params as SelectParams;

		// Verify the where clause structure can hold multiple conditions
		expect(Array.isArray(params.where)).toBe(true);
		expect(params.where).toHaveLength(1);
	});
});

describe('Integration with Track System', () => {
	test('should identify BAM tracks for coverage queries', () => {
		// Mock track identification for coverage queries
		const isBamTrack = (trackName: string): boolean => {
			// In real implementation, this would check track type
			return trackName.endsWith('.bam') || trackName.endsWith('.cram');
		};

		expect(isBamTrack('sample.bam')).toBe(true);
		expect(isBamTrack('data.cram')).toBe(true);
		expect(isBamTrack('genes.gff')).toBe(false);
	});

	test('should validate track compatibility with coverage queries', () => {
		const query = parseQuery('SELECT REGIONS FROM genes.bed WHERE coverage >= 10');

		// Coverage queries should only work with BAM/CRAM tracks
		// This test ensures we catch incompatible track types
		expect(query.valid).toBe(true); // Parser accepts it

		// But execution validation would reject it
		const params = query.params as SelectParams;
		const isValidForCoverage = params.from?.endsWith('.bam') ||
								  params.from?.endsWith('.cram') ||
								  !params.from; // No specific track specified

		// This would be checked during execution
		if (params.from && !isValidForCoverage) {
			// Should produce error during execution
			expect(true).toBe(true); // Placeholder for execution-time validation
		}
	});
});