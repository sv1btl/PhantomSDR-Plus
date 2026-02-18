#!/bin/bash

# PhantomSDR-Plus Recompile Script (Enhanced)
# This script helps you recompile backend and/or frontend components
# with support for selecting default App.svelte variant

set -e  # Exit on error

echo "=========================================="
echo "  PhantomSDR-Plus Recompile Script"
echo "=========================================="
echo ""

# Function to find PhantomSDR-Plus directory
find_phantom_dir() {
    # Check if we're already inside PhantomSDR-Plus directory
    if [ -f "meson.build" ] && [ -d "frontend" ] && [ -d "src" ]; then
        PHANTOM_DIR="."
        echo "✅ Found PhantomSDR-Plus in current directory"
        return 0
    fi
    
    # Check if PhantomSDR-Plus exists as a subdirectory
    if [ -d "PhantomSDR-Plus" ]; then
        PHANTOM_DIR="PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus directory"
        return 0
    fi
    
    # Check parent directory
    if [ -d "../PhantomSDR-Plus" ]; then
        PHANTOM_DIR="../PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus in parent directory"
        return 0
    fi
    
    # Check common locations
    if [ -d "$HOME/PhantomSDR-Plus" ]; then
        PHANTOM_DIR="$HOME/PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus in home directory"
        return 0
    fi
    
    # Not found, ask user
    echo "❌ Could not automatically locate PhantomSDR-Plus directory"
    echo ""
    read -p "Enter the full path to PhantomSDR-Plus directory: " user_path
    
    if [ -d "$user_path" ] && [ -f "$user_path/meson.build" ]; then
        PHANTOM_DIR="$user_path"
        echo "✅ Using: $PHANTOM_DIR"
        return 0
    else
        echo "❌ Error: Invalid path or not a PhantomSDR-Plus directory!"
        exit 1
    fi
}

# Function to select and set default App.svelte
select_default_app() {
    echo ""
    echo "=========================================="
    echo "Select Default App.svelte Variant"
    echo "=========================================="
    echo ""
    echo "Which version should be the default App.svelte?"
    echo ""
    echo "  [1] Analog S-Meter (App__analog_smeter_.svelte)"
    echo "  [2] Digital S-Meter (App__digital_smeter_.svelte)"
    echo "  [3] V2 Analog S-Meter (App__v2_analog_smeter_.svelte)"
    echo "  [4] V2 Digital S-Meter (App__v2_digital_smeter_.svelte)"
    echo ""
    read -p "Select default variant [1-4]: " default_choice
    
    FRONTEND_SRC="$PHANTOM_DIR/frontend/src"
    
    case $default_choice in
        1)
            DEFAULT_NAME="Analog S-Meter"
            SOURCE_FILE="$FRONTEND_SRC/App__analog_smeter_.svelte"
            VERSION_ID="analog"
            ;;
        2)
            DEFAULT_NAME="Digital S-Meter"
            SOURCE_FILE="$FRONTEND_SRC/App__digital_smeter_.svelte"
            VERSION_ID="digital"
            ;;
        3)
            DEFAULT_NAME="V2 Analog S-Meter"
            SOURCE_FILE="$FRONTEND_SRC/App__v2_analog_smeter_.svelte"
            VERSION_ID="v2-analog"
            ;;
        4)
            DEFAULT_NAME="V2 Digital S-Meter"
            SOURCE_FILE="$FRONTEND_SRC/App__v2_digital_smeter_.svelte"
            VERSION_ID="v2-digital"
            ;;
        *)
            echo "❌ Invalid option. Exiting."
            exit 1
            ;;
    esac
    
    # Check if source file exists
    if [ ! -f "$SOURCE_FILE" ]; then
        echo "❌ Error: Source file not found: $SOURCE_FILE"
        exit 1
    fi
    
    # Copy selected variant to App.svelte
    echo ""
    echo "Copying $DEFAULT_NAME to App.svelte..."
    cp "$SOURCE_FILE" "$FRONTEND_SRC/App.svelte"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully set $DEFAULT_NAME as default App.svelte"
    else
        echo "❌ Failed to copy App.svelte variant"
        exit 1
    fi
    
    # Update VersionSelector.svelte
    update_version_selector "$VERSION_ID" "$DEFAULT_NAME"
}

# Function to update VersionSelector.svelte with reordered options
update_version_selector() {
    local selected_id="$1"
    local selected_name="$2"
    
    echo ""
    echo "Updating VersionSelector.svelte..."
    
    VERSION_SELECTOR="$PHANTOM_DIR/frontend/src/lib/VersionSelector.svelte"
    
    if [ ! -f "$VERSION_SELECTOR" ]; then
        echo "⚠️  Warning: VersionSelector.svelte not found at $VERSION_SELECTOR"
        echo "   Skipping VersionSelector update..."
        return
    fi
    
    # Create backup
    cp "$VERSION_SELECTOR" "$VERSION_SELECTOR.backup"
    
    # Generate the reordered versions array based on selection
    case $selected_id in
        analog)
            VERSIONS_ARRAY="    { id: 'default', name: 'Analog S-Meter', path: '/' },
    { id: 'digital', name: 'Digital S-Meter', path: '/digital/index.html' },
    { id: 'v2-analog', name: 'V2 Analog S-Meter', path: '/v2-analog/index.html' },
    { id: 'v2-digital', name: 'V2 Digital S-Meter', path: '/v2-digital/index.html' }"
            ;;
        digital)
            VERSIONS_ARRAY="    { id: 'default', name: 'Digital S-Meter', path: '/' },
    { id: 'analog', name: 'Analog S-Meter', path: '/analog/index.html' },
    { id: 'v2-analog', name: 'V2 Analog S-Meter', path: '/v2-analog/index.html' },
    { id: 'v2-digital', name: 'V2 Digital S-Meter', path: '/v2-digital/index.html' }"
            ;;
        v2-analog)
            VERSIONS_ARRAY="    { id: 'default', name: 'V2 Analog S-Meter', path: '/' },
    { id: 'analog', name: 'Analog S-Meter', path: '/analog/index.html' },
    { id: 'digital', name: 'Digital S-Meter', path: '/digital/index.html' },
    { id: 'v2-digital', name: 'V2 Digital S-Meter', path: '/v2-digital/index.html' }"
            ;;
        v2-digital)
            VERSIONS_ARRAY="    { id: 'default', name: 'V2 Digital S-Meter', path: '/' },
    { id: 'analog', name: 'Analog S-Meter', path: '/analog/index.html' },
    { id: 'digital', name: 'Digital S-Meter', path: '/digital/index.html' },
    { id: 'v2-analog', name: 'V2 Analog S-Meter', path: '/v2-analog/index.html' }"
            ;;
    esac
    
    # Create the new VersionSelector.svelte content
    cat > "$VERSION_SELECTOR" << 'EOF'
<script>
  import { onMount } from 'svelte';
  
  const versions = [
EOF
    
    echo "$VERSIONS_ARRAY" >> "$VERSION_SELECTOR"
    
    cat >> "$VERSION_SELECTOR" << 'EOF'
  ];
  
  let currentVersion = 'default';
  
  // Detect current version from URL path
  onMount(() => {
    const path = window.location.pathname;
    if (path.includes('/analog/')) {
      currentVersion = 'analog';
    } else if (path.includes('/digital/')) {
      currentVersion = 'digital';
    } else if (path.includes('/v2-analog/')) {
      currentVersion = 'v2-analog';
    } else if (path.includes('/v2-digital/')) {
      currentVersion = 'v2-digital';
    } else {
      currentVersion = 'default';
    }
  });
  
  function handleVersionChange(event) {
    const selectedVersion = event.target.value;
    const version = versions.find(v => v.id === selectedVersion);
    if (version) {
      // Navigate to the selected version
      window.location.href = version.path;
    }
  }
</script>

<div class="version-selector">
  <label for="version-select">⚙️</label>
  <select id="version-select" bind:value={currentVersion} on:change={handleVersionChange}>
    {#each versions as version}
      <option value={version.id}>{version.name}</option>
    {/each}
  </select>
</div>

<style>
  .version-selector {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.75);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  label {
    color: white;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 500;
    margin: 0;
  }
  
  select {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    cursor: pointer;
    outline: none;
    min-width: 90px;
  }
  
  select:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  select:focus {
    border-color: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }
  
  select option {
    background: #2a2a2a;
    color: white;
    padding: 8px;
  }
  
  /* Mobile responsive */
  @media (max-width: 600px) {
    .version-selector {
      top: 5px;
      right: 5px;
      padding: 6px 8px;
      gap: 6px;
    }
    
    label {
      font-size: 12px;
    }
    
    select {
      font-size: 12px;
      padding: 4px 8px;
      min-width: 90px;
    }
  }
</style>
EOF
    
    echo "✅ VersionSelector.svelte updated (backup saved as VersionSelector.svelte.backup)"
    echo "   Default version: $selected_name (will appear first in dropdown)"
}

# Function to recompile backend
recompile_backend() {
    echo ""
    echo "=========================================="
    echo "Recompiling Backend"
    echo "=========================================="
    echo ""
    
    cd "$PHANTOM_DIR"
    
    echo "Removing old build directory..."
    rm -rf build
    
    echo "Setting up new build with Meson..."
    meson setup build
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Meson setup failed!"
        cd - > /dev/null
        exit 1
    fi
    
    echo "Compiling backend..."
    meson compile -C build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Backend compiled successfully!"
    else
        echo ""
        echo "❌ Backend compilation failed!"
        cd - > /dev/null
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to recompile frontend
recompile_frontend() {
    echo ""
    echo "=========================================="
    echo "Frontend Build Options"
    echo "=========================================="
    echo ""
    echo "Select which frontend build script to run:"
    echo ""
    echo "  [1] build-all.sh           - Build all versions (recommended)"
    echo "  [2] build-default.sh       - Build default version only"
    echo "  [3] build-analog.sh        - Build analog S-meter version"    
    echo "  [4] build-digital.sh       - Build digital S-meter version"
    echo "  [5] build-v2-analog.sh     - Build V2 analog S-meter version"
    echo "  [6] build-v2-digital.sh    - Build V2 digital S-meter version"
    echo "  [7] Custom selection       - Choose multiple builds"
    echo "  [0] Skip frontend build"
    echo ""
    read -p "Select an option [0-7]: " frontend_option
    
    case $frontend_option in
        0)
            echo "Skipping frontend build..."
            return
            ;;
        1)
            BUILD_SCRIPTS=("build-all.sh")
            ;;
        2)
            BUILD_SCRIPTS=("build-default.sh")
            ;;
        3)
            BUILD_SCRIPTS=("build-analog.sh")
            ;;
        4)
            BUILD_SCRIPTS=("build-digital.sh")
            ;;
        5)
            BUILD_SCRIPTS=("build-v2-analog.sh")
            ;;
        6)
            BUILD_SCRIPTS=("build-v2-digital.sh")
            ;;
        7)
            echo ""
            echo "Custom Selection Mode"
            echo "Enter the numbers of builds you want (space-separated):"
            echo "Example: 2 3 5 6"
            echo ""
            echo "  [2] build-default.sh"
            echo "  [3] build-analog.sh"            
            echo "  [4] build-digital.sh"
            echo "  [5] build-v2-analog.sh"
            echo "  [6] build-v2-digital.sh"
            echo ""
            read -p "Your selection: " custom_selection
            
            BUILD_SCRIPTS=()
            for num in $custom_selection; do
                case $num in
                    2) BUILD_SCRIPTS+=("build-default.sh") ;;
                    3) BUILD_SCRIPTS+=("build-analog.sh") ;;                    
                    4) BUILD_SCRIPTS+=("build-digital.sh") ;;
                    5) BUILD_SCRIPTS+=("build-v2-analog.sh") ;;
                    6) BUILD_SCRIPTS+=("build-v2-digital.sh") ;;
                    *) echo "⚠️  Invalid option: $num (skipping)" ;;
                esac
            done
            
            if [ ${#BUILD_SCRIPTS[@]} -eq 0 ]; then
                echo "No valid builds selected. Skipping frontend build."
                return
            fi
            ;;
        *)
            echo "Invalid option. Skipping frontend build."
            return
            ;;
    esac
    
    # Navigate to frontend directory
    FRONTEND_DIR="$PHANTOM_DIR/frontend"
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo "❌ Error: Frontend directory not found at $FRONTEND_DIR"
        exit 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Run npm install to ensure dependencies are up to date
    echo ""
    echo "Updating npm dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: npm install had issues, but continuing..."
    fi
    
    # Execute selected build scripts
    for script in "${BUILD_SCRIPTS[@]}"; do
        echo ""
        echo "=========================================="
        echo "Running $script"
        echo "=========================================="
        
        if [ ! -f "$script" ]; then
            echo "❌ Error: $script not found in $FRONTEND_DIR/"
            continue
        fi
        
        chmod +x "$script"
        ./"$script"
        
        if [ $? -eq 0 ]; then
            echo "✅ $script completed successfully!"
        else
            echo "❌ $script failed!"
        fi
    done
    
    cd - > /dev/null
}


# Main script execution
find_phantom_dir
echo ""

echo "What would you like to recompile?"
echo ""
echo "  [1] Backend only"
echo "  [2] Frontend only (with default App.svelte selection)"
echo "  [3] Both backend and frontend"
echo "  [0] Exit"
echo ""
read -p "Select an option [0-3]: " main_option

case $main_option in
    1)
        recompile_backend
        ;;
    2)
        select_default_app
        recompile_frontend
        ;;
    3)
        recompile_backend
        select_default_app
        recompile_frontend
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "✅ Recompile Complete!"
echo "=========================================="
echo ""

if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
    echo "📦 Frontend output: $PHANTOM_DIR/frontend/dist/"
fi

if [ -d "$PHANTOM_DIR/build" ]; then
    echo "📦 Backend output: $PHANTOM_DIR/build/"
fi

echo ""
echo "Summary:"
echo "  - Default App.svelte: $DEFAULT_NAME"
echo "  - VersionSelector dropdown updated (default appears first)"
echo ""
echo "Next steps:"
echo "  - Test your changes"
echo "  - Restart your PhantomSDR-Plus server if it's running"
echo ""
echo "Thank you for using PhantomSDR-Plus!"
echo ""
