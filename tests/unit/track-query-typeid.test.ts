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
