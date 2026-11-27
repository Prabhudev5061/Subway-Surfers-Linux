#!/bin/bash
# Shared packaging helper for SubwaySurfers-Linux
set -e

build_version_packages() {
    local VERSION_KEY="$1"      # SanFrancisco or Beijing
    local APP_ID="$2"           # SubwaySurfers-SanFrancisco-Linux or SubwaySurfers-Beijing-Linux
    local BIN_NAME="$3"         # subwaysurfers-sanfrancisco or subwaysurfers-beijing
    local OPT_SUBDIR="$4"       # subwaysurfers-sanfrancisco or subwaysurfers-beijing
    local DESKTOP_NAME="$5"     # subwaysurfers-sanfrancisco.desktop or subwaysurfers-beijing.desktop
    local ICON_SRC="$6"         # path to original logo PNG
    local ICON_NAME="$7"        # subwaysurfers-sanfrancisco.png or subwaysurfers-beijing.png
    local REPO_ROOT="$8"

    local WORKSPACE_PARENT="$(cd "$REPO_ROOT/.." && pwd)"
    local BASE_APPIMAGE="${SUBWAY_BASE_APPIMAGE:-$WORKSPACE_PARENT/SubwaySurfers-x86-64.AppImage}"
    if [ ! -f "$BASE_APPIMAGE" ]; then
        echo "Error: Upstream base AppImage not found at '$BASE_APPIMAGE'. Set SUBWAY_BASE_APPIMAGE." >&2
        exit 1
    fi

    local VER_SRC="$REPO_ROOT/Source/$VERSION_KEY"
    local SHARED_SRC="$REPO_ROOT/Source/Shared"
    local APPIMG_DIR="$REPO_ROOT/App images"
    local DEB_DIR="$REPO_ROOT/Debian installers"
    local INST_REQ_DIR="$REPO_ROOT/Terminal-Bash-Installers/$VERSION_KEY/required-files"

    local OUT_APPIMAGE="$APPIMG_DIR/${APP_ID}-x86_64.AppImage"
    local OUT_DEB="$DEB_DIR/${APP_ID}-amd64.deb"

    mkdir -p "$APPIMG_DIR" "$DEB_DIR" "$INST_REQ_DIR"

    local BUILD_TMP
    BUILD_TMP="$(mktemp -d /tmp/subwaysurfers-build-XXXXXX)"
    trap 'rm -rf "$BUILD_TMP"' RETURN

    local ELECTRON_SRC="$WORKSPACE_PARENT/analysis/extracted/squashfs-root"
    if [ ! -x "$ELECTRON_SRC/SubwaySurfers" ]; then
        echo "[$APP_ID] Extracting Electron runtime from base AppImage..."
        unsquashfs -d "$BUILD_TMP/base-squashfs" -o 189632 "$BASE_APPIMAGE" >/dev/null
        ELECTRON_SRC="$BUILD_TMP/base-squashfs"
    fi

    local STAGE_DIR="$BUILD_TMP/stage"
    local DEB_TREE="$BUILD_TMP/deb-tree"
    local RUNTIME_BIN="$BUILD_TMP/runtime"
    local SQUASH_IMG="$BUILD_TMP/app.squashfs"

    mkdir -p "$STAGE_DIR/resources/app/shared" "$STAGE_DIR/web"

    echo "[$APP_ID] Staging Electron runtime and shared storage layer..."
    head -c 189632 "$BASE_APPIMAGE" > "$RUNTIME_BIN"

    for item in SubwaySurfers chrome-sandbox chrome_crashpad_handler \
                libffmpeg.so libEGL.so libGLESv2.so libvk_swiftshader.so libvulkan.so.1 \
                vk_swiftshader_icd.json icudtl.dat resources.pak \
                chrome_100_percent.pak chrome_200_percent.pak \
                snapshot_blob.bin v8_context_snapshot.bin version \
                LICENSE LICENSES.chromium.html locales; do
        if [ -e "$ELECTRON_SRC/$item" ]; then
            cp -a "$ELECTRON_SRC/$item" "$STAGE_DIR/"
        fi
    done

    cp "$VER_SRC/electron/package.json" "$STAGE_DIR/resources/app/package.json"
    cp "$VER_SRC/electron/main.js" "$STAGE_DIR/resources/app/main.js"
    cp "$SHARED_SRC"/*.js "$STAGE_DIR/resources/app/shared/"

    cp -a "$VER_SRC/web/." "$STAGE_DIR/web/"
    cp "$VER_SRC/appimage/AppRun" "$STAGE_DIR/AppRun"
    chmod 755 "$STAGE_DIR/AppRun"
    cp "$VER_SRC/appimage/$DESKTOP_NAME" "$STAGE_DIR/$DESKTOP_NAME"
    cp "$ICON_SRC" "$STAGE_DIR/$ICON_NAME"
    cp "$ICON_SRC" "$STAGE_DIR/.DirIcon"

    echo "[$APP_ID] Verifying asset separation & hygiene guardrails..."
    python3 - "$STAGE_DIR" "$VERSION_KEY" << 'PYEOF'
import sys
from pathlib import Path

stage = Path(sys.argv[1])
ver = sys.argv[2]

if ver == "SanFrancisco":
    forbidden = ("beijing_2", "zurichnewprivacy", "igroutka", "logo-mini.png", "4399.png", "icon-placeholder")
    required = ("web/Build/SanFrancisco.json", "web/Build/SanFrancisco.data.unityweb", "web/Build/SanFrancisco.wasm.code.unityweb")
elif ver == "Beijing":
    forbidden = ("sanfrancisco", "zurichnewprivacy", "igroutka", "logo-mini.png", "icon-placeholder", "poki-sdk-core.js", "prebid4.12.0.js", "script.js", "loaders/v3/")
    required = ("web/Build/Beijing_2.json", "web/Build/Beijing_2.data.unityweb", "web/Build/Beijing_2.wasm.code.unityweb")
elif ver == "Zurich":
    forbidden = ("sanfrancisco", "beijing_2", "igroutka", "logo-mini.png", "4399.png", "icon-placeholder", "poki-sdk-core.js", "prebid4.12.0.js", "script.js")
    required = (
        "web/Build/ZurichNewPrivacy.json",
        "web/Build/ZurichNewPrivacy.data.unityweb",
        "web/Build/ZurichNewPrivacy.wasm.code.unityweb",
        "web/Build/ZurichNewPrivacy.wasm.framework.unityweb",
        "web/UnityLoader.2019.2.js",
        "web/4399.js",
        "web/b3f5e1472e1bfbee1804c7e854546a08.png",
    )
else:
    print(f"FATAL: Unknown version {ver}", file=sys.stderr)
    sys.exit(1)

for req in required:
    if not (stage / req).is_file():
        print(f"FATAL: Missing required asset in {ver} staging: {req}", file=sys.stderr)
        sys.exit(1)

for p in stage.rglob("*"):
    if not p.is_file():
        continue
    rel = p.relative_to(stage).as_posix().lower()
    if any(tok in rel for tok in forbidden):
        print(f"FATAL: Forbidden cross-version or adware file in {ver} staging: {rel}", file=sys.stderr)
        sys.exit(1)

print(f"[{ver}] Staging guardrail PASS.")
PYEOF

    echo "[$APP_ID] Building AppImage -> $OUT_APPIMAGE"
    mksquashfs "$STAGE_DIR" "$SQUASH_IMG" -comp gzip -b 131072 -root-owned -noappend >/dev/null
    cat "$RUNTIME_BIN" "$SQUASH_IMG" > "${OUT_APPIMAGE}.tmp"
    chmod 755 "${OUT_APPIMAGE}.tmp"
    mv -f "${OUT_APPIMAGE}.tmp" "$OUT_APPIMAGE"

    echo "[$APP_ID] Building Debian package -> $OUT_DEB"
    mkdir -p "$DEB_TREE/opt/$OPT_SUBDIR" \
             "$DEB_TREE/usr/bin" \
             "$DEB_TREE/usr/share/applications" \
             "$DEB_TREE/usr/share/pixmaps" \
             "$DEB_TREE/usr/share/icons/hicolor/512x512/apps" \
             "$DEB_TREE/DEBIAN"
    cp -a "$STAGE_DIR/." "$DEB_TREE/opt/$OPT_SUBDIR/"
    ln -sf "/opt/$OPT_SUBDIR/AppRun" "$DEB_TREE/usr/bin/$BIN_NAME"
    cp "$VER_SRC/appimage/$DESKTOP_NAME" "$DEB_TREE/usr/share/applications/$DESKTOP_NAME"
    cp "$ICON_SRC" "$DEB_TREE/usr/share/pixmaps/$ICON_NAME"
    cp "$ICON_SRC" "$DEB_TREE/usr/share/icons/hicolor/512x512/apps/$ICON_NAME"

    cp "$VER_SRC/debian/control" "$DEB_TREE/DEBIAN/control"
    cp "$VER_SRC/debian/postinst" "$DEB_TREE/DEBIAN/postinst"
    cp "$VER_SRC/debian/postrm" "$DEB_TREE/DEBIAN/postrm"
    chmod 755 "$DEB_TREE/DEBIAN/postinst" "$DEB_TREE/DEBIAN/postrm"

    dpkg-deb --build "$DEB_TREE" "${OUT_DEB}.tmp" >/dev/null
    mv -f "${OUT_DEB}.tmp" "$OUT_DEB"

    echo "[$APP_ID] Populating standalone Bash installer bundle -> $INST_REQ_DIR"
    rm -f "$INST_REQ_DIR"/*
    cp -f "$OUT_APPIMAGE" "$INST_REQ_DIR/${APP_ID}-x86_64.AppImage"
    cp -f "$OUT_DEB" "$INST_REQ_DIR/${APP_ID}-amd64.deb"
    cp -f "$ICON_SRC" "$INST_REQ_DIR/$ICON_NAME"
    cp -f "$VER_SRC/appimage/$DESKTOP_NAME" "$INST_REQ_DIR/$DESKTOP_NAME"
    chmod 755 "$REPO_ROOT/Terminal-Bash-Installers/$VERSION_KEY/install.sh" \
              "$REPO_ROOT/Terminal-Bash-Installers/$VERSION_KEY/uninstall.sh" \
              "$INST_REQ_DIR/${APP_ID}-x86_64.AppImage"

    echo "[$APP_ID] Build complete."
}
