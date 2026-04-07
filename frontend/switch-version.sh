#!/bin/bash
# Version Switcher Script - 4 Versions
# Quick switching during development
# Usage: ./switch-version.sh [version]
# Example: ./switch-version.sh digital

cd "$(dirname "$0")"

# Check if we're in the right directory
if [ ! -d "src" ]; then
    echo "❌ Error: src directory not found!"
    echo "   Please run this script from your frontend directory"
    exit 1
fi

if [ -z "$1" ]; then
    echo "📋 PhantomSDR Plus - Version Switcher"
    echo ""
    echo "Usage: ./switch-version.sh [version]"
    echo ""
    echo "Available versions:"
    echo "  default    - Default (Analog S-Meter)"
    echo "  digital    - Digital S-Meter"
    echo "  v2-analog  - V2 Analog S-Meter"
    echo "  v2-digital - V2 Digital S-Meter"
    echo ""
    echo "Example:"
    echo "  ./switch-version.sh digital"
    echo ""
    echo "After switching, restart your dev server:"
    echo "  npm run dev"
    exit 1
fi

VERSION=$1

case $VERSION in
    default)
        SOURCE="main-default.js"
        NAME="Default (Analog S-Meter)"
        ;;
    digital)
        SOURCE="main-digital.js"
        NAME="Digital S-Meter"
        ;;
    v2-analog)
        SOURCE="main-v2-analog.js"
        NAME="V2 Analog S-Meter"
        ;;
    v2-digital)
        SOURCE="main-v2-digital.js"
        NAME="V2 Digital S-Meter"
        ;;
    *)
        echo "❌ Error: Unknown version '$VERSION'"
        echo ""
        echo "Available versions: default, digital, v2-analog, v2-digital"
        echo "Run without arguments to see full usage"
        exit 1
        ;;
esac

if [ ! -f "src/$SOURCE" ]; then
    echo "❌ Error: Source file src/$SOURCE not found!"
    echo ""
    echo "Please make sure you have created the main-*.js files in your src/ directory"
    exit 1
fi

cp "src/$SOURCE" src/main.js
echo "✅ Switched to: $NAME"
echo ""
echo "🔄 Restart your dev server:"
echo "   npm run dev"
