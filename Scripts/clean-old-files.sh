#!/bin/bash
# ==============================================================================
# Safe Cleanup Script for Obsolete Pre-Migration Project Directories
#
# Preconditions enforced before removing any explicit target:
#   1. backups_audit_20261127/SHA256SUMS.backup passes sha256sum -c
#   2. SubwaySurfers-Linux/SHA256SUMS passes sha256sum -c
#   3. Upstream SubwaySurfers-x86-64.AppImage exists and matches expected SHA-256
#   4. Canonical ~/.local/share/SubwaySurfers-Linux/Save/ contains valid saves
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_PARENT="$(cd "$REPO_ROOT/.." && pwd)"

BACKUP_DIR="$WORKSPACE_PARENT/backups_audit_20261127"
UPSTREAM_APPIMAGE="$WORKSPACE_PARENT/SubwaySurfers-x86-64.AppImage"
UPSTREAM_SHA256="84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35"
SAVE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/SubwaySurfers-Linux/Save"

echo "=== Verifying Preconditions Before Cleanup ==="
if [ ! -f "$BACKUP_DIR/SHA256SUMS.backup" ]; then
    echo "ABORT: Backup manifest missing at $BACKUP_DIR/SHA256SUMS.backup" >&2
    exit 1
fi
(cd "$BACKUP_DIR" && sha256sum -c --quiet SHA256SUMS.backup)
echo "  [OK] Backup verified: $BACKUP_DIR"

(cd "$REPO_ROOT" && sha256sum -c --quiet SHA256SUMS)
echo "  [OK] Unified release SHA256SUMS verified."

if [ ! -f "$UPSTREAM_APPIMAGE" ]; then
    echo "ABORT: Upstream AppImage missing at $UPSTREAM_APPIMAGE" >&2
    exit 1
fi
ACTUAL_UP_SHA="$(sha256sum "$UPSTREAM_APPIMAGE" | awk '{print $1}')"
if [ "$ACTUAL_UP_SHA" != "$UPSTREAM_SHA256" ]; then
    echo "ABORT: Upstream AppImage SHA-256 mismatch ($ACTUAL_UP_SHA != $UPSTREAM_SHA256)" >&2
    exit 1
fi
echo "  [OK] Upstream AppImage preserved and verified."

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
