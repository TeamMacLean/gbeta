#!/bin/bash
#
# GFF3 to BigBed Conversion Script for gBeta
# Converts gene annotations to BigBed format for efficient HTTP Range queries
#
# Prerequisites:
#   - jq (brew install jq)
#   - UCSC tools: gff3ToGenePred, genePredToBigGenePred, bedToBigBed
#
# Usage:
#   ./convert.sh [genome_id]     # Convert specific genome
#   ./convert.sh --all           # Convert all genomes
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/genomes.json"
OUTPUT_DIR="$SCRIPT_DIR/output"
TOOLS_DIR="$SCRIPT_DIR/tools"
TEMP_DIR="$SCRIPT_DIR/temp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detect platform for UCSC tools
detect_platform() {
    case "$(uname -s)" in
        Darwin*)
            if [[ "$(uname -m)" == "arm64" ]]; then
                echo "macOSX.arm64"
            else
                echo "macOSX.x86_64"
            fi
            ;;
        Linux*)
            echo "linux.x86_64"
            ;;
        *)
            log_error "Unsupported platform: $(uname -s)"
            exit 1
            ;;
    esac
}

# Download UCSC tools if not present
setup_tools() {
    mkdir -p "$TOOLS_DIR"

    local platform=$(detect_platform)
    local base_url="https://hgdownload.soe.ucsc.edu/admin/exe/$platform"

    local tools=("gff3ToGenePred" "genePredToBigGenePred" "bedToBigBed" "bedClip")

    for tool in "${tools[@]}"; do
        if [[ ! -x "$TOOLS_DIR/$tool" ]]; then
            log_info "Downloading $tool..."
            curl -sL "$base_url/$tool" -o "$TOOLS_DIR/$tool"
            chmod +x "$TOOLS_DIR/$tool"
        fi
    done

    # Download bigGenePred.as schema
    if [[ ! -f "$TOOLS_DIR/bigGenePred.as" ]]; then
        log_info "Downloading bigGenePred.as schema..."
        curl -sL "https://genome.ucsc.edu/goldenPath/help/examples/bigGenePred.as" -o "$TOOLS_DIR/bigGenePred.as"
    fi

    log_info "Tools ready in $TOOLS_DIR"
}

# Generate chrom.sizes file from config
generate_chrom_sizes() {
    local genome_id="$1"
    local output_file="$TEMP_DIR/${genome_id}.chrom.sizes"

    jq -r --arg id "$genome_id" '
        .genomes[] | select(.id == $id) | .chromosomes[] |
        "\(.name)\t\(.length)"
    ' "$CONFIG_FILE" > "$output_file"

    echo "$output_file"
}

# Convert a single genome
convert_genome() {
    local genome_id="$1"

    log_info "Processing genome: $genome_id"

    # Get genome config
    local genome_config=$(jq -r --arg id "$genome_id" '.genomes[] | select(.id == $id)' "$CONFIG_FILE")

    if [[ -z "$genome_config" || "$genome_config" == "null" ]]; then
        log_error "Genome '$genome_id' not found in config"
        return 1
    fi

    local gff3_url=$(echo "$genome_config" | jq -r '.gff3_url')
    local gene_name_attr=$(echo "$genome_config" | jq -r '.gene_name_attr // "Name"')
    local genome_name=$(echo "$genome_config" | jq -r '.name')

    mkdir -p "$TEMP_DIR" "$OUTPUT_DIR"

    # Step 1: Download GFF3
    local gff3_file="$TEMP_DIR/${genome_id}.gff3"
    if [[ ! -f "$gff3_file" ]]; then
        log_info "Downloading GFF3 from $gff3_url"
        if [[ "$gff3_url" == *.gz ]]; then
            curl -sL "$gff3_url" | gunzip > "$gff3_file"
        else
            curl -sL "$gff3_url" > "$gff3_file"
        fi
    else
        log_info "Using cached GFF3: $gff3_file"
    fi

    # Step 2: Generate chrom.sizes
    local chrom_sizes=$(generate_chrom_sizes "$genome_id")
    log_info "Generated chrom.sizes: $chrom_sizes"

    # Step 3: Convert GFF3 to genePred
    local genepred_file="$TEMP_DIR/${genome_id}.genePred"
    log_info "Converting GFF3 to genePred..."

    # Filter to only gene/mRNA/exon features and convert
    "$TOOLS_DIR/gff3ToGenePred" \
        -geneNameAttr="$gene_name_attr" \
        -rnaNameAttr="transcript_id" \
        "$gff3_file" \
        "$genepred_file" 2>/dev/null || {
            log_warn "gff3ToGenePred had warnings, continuing..."
        }

    # Sort by chromosome and position
    sort -k2,2 -k4n,4n "$genepred_file" > "${genepred_file}.sorted"
    mv "${genepred_file}.sorted" "$genepred_file"

    # Step 4: Convert to bigGenePred format
    local biggenepred_file="$TEMP_DIR/${genome_id}.bigGenePred"
    log_info "Converting to bigGenePred format..."
    "$TOOLS_DIR/genePredToBigGenePred" "$genepred_file" "$biggenepred_file"

    # Step 5: Clip to chromosome bounds
    local clipped_file="$TEMP_DIR/${genome_id}.clipped"
    log_info "Clipping to chromosome bounds..."
    "$TOOLS_DIR/bedClip" "$biggenepred_file" "$chrom_sizes" "$clipped_file" 2>/dev/null || {
        # If bedClip fails, try without it
        log_warn "bedClip failed, using unclipped file"
        cp "$biggenepred_file" "$clipped_file"
    }

    # Step 6: Create BigBed
    local output_file="$OUTPUT_DIR/${genome_id}.genes.bb"
    log_info "Creating BigBed: $output_file"
    "$TOOLS_DIR/bedToBigBed" \
        -type=bed12+8 \
        -as="$TOOLS_DIR/bigGenePred.as" \
        -tab \
        "$clipped_file" \
        "$chrom_sizes" \
        "$output_file" 2>/dev/null || {
            # Try with simpler BED12 format if bigGenePred fails
            log_warn "bigGenePred format failed, trying BED12..."
            cut -f1-12 "$clipped_file" > "${clipped_file}.bed12"
            "$TOOLS_DIR/bedToBigBed" \
                -type=bed12 \
                "${clipped_file}.bed12" \
                "$chrom_sizes" \
                "$output_file"
        }

    local size=$(ls -lh "$output_file" | awk '{print $5}')
    log_info "Created $output_file ($size)"

    # Cleanup temp files for this genome
    rm -f "$TEMP_DIR/${genome_id}".*

    return 0
}

# Main
main() {
    if [[ $# -eq 0 ]]; then
        echo "Usage: $0 [genome_id | --all | --list]"
        echo ""
        echo "Options:"
        echo "  genome_id   Convert specific genome (e.g., tair10, spombe)"
        echo "  --all       Convert all genomes in config"
        echo "  --list      List available genomes"
        echo ""
        exit 1
    fi

    # Check for jq
    if ! command -v jq &> /dev/null; then
        log_error "jq is required. Install with: brew install jq"
        exit 1
    fi

    case "$1" in
        --list)
            echo "Available genomes:"
            jq -r '.genomes[] | "  \(.id): \(.name)"' "$CONFIG_FILE"
            ;;
        --all)
            setup_tools
            local genomes=$(jq -r '.genomes[].id' "$CONFIG_FILE")
            local failed=()
            for genome_id in $genomes; do
                if ! convert_genome "$genome_id"; then
                    failed+=("$genome_id")
                fi
            done
            echo ""
            log_info "Conversion complete. Output in $OUTPUT_DIR"
            if [[ ${#failed[@]} -gt 0 ]]; then
                log_warn "Failed genomes: ${failed[*]}"
            fi
            ;;
        *)
            setup_tools
            convert_genome "$1"
            ;;
    esac
}

main "$@"
