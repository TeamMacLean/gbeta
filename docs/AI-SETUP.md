# AI Setup Guide

gBeta's AI features translate natural language queries into reproducible GQL commands. You can use cloud AI providers (Anthropic, OpenAI) or run everything locally with Ollama for complete privacy.

## Quick Comparison

| Provider | Cost | Privacy | Setup | Best For |
|----------|------|---------|-------|----------|
| **Ollama** | Free | Complete (local) | Medium | Privacy-conscious users, offline use |
| **Anthropic** | Pay-per-use | Query text sent | Easy | Best quality responses |
| **OpenAI** | Pay-per-use | Query text sent | Easy | Familiar API |

---

## Option 1: Ollama (Local, Private, Free)

Run AI entirely on your machine. Your data never leaves your computer.

### Step 1: Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from [ollama.ai/download](https://ollama.ai/download)

### Step 2: Download a Model

```bash
# Recommended: Good balance of speed and quality
ollama pull llama3.2

# Alternative: Faster, smaller
ollama pull mistral

# Alternative: Optimized for code-like tasks
ollama pull codellama
```

### Step 3: Start Ollama

```bash
ollama serve
```

This runs a local server at `http://localhost:11434`.

### Step 4: Configure gBeta

1. Open gBeta in your browser
2. Click the **Settings** icon in the header (gear icon)
3. Under **AI Provider**, select **Ollama (Local)**
4. Choose your model from the dropdown
5. Click **Test Connection** to verify

### Troubleshooting Ollama

**"Cannot connect to Ollama"**
- Make sure Ollama is running: `ollama serve`
- Check if it's accessible: `curl http://localhost:11434/api/tags`

**"Model not found"**
- Pull the model first: `ollama pull llama3.2`
- List available models: `ollama list`

**Slow responses**
- Smaller models are faster: try `mistral` instead of `llama3.1:70b`
- GPU acceleration helps significantly if available

---

## Option 2: Anthropic (Claude)

Cloud-based AI using Claude models. Requires an API key and has per-use costs.

### Step 1: Get an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to **Settings > API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

### Step 2: Configure gBeta

1. Open gBeta in your browser
2. Click the **Settings** icon in the header
3. Under **AI Provider**, select **Anthropic (Claude)**
4. Paste your API key
5. Choose a model:
   - **Claude Sonnet 4.6** - Best balance (recommended)
   - **Claude Haiku 4.5** - Fastest, cheapest
   - **Claude Opus 4.8** - Most capable
6. Click **Test Connection** to verify

> If you previously saved an older Claude model that has since been retired,
> gBeta automatically forward-migrates it to a current one, so Test Connection
> won't 404.

### Pricing

Anthropic charges per token (roughly per word):
- Claude Sonnet 4.6: ~$3/million input tokens, ~$15/million output tokens
- Claude Haiku 4.5: ~$1/million input tokens, ~$5/million output tokens

For typical gBeta queries (a short question plus a small track summary), expect
costs of fractions of a cent per query.

---

## Option 3: OpenAI (GPT)

Cloud-based AI using GPT models. Requires an API key and has per-use costs.

### Step 1: Get an API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys** in the sidebar
4. Click **Create new secret key**
5. Copy the key (starts with `sk-`)

### Step 2: Configure gBeta

1. Open gBeta in your browser
2. Click the **Settings** icon in the header
3. Under **AI Provider**, select **OpenAI**
4. Paste your API key
5. Choose a model:
   - **GPT-4o Mini** - Fast and affordable (recommended)
   - **GPT-4o** - Most capable
   - **GPT-4 Turbo** - Previous generation
6. Click **Test Connection** to verify

### Pricing

OpenAI charges per token:
- GPT-4o Mini: ~$0.15/million input tokens, ~$0.60/million output tokens
- GPT-4o: ~$2.50/million input tokens, ~$10/million output tokens

---

## Privacy Considerations

### What Gets Sent to Cloud Providers

When using Anthropic or OpenAI, gBeta sends:
- Your natural language query text (and, in the Ask AI panel, the prior turns of the conversation)
- Current viewport location (chromosome, coordinates)
- Track names and types (not the actual data)
- A few sample feature names per track, and the names of filterable fields (e.g. VCF INFO keys) so the AI writes queries that match your data

**Your actual genomic data files are NEVER sent to any external service.** Feature
coordinates, sequences, and values stay in your browser.

### For Maximum Privacy

Use **Ollama**. With Ollama:
- All processing happens on your machine
- No internet connection required after initial setup
- No data leaves your computer
- No usage tracking or logging

---

## Switching Providers

You can switch providers at any time:

1. Open Settings
2. Select a different provider
3. Enter API key if needed
4. Previous provider settings are preserved

gBeta remembers your API keys and model preferences for each provider.

---

## Using AI in gBeta

Once configured, there are three places natural language works. All of them
translate your words into **GQL** — a concrete, editable, shareable command — so
every answer stays reproducible.

### 1. Ask AI panel (conversational)

Click the floating **💬 Ask AI** button (bottom-right). This is a full chat:

- Ask in plain English: *"which genes here have variants?"*, *"show pathogenic
  variants in TP53"*, *"what's the fewest variants in any gene?"*
- gBeta **runs the query** and shows the resulting genes/variants as a **ranked,
  clickable list** — click any row to jump straight there.
- If your request is ambiguous (e.g. scope unclear), it **asks a follow-up
  question** and remembers the conversation, so you can reply *"in the current
  view"* and it continues from there.

### 2. GQL Console (natural language → editable GQL)

Open the Console (`Cmd+\`` or the bottom tab). Type a request and it produces the
**GQL**, which you can review and edit before pressing **Execute** — ideal when
you want the reproducible command, not just the answer.

### 3. Search bar (quick navigation)

The header search bar also accepts free text and routes it to the AI when it
isn't a coordinate, gene symbol, or GQL command.

Examples:

```
show me all genes on chromosome 17
which genes here overlap variants?
find variants with high impact in BRCA1
what's the average number of variants per gene?
```

Every translated query lands in the unified **history**, so you can copy it,
**Export .gql**, share it via URL, or save the whole sequence as a re-runnable
**Analysis** (the Analyses tab in the Console).

See the [GQL Manual](GQL-MANUAL.md) for the full query language, and
[GQL Examples](GQL-EXAMPLES.md) for practical recipes.
