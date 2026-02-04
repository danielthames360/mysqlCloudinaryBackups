#!/bin/bash

# MySQL Backup Restore Script
# This script restores a backup created by mysqlCloudinaryBackups
#
# Usage: Copy this script to the backup folder and run it
#   ./restore.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== MySQL Backup Restore ==="
echo ""

# Check if manifest exists
if [ ! -f "manifest.json" ]; then
    echo "Error: manifest.json not found in current directory"
    echo ""
    echo "Make sure you run this script from inside the backup folder"
    echo "containing the manifest.json and .001, .002, etc. files"
    exit 1
fi

# Parse manifest
ORIGINAL_FILENAME=$(grep -o '"originalFilename": *"[^"]*"' manifest.json | cut -d'"' -f4)
TOTAL_PARTS=$(grep -o '"totalParts": *[0-9]*' manifest.json | grep -o '[0-9]*')

echo "Backup file: $ORIGINAL_FILENAME"
echo "Total parts: $TOTAL_PARTS"
echo ""

# Verify checksums
echo "Verifying checksums..."
CHECKSUMS_OK=true

for i in $(seq -w 1 $TOTAL_PARTS); do
    PART_NUM=$(printf "%03d" $i)
    PART_FILE="${ORIGINAL_FILENAME}.${PART_NUM}"

    if [ ! -f "$PART_FILE" ]; then
        echo "Error: Part file $PART_FILE not found"
        exit 1
    fi

    # Get expected checksum from manifest
    EXPECTED_CHECKSUM=$(grep -A2 "\"$PART_FILE\"" manifest.json | grep "checksum" | grep -o '"checksum": *"[^"]*"' | cut -d'"' -f4)

    # Calculate actual checksum
    if command -v md5sum &> /dev/null; then
        ACTUAL_CHECKSUM=$(md5sum "$PART_FILE" | cut -d' ' -f1)
    elif command -v md5 &> /dev/null; then
        ACTUAL_CHECKSUM=$(md5 -q "$PART_FILE")
    else
        echo "Warning: md5sum/md5 not found, skipping checksum verification"
        ACTUAL_CHECKSUM=$EXPECTED_CHECKSUM
    fi

    if [ "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM" ]; then
        echo "  ✓ $PART_FILE - OK"
    else
        echo "  ✗ $PART_FILE - CHECKSUM MISMATCH!"
        echo "    Expected: $EXPECTED_CHECKSUM"
        echo "    Actual:   $ACTUAL_CHECKSUM"
        CHECKSUMS_OK=false
    fi
done

if [ "$CHECKSUMS_OK" = false ]; then
    echo ""
    echo "Error: Checksum verification failed. Backup may be corrupted."
    exit 1
fi

echo ""
echo "All checksums verified successfully!"
echo ""

# Merge parts
echo "Merging parts..."
cat ${ORIGINAL_FILENAME}.* > "$ORIGINAL_FILENAME"
echo "Created: $ORIGINAL_FILENAME"

# Decompress
echo "Decompressing..."
SQL_FILE="${ORIGINAL_FILENAME%.gz}"
gunzip -k "$ORIGINAL_FILENAME"
echo "Created: $SQL_FILE"

echo ""
echo "=== Restore Complete ==="
echo ""
echo "SQL file ready: $SQL_FILE"
echo ""
echo "To import into MySQL, run:"
echo "  mysql -u YOUR_USER -p YOUR_DATABASE < $SQL_FILE"
echo ""
