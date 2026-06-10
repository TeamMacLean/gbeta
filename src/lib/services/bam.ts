/**
 * BAM/CRAM Remote Track Service
 *
 * Supports:
 * - .bam + .bai (BAM alignments)
 * - .cram + .crai (CRAM alignments)
 *
 * Uses @gmod/bam for BAM and @gmod/cram for CRAM parsing.
 */

import { BamFile, BamRecord } from '@gmod/bam';
import { IndexedCramFile, CraiIndex, CramFile, CramRecord } from '@gmod/cram';
import { RemoteFile } from 'generic-filehandle2';
import type { BedFeature } from '$lib/types/genome';
import type { BAMReadFeature } from '$lib/types/tracks';
import { query2bit, get2bitUrl } from '$lib/services/fasta';

// Cache for BAM file handles
const bamCache = new Map<string, BamFile>();

// Cache for CRAM file handles (keyed by url + assemblyId)
const cramCache = new Map<string, { cram: IndexedCramFile; seqIdToName: Map<number, string>; nameToSeqId: Map<string, number> }>();

// Cache for fetched features (keyed by url + region)
const featureCache = new Map<string, { features: BAMReadFeature[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Parse CIGAR string into operation/length pairs
 */
function parseCigar(cigar: string): Array<[string, number]> {
	const ops: Array<[string, number]> = [];
	const regex = /(\d+)([MIDNSHP=X])/g;
	let match;
	while ((match = regex.exec(cigar)) !== null) {
		ops.push([match[2], parseInt(match[1], 10)]);
	}
	return ops;
}

/**
 * Get or create a BAM file handle
 */
async function getBamFile(url: string): Promise<BamFile> {
	if (bamCache.has(url)) {
		return bamCache.get(url)!;
	}

	// Auto-discover index URL (.bai)
	const indexUrl = url + '.bai';

	const bamFile = new BamFile({
		bamFilehandle: new RemoteFile(url),
		baiFilehandle: new RemoteFile(indexUrl),
	});

	// Verify the file is valid by reading header - also populates indexToChr
	await bamFile.getHeader();

	bamCache.set(url, bamFile);
	return bamFile;
}

/**
 * Convert BAM record to BAMReadFeature with sequence data
 */
function bamRecordToFeature(record: BamRecord, chromosome: string): BAMReadFeature {
	const cigarString = record.CIGAR || '';
	const parsedCigar = parseCigar(cigarString);
	const flags = record.flags || 0;

	// Get mate information if available (using internal properties)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const rec = record as any;
	let mate: BAMReadFeature['mate'] | undefined;
	if (rec._next_pos !== undefined && rec._next_pos >= 0) {
		mate = {
			chromosome: rec._next_refid !== undefined ? chromosome : chromosome, // Would need refSeqs to resolve
			start: rec._next_pos,
			isReversed: (flags & 0x20) !== 0, // mate reverse strand flag
		};
	}

	return {
		id: `${record.name}:${record.start}-${record.end}:${flags}`,
		chromosome,
		start: record.start,
		end: record.end,
		name: record.name || undefined,
		strand: record.strand === 1 ? '+' : record.strand === -1 ? '-' : undefined,
		// Sequence data
		seq: record.seq || '',
		qual: record.qual || null,
		cigar: cigarString,
		parsedCigar,
		mq: record.mq || 0,
		isReversed: record.isReverseComplemented?.() ?? ((flags & 0x10) !== 0),
		mdTag: record.tags?.MD as string | undefined,
		readName: record.name || '',
		mate,
		templateLength: rec.template_length,
		flags,
	};
}

/**
 * Convert BAM record to simple BedFeature (for backwards compatibility)
 */
function bamRecordToBedFeature(record: BamRecord, chromosome: string): BedFeature {
	return {
		id: `${record.name}:${record.start}-${record.end}`,
		chromosome,
		start: record.start,
		end: record.end,
		name: record.name || undefined,
		strand: record.strand === 1 ? '+' : record.strand === -1 ? '-' : undefined,
		score: record.mq,
	};
}

/**
 * Query features from a remote BAM file
 * Returns BAMReadFeature with full sequence data for high-zoom rendering
 */
export async function queryBam(
	url: string,
	chromosome: string,
	start: number,
	end: number,
	options: { signal?: AbortSignal; assemblyId?: string } = {}
): Promise<BAMReadFeature[]> {
	// Check cache
	const cacheKey = `${url}:${chromosome}:${start}-${end}`;
	const cached = featureCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.features;
	}

	try {
		const bam = await getBamFile(url);

		// Get reference names from indexToChr (populated by getHeader)
		const refSeqs = bam.indexToChr || [];
		const refNames = refSeqs.map(r => r.refName);

		// Find matching reference name
		let resolvedChrom = chromosome;
		if (!chromosome) {
			throw new Error('Chromosome parameter is required');
		}
		if (!refNames.includes(chromosome)) {
			// Try common variations
			const variations = [
				chromosome.replace(/^chr/i, ''),
				'chr' + chromosome.replace(/^chr/i, ''),
			];
			for (const variant of variations) {
				if (refNames.includes(variant)) {
					resolvedChrom = variant;
					break;
				}
			}
		}

		// Check if chromosome exists
		if (!refNames.includes(resolvedChrom)) {
			return [];
		}

		// Query records
		const records = await bam.getRecordsForRange(resolvedChrom, start, end, {
			signal: options.signal,
		});

		// Convert to BedFeatures
		const features = records.map(record => bamRecordToFeature(record, chromosome));

		// Cache results
		featureCache.set(cacheKey, { features, timestamp: Date.now() });

		return features;
	} catch (error) {
		console.error(`Error querying BAM ${url}:`, error);
		throw error;
	}
}

/**
 * Get or create a CRAM file handle with reference sequence callback
 */
async function getCramFile(url: string, assemblyId: string): Promise<{
	cram: IndexedCramFile;
	seqIdToName: Map<number, string>;
	nameToSeqId: Map<string, number>;
}> {
	const cacheKey = `${url}:${assemblyId}`;
	if (cramCache.has(cacheKey)) {
		return cramCache.get(cacheKey)!;
	}

	// Get 2bit URL for this assembly
	const twoBitUrl = get2bitUrl(assemblyId);
	if (!twoBitUrl) {
		throw new Error(`No reference sequence available for assembly: ${assemblyId}`);
	}

	// We need to read the SAM header first to build seqId -> name mapping
	// Create a temporary CramFile just to read the header
	const tempCram = new CramFile({
		filehandle: new RemoteFile(url),
	});

	const samHeader = await tempCram.getSamHeader();

	// Build seqId -> chromosome name mapping from @SQ lines
	const seqIdToName = new Map<number, string>();
	const nameToSeqId = new Map<string, number>();
	let seqId = 0;
	for (const line of samHeader) {
		if (line.tag === 'SQ') {
			const snTag = line.data.find((d: { tag: string; value: string }) => d.tag === 'SN');
			if (snTag) {
				seqIdToName.set(seqId, snTag.value);
				nameToSeqId.set(snTag.value, seqId);
				seqId++;
			}
		}
	}

	// Create seqFetch callback that uses 2bit reference
	const seqFetch = async (seqId: number, start: number, end: number): Promise<string> => {
		const chromName = seqIdToName.get(seqId);
		if (!chromName) {
			console.warn(`Unknown sequence ID: ${seqId}`);
			return '';
		}
		try {
			// CRAM uses 1-based coordinates, query2bit uses 0-based
			const seq = await query2bit(twoBitUrl, chromName, start - 1, end);
			return seq;
		} catch (error) {
			console.error(`Error fetching reference sequence for ${chromName}:${start}-${end}:`, error);
			return '';
		}
	};

	// Create the actual CRAM file with seqFetch
	const cramFile = new CramFile({
		filehandle: new RemoteFile(url),
		seqFetch,
		checkSequenceMD5: false, // Disable MD5 check to avoid fetching entire chromosomes
	});

	// Create index
	const indexUrl = url + '.crai';
	const craiIndex = new CraiIndex({
		filehandle: new RemoteFile(indexUrl),
	});

	// Create indexed CRAM file
	const indexedCram = new IndexedCramFile({
		cram: cramFile,
		index: craiIndex,
	});

	const result = { cram: indexedCram, seqIdToName, nameToSeqId };
	cramCache.set(cacheKey, result);
	return result;
}

/**
 * Convert CRAM record to BAMReadFeature
 */
function cramRecordToFeature(record: CramRecord, chromosome: string): BAMReadFeature {
	const flags = record.flags || 0;

	// Build CIGAR string from readFeatures
	// CRAM stores operations differently - we need to reconstruct CIGAR
	let cigarString = '';
	const parsedCigar: Array<[string, number]> = [];

	if (record.readFeatures && record.readFeatures.length > 0) {
		// Sort features by position
		const sortedFeatures = [...record.readFeatures].sort((a, b) => a.pos - b.pos);

		let lastPos = 1;
		for (const feature of sortedFeatures) {
			// Add matches before this feature
			if (feature.pos > lastPos) {
				const matchLen = feature.pos - lastPos;
				cigarString += `${matchLen}M`;
				parsedCigar.push(['M', matchLen]);
			}

			// Handle different feature types
			switch (feature.code) {
				case 'X': // substitution
				case 'B': // base
					cigarString += '1M';
					parsedCigar.push(['M', 1]);
					lastPos = feature.pos + 1;
					break;
				case 'I': // insertion
					const insLen = typeof feature.data === 'string' ? feature.data.length : 1;
					cigarString += `${insLen}I`;
					parsedCigar.push(['I', insLen]);
					lastPos = feature.pos;
					break;
				case 'D': // deletion
					const delLen = typeof feature.data === 'number' ? feature.data : 1;
					cigarString += `${delLen}D`;
					parsedCigar.push(['D', delLen]);
					lastPos = feature.pos;
					break;
				case 'N': // ref skip
					const skipLen = typeof feature.data === 'number' ? feature.data : 1;
					cigarString += `${skipLen}N`;
					parsedCigar.push(['N', skipLen]);
					lastPos = feature.pos;
					break;
				case 'S': // soft clip
					const clipLen = typeof feature.data === 'string' ? feature.data.length : 1;
					cigarString += `${clipLen}S`;
					parsedCigar.push(['S', clipLen]);
					lastPos = feature.pos;
					break;
				case 'H': // hard clip
					const hardLen = typeof feature.data === 'number' ? feature.data : 1;
					cigarString += `${hardLen}H`;
					parsedCigar.push(['H', hardLen]);
					break;
				case 'P': // padding
					const padLen = typeof feature.data === 'number' ? feature.data : 1;
					cigarString += `${padLen}P`;
					parsedCigar.push(['P', padLen]);
					break;
				default:
					// Unknown feature, treat as match
					lastPos = feature.pos + 1;
			}
		}

		// Add trailing matches
		if (record.readLength && lastPos <= record.readLength) {
			const matchLen = record.readLength - lastPos + 1;
			cigarString += `${matchLen}M`;
			parsedCigar.push(['M', matchLen]);
		}
	} else {
		// No features = simple match
		const len = record.readLength || record.lengthOnRef || 0;
		if (len > 0) {
			cigarString = `${len}M`;
			parsedCigar.push(['M', len]);
		}
	}

	// Calculate end position
	const alignStart = record.alignmentStart - 1; // Convert 1-based to 0-based
	const lengthOnRef = record.lengthOnRef || record.readLength || 0;
	const alignEnd = alignStart + lengthOnRef;

	// Get sequence - use getReadBases() which handles reference-based encoding
	const seq = record.getReadBases() || '';

	// Convert quality scores
	let qual: Uint8Array | null = null;
	if (record.qualityScores && record.qualityScores.length > 0) {
		qual = new Uint8Array(record.qualityScores);
	}

	// Get mate info
	let mate: BAMReadFeature['mate'] | undefined;
	if (record.mate) {
		mate = {
			chromosome: chromosome, // Would need seqIdToName to resolve properly
			start: record.mate.alignmentStart - 1,
			isReversed: (record.mate.flags ?? 0 & 0x20) !== 0,
		};
	}

	return {
		id: `${record.readName || record.uniqueId}:${alignStart}-${alignEnd}:${flags}`,
		chromosome,
		start: alignStart,
		end: alignEnd,
		name: record.readName || undefined,
		strand: record.isReverseComplemented() ? '-' : '+',
		seq,
		qual,
		cigar: cigarString,
		parsedCigar,
		mq: record.mappingQuality || 0,
		isReversed: record.isReverseComplemented(),
		mdTag: record.tags?.MD as string | undefined,
		readName: record.readName || '',
		mate,
		templateLength: record.templateSize,
		flags,
	};
}

/**
 * Query features from a remote CRAM file
 * Returns BAMReadFeature with full sequence data for high-zoom rendering
 */
export async function queryCram(
	url: string,
	chromosome: string,
	start: number,
	end: number,
	options: { signal?: AbortSignal; assemblyId?: string } = {}
): Promise<BAMReadFeature[]> {
	const assemblyId = options.assemblyId;
	if (!assemblyId) {
		console.warn('CRAM requires assemblyId for reference sequence lookup');
		return [];
	}

	// Check cache
	const cacheKey = `cram:${url}:${chromosome}:${start}-${end}`;
	const cached = featureCache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.features;
	}

	try {
		const { cram, nameToSeqId, seqIdToName } = await getCramFile(url, assemblyId);

		// Resolve chromosome name to seqId
		let seqId = nameToSeqId.get(chromosome);
		if (seqId === undefined) {
			// Try common variations
			const variations = [
				chromosome.replace(/^chr/i, ''),
				'chr' + chromosome.replace(/^chr/i, ''),
			];
			for (const variant of variations) {
				seqId = nameToSeqId.get(variant);
				if (seqId !== undefined) break;
			}
		}

		if (seqId === undefined) {
			return [];
		}

		// Query records (CRAM uses 1-based coordinates)
		const records = await cram.getRecordsForRange(seqId, start + 1, end + 1);

		// Convert to BAMReadFeature
		const features = records.map(record => cramRecordToFeature(record, chromosome));

		// Cache results
		featureCache.set(cacheKey, { features, timestamp: Date.now() });

		return features;
	} catch (error) {
		console.error(`Error querying CRAM ${url}:`, error);
		throw error;
	}
}

/**
 * Get chromosome list from a CRAM file
 * Extracts reference sequence names from the SAM header
 */
export async function getCramChromosomes(url: string, assemblyId?: string): Promise<string[]> {
	try {
		// Read header directly without seqFetch (just need chromosome names)
		const tempCram = new CramFile({
			filehandle: new RemoteFile(url),
		});

		const samHeader = await tempCram.getSamHeader();
		const chromosomes: string[] = [];

		for (const line of samHeader) {
			if (line.tag === 'SQ') {
				const snTag = line.data.find((d: { tag: string; value: string }) => d.tag === 'SN');
				if (snTag) {
					chromosomes.push(snTag.value);
				}
			}
		}

		return chromosomes;
	} catch (error) {
		console.error(`Error getting chromosomes from CRAM ${url}:`, error);
		return [];
	}
}

/**
 * Get chromosome list from a BAM file
 * Extracts reference sequence names from the BAM header
 */
export async function getBamChromosomes(url: string): Promise<string[]> {
	try {
		const bam = await getBamFile(url);
		// indexToChr is populated after getHeader() - contains {refName, length}[]
		const refSeqs = bam.indexToChr || [];
		return refSeqs.map(r => r.refName);
	} catch (error) {
		console.error(`Error getting chromosomes from BAM ${url}:`, error);
		return [];
	}
}

/**
 * Coverage data for a genomic region
 */
export interface CoverageData {
	chromosome: string;
	start: number;
	end: number;
	coverage: number[];  // Coverage depth at each position
}

/**
 * Region with coverage information
 */
export interface CoverageRegion {
	chromosome: string;
	start: number;
	end: number;
	coverage: number;
}

/**
 * Compute coverage depth from BAM reads for a given region
 * Returns an array where index i represents coverage at position start+i
 */
export function computeCoverage(
	reads: BAMReadFeature[],
	regionStart: number,
	regionEnd: number
): number[] {
	const length = regionEnd - regionStart;
	const coverage = new Array(length).fill(0);

	for (const read of reads) {
		// Calculate overlap with region
		const overlapStart = Math.max(read.start, regionStart);
		const overlapEnd = Math.min(read.end, regionEnd);

		if (overlapStart < overlapEnd) {
			// Increment coverage for each overlapping position
			for (let pos = overlapStart; pos < overlapEnd; pos++) {
				const index = pos - regionStart;
				if (index >= 0 && index < length) {
					coverage[index]++;
				}
			}
		}
	}

	return coverage;
}

/**
 * Find contiguous regions that meet minimum coverage criteria
 */
export function findCoverageRegions(
	coverageData: number[],
	regionStart: number,
	minCoverage: number,
	chromosome: string
): CoverageRegion[] {
	const regions: CoverageRegion[] = [];
	let currentStart = -1;
	let currentSum = 0;
	let currentLength = 0;

	for (let i = 0; i < coverageData.length; i++) {
		const coverage = coverageData[i];
		const position = regionStart + i;

		if (coverage >= minCoverage) {
			// Start or continue a region
			if (currentStart === -1) {
				currentStart = position;
				currentSum = coverage;
				currentLength = 1;
			} else {
				currentSum += coverage;
				currentLength++;
			}
		} else {
			// End current region if it exists
			if (currentStart !== -1) {
				regions.push({
					chromosome,
					start: currentStart,
					end: currentStart + currentLength,
					coverage: Math.round(currentSum / currentLength) // Average coverage
				});
				currentStart = -1;
				currentSum = 0;
				currentLength = 0;
			}
		}
	}

	// Handle region that extends to the end
	if (currentStart !== -1) {
		regions.push({
			chromosome,
			start: currentStart,
			end: currentStart + currentLength,
			coverage: Math.round(currentSum / currentLength)
		});
	}

	return regions;
}

/**
 * Query BAM file and return regions that meet coverage criteria
 * This is the main function for coverage-based queries
 */
export async function queryBamCoverage(
	url: string,
	chromosome: string,
	start: number,
	end: number,
	minCoverage: number,
	options: { signal?: AbortSignal; assemblyId?: string } = {}
): Promise<CoverageRegion[]> {
	// 1. Query reads from the indexed BAM file (existing efficient method)
	const reads = await queryBam(url, chromosome, start, end, options);

	// 2. Compute coverage for this region only
	const coverageArray = computeCoverage(reads, start, end);

	// 3. Find regions that meet the minimum coverage criteria
	const regions = findCoverageRegions(coverageArray, start, minCoverage, chromosome);

	return regions;
}

/**
 * Get detailed coverage data for a region (for visualization)
 */
export async function getBamCoverageData(
	url: string,
	chromosome: string,
	start: number,
	end: number,
	options: { signal?: AbortSignal; assemblyId?: string; pixelsPerBase?: number } = {}
): Promise<CoverageData> {
	const regionSize = end - start;
	const pixelsPerBase = options.pixelsPerBase || 1; // Default to high detail

	// Use windowed coverage for large regions (density mode). At this zoom each
	// base is sub-pixel, so we sample ~75-175 windows instead of computing a
	// per-base array over the whole region.
	if (pixelsPerBase < 1 && regionSize > 50000) {
		// Resolution is driven by the user's coverage-quality setting.
		const { useCoverageQuality } = await import('$lib/stores/coverageQuality.svelte');
		const userResolution = useCoverageQuality().getQualityForTrackType('bam');

		const { selectBamStrategy, getBamData } = await import('./bamDataStrategy');
		const strategy = selectBamStrategy(regionSize, pixelsPerBase, userResolution);

		if (strategy.useWindowed) {
			const bamData = await getBamData(url, chromosome, start, end, strategy);

			if (bamData.type === 'coverage') {
				// Windows uniformly tile the region, so the per-window depth values
				// are the coverage series the renderer maps proportionally across
				// the viewport. No dense per-base array required.
				const coverage = (bamData.data as Array<{ value: number }>).map((w) => w.value);

				return {
					chromosome,
					start,
					end,
					coverage
				};
			}
		}
	}

	// Fallback to per-base coverage for smaller regions or individual-reads mode.
	const reads = await queryBam(url, chromosome, start, end, options);
	const coverage = computeCoverage(reads, start, end);

	return {
		chromosome,
		start,
		end,
		coverage
	};
}

/**
 * Clear all BAM and CRAM caches
 */
export function clearBamCache(): void {
	bamCache.clear();
	cramCache.clear();
	featureCache.clear();
}
