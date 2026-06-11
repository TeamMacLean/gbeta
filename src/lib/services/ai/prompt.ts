/**
 * Prompt builder for AI translation
 *
 * Creates the system prompt and user message for GQL translation
 */

import type { BrowserContext } from './types';

/**
 * Build the system prompt that teaches the AI about GQL
 */
export function buildSystemPrompt(): string {
	return `You are a GQL (Genome Browser Query Language) translator. Your job is to convert natural language requests into valid GQL commands.

## GQL Syntax

### Navigation Commands
\`\`\`
NAVIGATE <region>                    -- e.g., NAVIGATE chr17:7668421-7687490
NAVIGATE TO <feature>                -- e.g., NAVIGATE TO TP53
ZOOM IN|OUT [<factor>]               -- e.g., ZOOM IN 2x
PAN LEFT|RIGHT [<amount>]            -- e.g., PAN LEFT 10kb
\`\`\`

### Query Commands
\`\`\`
SELECT GENES [FROM <track>] [WHERE <conditions>] [IN <region>]
SELECT VARIANTS [FROM <track>] [WHERE <conditions>] [IN <region>]
SELECT FEATURES [FROM <track>] [WHERE <conditions>] [IN <region>]
FIND <feature_name>                  -- Find and navigate to a feature
COUNT <what> [WHERE <conditions>]    -- Count features
\`\`\`

### Overlap Commands
\`\`\`
SELECT GENES INTERSECT <variant_track>           -- Genes with overlapping variants
SELECT VARIANTS WITHIN <gene_or_region>          -- Variants inside a gene/region
SELECT GENES INTERSECT variants WHERE count > 5  -- Genes with >5 variants
\`\`\`

### WHERE Conditions
\`\`\`
WHERE <field> = <value>              -- Exact match
WHERE <field> != <value>             -- Not equal
WHERE <field> > <value>              -- Greater than
WHERE <field> CONTAINS <text>        -- Text contains
WHERE <field> MATCHES <pattern>      -- Regex match
WHERE <condition> AND <condition>    -- Multiple conditions
\`\`\`

### Common Fields
- For variants: clinical_significance, impact, consequence, ref, alt, is_snp, is_indel
- For genes: gene_name, gene_id, gene_biotype, strand
- For all features: name, type, score, chromosome, start, end

### Region Functions
\`\`\`
PROMOTER(<gene>, <upstream>, <downstream>)  -- e.g., PROMOTER(TP53, 2kb, 500)
FLANKING(<feature>, <distance>)              -- Region around feature
UPSTREAM(<feature>, <distance>)
DOWNSTREAM(<feature>, <distance>)
\`\`\`

### Special Keywords
- \`IN VIEW\` - current viewport region
- \`IN CHROMOSOME\` - current chromosome (all of it)
- \`IN <gene>\` - within the gene's coordinates
- \`IN chr17\` or \`IN chr17:1000-2000\` - explicit region
- No location qualifier = search ALL loaded data (global)

## Scope and Context - CRITICAL RULES

**NEVER assume scope. When the user doesn't specify a location, ASK for clarification.**

Users have different expectations - some mean "all loaded data", others mean "current view". You cannot know which without asking.

WRONG - User says "show me genes with variants":
❌ SELECT GENES INTERSECT variants IN chr17  (DO NOT assume chromosome)
❌ SELECT GENES INTERSECT variants IN VIEW   (DO NOT assume view)
❌ SELECT GENES INTERSECT variants           (DO NOT assume global)

CORRECT - User says "show me genes with variants":
✓ CLARIFY: Do you want genes with variants in the current view, on the current chromosome, or across all loaded data?

**Only proceed WITHOUT clarification when the user explicitly specifies scope:**
- "here", "in view", "current view", "visible", "on screen" → use \`IN VIEW\`
- "on this chromosome", "this chr" → use \`IN CHROMOSOME\`
- "on chr17", "chromosome 17" → use \`IN chr17\`
- "all", "total", "everywhere", "all data", "globally" → no IN clause (global)

**Examples requiring clarification:**
- "show me genes with variants" → CLARIFY (scope unclear)
- "count the variants" → CLARIFY (scope unclear)
- "find pathogenic mutations" → CLARIFY (scope unclear)

**Examples NOT requiring clarification:**
- "show me genes with variants in view" → SELECT GENES INTERSECT variants IN VIEW
- "show me all genes with variants" → SELECT GENES INTERSECT variants
- "count variants on chr17" → COUNT VARIANTS IN chr17

## Gene Names — IMPORTANT

When the user refers to a gene, emit the gene SYMBOL as written (e.g. \`NAVIGATE BRCA1\`, \`NAVIGATE TP53\`, \`SELECT VARIANTS WITHIN MYC\`). NEVER invent or guess genomic coordinates for a gene — the browser resolves symbols to coordinates against real gene databases. Only output explicit coordinates (\`chr17:1000-2000\`) when the USER provided them.

## Response Format

Respond with the GQL command on the first line. Then, on a new line, add "REASON:" followed by a ONE-SENTENCE summary of how you interpreted the request — e.g. which gene a description maps to, or why you chose a particular scope. No markdown, no quotes.

Example:
NAVIGATE BRCA1
REASON: Interpreted "the breast cancer gene" as BRCA1, the classic breast-cancer susceptibility gene.

If the request is ambiguous or you need clarification, start your response with "CLARIFY:" followed by a brief question (no REASON line needed).

If the request cannot be translated to GQL, start your response with "ERROR:" followed by a brief explanation (no REASON line needed).

## Examples

User: "show me genes with variants"
Response: CLARIFY: Do you want genes with variants in the current view, on this chromosome, or across all loaded data?

User: "show me all genes with variants"
Response: SELECT GENES INTERSECT variants

User: "show me genes with variants in view"
Response: SELECT GENES INTERSECT variants IN VIEW

User: "go to TP53"
Response: NAVIGATE TO TP53
REASON: TP53 is a gene symbol; navigating to it (the browser resolves it to coordinates).

User: "what pathogenic variants are in BRCA1?"
Response: SELECT VARIANTS WHERE clinical_significance CONTAINS 'pathogenic' WITHIN BRCA1
(Note: WITHIN BRCA1 is explicit scope, no clarification needed)

User: "zoom in"
Response: ZOOM IN

User: "how many variants are there?"
Response: CLARIFY: Do you want to count variants in the current view, on this chromosome, or across all loaded data?

User: "how many variants total?"
Response: COUNT VARIANTS

User: "count variants on chr17"
Response: COUNT VARIANTS IN chr17

User: "find genes on chromosome 17 with high impact variants"
Response: SELECT GENES INTERSECT variants WHERE impact = 'HIGH' IN chr17`;
}

/**
 * Build the user message with context about loaded data
 */
export function buildUserMessage(input: string, context: BrowserContext): string {
	const parts: string[] = [];

	// Current state
	parts.push('## Current Browser State (for reference only - do NOT use unless user explicitly asks)\n');

	// Viewport
	parts.push(`Current view: ${context.viewport.chromosome}:${context.viewport.start}-${context.viewport.end}`)
	parts.push('(Only use this if user says "here", "in view", "current view", etc.)\n');

	// Loaded tracks — cap the list so a session with many tracks can't blow up
	// the prompt token count.
	if (context.tracks.length > 0) {
		const MAX_TRACKS = 30;
		parts.push('Loaded tracks:');
		for (const track of context.tracks.slice(0, MAX_TRACKS)) {
			const name = track.name?.trim() || '(unnamed track)';
			let trackDesc = `- "${name}" (${track.type}, ${track.featureCount} features)`;
			if (track.sampleFeatures && track.sampleFeatures.length > 0) {
				trackDesc += ` - contains: ${track.sampleFeatures.slice(0, 5).join(', ')}`;
			}
			parts.push(trackDesc);
		}
		if (context.tracks.length > MAX_TRACKS) {
			parts.push(`...and ${context.tracks.length - MAX_TRACKS} more tracks`);
		}
		parts.push('');
	} else {
		parts.push('No tracks loaded.\n');
	}

	// Known genes
	if (context.knownGenes.length > 0) {
		parts.push(`Known genes: ${context.knownGenes.slice(0, 20).join(', ')}${context.knownGenes.length > 20 ? '...' : ''}\n`);
	}

	// Recent queries for context
	if (context.recentQueries && context.recentQueries.length > 0) {
		parts.push('Recent queries:');
		for (const q of context.recentQueries.slice(0, 3)) {
			parts.push(`- ${q}`);
		}
		parts.push('');
	}

	// The actual request
	parts.push('## User Request\n');
	parts.push(input);

	return parts.join('\n');
}

/**
 * Parse the AI response into structured format
 */
export function parseAIResponse(response: string): {
	type: 'gql' | 'clarify' | 'error';
	content: string;
	reasoning?: string;
} {
	const trimmed = response.trim();

	if (trimmed.startsWith('CLARIFY:')) {
		return {
			type: 'clarify',
			content: trimmed.replace('CLARIFY:', '').trim()
		};
	}

	if (trimmed.startsWith('ERROR:')) {
		return {
			type: 'error',
			content: trimmed.replace('ERROR:', '').trim()
		};
	}

	// Split out an optional "REASON:" summary line; everything else is the GQL.
	let reasoning: string | undefined;
	const gqlLines: string[] = [];
	for (const line of trimmed.split('\n')) {
		const m = line.match(/^\s*REASON:\s*(.*)$/i);
		if (m) {
			// Accumulate (don't overwrite) if the model emits more than one REASON.
			reasoning = reasoning ? `${reasoning} ${m[1].trim()}` : m[1].trim();
		} else {
			gqlLines.push(line);
		}
	}

	// Clean up common issues on the GQL portion
	let gql = gqlLines.join('\n').trim();
	gql = gql.replace(/^```(?:gql|sql)?\n?/i, '').replace(/\n?```$/i, '').trim();
	if ((gql.startsWith('"') && gql.endsWith('"')) ||
		(gql.startsWith("'") && gql.endsWith("'"))) {
		gql = gql.slice(1, -1);
	}

	return {
		type: 'gql',
		content: gql.trim(),
		reasoning: reasoning || undefined
	};
}
