#!/bin/bash
# Build ONLY the default version (App.svelte)
# AUTOMATICALLY fixes title and favicon after build

set -e

echo "📦 Building Default Version with auto title fix"

if [ ! -f "src/App.svelte" ]; then
    echo "❌ Error: src/App.svelte not found!"
    exit 1
fi

# Check for favicon
if [ ! -f "favicon.ico" ]; then
    echo "⚠️  Warning: favicon.ico not found"
fi

# Backup main.js
cp src/main.js src/main.js.backup

# Create main.js for default version
cat > src/main.js << 'EOF'
import './app.css'
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app')
})

export default app
EOF

# Build
npm run build -- --outDir "dist" --base "/"

# Copy favicon if it exists
if [ -f "favicon.ico" ]; then
    cp favicon.ico dist/
    echo "✓ Copied favicon.ico"
fi

# Copy site_information.json if it exists
if [ -f "site_information.json" ]; then
    cp site_information.json dist/
    echo "✓ Copied site_information.json"
fi

# Restore main.js
mv src/main.js.backup src/main.js

# AUTO-FIX TITLE
echo ""
echo "🔧 Auto-fixing title and favicon..."
if [ -f "fix-title-python.py" ]; then
    python3 fix-title-python.py
    echo ""
else
    echo "⚠️  fix-title-python.py not found, skipping title fix"
    echo "   Run manually: python3 fix-title-python.py"
    echo ""
fi

echo "✅ Default version built with title fix!"
echo "   ✓ Title includes your siteSysop"
echo "   ✓ Favicon included"
echo "🌐 Test: cd dist && python3 -m http.server port_used"
