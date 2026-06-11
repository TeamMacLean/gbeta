/**
 * Core genomic types for gBeta
 * All coordinates are 0-based, half-open internally
 */

export interface Viewport {
	chromosome: string;
	start: number;
	end: number;
}

export interface GenomicFeature {
	id: string;
	chromosome: string;
	start: number;
	end: number;
	name?: string;
	strand?: '+' | '-' | '.';
	score?: number;
	type?: string;
	attributes?: Record<string, string>;
}

export interface BedFeature extends GenomicFeature {
	thickStart?: number;
	thickEnd?: number;
	itemRgb?: string;
	blockCount?: number;
	blockSizes?: number[];
	blockStarts?: number[];
	geneSymbol?: string; // Gene symbol from extended BED fields (e.g., "TP53")
}

export interface GffFeature extends GenomicFeature {
	source: string;
	type: string;
	phase?: 0 | 1 | 2 | '.';
	parent?: string;
	children?: GffFeature[];
}

export interface Track {
	id: string;
	name: string;
	type: 'bed' | 'gff' | 'vcf' | 'bigwig';
	features: GenomicFeature[];
	visible: boolean;
	color?: string;
	height?: number;
}

export interface ChromosomeInfo {
	name: string;
	length: number;
	aliases?: string[]; // e.g., ["1", "Chr1"] for "chr1"
}

export interface GenomeAssembly {
	id: string;
	name: string;
	species?: string;
	description?: string;
	chromosomes: ChromosomeInfo[];
	source: 'builtin' | 'url' | 'inferred' | 'custom';
	chromSizesUrl?: string; // URL to fetch full chrom.sizes if needed
	defaultViewport?: Viewport; // Default region to show when switching to this assembly
}

// AI Query types
export type QueryIntent = 'navigate' | 'search' | 'filter' | 'explain' | 'unknown';

export interface AIQueryResult {
	intent: QueryIntent;
	chromosome: string | null;
	start: number | null;
	end: number | null;
	gene: string | null;
	feature: 'exon' | 'intron' | 'promoter' | 'utr' | null;
	message: string;
	confidence: number;
}

// Display coordinate conversion helpers
export function toDisplayCoordinate(pos: number): number {
	return pos + 1; // 0-based to 1-based
}

export function toInternalCoordinate(pos: number): number {
	return pos - 1; // 1-based to 0-based
}

export function formatCoordinate(chr: string, start: number, end: number): string {
	return `${chr}:${toDisplayCoordinate(start).toLocaleString()}-${end.toLocaleString()}`;
}

export function parseCoordinate(coord: string): Viewport | null {
	// Support multiple chromosome naming conventions:
	// - chr17:1000-2000 (UCSC style)
	// - 17:1000-2000 (numeric)
	// - NC_000913.3:1000-2000 (NCBI RefSeq accession)
	// - CM000663.2:1000-2000 (GenBank accession)
	const match = coord.trim().match(/^([A-Za-z0-9_.]+):(\d[\d,]*)-(\d[\d,]*)$/i);
	if (!match) return null;

	let chr = match[1];
	// Only add 'chr' prefix for simple numeric chromosomes (1-22, X, Y, M)
	if (/^[\dXYM]+$/i.test(chr) && !chr.startsWith('chr')) {
		chr = 'chr' + chr;
	}

	const start = toInternalCoordinate(parseInt(match[2].replace(/,/g, ''), 10));
	const end = parseInt(match[3].replace(/,/g, ''), 10);

	if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
		return null;
	}

	return { chromosome: chr, start, end };
}
