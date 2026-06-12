/**
 * Build a prefilled GitHub "new issue" URL for in-app feedback.
 *
 * Auto-fills diagnostic context to make field reports actionable — but only
 * METADATA (assembly, viewport coordinates, track *types*, browser). Never
 * track names or feature data, so nothing identifying leaves the browser.
 */

const REPO = 'TeamMacLean/gbeta';
const VERSION = '0.1.0';

export interface FeedbackContext {
	assemblyName: string;
	assemblyId: string;
	/** e.g. "chr17:7,657,914-7,691,411" */
	view: string;
	/** Loaded tracks summarized by type only, e.g. "1 gene-model, 1 variants" */
	trackSummary: string;
	/** Current page URL (encodes the view; contains no track data). */
	url: string;
	/** navigator.userAgent */
	userAgent: string;
}

/** Summarize loaded tracks by type only (no names — privacy). */
export function summarizeTracks(types: string[]): string {
	if (types.length === 0) return 'none loaded';
	const counts = new Map<string, number>();
	for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts.entries()].map(([type, n]) => `${n} ${type}`).join(', ');
}

export function buildFeedbackUrl(ctx: FeedbackContext): string {
	const body = [
		'_Thanks for trying gBeta! A quick report helps a lot — fill in what you can:_',
		'',
		'**What were you trying to do?**',
		'',
		'',
		'**What happened?**',
		'',
		'',
		'**What did you expect instead?**',
		'',
		'',
		'---',
		'_Auto-filled context (metadata only — no genomic data):_',
		`- gBeta: v${VERSION}`,
		`- Assembly: ${ctx.assemblyName} (${ctx.assemblyId})`,
		`- View: ${ctx.view}`,
		`- Tracks: ${ctx.trackSummary}`,
		`- URL: ${ctx.url}`,
		`- Browser: ${ctx.userAgent}`
	].join('\n');

	const params = new URLSearchParams({
		title: 'gBeta feedback: ',
		body,
		labels: 'feedback'
	});
	return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}
