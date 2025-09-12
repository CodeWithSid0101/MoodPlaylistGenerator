#!/bin/bash
echo "🔧 Building from root directory..."
cd "$(dirname "$0")"
npm install
echo "✅ Build complete!"