import { describe, it, expect } from 'vitest';
import { buildFeedbackUrl, summarizeTracks, type FeedbackContext } from '$lib/services/feedback';

const ctx: FeedbackContext = {
	assemblyName: 'Human GRCh38',
	assemblyId: 'grch38',
	view: 'chr17:7,657,914-7,691,411',
	trackSummary: '1 gene-model, 1 variants',
	url: 'https://teammaclean.github.io/gbetter/?chr=chr17&start=7657913&end=7691411',
	userAgent: 'Mozilla/5.0 (Macintosh)'
};

describe('summarizeTracks', () => {
	it('counts by type, no names', () => {
		expect(summarizeTracks(['gene-model', 'variants', 'variants'])).toBe('1 gene-model, 2 variants');
	});
	it('reports none', () => {
		expect(summarizeTracks([])).toBe('none loaded');
	});
});

describe('buildFeedbackUrl', () => {
	it('targets a new GitHub issue on the repo with the feedback label', () => {
		const url = buildFeedbackUrl(ctx);
		expect(url.startsWith('https://github.com/TeamMacLean/gbeta/issues/new?')).toBe(true);
		const params = new URL(url).searchParams;
		expect(params.get('labels')).toBe('feedback');
		expect(params.get('title')).toMatch(/gBeta feedback/);
	});

	it('embeds the diagnostic context in the body', () => {
		const body = new URL(buildFeedbackUrl(ctx)).searchParams.get('body')!;
		expect(body).toContain('Human GRCh38 (grch38)');
		expect(body).toContain('chr17:7,657,914-7,691,411');
		expect(body).toContain('1 gene-model, 1 variants');
		expect(body).toContain(ctx.url);
		expect(body).toContain('Macintosh');
	});

	it('does not leak track names or feature data (metadata only)', () => {
		// summarizeTracks only ever receives types, so a name like "patient1.vcf"
		// can't appear. Sanity-check the body has no raw filename pattern.
		const body = new URL(buildFeedbackUrl(ctx)).searchParams.get('body')!;
		expect(body).not.toMatch(/\.vcf|\.bam|\.gff/);
	});
});
