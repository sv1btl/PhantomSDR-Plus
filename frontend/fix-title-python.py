#!/usr/bin/env python3
"""
Simple, reliable script to inject title and favicon
Works with any site_information.json format
"""

import json
import re
import os
import sys

print("🔧 Fixing title and favicon in HTML files...")
print("")

# Check if we're in the right directory
if not os.path.exists('site_information.json'):
    print("❌ Error: site_information.json not found!")
    print(f"   Current directory: {os.getcwd()}")
    print("   Please run this from: /home/sv1btl/PhantomSDR-Plus/frontend/")
    sys.exit(1)

# Load site_information.json
print("📄 Reading site_information.json...")
try:
    with open('site_information.json', 'r') as f:
        site_info = json.load(f)
    print(f"✓ Loaded successfully")
except Exception as e:
    print(f"❌ Error reading JSON: {e}")
    sys.exit(1)

# Extract siteSysop
if 'siteSysop' not in site_info:
    print("❌ Error: 'siteSysop' field not found in site_information.json!")
    print("")
    print("Available fields:")
    for key in site_info.keys():
        print(f"  - {key}")
    print("")
    print("Please add 'siteSysop' to your site_information.json")
    sys.exit(1)

site_sysop = site_info['siteSysop']
if not site_sysop or site_sysop.strip() == '':
    print("⚠️  Warning: siteSysop is empty, using default")
    site_sysop = "PhantomSDR"

print(f"✓ siteSysop: {site_sysop}")

# Create title
title = f"{site_sysop} PhantomSDR+"
print(f"✓ Title will be: {title}")
print("")

# Function to update HTML file
def update_html(html_file, favicon_path):
    if not os.path.exists(html_file):
        print(f"⚠️  Skipping {html_file} (not found)")
        return False
    
    print(f"📝 Processing: {html_file}")
    
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Update title
        html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html, flags=re.DOTALL)
        
        # Add or update favicon
        if 'favicon.ico' not in html:
            # Add favicon before </head>
            html = html.replace('</head>', f'    <link rel="icon" type="image/x-icon" href="{favicon_path}" />\n  </head>')
        else:
            # Update existing favicon path
            html = re.sub(r'href="[^"]*favicon\.ico"', f'href="{favicon_path}"', html)
        
        # Write back
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"   ✅ Updated!")
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

# Check if dist exists
if not os.path.exists('dist'):
    print("❌ Error: dist/ directory not found!")
    print("   Please build first: ./build-each-version-separate.sh")
    sys.exit(1)

print("🔧 Updating HTML files...")
print("")

# Update all HTML files
updated = 0

files_to_update = [
    ('dist/index.html', '/favicon.ico'),
    ('dist/digital/index.html', '/digital/favicon.ico'),
    ('dist/v2-analog/index.html', '/v2-analog/favicon.ico'),
    ('dist/v2-digital/index.html', '/v2-digital/favicon.ico'),
]

for html_file, favicon_path in files_to_update:
    if update_html(html_file, favicon_path):
        updated += 1

print("")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"✅ Updated {updated} HTML files!")
print(f"   Title: {title}")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("")
print("🧪 Verify:")
print("   grep '<title>' dist/index.html")
print("")
print(f"   Should show: <title>{title}</title>")
print("")
