#!/bin/bash
# Build ONLY the digital version with auto title fix

set -e

echo "📦 Building Digital S-Meter Version with auto title fix"

if [ ! -f "src/App__digital_smeter_.svelte" ]; then
    echo "❌ Error: src/App__digital_smeter_.svelte not found!"
    exit 1
fi

cp src/main.js src/main.js.backup

cat > src/main.js << 'EOF'
import './app.css'
import App from './App__digital_smeter_.svelte'

const app = new App({
  target: document.getElementById('app')
})

export default app
EOF

npm run build -- --outDir "dist/digital" --base "/digital/"

if [ -f "favicon.ico" ]; then
    mkdir -p dist/digital
    cp favicon.ico dist/digital/
fi

mv src/main.js.backup src/main.js

echo ""
echo "🔧 Auto-fixing title and favicon..."
if [ -f "fix-title-python.py" ]; then
    python3 fix-title-python.py
else
    echo "⚠️  Run manually: python3 fix-title-python.py"
fi

echo ""
echo "✅ Digital version built with title fix!"
echo "🌐 Test: cd dist && python3 -m http.server port_used"
echo "   Visit: http://localhost:8080/digital/index.html"
