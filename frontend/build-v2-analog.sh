#!/bin/bash
# Build ONLY the V2 Analog version with auto title fix

set -e

echo "📦 Building V2 Analog S-Meter Version with auto title fix"

if [ ! -f "src/App__v2_analog_smeter_.svelte" ]; then
    echo "❌ Error: src/App__v2_analog_smeter_.svelte not found!"
    exit 1
fi

cp src/main.js src/main.js.backup

cat > src/main.js << 'EOF'
import './app.css'
import App from './App__v2_analog_smeter_.svelte'

const app = new App({
  target: document.getElementById('app')
})

export default app
EOF

npm run build -- --outDir "dist/v2-analog" --base "/v2-analog/"

if [ -f "favicon.ico" ]; then
    mkdir -p dist/v2-analog
    cp favicon.ico dist/v2-analog/
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
echo "✅ V2 Analog version built with title fix!"
echo "🌐 Test: cd dist && python3 -m http.server port_used"
echo "   Visit: http://localhost:8080/v2-analog/index.html"
