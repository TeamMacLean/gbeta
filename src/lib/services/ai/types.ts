/**
 * AI Provider abstraction for GQL translation
 *
 * Supports multiple AI backends (Claude, OpenAI, Gemini, local models)
 * User provides their own API key - stored in browser localStorage
 */

export interface AIProvider {
	/** Unique identifier for this provider */
	id: string;

	/** Display name */
	name: string;

	/** Provider website for getting API keys */
	apiKeyUrl: string;

	/** Placeholder text for API key input */
	apiKeyPlaceholder: string;

	/** Available models for this provider */
	models: AIModel[];

	/** Translate natural language to GQL */
	translate(request: TranslationRequest): Promise<TranslationResponse>;

	/** Test if the API key is valid */
	testConnection(apiKey: string): Promise<boolean>;
}

export interface AIModel {
	id: string;
	name: string;
	description?: string;
	isDefault?: boolean;
}

/** A prior turn in a multi-turn AI conversation. */
export interface ConversationTurn {
	role: 'user' | 'assistant';
	content: string;
}

export interface TranslationRequest {
	/** The natural language input from the user */
	input: string;

	/** Context about the current browser state */
	context: BrowserContext;

	/** API key for the provider */
	apiKey: string;

	/** Which model to use */
	model?: string;

	/** Prior conversation turns, for multi-turn follow-ups / clarifications. */
	history?: ConversationTurn[];
}

export interface BrowserContext {
	/** Currently loaded tracks */
	tracks: TrackInfo[];

	/** Current viewport */
	viewport: {
		chromosome: string;
		start: number;
		end: number;
	};

	/** Known gene names (for validation) */
	knownGenes: string[];

	/** Recent successful queries (for context) */
	recentQueries?: string[];
}

export interface TrackInfo {
	name: string;
	type: 'bed' | 'gff3' | 'vcf' | 'bedgraph' | 'bigwig' | 'bam' | 'fasta';
	featureCount: number;
	/** Sample feature names for context */
	sampleFeatures?: string[];
}

export interface TranslationResponse {
	success: boolean;

	/** The generated GQL command */
	gql?: string;

	/** Explanation of what the query does (optional) */
	explanation?: string;

	/** If the AI needs clarification */
	clarificationNeeded?: boolean;
	clarificationQuestion?: string;

	/** Error message if failed */
	error?: string;

	/** Raw response for debugging */
	rawResponse?: string;
}

/** Stored settings for AI providers */
export interface AISettings {
	/** Currently selected provider */
	activeProvider: string;

	/** Currently selected model (per provider) */
	activeModels: Record<string, string>;

	/** API keys (per provider) - stored in localStorage */
	apiKeys: Record<string, string>;
}

/** Default settings */
export const DEFAULT_AI_SETTINGS: AISettings = {
	activeProvider: 'anthropic',
	activeModels: {
		anthropic: 'claude-sonnet-4-6',
		openai: 'gpt-4o-mini',
	},
	apiKeys: {},
};
