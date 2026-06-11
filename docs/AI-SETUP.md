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
   - **Claude Sonnet 4** - Best balance (recommended)
   - **Claude 3.5 Haiku** - Fastest, cheapest
   - **Claude Opus 4** - Most capable
6. Click **Test Connection** to verify

### Pricing

Anthropic charges per token (roughly per word):
- Claude Sonnet 4: ~$3/million input tokens, ~$15/million output tokens
- Claude 3.5 Haiku: ~$0.25/million input tokens, ~$1.25/million output tokens

For typical gBeta queries, expect costs of fractions of a cent per query.

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
- Your natural language query text
- Current viewport location (chromosome, coordinates)
- Track names and types (not the actual data)
- Sample feature names (first 10 from each track)

**Your actual genomic data files are NEVER sent to any external service.**

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

Once configured, use the search bar to enter natural language queries:

```
show me all genes on chromosome 17
zoom into TP53
find variants with high impact
filter to show only exons
```

gBeta translates these to GQL commands, which you can:
- See in the query history
- Copy and share with colleagues
- Re-run for reproducibility

See the [GQL Manual](GQL-MANUAL.md) for the full query language specification.
