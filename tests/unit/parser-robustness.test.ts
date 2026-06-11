import { describe, it, expect } from 'vitest';
import { geneModelTrackType } from '$lib/services/trackTypes/geneModel';
import { signalTrackType } from '$lib/services/trackTypes/signal';
import { intervalsTrackType } from '$lib/services/trackTypes/intervals';
import { variantsTrackType } from '$lib/services/trackTypes/variants';

describe('GFF3 parser — malformed attributes (was a crash)', () => {
	it('does not throw on a malformed %-escape; keeps the rest of the track', () => {
		const gff = 'chr1\t.\tgene\t100\t200\t.\t+\t.\tID=gene1;Name=%ZZ\nchr1\t.\tgene\t300\t400\t.\t+\t.\tID=gene2;Name=ok';
		let result: any;
		expect(() => { result = geneModelTrackType.parse!(gff); }).not.toThrow();
		// both rows parse (the bad escape falls back to the raw value, not a crash)
		expect(result.features.length).toBe(2);
	});

	it('handles attribute values containing "=" and bare keys without value', () => {
		const gff = 'chr1\t.\tgene\t100\t200\t.\t+\t.\tID=gene1;Note=a=b;BareKey';
		const { features } = geneModelTrackType.parse!(gff);
		expect(features.length).toBe(1);
	});
});

describe('bedGraph parser — non-integer coordinates', () => {
	it('rejects float coordinates instead of silently truncating', () => {
		const { features, errors } = signalTrackType.parse!('chr1\t100.5\t200.7\t42.5');
		expect(features.length).toBe(0);
		expect(errors.length).toBeGreaterThan(0);
	});
	it('rejects scientific-notation coordinates', () => {
		const { features } = signalTrackType.parse!('chr1\t1e2\t2e2\t42');
		expect(features.length).toBe(0);
	});
	it('accepts valid integer coordinates', () => {
		const { features } = signalTrackType.parse!('chr1\t100\t200\t42.5');
		expect(features.length).toBe(1);
		expect(features[0].start).toBe(100);
	});
});

describe('BED12 parser — block-count consistency', () => {
	it('rejects block annotations whose count does not match blockSizes/blockStarts', () => {
		// blockCount=5 but only 2 blocks supplied
		const bed = 'chr1\t100\t200\tfeat\t0\t+\t100\t200\t0\t5\t50,50\t0,50';
		const { features, errors } = intervalsTrackType.parse!(bed);
		expect(features.length).toBe(1);
		expect(features[0].blockCount).toBeUndefined(); // not applied
		expect(errors.some((e: string) => /block/i.test(e))).toBe(true);
	});
	it('accepts consistent BED12 blocks', () => {
		const bed = 'chr1\t100\t200\tfeat\t0\t+\t100\t200\t0\t2\t50,50\t0,50';
		const { features } = intervalsTrackType.parse!(bed);
		expect(features[0].blockCount).toBe(2);
	});
});

describe('VCF parser — REF/ALT and chromosome naming', () => {
	it('rejects an empty ALT field', () => {
		const { features, errors } = variantsTrackType.parse!('1\t100\t.\tA\t');
		expect(features.length).toBe(0);
		expect(errors.length).toBeGreaterThan(0);
	});
	it('does not mangle an accession into chrNC_... (only UCSC-style names get a prefix)', () => {
		const { features } = variantsTrackType.parse!('NC_000913.3\t100\t.\tA\tT');
		expect(features.length).toBe(1);
		expect(features[0].chromosome).toBe('NC_000913.3');
	});
	it('still adds chr prefix for UCSC-style human names', () => {
		const { features } = variantsTrackType.parse!('1\t100\t.\tA\tT');
		expect(features[0].chromosome).toBe('chr1');
	});
});
