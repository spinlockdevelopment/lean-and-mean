#!/bin/sh
set -eu

cd "$(dirname "$0")"
build="$PWD/.build"
app="$build/Codex Companion.app"
mkdir -p "$app/Contents/MacOS" "$build/modules"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>CodexCompanion</string>
    <key>CFBundleIdentifier</key><string>dev.leanandmean.codex-companion</string>
    <key>CFBundleName</key><string>Codex Companion</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST

swiftc -O -module-cache-path "$build/modules" Activity.swift CodexAppearance.swift ProjectStatus.swift main.swift -o "$app/Contents/MacOS/CodexCompanion"
codesign --force --sign - "$app"
