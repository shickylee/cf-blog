#!/bin/bash

set -e

echo "=== Cloudflare Pages Build Script ==="

echo "Installing dependencies..."
pnpm install

echo "Building project..."
pnpm run build:workers

echo "Build completed successfully!"
