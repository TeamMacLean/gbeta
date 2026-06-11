/**
 * Gene Lookup Service
 *
 * Resolves a gene symbol (or fuzzy term) to genomic coordinates for the current
 * assembly, so any GQL command that accepts coordinates can accept a gene name.
 *
 * Two backends, routed per-assembly with NO overlap (so no fallback logic):
 *   - MyGene.info  — 18 assemblies (vertebrates, plants, microbes, viruses)
 *   - Ensembl REST — 6 fungal/protist assemblies
 *
 * Design notes (see docs/plans/gene-lookup-implementation.md):
 *   - Coordinates are returned 1-based (as the APIs and the browser's coordinate
 *     strings express them, e.g. BRCA1 -> chr17:43044292-43170245). Callers feed
 *     these into the same path as a typed coordinate string, so the existing
 *     1-based -> internal conversion is reused and not duplicated here.
 *   - Chromosome names from the APIs vary by organism (MyGene human -> "17",
 *     MyGene E. coli -> "NC_000913.3", Ensembl -> bare seq_region_name). We
 *     normalize each against the assembly's own chromosome list/aliases.
 *   - The result is REPRODUCIBLE: facts come from real data sources, never from
 *     an AI guess.
 */

import type { GenomeAssembly } from '$lib/types/genome';

export interface GeneResult {
	symbol: string; // e.g. BRCA1
	name: string; // e.g. BRCA1 DNA repair associated
	chromosome: string; // normalized to the assembly's convention (e.g. chr17)
	start: number; // 1-based start (genomic convention)
	end: number; // 1-based end
	strand: '+' | '-';
	source: 'mygene' | 'ensembl';
}

type LookupConfig =
	| { backend: 'mygene'; taxid: number }
	| { backend: 'ensembl'; species: string };

/**
 * Assembly id -> backend config. Keys match `assemblies.json` ids exactly.
 * Ensembl species names verified against rest.ensembl.org/info/assembly.
 */
export const GENE_LOOKUP_CONFIG: Record<string, LookupConfig> = {
	// --- MyGene.info ---
	grch38: { backend: 'mygene', taxid: 9606 },
	grch37: { backend: 'mygene', taxid: 9606 },
	't2t-chm13': { backend: 'mygene', taxid: 9606 },
	mm39: { backend: 'mygene', taxid: 10090 },
	mm10: { backend: 'mygene', taxid: 10090 },
	rn7: { backend: 'mygene', taxid: 10116 },
	danrer11: { backend: 'mygene', taxid: 7955 },
	dm6: { backend: 'mygene', taxid: 7227 },
	ce11: { backend: 'mygene', taxid: 6239 },
	galGal6: { backend: 'mygene', taxid: 9031 },
	tair10: { backend: 'mygene', taxid: 3702 },
	irgsp1: { backend: 'mygene', taxid: 39947 },
	'zm-b73-nam5': { backend: 'mygene', taxid: 4577 },
	'iwgsc-refseq2': { backend: 'mygene', taxid: 4565 },
	'morex-v3': { backend: 'mygene', taxid: 4513 },
	spombe: { backend: 'mygene', taxid: 4896 },
	'ecoli-k12': { backend: 'mygene', taxid: 511145 },
	'sars-cov-2': { backend: 'mygene', taxid: 2697049 },

	// --- Ensembl REST ---
	saccer3: { backend: 'ensembl', species: 'saccharomyces_cerevisiae' },
	botrytis: { backend: 'ensembl', species: 'botrytis_cinerea' },
	magnaporthe: { backend: 'ensembl', species: 'pyricularia_oryzae' },
	puccinia: { backend: 'ensembl', species: 'puccinia_graminis' },
	zymoseptoria: { backend: 'ensembl', species: 'zymoseptoria_tritici' },
	phytophthora: { backend: 'ensembl', species: 'phytophthora_infestans' }
};

const MYGENE_BASE = 'https://mygene.info/v3';
const ENSEMBL_BASE = 'https://rest.ensembl.org';
const TIMEOUT_MS = 5000;
const MAX_RESULTS = 10;

const COORDINATE_RE = /^([\w.\-]+):([\d,]+)-([\d,]+)$/;

/**
 * True when the term is a VALID coordinate (e.g. chr17:1-1000 or
 * NC_000913.3:1-1000000) and should be used directly rather than looked up.
 * Also validates semantics — a reversed range (chr1:5000-1000) is not a usable
 * coordinate.
 */
export function isCoordinate(term: string): boolean {
	const m = term.trim().match(COORDINATE_RE);
	if (!m) return false;
	const start = parseInt(m[2].replace(/,/g, ''), 10);
	const end = parseInt(m[3].replace(/,/g, ''), 10);
	return !isNaN(start) && !isNaN(end) && end > start;
}

/** Whether gene lookup is available for an assembly. */
export function supportsGeneLookup(assemblyId: string): boolean {
	return assemblyId in GENE_LOOKUP_CONFIG;
}

// --- session cache (cleared on refresh) ---
const cache = new Map<string, GeneResult[]>();
const cacheKey = (term: string, assemblyId: string) =>
	`${term.trim().toLowerCase()}:${assemblyId}`;

/** Test seam: clears the session cache. */
export function _clearGeneCache(): void {
	cache.clear();
}

/**
 * Resolve a gene term to coordinates for the given assembly.
 * @returns top matches (best first); empty array when nothing matches.
 * @throws when the assembly is unsupported or the API call fails.
 */
export async function lookupGene(
	term: string,
	assembly: GenomeAssembly
): Promise<GeneResult[]> {
	const trimmed = term.trim();
	if (!trimmed) return [];

	// A gene symbol is a single token — never a phrase. Reject multi-word junk
	// (e.g. a hallucinated "FIRST GENE IN <track>") so it can't fuzzy-match to a
	// random gene and navigate somewhere unexpected.
	if (/\s/.test(trimmed)) return [];

	const config = GENE_LOOKUP_CONFIG[assembly.id];
	if (!config) {
		throw new Error(`Gene lookup not available for ${assembly.name}`);
	}

	const key = cacheKey(trimmed, assembly.id);
	const cached = cache.get(key);
	if (cached) return cached;

	const results =
		config.backend === 'mygene'
			? await lookupMyGene(trimmed, config.taxid, assembly)
			: await lookupEnsembl(trimmed, config.species, assembly);

	cache.set(key, results);
	return results;
}

// ---------------------------------------------------------------------------
// MyGene.info
// ---------------------------------------------------------------------------

interface MyGeneHit {
	symbol?: string;
	name?: string;
	genomic_pos?: MyGenePos | MyGenePos[];
}
interface MyGenePos {
	chr: string;
	start: number;
	end: number;
	strand: number;
}

async function lookupMyGene(
	term: string,
	taxid: number,
	assembly: GenomeAssembly
): Promise<GeneResult[]> {
	const url =
		`${MYGENE_BASE}/query?q=${encodeURIComponent(term)}` +
		`&species=${taxid}&fields=symbol,name,genomic_pos&size=${MAX_RESULTS}`;
	const json = await fetchJson(url, 'MyGene');
	const hits: MyGeneHit[] = json?.hits ?? [];

	const results: GeneResult[] = [];
	for (const hit of hits) {
		if (!hit.symbol) continue;
		// A gene can map to multiple loci (e.g. pseudoautosomal, alt contigs).
		// Emit every position rather than silently dropping all but the first —
		// the picker then lets the user disambiguate.
		const positions = Array.isArray(hit.genomic_pos)
			? hit.genomic_pos
			: hit.genomic_pos
				? [hit.genomic_pos]
				: [];
		for (const pos of positions) {
			if (!pos) continue;
			results.push({
				symbol: hit.symbol,
				name: hit.name ?? hit.symbol,
				chromosome: normalizeChromosome(pos.chr, assembly),
				start: pos.start,
				end: pos.end,
				strand: pos.strand < 0 ? '-' : '+',
				source: 'mygene'
			});
		}
	}
	return results;
}

// ---------------------------------------------------------------------------
// Ensembl REST (two-step: symbol -> gene id -> coordinates)
// ---------------------------------------------------------------------------

interface EnsemblXref {
	type: string;
	id: string;
}
interface EnsemblGene {
	display_name?: string;
	id: string;
	seq_region_name: string;
	start: number;
	end: number;
	strand: number;
	biotype?: string;
}

async function lookupEnsembl(
	term: string,
	species: string,
	assembly: GenomeAssembly
): Promise<GeneResult[]> {
	const xrefUrl =
		`${ENSEMBL_BASE}/xrefs/symbol/${species}/${encodeURIComponent(term)}` +
		`?content-type=application/json`;
	const xrefs: EnsemblXref[] = (await fetchJson(xrefUrl, 'Ensembl')) ?? [];
	const geneIds = xrefs.filter((x) => x.type === 'gene').map((x) => x.id);
	if (geneIds.length === 0) return [];

	const results: GeneResult[] = [];
	for (const id of geneIds.slice(0, MAX_RESULTS)) {
		const gene: EnsemblGene = await fetchJson(
			`${ENSEMBL_BASE}/lookup/id/${id}?content-type=application/json`,
			'Ensembl'
		);
		if (!gene || gene.start == null || gene.end == null) continue;
		results.push({
			symbol: gene.display_name ?? gene.id,
			name: gene.display_name ?? gene.id,
			chromosome: normalizeChromosome(gene.seq_region_name, assembly),
			start: gene.start,
			end: gene.end,
			strand: gene.strand < 0 ? '-' : '+',
			source: 'ensembl'
		});
	}
	return results;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Map a chromosome name returned by an API to the assembly's canonical name.
 * Built-in assemblies are inconsistent (grch38 "chr17" without aliases, ecoli
 * "NC_000913.3", botrytis bare "1", saccer3 "chrI"), so we try several
 * strategies and fall back to the raw value if none match.
 */
export function normalizeChromosome(raw: string, assembly: GenomeAssembly): string {
	const chroms = assembly.chromosomes;
	const lower = raw.toLowerCase();

	// 1. exact name (case-insensitive)
	const direct = chroms.find((c) => c.name.toLowerCase() === lower);
	if (direct) return direct.name;

	// 2. alias (case-insensitive)
	const aliased = chroms.find((c) => c.aliases?.some((a) => a.toLowerCase() === lower));
	if (aliased) return aliased.name;

	// 3. add a "chr" prefix (MyGene "17" -> chr17, Ensembl "IV" -> chrIV)
	const prefixed = `chr${raw}`.toLowerCase();
	const withPrefix = chroms.find((c) => c.name.toLowerCase() === prefixed);
	if (withPrefix) return withPrefix.name;

	// 4. strip a "chr" prefix (API "chr1" -> assembly "1")
	if (lower.startsWith('chr')) {
		const stripped = lower.slice(3);
		const withoutPrefix = chroms.find((c) => c.name.toLowerCase() === stripped);
		if (withoutPrefix) return withoutPrefix.name;
	}

	// no confident match — return raw (chromosome validation will surface it)
	return raw;
}

async function fetchJson(url: string, backend: string): Promise<any> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) {
			throw new Error(`${backend} request failed (HTTP ${res.status})`);
		}
		return await res.json();
	} catch (err) {
		if (err instanceof Error && err.name === 'AbortError') {
			throw new Error(`${backend} lookup timed out`);
		}
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`${backend} lookup failed: ${msg}`);
	} finally {
		clearTimeout(timer);
	}
}
