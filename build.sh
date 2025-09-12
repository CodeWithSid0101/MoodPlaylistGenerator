#!/bin/bash
# This build script ensures dependencies are installed in the correct location
echo "🔧 Building Spotify Playlist Generator..."
echo "📍 Current directory: $(pwd)"
echo "📋 Installing dependencies..."
npm install
echo "✅ Dependencies installed in $(pwd)"
echo "📦 Listing node_modules:"
ls -la node_modules/ | head -5
echo "✅ Build complete!"