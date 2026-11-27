#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_PARENT="$(cd "$REPO_ROOT/.." && pwd)"

find_node_bin() {
    if command -v node >/dev/null 2>&1; then
        echo "node"
        return 0
    fi
    if [ -x "$WORKSPACE_PARENT/analysis/extracted/squashfs-root/SubwaySurfers" ]; then
        export ELECTRON_RUN_AS_NODE=1
        echo "$WORKSPACE_PARENT/analysis/extracted/squashfs-root/SubwaySurfers"
        return 0
    fi
    local TMP_NODE_DIR="/tmp/subway_test_node_runtime"
    if [ ! -x "$TMP_NODE_DIR/SubwaySurfers" ] || [ ! -f "$TMP_NODE_DIR/icudtl.dat" ]; then
        rm -rf "$TMP_NODE_DIR"
        unsquashfs -d "$TMP_NODE_DIR" -o 189632 "$REPO_ROOT/App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage" SubwaySurfers libffmpeg.so icudtl.dat snapshot_blob.bin v8_context_snapshot.bin >/dev/null
    fi
    export ELECTRON_RUN_AS_NODE=1
    echo "$TMP_NODE_DIR/SubwaySurfers"
}

NODE_BIN="$(find_node_bin)"
if [ "$NODE_BIN" != "node" ]; then
    export ELECTRON_RUN_AS_NODE=1
fi

echo "=== 1. Shared Storage & Process Locking Tests ==="
"$NODE_BIN" "$REPO_ROOT/Tests/shared-storage/test_shared_storage.js"

echo "=== 2. Safe First-Launch Migration Tests ==="
"$NODE_BIN" "$REPO_ROOT/Tests/migration/test_migration.js"

echo "=== 3. AutoSave & HostIDBFS Integration Tests ==="
"$NODE_BIN" "$REPO_ROOT/Tests/autosave/test_autosave_and_recovery.js"

echo "=== 4. Packaging, Naming, Logos & Standalone Installer Tests ==="
python3 "$REPO_ROOT/Tests/packaging/test_packaging_and_installers.py"

echo "=== 5. Live Cross-Version Switching, UI, Security & Crash Recovery Tests ==="
"$NODE_BIN" "$REPO_ROOT/Tests/integration/test_cross_version_and_ui.js"

echo "=== 6. SHA256SUMS Verification ==="
"$SCRIPT_DIR/verify-checksums.sh"

echo ""
echo "ALL SUBWAYSURFERS-LINUX AUTOMATED TESTS PASSED."
