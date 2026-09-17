#!/bin/bash
# Builds the AgentCore direct code deploy zip with ARM64 Linux dependencies.
# Usage: ./build.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.build"
OUTPUT="$SCRIPT_DIR/deployment_package.zip"

echo "Cleaning previous build..."
rm -rf "$BUILD_DIR" "$OUTPUT"
mkdir -p "$BUILD_DIR"

echo "Installing ARM64 Linux dependencies..."
pip install --no-cache-dir \
    --platform manylinux2014_aarch64 \
    --implementation cp \
    --python-version 3.11 \
    --only-binary=:all: \
    -r "$SCRIPT_DIR/requirements.txt" \
    -t "$BUILD_DIR"

echo "Copying source code..."
cp -a "$SCRIPT_DIR/src" "$BUILD_DIR/src"
cp "$SCRIPT_DIR/pyproject.toml" "$BUILD_DIR/" 2>/dev/null || true
cp "$SCRIPT_DIR/requirements.txt" "$BUILD_DIR/" 2>/dev/null || true

echo "Creating zip..."
cd "$BUILD_DIR"
zip -r "$OUTPUT" . -x "*.pyc" "__pycache__/*"

echo "Cleaning up..."
rm -rf "$BUILD_DIR"

echo "Done: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
