#!/bin/bash
# ==============================================================================
# Safe Cleanup Script for SubwaySurfers-Linux (3-Version Collection)
#
# Preconditions enforced before removing any explicit redundant target:
#   1. backups_audit_20261127/SHA256SUMS.backup passes sha256sum -c
#   2. SubwaySurfers-Linux/SHA256SUMS (all 24 entries) passes sha256sum -c
#   3. Upstream SubwaySurfers-x86-64.AppImage exists and matches expected SHA-256
#   4. Original Zurich source files & logo exist and match expected SHA-256
#   5. Canonical ~/.local/share/SubwaySurfers-Linux/Save/ contains valid saves
#
# Preserved permanently (NEVER deleted):
#   - SubwaySurfers-Linux/
#   - SubwaySurfers-x86-64.AppImage (upstream San Francisco provenance)
#   - Zurich/ (original Zurich source & provenance)
#   - backups_audit_20261127/, backups_unified_migration_20261127_1444/, backups_zurich_phase0_*
#   - ~/.local/share/SubwaySurfers-Linux/Save/ and migration backups
#   - ~/.config/SubwaySurfersSanfrancisco and ~/.config/SubwaySurfersBeijing2
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_PARENT="$(cd "$REPO_ROOT/.." && pwd)"

BACKUP_DIR="$WORKSPACE_PARENT/backups_audit_20261127"
UPSTREAM_APPIMAGE="$WORKSPACE_PARENT/SubwaySurfers-x86-64.AppImage"
UPSTREAM_SHA256="84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35"
ZURICH_SRC_DIR="$WORKSPACE_PARENT/Zurich/files/m.igroutka.ru/ni3/171/SubwaySurfers"
ZURICH_DATA_SHA256="abf564553f7b07a29425c035ce8069248809c5efdcc4e76a147412fa87a5ee9a"
ZURICH_LOGO_SHA256="2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a"
SAVE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/SubwaySurfers-Linux/Save"

echo "=== Verifying Preconditions Before Cleanup ==="
if [ ! -f "$BACKUP_DIR/SHA256SUMS.backup" ]; then
    echo "ABORT: Backup manifest missing at $BACKUP_DIR/SHA256SUMS.backup" >&2
    exit 1
fi
(cd "$BACKUP_DIR" && sha256sum -c --quiet SHA256SUMS.backup)
echo "  [OK] Backup verified: $BACKUP_DIR"

(cd "$REPO_ROOT" && sha256sum -c --quiet SHA256SUMS)
echo "  [OK] Unified 3-version SHA256SUMS verified."

if [ ! -f "$UPSTREAM_APPIMAGE" ]; then
    echo "ABORT: Upstream AppImage missing at $UPSTREAM_APPIMAGE" >&2
    exit 1
fi
ACTUAL_UP_SHA="$(sha256sum "$UPSTREAM_APPIMAGE" | awk '{print $1}')"
if [ "$ACTUAL_UP_SHA" != "$UPSTREAM_SHA256" ]; then
    echo "ABORT: Upstream AppImage SHA-256 mismatch ($ACTUAL_UP_SHA != $UPSTREAM_SHA256)" >&2
    exit 1
fi
echo "  [OK] Upstream San Francisco AppImage preserved and verified."

if [ ! -f "$ZURICH_SRC_DIR/Build/ZurichNewPrivacy.data.unityweb" ] || [ ! -f "$ZURICH_SRC_DIR/b3f5e1472e1bfbee1804c7e854546a08.png" ]; then
    echo "ABORT: Original Zurich source files missing at $ZURICH_SRC_DIR" >&2
    exit 1
fi
ACTUAL_ZR_DATA_SHA="$(sha256sum "$ZURICH_SRC_DIR/Build/ZurichNewPrivacy.data.unityweb" | awk '{print $1}')"
ACTUAL_ZR_LOGO_SHA="$(sha256sum "$ZURICH_SRC_DIR/b3f5e1472e1bfbee1804c7e854546a08.png" | awk '{print $1}')"
if [ "$ACTUAL_ZR_DATA_SHA" != "$ZURICH_DATA_SHA256" ] || [ "$ACTUAL_ZR_LOGO_SHA" != "$ZURICH_LOGO_SHA256" ]; then
    echo "ABORT: Original Zurich source SHA-256 mismatch." >&2
    exit 1
fi
echo "  [OK] Original Zurich source & logo preserved and verified."

if [ ! -f "$SAVE_DIR/cloud" ] || [ ! -f "$SAVE_DIR/PlayerPrefs" ]; then
    echo "ABORT: Canonical shared save directory incomplete at $SAVE_DIR" >&2
    exit 1
fi
echo "  [OK] Shared save directory verified: $SAVE_DIR"

TARGETS=(
    "Subway-Surfers-Linux"
    "SubwaySurfers-Beijing-Linux"
    "analysis"
    "Beijing-Website-Download"
    "investigation_igroutka_beijing2"
    "siteone-temp"
    "SubwaySurfers-beijing"
    "CLEANUP_PLAN.md"
    "backups_launch_repair_20261124"
)

echo "=== Removing Verified Redundant Targets ==="
for rel in "${TARGETS[@]}"; do
    target="$WORKSPACE_PARENT/$rel"
    if [ -e "$target" ]; then
        rm -rf -- "$target"
        echo "  [REMOVED] $target"
    else
        echo "  [SKIP] Already absent: $target"
    fi
done

echo "=== Cleanup Complete ==="
ls -la "$WORKSPACE_PARENT"
