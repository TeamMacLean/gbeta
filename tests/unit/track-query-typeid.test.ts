import { describe, it, expect } from 'vitest';
import { geneModelTrackType } from '$lib/services/trackTypes/geneModel';
import { variantsTrackType } from '$lib/services/trackTypes/variants';
import { parseQuery, executeQueryWithTracks } from '$lib/services/queryLanguage';

const GFF = [
	'chr17\tEnsembl\tgene\t100\t200\t.\t+\t.\tID=G1;Name=G1',
	'chr17\tEnsembl\tgene\t300\t400\t.\t+\t.\tID=G2;Name=G2'
].join('\n');

const VCF = [
	'##fileformat=VCFv4.2',
	'#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
	'chr17\t150\trs1\tC\tG\t.\tPASS\tGENE=G1;CLIN=pathogenic'
].join('\n');

function tracks() {
	return [
		{
			id: 'g',
			name: 'human-genes-complex',
			typeId: geneModelTrackType.id, // real registry id ('gene-model')
			visible: true,
			features: geneModelTrackType.parse(GFF).features
		},
		{
			id: 'v',
			name: 'cancer-variants',
			typeId: variantsTrackType.id, // real registry id ('variants')
			visible: true,
			features: variantsTrackType.parse(VCF).features
		}
	] as any;
}
const run = (q: string) => executeQueryWithTracks(parseQuery(q), tracks());

describe('query engine recognizes real registry track typeIds', () => {
	it('SELECT GENES sees a gene-model track', () => {
		expect(run('SELECT GENES').results?.length).toBe(2);
	});
	it('SELECT VARIANTS sees a variants track', () => {
		expect(run('SELECT VARIANTS').results?.length).toBe(1);
	});
	it('INTERSECT resolves "variants" to the VCF track', () => {
		expect(run('SELECT GENES INTERSECT variants').results?.length).toBe(1); // G1 overlaps the variant
	});
	it('FROM tolerates a quoted track name', () => {
		expect(run('SELECT VARIANTS FROM "cancer-variants"').results?.length).toBe(1);
	});
	it('WITHIN tolerates a quoted gene name from the loaded track', () => {
		expect(run('SELECT VARIANTS WITHIN "G1"').results?.length).toBe(1);
	});
});

describe('WHERE count filters genes by INTERSECT overlap count', () => {
	// G1 gets 2 variants, G2 gets 1.
	const GFF2 = [
		'chr17\tEnsembl\tgene\t100\t200\t.\t+\t.\tID=G1;Name=G1',
		'chr17\tEnsembl\tgene\t300\t400\t.\t+\t.\tID=G2;Name=G2'
	].join('\n');
	const VCF2 = [
		'##fileformat=VCFv4.2',
		'#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
		'chr17\t120\tr1\tC\tG\t.\tPASS\tGENE=G1',
		'chr17\t160\tr2\tC\tT\t.\tPASS\tGENE=G1',
		'chr17\t320\tr3\tA\tG\t.\tPASS\tGENE=G2'
	].join('\n');
	const t = () =>
		[
			{ id: 'g', name: 'genes', typeId: geneModelTrackType.id, visible: true, features: geneModelTrackType.parse(GFF2).features },
			{ id: 'v', name: 'variants', typeId: variantsTrackType.id, visible: true, features: variantsTrackType.parse(VCF2).features }
		] as any;
	const r = (q: string) => executeQueryWithTracks(parseQuery(q), t());

	it('exposes a numeric count field and filters with =', () => {
		const res = r('SELECT GENES INTERSECT variants WHERE count = 1');
		expect(res.results?.map((x) => x.name)).toEqual(['G2']);
	});
	it('filters with < ', () => {
		expect(r('SELECT GENES INTERSECT variants WHERE count < 2').results?.map((x) => x.name)).toEqual(['G2']);
	});
	it('filters with >=', () => {
		expect(r('SELECT GENES INTERSECT variants WHERE count >= 2').results?.map((x) => x.name)).toEqual(['G1']);
	});

	it('MIN(count) reports the minimum and the achieving gene', () => {
		const res = r('SELECT MIN(count) GENES INTERSECT variants');
		expect(res.message).toMatch(/MIN\(count\) = 1/);
		expect(res.results?.map((x) => x.name)).toEqual(['G2']); // G2 has 1
	});
	it('MAX(count) reports the maximum', () => {
		const res = r('SELECT MAX(count) GENES INTERSECT variants');
		expect(res.message).toMatch(/MAX\(count\) = 2/);
		expect(res.results?.map((x) => x.name)).toEqual(['G1']);
	});
	it('AVG and SUM over the per-gene counts', () => {
		expect(r('SELECT AVG(count) GENES INTERSECT variants').message).toMatch(/AVG\(count\) = 1\.5/);
		expect(r('SELECT SUM(count) GENES INTERSECT variants').message).toMatch(/SUM\(count\) = 3/);
	});
	it('explains when the aggregate field is absent (no INTERSECT)', () => {
		expect(r('SELECT MIN(count) GENES').message).toMatch(/no numeric "count"/i);
	});
	it('does not let a track name containing "gene" hijack the SELECT target', () => {
		expect(parseQuery('SELECT VARIANTS FROM human-genes-complex').params).toMatchObject({ what: 'variants' });
	});
});
