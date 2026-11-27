#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

"$SCRIPT_DIR/build-sanfrancisco.sh"
"$SCRIPT_DIR/build-beijing.sh"
"$SCRIPT_DIR/build-zurich.sh"
"$SCRIPT_DIR/verify-checksums.sh" --generate
