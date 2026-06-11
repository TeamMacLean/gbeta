/**
 * GBetter Query Language (GQL)
 * A simple, reproducible query language for genome browser operations
 *
 * Syntax:
 *   navigate chr17:7668421-7687490
 *   search gene TP53
 *   zoom in|out|2x|0.5x
 *   pan left|right 1000|1000bp|1kb
 *   filter type=exon strand=+
 *   highlight chr17:7670000-7675000
 */

import { useViewport } from '$lib/stores/viewport.svelte';
import { useTracks, type FilterCriteria } from '$lib/stores/tracks.svelte';
import { parseCoordinate } from '$lib/types/genome';
import type { LoadedTrack, GeneModelFeature, VariantFeature } from '$lib/types/tracks';
import { queryBamCoverage, type CoverageRegion } from './bam';

export type QueryCommand =
	| 'navigate'
	| 'goto'
	| 'go'
	| 'search'
	| 'zoom'
	| 'pan'
	| 'filter'
	| 'highlight'
	| 'clear'
	| 'list'
	| 'find'
	| 'show'
	| 'select'
	| 'count'
	| 'unknown';

export interface SelectParams {
	what: 'genes' | 'variants' | 'features' | 'regions' | 'all';
	from?: string;           // Track name
	where?: WhereClause[];   // WHERE conditions
	intersect?: string;      // INTERSECT track name
	within?: string;         // WITHIN gene/region
	inRegion?: 'view' | 'chromosome' | { chromosome: string; start?: number; end?: number };
	orderBy?: { field: string; direction: 'ASC' | 'DESC' };
	limit?: number;
}

export interface WhereClause {
	field: string;
	operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'matches';
	value: string | number | boolean;
}

export interface ParsedQuery {
	command: QueryCommand;
	raw: string;
	params: Record<string, string | number | boolean> | SelectParams;
	valid: boolean;
	error?: string;
}

export interface ListResultItem {
	id: string;
	name: string;
	chromosome: string;
	start: number;
	end: number;
	type?: string;
	details?: Record<string, string>;
}

export interface QueryResult {
	success: boolean;
	query: ParsedQuery;
	message: string;
	timestamp: number;
	naturalLanguage?: string; // Original natural language input if translated
	reasoning?: string; // AI's one-line summary of how it interpreted the request
	results?: ListResultItem[]; // For list/find commands
	showResultPanel?: boolean; // Whether to show result panel
}

// Known genes for search (placeholder - would be loaded from index)
const KNOWN_GENES: Record<string, { chr: string; start: number; end: number }> = {
	'TP53': { chr: 'chr17', start: 7668421, end: 7687490 },
	'BRCA1': { chr: 'chr17', start: 43044295, end: 43170245 },
	'BRCA2': { chr: 'chr13', start: 32315086, end: 32400266 },
	'EGFR': { chr: 'chr7', start: 55019017, end: 55211628 },
	'MYC': { chr: 'chr8', start: 127735434, end: 127742951 },
	'KRAS': { chr: 'chr12', start: 25205246, end: 25250936 },
	'PIK3CA': { chr: 'chr3', start: 179148114, end: 179240093 },
	'APC': { chr: 'chr5', start: 112707498, end: 112846239 },
	'PTEN': { chr: 'chr10', start: 87863438, end: 87971930 },
	'RB1': { chr: 'chr13', start: 48303747, end: 48481890 },
};

/**
 * Parse a GQL command string
 */
export function parseQuery(input: string): ParsedQuery {
	const raw = input.trim();
	const parts = raw.split(/\s+/);
	const command = parts[0]?.toLowerCase() as QueryCommand;

	switch (command) {
		case 'navigate':
		case 'goto':
		case 'go': {
			const coord = parts.slice(1).join('');
			const parsed = parseCoordinate(coord);
			if (parsed) {
				return {
					command: 'navigate',
					raw,
					params: { chromosome: parsed.chromosome, start: parsed.start, end: parsed.end },
					valid: true
				};
			}
			return { command: 'navigate', raw, params: {}, valid: false, error: 'Invalid coordinates' };
		}

		case 'search': {
			const searchType = parts[1]?.toLowerCase();
			const searchTerm = parts.slice(2).join(' ');
			if (searchType === 'gene' && searchTerm) {
				return {
					command: 'search',
					raw,
					params: { type: 'gene', term: searchTerm.toUpperCase() },
					valid: true
				};
			}
			// Default to gene search
			const term = parts.slice(1).join(' ');
			if (term) {
				return {
					command: 'search',
					raw,
					params: { type: 'gene', term: term.toUpperCase() },
					valid: true
				};
			}
			return { command: 'search', raw, params: {}, valid: false, error: 'Search term required' };
		}

		case 'zoom': {
			const arg = parts[1]?.toLowerCase();
			if (arg === 'in') {
				return { command: 'zoom', raw, params: { factor: 0.5 }, valid: true };
			}
			if (arg === 'out') {
				return { command: 'zoom', raw, params: { factor: 2 }, valid: true };
			}
			// Parse factor like "2x" or "0.5x"
			const factorMatch = arg?.match(/^(\d*\.?\d+)x?$/);
			if (factorMatch) {
				return { command: 'zoom', raw, params: { factor: parseFloat(factorMatch[1]) }, valid: true };
			}
			return { command: 'zoom', raw, params: {}, valid: false, error: 'Invalid zoom factor' };
		}

		case 'pan': {
			const direction = parts[1]?.toLowerCase();
			const amountStr = parts[2] || '10000';
			// Parse amount with optional unit (bp, kb, mb)
			const amountMatch = amountStr.match(/^(\d+)(bp|kb|mb)?$/i);
			if (!amountMatch) {
				return { command: 'pan', raw, params: {}, valid: false, error: 'Invalid pan amount' };
			}
			let amount = parseInt(amountMatch[1], 10);
			const unit = amountMatch[2]?.toLowerCase();
			if (unit === 'kb') amount *= 1000;
			if (unit === 'mb') amount *= 1000000;

			if (direction === 'left' || direction === 'l') {
				return { command: 'pan', raw, params: { direction: 'left', amount }, valid: true };
			}
			if (direction === 'right' || direction === 'r') {
				return { command: 'pan', raw, params: { direction: 'right', amount }, valid: true };
			}
			return { command: 'pan', raw, params: {}, valid: false, error: 'Direction must be left or right' };
		}

		case 'filter': {
			// Parse field/operator/value tokens. Capture the comparison operator
			// explicitly so "score>=100" keeps the >= (splitting on '=' mangled it
			// into a "score>" key). The value carries the operator prefix that the
			// executor expects (e.g. ">=100").
			const filters: Record<string, string> = {};
			const filterRe = /^([A-Za-z_][\w.]*)\s*(>=|<=|!=|>|<|=)\s*(.+)$/;
			for (let i = 1; i < parts.length; i++) {
				const m = parts[i].match(filterRe);
				if (m) {
					const [, field, op, value] = m;
					filters[field] = op === '=' ? value : op + value;
				}
			}
			if (Object.keys(filters).length > 0) {
				return { command: 'filter', raw, params: filters, valid: true };
			}
			return { command: 'filter', raw, params: {}, valid: false, error: 'No filter criteria' };
		}

		case 'highlight': {
			const coord = parts.slice(1).join('');
			const parsed = parseCoordinate(coord);
			if (parsed) {
				return {
					command: 'highlight',
					raw,
					params: { chromosome: parsed.chromosome, start: parsed.start, end: parsed.end },
					valid: true
				};
			}
			return { command: 'highlight', raw, params: {}, valid: false, error: 'Invalid coordinates' };
		}

		case 'clear': {
			const target = parts[1]?.toLowerCase();
			if (target === 'filters' || target === 'filter') {
				return { command: 'clear', raw, params: { target: 'filters' }, valid: true };
			}
			if (target === 'highlights' || target === 'highlight') {
				return { command: 'clear', raw, params: { target: 'highlights' }, valid: true };
			}
			if (target === 'all') {
				return { command: 'clear', raw, params: { target: 'all' }, valid: true };
			}
			// Default: clear all
			return { command: 'clear', raw, params: { target: 'all' }, valid: true };
		}

		case 'list':
		case 'find':
		case 'show': {
			// Parse "list genes with variants", "find variants in TP53", etc.
			const restOfQuery = parts.slice(1).join(' ').toLowerCase();

			// "list genes" or "list all genes"
			if (restOfQuery.match(/^(all\s+)?genes$/)) {
				return { command: 'list', raw, params: { type: 'genes' }, valid: true };
			}

			// "list variants" or "list all variants"
			if (restOfQuery.match(/^(all\s+)?variants$/)) {
				return { command: 'list', raw, params: { type: 'variants' }, valid: true };
			}

			// "list genes with variants" or "find genes with variants"
			if (restOfQuery.match(/genes?\s+with\s+variants?/)) {
				return { command: 'list', raw, params: { type: 'genes', filter: 'with_variants' }, valid: true };
			}

			// "list variants in GENE" or "find variants in GENE"
			const variantsInMatch = restOfQuery.match(/variants?\s+in\s+(\w+)/);
			if (variantsInMatch) {
				return { command: 'list', raw, params: { type: 'variants', gene: variantsInMatch[1].toUpperCase() }, valid: true };
			}

			// "list pathogenic variants"
			if (restOfQuery.match(/pathogenic\s+variants?/)) {
				return { command: 'list', raw, params: { type: 'variants', filter: 'pathogenic' }, valid: true };
			}

			// "find high coverage regions" or "list high coverage areas"
			if (restOfQuery.match(/(high\s+)?coverage\s+(regions?|areas?)/)) {
				return { command: 'list', raw, params: { type: 'coverage', filter: 'high' }, valid: true };
			}

			// "show me areas with coverage above X"
			const coverageThresholdMatch = restOfQuery.match(/areas?\s+with\s+coverage\s+(above|over|>=|>)\s+(\d+)/);
			if (coverageThresholdMatch) {
				const threshold = parseInt(coverageThresholdMatch[2], 10);
				return { command: 'list', raw, params: { type: 'coverage', threshold }, valid: true };
			}

			// Generic list with type
			const typeMatch = restOfQuery.match(/^(\w+)$/);
			if (typeMatch) {
				return { command: 'list', raw, params: { type: typeMatch[1] }, valid: true };
			}

			return { command: 'list', raw, params: { query: restOfQuery }, valid: true };
		}

		case 'select': {
			// Parse SELECT statements: SELECT GENES/VARIANTS/FEATURES [FROM track] [INTERSECT track] [WHERE conditions] [IN region/VIEW]
			return parseSelectQuery(raw);
		}

		case 'count': {
			// COUNT is like SELECT but returns count
			const selectResult = parseSelectQuery(raw.replace(/^count/i, 'SELECT'));
			if (selectResult.valid) {
				return { ...selectResult, command: 'count' };
			}
			return selectResult;
		}

		default:
			return { command: 'unknown', raw, params: {}, valid: false, error: 'Unknown command' };
	}
}

/**
 * Parse a SELECT query into structured params
 * SELECT GENES/VARIANTS/FEATURES [FROM track] [INTERSECT track] [WHERE conditions] [IN region/VIEW]
 */
function parseSelectQuery(raw: string): ParsedQuery {
	const upperRaw = raw.toUpperCase();

	// Determine what we're selecting
	let what: SelectParams['what'] = 'features';
	if (upperRaw.includes('SELECT GENES') || upperRaw.includes('SELECT GENE')) {
		what = 'genes';
	} else if (upperRaw.includes('SELECT VARIANTS') || upperRaw.includes('SELECT VARIANT')) {
		what = 'variants';
	} else if (upperRaw.includes('SELECT REGIONS') || upperRaw.includes('SELECT REGION')) {
		what = 'regions';
	} else if (upperRaw.includes('SELECT FEATURES') || upperRaw.includes('SELECT FEATURE')) {
		what = 'features';
	} else if (upperRaw.includes('SELECT *') || upperRaw.includes('SELECT ALL')) {
		what = 'all';
	}

	const params: SelectParams = { what };

	// Parse FROM clause
	const fromMatch = raw.match(/FROM\s+([^\s]+)/i);
	if (fromMatch) {
		params.from = fromMatch[1];
	}

	// Parse INTERSECT clause
	const intersectMatch = raw.match(/INTERSECT\s+([^\s]+)/i);
	if (intersectMatch) {
		params.intersect = intersectMatch[1];
	}

	// Parse WITHIN clause
	const withinMatch = raw.match(/WITHIN\s+([^\s]+)/i);
	if (withinMatch) {
		params.within = withinMatch[1];
	}

	// Parse IN clause (VIEW, CHROMOSOME, chr17, or chr17:1000-2000)
	const inViewMatch = raw.match(/IN\s+VIEW/i);
	const inChromosomeMatch = raw.match(/IN\s+CHROMOSOME/i);
	if (inViewMatch) {
		params.inRegion = 'view';
	} else if (inChromosomeMatch) {
		params.inRegion = 'chromosome';
	} else {
		// Try chr17:1000-2000 (with coordinates)
		const inRegionMatch = raw.match(/IN\s+(chr[\w]+):(\d+)-(\d+)/i);
		if (inRegionMatch) {
			params.inRegion = {
				chromosome: inRegionMatch[1],
				start: parseInt(inRegionMatch[2], 10),
				end: parseInt(inRegionMatch[3], 10)
			};
		} else {
			// Try just chr17 (chromosome only, no coordinates)
			const inChrMatch = raw.match(/IN\s+(chr[\w]+)(?:\s|$)/i);
			if (inChrMatch) {
				params.inRegion = { chromosome: inChrMatch[1] };
			}
		}
	}

	// Parse WHERE clause (simplified - handles basic conditions)
	const whereMatch = raw.match(/WHERE\s+(.+?)(?:\s+(?:IN|FROM|INTERSECT|WITHIN|ORDER|LIMIT)\s|$)/i);
	if (whereMatch) {
		const whereStr = whereMatch[1];
		const conditions: WhereClause[] = [];

		// Split by AND
		const condParts = whereStr.split(/\s+AND\s+/i);
		for (const part of condParts) {
			// Match patterns like: field = 'value', field > 10, field CONTAINS 'text'
			const condMatch = part.match(/(\w+)\s*(>=|<=|!=|=|>|<|CONTAINS|MATCHES)\s*['"]?([^'"]+)['"]?/i);
			if (condMatch) {
				const field = condMatch[1];
				const operator = condMatch[2].toLowerCase() as WhereClause['operator'];
				let value: string | number | boolean = condMatch[3];

				// Validate coverage field syntax
				if (field.toLowerCase() === 'coverage') {
					// Coverage requires numeric operators and numeric values
					if (!['=', '!=', '>', '<', '>=', '<='].includes(operator)) {
						return {
							command: 'select',
							raw,
							params,
							valid: false,
							error: `Coverage queries require numeric operators (>=, >, etc.), not '${operator}'`
						};
					}

					// Value must be numeric for coverage
					if (isNaN(Number(value))) {
						return {
							command: 'select',
							raw,
							params,
							valid: false,
							error: `coverage threshold must be a number, got '${value}'`
						};
					}
				}

				// Try to parse as number
				if (!isNaN(Number(value))) {
					value = Number(value);
				} else if (value.toLowerCase() === 'true') {
					value = true;
				} else if (value.toLowerCase() === 'false') {
					value = false;
				}

				conditions.push({
					field,
					operator,
					value
				});
			} else {
				// Check for malformed WHERE clauses
				if (part.toLowerCase().includes('coverage') && !part.includes('>=') && !part.includes('>') && !part.includes('=')) {
					return {
						command: 'select',
						raw,
						params,
						valid: false,
						error: 'Coverage queries require an operator and value (e.g., "coverage >= 10")'
					};
				}
			}
		}

		if (conditions.length > 0) {
			params.where = conditions;
		}
	}

	// Parse ORDER BY clause
	// Supports: ORDER BY name, ORDER BY (end - start), ORDER BY length DESC
	const orderMatch = raw.match(/ORDER\s+BY\s+(\([^)]+\)|[\w]+)(?:\s+(ASC|DESC))?/i);
	if (orderMatch) {
		let field = orderMatch[1];
		// Handle expression like (end - start) -> convert to 'length'
		if (field.match(/\(\s*end\s*-\s*start\s*\)/i)) {
			field = 'length';
		} else {
			field = field.replace(/[()]/g, '').trim();
		}
		const direction = (orderMatch[2]?.toUpperCase() || 'ASC') as 'ASC' | 'DESC';
		params.orderBy = { field, direction };
	}

	// Parse LIMIT clause
	const limitMatch = raw.match(/LIMIT\s+(\d+)/i);
	if (limitMatch) {
		params.limit = parseInt(limitMatch[1], 10);
	}

	return {
		command: 'select',
		raw,
		params,
		valid: true
	};
}

/**
 * Execute a parsed query
 */
export function executeQuery(query: ParsedQuery): QueryResult {
	const viewport = useViewport();
	const timestamp = Date.now();

	if (!query.valid) {
		return {
			success: false,
			query,
			message: query.error || 'Invalid query',
			timestamp
		};
	}

	switch (query.command) {
		case 'navigate': {
			const { chromosome, start, end } = query.params as { chromosome: string; start: number; end: number };
			viewport.navigateTo(chromosome, start, end);
			return {
				success: true,
				query,
				message: `Navigated to ${chromosome}:${start}-${end}`,
				timestamp
			};
		}

		case 'search': {
			const { term } = query.params as { term: string };
			const gene = KNOWN_GENES[term];
			if (gene) {
				viewport.navigateTo(gene.chr, gene.start, gene.end);
				return {
					success: true,
					query,
					message: `Found ${term} at ${gene.chr}:${gene.start}-${gene.end}`,
					timestamp
				};
			}
			return {
				success: false,
				query,
				message: `Gene "${term}" not found`,
				timestamp
			};
		}

		case 'zoom': {
			const { factor } = query.params as { factor: number };
			viewport.zoom(factor);
			const direction = factor < 1 ? 'in' : 'out';
			return {
				success: true,
				query,
				message: `Zoomed ${direction} ${factor}x`,
				timestamp
			};
		}

		case 'pan': {
			const { direction, amount } = query.params as { direction: 'left' | 'right'; amount: number };
			const deltaPixels = direction === 'left' ? amount : -amount;
			// Use 1 as pixelsPerBase to pan by bases directly
			viewport.pan(deltaPixels, 1);
			return {
				success: true,
				query,
				message: `Panned ${direction} ${amount.toLocaleString()} bp`,
				timestamp
			};
		}

		case 'filter': {
			// Apply filter using tracks store
			const tracksStore = useTracks();

			const filters = query.params as Record<string, string>;
			const criteria: FilterCriteria[] = [];

			for (const [field, value] of Object.entries(filters)) {
				// Parse operators in value (e.g., ">100", "!=exon")
				let operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'matches' = '=';
				let actualValue: string | number | boolean = value;

				if (value.startsWith('>=')) {
					operator = '>=';
					actualValue = value.slice(2);
				} else if (value.startsWith('<=')) {
					operator = '<=';
					actualValue = value.slice(2);
				} else if (value.startsWith('!=')) {
					operator = '!=';
					actualValue = value.slice(2);
				} else if (value.startsWith('>')) {
					operator = '>';
					actualValue = value.slice(1);
				} else if (value.startsWith('<')) {
					operator = '<';
					actualValue = value.slice(1);
				} else if (value.startsWith('~')) {
					operator = 'matches';
					actualValue = value.slice(1);
				} else if (value.startsWith('*')) {
					operator = 'contains';
					actualValue = value.slice(1);
				}

				// Try to parse as number
				if (!isNaN(Number(actualValue))) {
					actualValue = Number(actualValue);
				}

				criteria.push({ field, operator, value: actualValue });
			}

			// Apply as global filter with 'dim' mode
			tracksStore.setGlobalFilter(criteria, 'dim');

			const filterDesc = criteria.map(c => `${c.field}${c.operator}${c.value}`).join(', ');
			return {
				success: true,
				query,
				message: `Filter applied: ${filterDesc}`,
				timestamp
			};
		}

		case 'highlight': {
			const { chromosome, start, end } = query.params as { chromosome: string; start: number; end: number };

			// Add highlight region
			viewport.addHighlight(chromosome, start, end, {
				label: `${chromosome}:${start.toLocaleString()}-${end.toLocaleString()}`
			});

			// Navigate to the highlighted region
			const padding = Math.round((end - start) * 0.2);
			viewport.navigateTo(chromosome, Math.max(0, start - padding), end + padding);

			return {
				success: true,
				query,
				message: `Highlighted ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()}`,
				timestamp
			};
		}

		case 'clear': {
			const { target } = query.params as { target: 'filters' | 'highlights' | 'all' };
			const tracksStore = useTracks();

			if (target === 'filters' || target === 'all') {
				tracksStore.clearAllFilters();
			}
			if (target === 'highlights' || target === 'all') {
				viewport.clearAllHighlights();
			}

			const cleared = target === 'all' ? 'filters and highlights' : target;
			return {
				success: true,
				query,
				message: `Cleared ${cleared}`,
				timestamp
			};
		}

		case 'list':
		case 'find':
		case 'show': {
			// List commands return results for display in a panel
			const params = query.params as { type?: string; filter?: string; gene?: string; query?: string };
			const results: ListResultItem[] = [];

			if (params.type === 'genes') {
				// List all known genes
				for (const [name, info] of Object.entries(KNOWN_GENES)) {
					results.push({
						id: name,
						name,
						chromosome: info.chr,
						start: info.start,
						end: info.end,
						type: 'gene'
					});
				}

				// Filter if needed
				if (params.filter === 'with_variants') {
					// This would need track data access - for now return all genes
					// In a real implementation, we'd check against loaded variant tracks
				}
			} else if (params.type === 'variants') {
				// This would need access to loaded tracks
				// For now, return a message indicating tracks need to be loaded
				return {
					success: true,
					query,
					message: 'Load a VCF file to list variants',
					timestamp,
					showResultPanel: true,
					results: []
				};
			}

			const title = params.filter
				? `${params.type} (${params.filter.replace('_', ' ')})`
				: params.type || 'Results';

			return {
				success: true,
				query,
				message: `Found ${results.length} ${title}`,
				timestamp,
				showResultPanel: true,
				results
			};
		}

		default:
			return {
				success: false,
				query,
				message: 'Unknown command',
				timestamp
			};
	}
}

/**
 * Helper: Extract ALL features from a track as ListResultItems
 * Works with any track type (BED, GFF3, VCF, etc.)
 */
function extractAllFeaturesFromTrack(track: LoadedTrack): ListResultItem[] {
	const results: ListResultItem[] = [];

	for (const feature of track.features) {
		const name = (feature as { name?: string }).name ||
			(feature as GeneModelFeature).geneId ||
			feature.id ||
			`${feature.chromosome}:${feature.start}-${feature.end}`;

		results.push({
			id: feature.id,
			name: name,
			chromosome: feature.chromosome,
			start: feature.start,
			end: feature.end,
			type: (feature as GeneModelFeature).featureType || track.typeId,
			details: {
				strand: (feature as { strand?: string }).strand || '.',
				source: track.name,
				length: String(feature.end - feature.start)
			}
		});
	}

	return results;
}

/**
 * Helper: Extract genes from loaded tracks (GFF3/gene model tracks)
 * @param tracks - Tracks to extract from
 * @param fallbackToKnown - Whether to fall back to KNOWN_GENES if no genes found (default: true)
 */
function extractGenesFromTracks(tracks: LoadedTrack[], fallbackToKnown: boolean = true): ListResultItem[] {
	const genes: ListResultItem[] = [];
	const seenGenes = new Set<string>();

	for (const track of tracks) {
		if (track.typeId === 'gff3' || track.typeId === 'geneModel') {
			for (const feature of track.features as GeneModelFeature[]) {
				// Look for top-level gene features or mRNAs
				if (feature.featureType === 'gene' || feature.featureType === 'mRNA') {
					const name = feature.name || feature.geneId || feature.id;
					const key = `${name}-${feature.chromosome}-${feature.start}`;
					if (!seenGenes.has(key)) {
						seenGenes.add(key);
						genes.push({
							id: feature.id,
							name: name,
							chromosome: feature.chromosome,
							start: feature.start,
							end: feature.end,
							type: 'gene',
							details: {
								strand: feature.strand || '.',
								source: track.name,
								length: String(feature.end - feature.start)
							}
						});
					}
				}
			}
		}
	}

	// Also include known genes if no tracks have gene data AND fallback is enabled
	if (genes.length === 0 && fallbackToKnown) {
		for (const [name, info] of Object.entries(KNOWN_GENES)) {
			genes.push({
				id: name,
				name,
				chromosome: info.chr,
				start: info.start,
				end: info.end,
				type: 'gene',
				details: {
					length: String(info.end - info.start)
				}
			});
		}
	}

	return genes;
}

/**
 * Helper: Extract variants from loaded VCF tracks
 */
function extractVariantsFromTracks(tracks: LoadedTrack[]): ListResultItem[] {
	const variants: ListResultItem[] = [];

	for (const track of tracks) {
		if (track.typeId === 'vcf') {
			for (const feature of track.features as VariantFeature[]) {
				const name = feature.name || `${feature.ref}>${feature.alt.join(',')}`;
				variants.push({
					id: feature.id,
					name: name,
					chromosome: feature.chromosome,
					start: feature.start,
					end: feature.end,
					type: 'variant',
					details: {
						ref: feature.ref,
						alt: feature.alt.join(','),
						...(feature.info?.CLNSIG && { significance: feature.info.CLNSIG }),
						source: track.name
					}
				});
			}
		}
	}

	return variants;
}

/**
 * Helper: Check if two genomic regions overlap
 */
function regionsOverlap(
	chr1: string, start1: number, end1: number,
	chr2: string, start2: number, end2: number
): boolean {
	if (chr1 !== chr2) return false;
	return start1 < end2 && start2 < end1;
}

/**
 * Helper: Filter items by region (IN VIEW, IN CHROMOSOME, or IN chr:start-end)
 */
function filterByRegion(
	items: ListResultItem[],
	inRegion: SelectParams['inRegion'],
	viewport: { chromosome: string; start: number; end: number }
): ListResultItem[] {
	if (!inRegion) return items;

	if (inRegion === 'view') {
		// Current viewport
		return items.filter(item =>
			regionsOverlap(
				item.chromosome, item.start, item.end,
				viewport.chromosome, viewport.start, viewport.end
			)
		);
	}

	if (inRegion === 'chromosome') {
		// Current chromosome (all of it)
		return items.filter(item => item.chromosome === viewport.chromosome);
	}

	// Specific chromosome or region
	if (inRegion.start !== undefined && inRegion.end !== undefined) {
		// Full region with coordinates
		const { chromosome, start, end } = inRegion;
		return items.filter(item =>
			regionsOverlap(
				item.chromosome, item.start, item.end,
				chromosome, start, end
			)
		);
	} else {
		// Chromosome only (no coordinates)
		return items.filter(item => item.chromosome === inRegion.chromosome);
	}
}

/**
 * Helper: Find track by name (case-insensitive, partial match)
 */
function findTrackByName(tracks: LoadedTrack[], name: string): LoadedTrack | undefined {
	const lowerName = name.toLowerCase();
	// Exact match first
	let found = tracks.find(t => t.name.toLowerCase() === lowerName);
	if (found) return found;

	// Partial match
	found = tracks.find(t => t.name.toLowerCase().includes(lowerName));
	if (found) return found;

	// Match by type
	if (lowerName === 'variants' || lowerName === 'vcf') {
		return tracks.find(t => t.typeId === 'vcf');
	}
	if (lowerName === 'genes' || lowerName === 'gff3' || lowerName === 'gff') {
		return tracks.find(t => t.typeId === 'gff3');
	}

	return undefined;
}

/**
 * Execute a SELECT query against loaded tracks
 */
function executeSelectQuery(
	query: ParsedQuery,
	tracks: LoadedTrack[],
	viewport: { chromosome: string; start: number; end: number }
): QueryResult {
	const timestamp = Date.now();
	const params = query.params as SelectParams;

	let results: ListResultItem[] = [];
	let title = '';

	// Check if FROM clause specifies a specific track
	if (params.from) {
		const fromTrack = findTrackByName(tracks, params.from);
		if (fromTrack) {
			// Extract ALL features from the specified track (any track type)
			results = extractAllFeaturesFromTrack(fromTrack);
			title = `${params.what === 'genes' ? 'Genes' : params.what === 'variants' ? 'Variants' : 'Features'} from ${fromTrack.name}`;
		} else {
			// Track not found
			return {
				success: false,
				query,
				message: `Track "${params.from}" not found. Loaded tracks: ${tracks.map(t => t.name).join(', ')}`,
				timestamp,
				showResultPanel: true,
				results: []
			};
		}
	} else {
		// No FROM clause - get results based on 'what' we're selecting with fallback to KNOWN_GENES
		if (params.what === 'genes') {
			results = extractGenesFromTracks(tracks, true); // fallback enabled
			title = 'Genes';
		} else if (params.what === 'variants') {
			results = extractVariantsFromTracks(tracks);
			title = 'Variants';
		} else if (params.what === 'regions') {
			// Handle coverage queries
			const viewportStore = useViewport();
			const currentViewport = viewportStore.current;

			// Find BAM/CRAM tracks for coverage analysis
			const bamTracks = tracks.filter(track => track.typeId === 'bam' || track.typeId === 'cram');

			if (bamTracks.length === 0) {
				return {
					success: false,
					query,
					message: 'No BAM/CRAM tracks loaded for coverage analysis',
					timestamp
				};
			}

			// Extract coverage threshold from WHERE clause
			let coverageThreshold = 10; // default
			if (params.where) {
				const coverageClause = params.where.find(w => w.field.toLowerCase() === 'coverage');
				if (coverageClause && typeof coverageClause.value === 'number') {
					coverageThreshold = coverageClause.value;
				}
			}

			// Determine region to query
			let queryChromosome = currentViewport.chromosome;
			let queryStart = currentViewport.start;
			let queryEnd = currentViewport.end;

			if (params.inRegion && typeof params.inRegion === 'object') {
				queryChromosome = params.inRegion.chromosome;
				queryStart = params.inRegion.start || currentViewport.start;
				queryEnd = params.inRegion.end || currentViewport.end;
			}

			// TODO: Implement async coverage querying
			// For now, return a placeholder result
			results = [{
				id: 'coverage-placeholder',
				name: 'Coverage analysis',
				chromosome: queryChromosome,
				start: queryStart,
				end: queryEnd,
				details: {
					message: 'Coverage analysis implementation in progress',
					threshold: `${coverageThreshold}x`,
					tracks: `${bamTracks.length} BAM tracks`
				}
			}];

			title = `Coverage regions ≥${coverageThreshold}x`;
		} else if (params.what === 'features' || params.what === 'all') {
			// Get all features from all tracks
			results = [
				...extractGenesFromTracks(tracks, true),
				...extractVariantsFromTracks(tracks)
			];
			title = 'Features';
		}
	}

	// Apply INTERSECT filter (overlap with another track)
	if (params.intersect) {
		const intersectTrack = findTrackByName(tracks, params.intersect);
		if (intersectTrack) {
			const intersectItems = intersectTrack.typeId === 'vcf'
				? extractVariantsFromTracks([intersectTrack])
				: extractGenesFromTracks([intersectTrack]);

			if (intersectItems.length === 0) {
				return {
					success: true,
					query,
					message: `No features found in "${params.intersect}" track to intersect with`,
					timestamp,
					showResultPanel: true,
					results: []
				};
			}

			// Filter to only items that overlap with intersect track
			results = results.filter(item =>
				intersectItems.some(ii =>
					regionsOverlap(item.chromosome, item.start, item.end, ii.chromosome, ii.start, ii.end)
				)
			);

			// Add overlap count to details
			results = results.map(item => {
				const overlaps = intersectItems.filter(ii =>
					regionsOverlap(item.chromosome, item.start, item.end, ii.chromosome, ii.start, ii.end)
				);
				return {
					...item,
					details: {
						...item.details,
						[`${intersectTrack.typeId}_overlaps`]: String(overlaps.length)
					}
				};
			});

			title += ` intersecting ${intersectTrack.name}`;
		} else {
			return {
				success: false,
				query,
				message: `Track "${params.intersect}" not found. Loaded tracks: ${tracks.map(t => t.name).join(', ')}`,
				timestamp,
				showResultPanel: true,
				results: []
			};
		}
	}

	// Apply WITHIN filter (inside a gene or region)
	if (params.within) {
		// Check if it's a gene name
		const allGenes = extractGenesFromTracks(tracks);
		const gene = allGenes.find(g => g.name.toUpperCase() === params.within?.toUpperCase());

		if (gene) {
			results = results.filter(item =>
				regionsOverlap(item.chromosome, item.start, item.end, gene.chromosome, gene.start, gene.end)
			);
			title += ` within ${gene.name}`;
		} else {
			// Try as region
			const coord = parseCoordinate(params.within);
			if (coord) {
				results = results.filter(item =>
					regionsOverlap(item.chromosome, item.start, item.end, coord.chromosome, coord.start, coord.end)
				);
				title += ` within ${params.within}`;
			} else {
				// Try KNOWN_GENES
				const knownGene = KNOWN_GENES[params.within.toUpperCase()];
				if (knownGene) {
					results = results.filter(item =>
						regionsOverlap(item.chromosome, item.start, item.end, knownGene.chr, knownGene.start, knownGene.end)
					);
					title += ` within ${params.within.toUpperCase()}`;
				} else {
					// Don't silently drop the constraint — tell the user it was ignored.
					title += ` — note: WITHIN target "${params.within}" is not a known gene or valid region (ignored)`;
				}
			}
		}
	}

	// Apply IN region/VIEW filter
	if (params.inRegion) {
		results = filterByRegion(results, params.inRegion, viewport);
		if (params.inRegion === 'view') {
			title += ' in view';
		} else if (params.inRegion === 'chromosome') {
			title += ` on ${viewport.chromosome}`;
		} else if (typeof params.inRegion === 'object') {
			if (params.inRegion.start !== undefined) {
				title += ` in ${params.inRegion.chromosome}:${params.inRegion.start}-${params.inRegion.end}`;
			} else {
				title += ` on ${params.inRegion.chromosome}`;
			}
		}
	}

	// Apply WHERE conditions
	if (params.where && params.where.length > 0) {
		const unknownFields: string[] = [];
		for (const condition of params.where) {
			// A WHERE on a field that NO result has would silently empty the set —
			// surface that as a note so the user isn't left guessing.
			if (
				results.length > 0 &&
				!results.some(
					(item) =>
						(item.details?.[condition.field] ??
							(item as unknown as Record<string, unknown>)[condition.field]) !== undefined
				)
			) {
				unknownFields.push(condition.field);
			}
			results = results.filter(item => {
				const itemValue = item.details?.[condition.field] ?? (item as unknown as Record<string, unknown>)[condition.field];
				if (itemValue === undefined) return false;

				const strValue = String(itemValue).toLowerCase();
				const condValue = String(condition.value).toLowerCase();

				switch (condition.operator) {
					case '=':
						return strValue === condValue;
					case '!=':
						return strValue !== condValue;
					case '>':
						return Number(itemValue) > Number(condition.value);
					case '<':
						return Number(itemValue) < Number(condition.value);
					case '>=':
						return Number(itemValue) >= Number(condition.value);
					case '<=':
						return Number(itemValue) <= Number(condition.value);
					case 'contains':
						return strValue.includes(condValue);
					case 'matches':
						try {
							return new RegExp(String(condition.value), 'i').test(String(itemValue));
						} catch {
							return false;
						}
					default:
						return true;
				}
			});
		}
		title += ' (filtered)';
		if (unknownFields.length > 0) {
			title += ` — note: no results have field(s) ${[...new Set(unknownFields)].join(', ')}`;
		}
	}

	// Apply ORDER BY
	if (params.orderBy) {
		const { field, direction } = params.orderBy;
		results.sort((a, b) => {
			let aVal: string | number;
			let bVal: string | number;

			// Handle special 'length' field
			if (field === 'length') {
				aVal = a.end - a.start;
				bVal = b.end - b.start;
			} else if (field === 'start' || field === 'end') {
				aVal = a[field];
				bVal = b[field];
			} else if (field === 'name') {
				aVal = a.name.toLowerCase();
				bVal = b.name.toLowerCase();
			} else {
				// Try details first, then direct field access
				const aRaw = a.details?.[field] ?? (a as unknown as Record<string, unknown>)[field];
				const bRaw = b.details?.[field] ?? (b as unknown as Record<string, unknown>)[field];
				aVal = typeof aRaw === 'number' ? aRaw : String(aRaw ?? '');
				bVal = typeof bRaw === 'number' ? bRaw : String(bRaw ?? '');
			}

			// Compare
			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return direction === 'DESC' ? bVal - aVal : aVal - bVal;
			}
			const cmp = String(aVal).localeCompare(String(bVal));
			return direction === 'DESC' ? -cmp : cmp;
		});

		title += ` ordered by ${field} ${direction}`;
	}

	// Apply LIMIT
	if (params.limit && params.limit > 0) {
		const originalCount = results.length;
		results = results.slice(0, params.limit);
		title += ` (top ${params.limit} of ${originalCount})`;
	}

	// For COUNT command, return count instead of results
	if (query.command === 'count') {
		return {
			success: true,
			query,
			message: `Count: ${results.length} ${title}`,
			timestamp,
			showResultPanel: false,
			results: []
		};
	}

	return {
		success: true,
		query,
		message: `${title} (${results.length})`,
		timestamp,
		showResultPanel: true,
		results
	};
}

/**
 * Execute a parsed query with awareness of loaded tracks
 * This is the track-aware version that queries actual loaded data
 */
export function executeQueryWithTracks(query: ParsedQuery, tracks: LoadedTrack[]): QueryResult {
	const viewport = useViewport();
	const timestamp = Date.now();

	if (!query.valid) {
		return {
			success: false,
			query,
			message: query.error || 'Invalid query',
			timestamp
		};
	}

	// Handle SELECT and COUNT commands
	if (query.command === 'select' || query.command === 'count') {
		return executeSelectQuery(query, tracks, viewport.current);
	}

	// For non-list commands, use the standard execution
	if (query.command !== 'list' && query.command !== 'find' && query.command !== 'show') {
		return executeQuery(query);
	}

	// Handle list commands with track awareness
	const params = query.params as { type?: string; filter?: string; gene?: string; query?: string };
	let results: ListResultItem[] = [];
	let title = '';

	if (params.type === 'genes') {
		const genes = extractGenesFromTracks(tracks);

		if (params.filter === 'with_variants') {
			// Find genes that have overlapping variants
			const variants = extractVariantsFromTracks(tracks);

			if (variants.length === 0) {
				return {
					success: true,
					query,
					message: 'No variant tracks loaded - load a VCF file to find genes with variants',
					timestamp,
					showResultPanel: true,
					results: []
				};
			}

			// Filter genes to only those with overlapping variants
			results = genes.filter(gene => {
				return variants.some(variant =>
					regionsOverlap(
						gene.chromosome, gene.start, gene.end,
						variant.chromosome, variant.start, variant.end
					)
				);
			});

			// Add variant count to details
			results = results.map(gene => {
				const overlappingVariants = variants.filter(v =>
					regionsOverlap(gene.chromosome, gene.start, gene.end, v.chromosome, v.start, v.end)
				);
				return {
					...gene,
					details: {
						...gene.details,
						variants: String(overlappingVariants.length)
					}
				};
			});

			title = `Genes with variants (${results.length})`;
		} else {
			results = genes;
			title = `All genes (${results.length})`;
		}
	} else if (params.type === 'variants') {
		const variants = extractVariantsFromTracks(tracks);

		if (variants.length === 0) {
			return {
				success: true,
				query,
				message: 'No variant tracks loaded - load a VCF file to list variants',
				timestamp,
				showResultPanel: true,
				results: []
			};
		}

		if (params.gene) {
			// Find variants in a specific gene
			const genes = extractGenesFromTracks(tracks);
			const targetGene = genes.find(g => g.name.toUpperCase() === params.gene?.toUpperCase());

			if (!targetGene) {
				// Try KNOWN_GENES
				const knownGene = KNOWN_GENES[params.gene.toUpperCase()];
				if (knownGene) {
					results = variants.filter(v =>
						regionsOverlap(knownGene.chr, knownGene.start, knownGene.end, v.chromosome, v.start, v.end)
					);
					title = `Variants in ${params.gene.toUpperCase()} (${results.length})`;
				} else {
					return {
						success: false,
						query,
						message: `Gene "${params.gene}" not found`,
						timestamp,
						showResultPanel: true,
						results: []
					};
				}
			} else {
				results = variants.filter(v =>
					regionsOverlap(targetGene.chromosome, targetGene.start, targetGene.end, v.chromosome, v.start, v.end)
				);
				title = `Variants in ${targetGene.name} (${results.length})`;
			}
		} else if (params.filter === 'pathogenic') {
			results = variants.filter(v =>
				v.details?.significance?.toLowerCase().includes('pathogenic')
			);
			title = `Pathogenic variants (${results.length})`;
		} else {
			results = variants;
			title = `All variants (${results.length})`;
		}
	}

	return {
		success: true,
		query,
		message: title || `Found ${results.length} results`,
		timestamp,
		showResultPanel: true,
		results
	};
}

/**
 * Translate natural language to GQL
 * This is a simple pattern-based translator - could be enhanced with actual AI
 *
 * IMPORTANT: Order matters! More specific patterns must come BEFORE generic ones.
 */
export function translateNaturalLanguage(input: string): ParsedQuery | null {
	const lower = input.toLowerCase().trim();

	// Direct coordinate input (highest priority)
	const coordMatch = parseCoordinate(input);
	if (coordMatch) {
		return parseQuery(`navigate ${input}`);
	}

	// ============================================================
	// LIST/QUERY PATTERNS (most specific - check these FIRST)
	// ============================================================

	// Genes with variants - many phrasings
	// "what/which genes have variants", "show me genes with variants", etc.
	if (lower.match(/genes?\s+(?:with|that\s+have|having|containing|overlapping)\s+(?:\w+\s+)?variants?/) ||
		lower.match(/(?:what|which|show|give|display|list|find|get)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?genes?\s+(?:with|that\s+have|having|containing)\s+(?:\w+\s+)?variants?/)) {
		return parseQuery('list genes with variants');
	}

	// "what/which genes have X variants" (cancer variants, pathogenic variants, etc.)
	if (lower.match(/(?:what|which)\s+genes?\s+(?:have|contain|include|overlap)/)) {
		if (lower.includes('variant')) {
			return parseQuery('list genes with variants');
		}
	}

	// Variants in a gene - "variants in TP53", "what variants are in BRCA1"
	const variantsInGeneMatch = lower.match(/(?:(?:what|which|show|list|find|get)\s+(?:me\s+)?(?:the\s+)?)?variants?\s+(?:in|for|of|within|inside)\s+(\w+)/);
	if (variantsInGeneMatch) {
		return parseQuery(`list variants in ${variantsInGeneMatch[1]}`);
	}

	// Pathogenic variants
	if (lower.match(/pathogenic\s+variants?/) ||
		lower.match(/variants?\s+(?:that\s+are\s+)?pathogenic/) ||
		lower.match(/(?:what|which)\s+variants?\s+(?:are\s+)?pathogenic/)) {
		return parseQuery('list pathogenic variants');
	}

	// List/show genes (without variants filter)
	if (lower.match(/(?:list|show|find|get|display)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?genes?$/) ||
		lower.match(/(?:what|which)\s+(?:are\s+)?(?:the\s+)?genes?$/) ||
		lower === 'genes') {
		return parseQuery('list genes');
	}

	// List/show variants (without gene filter)
	if (lower.match(/(?:list|show|find|get|display)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?variants?$/) ||
		lower.match(/(?:what|which)\s+(?:are\s+)?(?:the\s+)?variants?$/) ||
		lower === 'variants') {
		return parseQuery('list variants');
	}

	// ============================================================
	// NAVIGATION PATTERNS
	// ============================================================

	// "zoom in/out"
	if (lower.includes('zoom in') || lower === 'closer' || lower === 'magnify') {
		return parseQuery('zoom in');
	}
	if (lower.includes('zoom out') || lower === 'wider' || lower === 'farther') {
		return parseQuery('zoom out');
	}
	const zoomMatch = lower.match(/zoom\s+(\d+\.?\d*)x?/);
	if (zoomMatch) {
		return parseQuery(`zoom ${zoomMatch[1]}x`);
	}

	// "pan/move left/right"
	const panMatch = lower.match(/(?:pan|move|scroll)\s+(left|right)(?:\s+(\d+)\s*(bp|kb|mb)?)?/);
	if (panMatch) {
		const amount = panMatch[2] ? `${panMatch[2]}${panMatch[3] || 'bp'}` : '10kb';
		return parseQuery(`pan ${panMatch[1]} ${amount}`);
	}

	// ============================================================
	// FILTER PATTERNS
	// ============================================================

	// "show only exons", "filter to exons" - strip trailing 's' for singular
	const filterOnlyMatch = lower.match(/(?:show\s+only|filter\s+(?:to|by))\s+(\w+?)s?$/);
	if (filterOnlyMatch) {
		const featureType = filterOnlyMatch[1].replace(/s$/, ''); // Remove plural
		return parseQuery(`filter type=${featureType}`);
	}

	// "only show exons" - need separate pattern to not conflict with "only show genes" -> list genes
	const onlyShowMatch = lower.match(/^only\s+show\s+(\w+?)s?$/);
	if (onlyShowMatch) {
		const featureType = onlyShowMatch[1];
		// Don't match "only show genes" or "only show variants" as those are list commands
		if (featureType !== 'gene' && featureType !== 'variant') {
			return parseQuery(`filter type=${featureType}`);
		}
	}

	// "filter by type=exon", "filter strand=+"
	const filterByMatch = lower.match(/filter\s+(?:by\s+)?(\w+)\s*[=:]\s*(\S+)/);
	if (filterByMatch) {
		return parseQuery(`filter ${filterByMatch[1]}=${filterByMatch[2]}`);
	}

	// "show plus strand", "show minus strand"
	const showStrandMatch = lower.match(/show\s+(plus|\+|minus|-|forward|reverse)\s+strand/);
	if (showStrandMatch) {
		const strand = showStrandMatch[1].match(/plus|\+|forward/) ? '+' : '-';
		return parseQuery(`filter strand=${strand}`);
	}

	// "filter to plus/minus strand" - separate pattern
	const filterStrandMatch = lower.match(/filter\s+to\s+(plus|\+|minus|-|forward|reverse)\s+strand/);
	if (filterStrandMatch) {
		const strand = filterStrandMatch[1].match(/plus|\+|forward/) ? '+' : '-';
		return parseQuery(`filter strand=${strand}`);
	}

	// "clear filters", "remove filters", "reset filters"
	if (lower.match(/(?:clear|remove|reset)\s+filters?/)) {
		return parseQuery('clear filters');
	}

	// ============================================================
	// HIGHLIGHT PATTERNS
	// ============================================================

	// "highlight region chr17:1000-2000", "mark chr17:1000-2000"
	const highlightRegionMatch = lower.match(/(?:highlight|mark|show)\s+(?:region\s+)?(chr[\w]+:\d+-\d+)/i);
	if (highlightRegionMatch) {
		return parseQuery(`highlight ${highlightRegionMatch[1]}`);
	}

	// "highlight GENE" - highlight the gene region
	const highlightGeneMatch = lower.match(/^(?:highlight|mark)\s+([a-z0-9]+)$/i);
	if (highlightGeneMatch) {
		const geneName = highlightGeneMatch[1].toUpperCase();
		const gene = KNOWN_GENES[geneName];
		if (gene) {
			return parseQuery(`highlight ${gene.chr}:${gene.start}-${gene.end}`);
		}
	}

	// "clear highlights", "remove highlights"
	if (lower.match(/(?:clear|remove|reset)\s+highlights?/)) {
		return parseQuery('clear highlights');
	}

	// "clear all" or just "clear"
	if (lower === 'clear' || lower === 'clear all' || lower === 'reset') {
		return parseQuery('clear all');
	}

	// ============================================================
	// GENE/COORDINATE SEARCH (more generic - check LAST)
	// ============================================================

	// Just a gene name by itself
	const upperInput = input.toUpperCase().trim();
	if (KNOWN_GENES[upperInput]) {
		return parseQuery(`search gene ${upperInput}`);
	}

	// "go to X", "navigate to X" - for coordinates or genes
	const gotoMatch = lower.match(/^(?:go\s+to|navigate\s+to|jump\s+to)\s+(.+)$/);
	if (gotoMatch) {
		const target = gotoMatch[1];
		const coordParsed = parseCoordinate(target);
		if (coordParsed) {
			return parseQuery(`navigate ${target}`);
		}
		return parseQuery(`search gene ${target}`);
	}

	// "show/view/display GENE" - but NOT "show me X" or "show genes" (handled above)
	// Only match single gene names after "show"
	const showGeneMatch = lower.match(/^(?:show|view|display)\s+([a-z0-9]+)$/i);
	if (showGeneMatch) {
		const possibleGene = showGeneMatch[1].toUpperCase();
		if (KNOWN_GENES[possibleGene] || possibleGene.match(/^[A-Z][A-Z0-9]{1,10}$/)) {
			return parseQuery(`search gene ${possibleGene}`);
		}
	}

	// "find X", "search for X", "where is X" - for gene search
	const searchMatch = lower.match(/^(?:find|search\s+(?:for)?|where\s+is|locate)\s+(?:gene\s+)?([a-z0-9]+)$/i);
	if (searchMatch) {
		return parseQuery(`search gene ${searchMatch[1]}`);
	}

	return null;
}

/**
 * Get list of available commands for help/autocomplete
 */
export function getCommandHelp(): Array<{ command: string; syntax: string; description: string }> {
	return [
		{
			command: 'navigate',
			syntax: 'navigate chr1:1000-2000',
			description: 'Navigate to a genomic region'
		},
		{
			command: 'search',
			syntax: 'search gene TP53',
			description: 'Search for a gene and navigate to it'
		},
		{
			command: 'list',
			syntax: 'list genes',
			description: 'List all known genes'
		},
		{
			command: 'list',
			syntax: 'list genes with variants',
			description: 'List genes that have overlapping variants'
		},
		{
			command: 'list',
			syntax: 'list variants in TP53',
			description: 'List variants within a specific gene'
		},
		{
			command: 'zoom',
			syntax: 'zoom in|out|2x',
			description: 'Zoom the viewport in or out'
		},
		{
			command: 'pan',
			syntax: 'pan left|right 10kb',
			description: 'Pan the viewport left or right'
		},
		{
			command: 'filter',
			syntax: 'filter type=exon strand=+',
			description: 'Filter features by attributes (dims non-matching)'
		},
		{
			command: 'highlight',
			syntax: 'highlight chr1:1000-2000',
			description: 'Highlight a genomic region'
		},
		{
			command: 'clear',
			syntax: 'clear [filters|highlights|all]',
			description: 'Clear active filters or highlights'
		}
	];
}

/**
 * Get available genes for autocomplete
 */
export function getAvailableGenes(): string[] {
	return Object.keys(KNOWN_GENES);
}
