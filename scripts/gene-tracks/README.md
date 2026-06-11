# gBeta Gene Track Pipeline

This directory contains scripts to generate and host BigBed gene annotation files for gBeta.

## Overview

For genomes not available from UCSC/GenArk, we:
1. Download GFF3 annotations from Ensembl/NCBI
2. Convert to BigBed format using gffutils (Python) + UCSC bedToBigBed
3. Host on Cloudflare R2 (free, supports HTTP Range requests)

## Quick Start

```bash
# 1. Set up Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. List available genomes
python convert_gffutils.py --list

# 3. Convert a specific genome
python convert_gffutils.py sars-cov-2

# 4. Convert all genomes
python convert_gffutils.py --all

# 5. Upload to R2 (after configuring rclone)
./upload-r2.sh
```

## Prerequisites

### Python (required)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### For upload script
```bash
# macOS
brew install jq rclone

# Linux
sudo apt install jq rclone
```

### Alternative: Shell-based conversion (legacy)

If you prefer shell scripts or have issues with Python:
```bash
brew install jq  # or: sudo apt install jq
./convert.sh genome_id
```
Note: The shell script uses UCSC gff3ToGenePred which may fail on some GFF3 formats (especially NCBI).

## Cloudflare R2 Setup

### 1. Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **R2 Object Storage** → **Create bucket**
3. Name: `gbetter-gene-tracks`
4. Location: Auto (or choose nearest)

### 2. Enable Public Access

In bucket settings → **Settings**, you have two options:

**Option A: Public Development URL (quick/testing)**
1. Find "Public Development URL" and enable it
2. You'll get a URL like `pub-xxxxx.r2.dev`
3. Note: Has rate limits, not for heavy production use

**Option B: Custom Domain (recommended for production)**
1. Find "Custom Domains" → "Connect Domain"
2. Add a subdomain like `genes.yourdomain.com`
3. Cloudflare handles SSL automatically
4. No rate limits, better for production

### 3. Configure CORS

In bucket settings → **CORS policy**, add:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Content-Range", "Accept-Ranges", "Content-Length"],
    "MaxAgeSeconds": 86400
  }
]
```

### 4. Create API Token

1. Go to **Storage and Databases** → **R2 Object Storage** → **Overview**
2. In the right panel "Account Details", find **API Tokens** → click **Manage**
3. Click **"Create account API token"** (not user API token)
4. Name: `gbetter-gene-tracks-rw` (or similar)
5. Permissions: **Object Read & Write**
6. Bucket scope: Select `gbetter-gene-tracks` (or "All buckets")
7. Click **Create API Token**
8. **Important:** Copy both values immediately (secret is only shown once):
   - Access Key ID
   - Secret Access Key

### 5. Configure rclone

```bash
rclone config
```

Choose:
- **n** (new remote)
- Name: **r2**
- Type: **s3**
- Provider: **Cloudflare** (option 6)
- env_auth: **1** (false) - enter credentials manually
- Access Key ID: *paste your key*
- Secret Access Key: *paste your secret*
- Edit advanced config: **n** (No)
- Keep this remote: **y**
- Quit config: **q**

**Important:** The wizard doesn't ask for the endpoint, so add it manually:

```bash
nano ~/.config/rclone/rclone.conf
```

Add the `endpoint` line to the `[r2]` section:
```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = your_access_key_here
secret_access_key = your_secret_key_here
endpoint = https://<account_id>.r2.cloudflarestorage.com
```

Replace `<account_id>` with your Cloudflare **Account ID** (found in the "Account Details" panel).

**Note:** The Account ID is different from your Access Key ID:
- Account ID: Your Cloudflare account (32-char hex, also visible in dashboard URL)
- Access Key ID: From the API token you created

Test connection:
```bash
rclone ls r2:gbetter-gene-tracks
```

**Note:** If you scoped your API token to a specific bucket, `rclone lsd r2:` will fail with "Access Denied" - this is expected. Use `rclone ls r2:bucket-name` instead.

## File Structure

```
scripts/gene-tracks/
├── README.md             # This file
├── genomes.json          # Genome configuration
├── requirements.txt      # Python dependencies
├── convert_gffutils.py   # GFF3 → BigBed (Python, recommended)
├── convert.sh            # GFF3 → BigBed (shell, legacy)
├── upload-r2.sh          # Upload to R2
├── .venv/                # Python virtual environment (gitignored)
├── tools/                # UCSC binaries (auto-downloaded)
├── temp/                 # Temporary files (auto-cleaned)
└── output/               # Generated BigBed files
    ├── tair10.genes.bb
    ├── spombe.genes.bb
    └── ...
```

## Adding New Genomes

Edit `genomes.json` to add new genomes:

```json
{
  "id": "my_genome",
  "name": "My Organism v1.0",
  "gff3_url": "https://example.com/annotations.gff3.gz",
  "chromosomes": [
    {"name": "chr1", "length": 1000000},
    {"name": "chr2", "length": 800000}
  ],
  "gene_name_attr": "Name"
}
```

Then run:
```bash
python convert_gffutils.py my_genome
./upload-r2.sh my_genome
```

## Updating bigbed.ts

After uploading, update `src/lib/services/bigbed.ts`:

```typescript
export const GENE_BIGBED_URLS: Record<string, string> = {
  // ... existing entries ...

  // Self-hosted on R2
  'tair10': 'https://genes.gbetter.io/tair10.genes.bb',
  'spombe': 'https://genes.gbetter.io/spombe.genes.bb',
  // etc.
};
```

## Troubleshooting

### Conversion fails with "no genes found"

The GFF3 might use different feature types. Check what's in the file:
```bash
zcat file.gff3.gz | grep -v "^#" | cut -f3 | sort | uniq -c
```

Common issues:
- `gene` vs `Gene` (case sensitivity)
- Missing `transcript_id` attribute
- Different gene name attribute (try `gene`, `Name`, `ID`)

### BigBed file is empty

Check the genePred intermediate file:
```bash
wc -l temp/genome.genePred
```

If empty, the GFF3→genePred conversion failed. Try:
```bash
./tools/gff3ToGenePred -help
```

### R2 upload fails

Verify rclone config:
```bash
rclone lsd r2:
rclone ls r2:gbetter-gene-tracks
```

### CORS errors in browser

Ensure CORS is configured on the R2 bucket (see step 3 above).

## Generated File Sizes

| Genome | Genes | Transcripts | Total Size |
|--------|-------|-------------|------------|
| **Plants** | | | |
| tair10 (Arabidopsis) | 932 KB | 2.6 MB | 3.5 MB |
| irgsp1 (Rice) | 1.3 MB | 2.8 MB | 4.1 MB |
| iwgsc-refseq2 (Wheat) | 4.2 MB | 9.7 MB | 13.9 MB |
| morex-v3 (Barley) | 1.5 MB | 2.5 MB | 4.0 MB |
| zm-b73-nam5 (Maize) | 2.0 MB | 4.1 MB | 6.1 MB |
| **Fungi** | | | |
| spombe (Fission yeast) | 201 KB | 233 KB | 434 KB |
| botrytis | 378 KB | 523 KB | 901 KB |
| magnaporthe | 350 KB | 452 KB | 802 KB |
| puccinia | 174 KB | 335 KB | 509 KB |
| zymoseptoria | 372 KB | 456 KB | 828 KB |
| **Protists** | | | |
| phytophthora | 245 KB | 311 KB | 556 KB |
| **Microbes** | | | |
| ecoli-k12 | 177 KB | — | 177 KB |
| sars-cov-2 | 20 KB | — | 20 KB |
| **Total** | | | **~36 MB** |

R2 free tier: 10 GB storage, unlimited egress. Plenty of room!
