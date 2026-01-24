#!/bin/bash
# Build each App*.svelte version separately
# AUTOMATICALLY fixes title and favicon after build

set -e

echo "🚀 Building all App versions with auto title fix"
echo ""

# Check we're in the right directory
if [ ! -d "src" ]; then
    echo "❌ Error: src directory not found!"
    echo "   Run this from: /home/sv1btl/PhantomSDR-Plus/frontend/"
    exit 1
fi

# Check all App files exist
echo "📋 Checking App files..."
for file in App.svelte App__analog_smeter_.svelte App__digital_smeter_.svelte App__v2_analog_smeter_.svelte App__v2_digital_smeter_.svelte; do
    if [ ! -f "src/$file" ]; then
        echo "❌ Error: src/$file not found!"
        exit 1
    fi
    echo "   ✓ $file"
done

# Check for favicon.ico
if [ ! -f "favicon.ico" ]; then
    echo "⚠️  Warning: favicon.ico not found in current directory"
    FAVICON_EXISTS=false
else
    echo "   ✓ favicon.ico found"
    FAVICON_EXISTS=true
fi

# Check for site_information.json
if [ ! -f "site_information.json" ]; then
    echo "⚠️  Warning: site_information.json not found"
    SITEINFO_EXISTS=false
else
    echo "   ✓ site_information.json found"
    SITEINFO_EXISTS=true
fi

# Backup original main.js
echo ""
echo "💾 Backing up main.js..."
cp src/main.js src/main.js.original
echo "   ✓ Backed up to src/main.js.original"

# Function to create temporary main.js for a version
create_main_js() {
    local APP_FILE=$1
    
    cat > src/main.js << EOF
import './app.css'
import App from './$APP_FILE'

const app = new App({
  target: document.getElementById('app')
})

export default app
EOF
}

# Function to build a version
build_version() {
    local APP_FILE=$1
    local VERSION_NAME=$2
    local OUTPUT_DIR=$3
    local BASE_PATH=$4
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 Building: $VERSION_NAME"
    echo "   App file: $APP_FILE"
    echo "   Base path: $BASE_PATH"
    echo "   Output: $OUTPUT_DIR"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Create temporary main.js for this version
    create_main_js "$APP_FILE"
    
    # Build with base path
    npm run build -- --outDir "$OUTPUT_DIR" --base "$BASE_PATH"
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Built: $VERSION_NAME"
    else
        echo "   ❌ Failed: $VERSION_NAME"
        return 1
    fi
}

# Clean dist directory
if [ -d "dist" ]; then
    echo ""
    echo "🗑️  Cleaning old dist/ directory..."
    rm -rf dist
fi

# Build each version
echo ""
echo "🔨 Starting builds..."

# Build root version (App.svelte at /)
build_version "App.svelte" "Default" "dist" "/"

# Build analog version
build_version "App__analog_smeter_.svelte" "Analog S-Meter" "dist/analog" "/analog/"

# Build digital version
build_version "App__digital_smeter_.svelte" "Digital S-Meter" "dist/digital" "/digital/"

# Build V2 analog version
build_version "App__v2_analog_smeter_.svelte" "V2 Analog S-Meter" "dist/v2-analog" "/v2-analog/"

# Build V2 digital version
build_version "App__v2_digital_smeter_.svelte" "V2 Digital S-Meter" "dist/v2-digital" "/v2-digital/"

# Copy favicon to all directories
if [ "$FAVICON_EXISTS" = true ]; then
    echo ""
    echo "📎 Copying favicon.ico to all directories..."
    cp favicon.ico dist/
    echo "   ✓ dist/favicon.ico"
    
    for dir in analog digital v2-analog v2-digital; do
        if [ -d "dist/$dir" ]; then
            cp favicon.ico "dist/$dir/"
            echo "   ✓ dist/$dir/favicon.ico"
        fi
    done
fi

# Copy site_information.json to root
if [ "$SITEINFO_EXISTS" = true ]; then
    echo ""
    echo "📋 Copying site_information.json..."
    cp site_information.json dist/
    echo "   ✓ dist/site_information.json"
fi

# Restore original main.js
echo ""
echo "🔄 Restoring original main.js..."
mv src/main.js.original src/main.js
echo "   ✓ Restored"

# AUTO-FIX TITLE AND FAVICON
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Auto-fixing title and favicon..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "fix-title-python.py" ]; then
    python3 fix-title-python.py
else
    echo "⚠️  Warning: fix-title-python.py not found"
    echo "   Titles will use default values"
    echo ""
    echo "   To fix manually:"
    echo "   python3 fix-title-python.py"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All builds complete with title fix!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Title is automatically fixed after every build!"
echo ""
