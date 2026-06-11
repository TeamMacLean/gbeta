#!/bin/bash
#
# Create 2bit reference sequence files for gBeta assemblies
#
# This script downloads FASTA files from NCBI/Ensembl and converts them to 2bit format
# using UCSC's faToTwoBit tool.
#
# Prerequisites:
#   - curl
#   - gunzip
#   - faToTwoBit (UCSC tool) - will be downloaded if not present
#
# Output:
#   - output/*.2bit files ready for upload to R2
#
# Usage:
#   ./create-2bit.sh [assembly_id]
#   ./create-2bit.sh          # Process all assemblies
#   ./create-2bit.sh ecoli-k12  # Process single assembly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"
FASTA_DIR="$SCRIPT_DIR/fasta"
TOOLS_DIR="$SCRIPT_DIR/tools"

mkdir -p "$OUTPUT_DIR" "$FASTA_DIR" "$TOOLS_DIR"

# Detect OS for faToTwoBit download
OS="$(uname -s)"
case "$OS" in
    Linux*)  PLATFORM="linux.x86_64" ;;
    Darwin*)
        # Check for ARM vs Intel Mac
        ARCH="$(uname -m)"
        if [ "$ARCH" = "arm64" ]; then
            PLATFORM="macOSX.arm64"
        else
            PLATFORM="macOSX.x86_64"
        fi
        ;;
    *)       echo "Unsupported OS: $OS"; exit 1 ;;
esac

# Download faToTwoBit if not present
FATOTWOBIT="$TOOLS_DIR/faToTwoBit"
if [ ! -x "$FATOTWOBIT" ]; then
    echo "Downloading faToTwoBit for $PLATFORM..."
    curl -s -o "$FATOTWOBIT" "https://hgdownload.soe.ucsc.edu/admin/exe/$PLATFORM/faToTwoBit"
    chmod +x "$FATOTWOBIT"
fi

# Assembly definitions as simple text (compatible with bash 3.x)
# Format: id|name|url
ASSEMBLY_LIST="
ecoli-k12|E. coli K-12|https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/GCF_000005845.2_ASM584v2_genomic.fna.gz
sars-cov-2|SARS-CoV-2|https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/009/858/895/GCF_009858895.2_ASM985889v3/GCF_009858895.2_ASM985889v3_genomic.fna.gz
spombe|S. pombe|https://ftp.ensemblgenomes.ebi.ac.uk/pub/fungi/release-57/fasta/schizosaccharomyces_pombe/dna/Schizosaccharomyces_pombe.ASM294v2.dna.toplevel.fa.gz
irgsp1|Rice IRGSP-1.0|https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-57/fasta/oryza_sativa/dna/Oryza_sativa.IRGSP-1.0.dna.toplevel.fa.gz
iwgsc-refseq2|Wheat IWGSC|https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-57/fasta/triticum_aestivum/dna/Triticum_aestivum.IWGSC.dna.toplevel.fa.gz
zm-b73-nam5|Maize B73|https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-57/fasta/zea_mays/dna/Zea_mays.Zm-B73-REFERENCE-NAM-5.0.dna.toplevel.fa.gz
morex-v3|Barley Morex|https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-57/fasta/hordeum_vulgare/dna/Hordeum_vulgare.MorexV3_pseudomolecules_assembly.dna.toplevel.fa.gz
botrytis|Botrytis cinerea|https://ftp.ensemblgenomes.ebi.ac.uk/pub/fungi/release-57/fasta/botrytis_cinerea/dna/Botrytis_cinerea.ASM83294v1.dna.toplevel.fa.gz
magnaporthe|Magnaporthe oryzae|https://ftp.ensemblgenomes.ebi.ac.uk/pub/fungi/release-57/fasta/magnaporthe_oryzae/dna/Magnaporthe_oryzae.MG8.dna.toplevel.fa.gz
puccinia|Puccinia graminis|https://ftp.ensemblgenomes.ebi.ac.uk/pub/fungi/release-57/fasta/puccinia_graminis/dna/Puccinia_graminis.ASM14992v1.dna.toplevel.fa.gz
zymoseptoria|Zymoseptoria tritici|https://ftp.ensemblgenomes.ebi.ac.uk/pub/fungi/release-57/fasta/zymoseptoria_tritici/dna/Zymoseptoria_tritici.MG2.dna.toplevel.fa.gz
phytophthora|Phytophthora infestans|https://ftp.ensemblgenomes.ebi.ac.uk/pub/protists/release-57/fasta/phytophthora_infestans/dna/Phytophthora_infestans.ASM14294v1.dna.toplevel.fa.gz
"

# Function to get assembly info by ID
get_assembly_info() {
    local search_id="$1"
    echo "$ASSEMBLY_LIST" | grep "^${search_id}|" | head -1
}

# Function to process a single assembly
process_assembly() {
    local id="$1"
    local info=$(get_assembly_info "$id")

    if [ -z "$info" ]; then
        echo "ERROR: Unknown assembly: $id"
        echo "Available assemblies:"
        echo "$ASSEMBLY_LIST" | grep -v '^$' | cut -d'|' -f1 | sed 's/^/  /'
        return 1
    fi

    local name=$(echo "$info" | cut -d'|' -f2)
    local url=$(echo "$info" | cut -d'|' -f3)
    local fasta_gz="$FASTA_DIR/${id}.fa.gz"
    local fasta="$FASTA_DIR/${id}.fa"
    local twobit="$OUTPUT_DIR/${id}.2bit"

    echo ""
    echo "=========================================="
    echo "Processing: $name ($id)"
    echo "=========================================="

    # Skip if 2bit already exists
    if [ -f "$twobit" ]; then
        echo "  2bit already exists: $twobit"
        echo "  Skipping (delete to regenerate)"
        return 0
    fi

    # Download FASTA
    if [ ! -f "$fasta_gz" ] && [ ! -f "$fasta" ]; then
        echo "  Downloading FASTA..."
        echo "  URL: $url"
        curl -L --progress-bar -o "$fasta_gz" "$url" || {
            echo "  ERROR: Download failed"
            return 1
        }
    else
        echo "  FASTA already downloaded"
    fi

    # Decompress if needed
    if [ -f "$fasta_gz" ] && [ ! -f "$fasta" ]; then
        echo "  Decompressing..."
        gunzip -k "$fasta_gz"
    fi

    # Convert to 2bit
    echo "  Converting to 2bit..."
    "$FATOTWOBIT" "$fasta" "$twobit" || {
        echo "  ERROR: faToTwoBit failed"
        return 1
    }

    # Show result
    local size=$(ls -lh "$twobit" | awk '{print $5}')
    echo "  Created: $twobit ($size)"

    # Clean up uncompressed FASTA to save space (keep .gz)
    if [ -f "$fasta" ] && [ -f "$fasta_gz" ]; then
        echo "  Cleaning up uncompressed FASTA..."
        rm "$fasta"
    fi

    return 0
}

# Get list of all assembly IDs
get_all_ids() {
    echo "$ASSEMBLY_LIST" | grep -v '^$' | cut -d'|' -f1
}

# Main
echo "gBeta 2bit Reference File Generator"
echo "======================================"
echo ""
echo "Output directory: $OUTPUT_DIR"
echo "Platform: $PLATFORM"

if [ -n "$1" ]; then
    # Process single assembly
    process_assembly "$1"
else
    # Process all assemblies
    ids=$(get_all_ids)
    count=$(echo "$ids" | wc -l | tr -d ' ')
    echo ""
    echo "Assemblies to process: $count"

    for id in $ids; do
        process_assembly "$id" || echo "  WARNING: Failed to process $id"
    done
fi

echo ""
echo "=========================================="
echo "Done!"
echo ""
echo "2bit files in: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"/*.2bit 2>/dev/null || echo "(no 2bit files yet)"
echo ""
echo "Next steps:"
echo "  1. Upload to R2:"
echo "     for f in output/*.2bit; do"
echo "       wrangler r2 object put gbetter-public/reference/\$(basename \$f) --file=\$f"
echo "     done"
echo "  2. Add URLs to src/lib/services/fasta.ts"
