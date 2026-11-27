#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [ "$1" = "--generate" ]; then
    {
        sha256sum "App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"
        sha256sum "App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage"
        sha256sum "Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb"
        sha256sum "Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb"
        sha256sum "Terminal-Bash-Installers/SanFrancisco/install.sh"
        sha256sum "Terminal-Bash-Installers/SanFrancisco/uninstall.sh"
        sha256sum "Terminal-Bash-Installers/SanFrancisco/required-files/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"
        sha256sum "Terminal-Bash-Installers/SanFrancisco/required-files/SubwaySurfers-SanFrancisco-Linux-amd64.deb"
        sha256sum "Terminal-Bash-Installers/SanFrancisco/required-files/subwaysurfers-sanfrancisco.png"
        sha256sum "Terminal-Bash-Installers/SanFrancisco/required-files/subwaysurfers-sanfrancisco.desktop"
        sha256sum "Terminal-Bash-Installers/Beijing/install.sh"
        sha256sum "Terminal-Bash-Installers/Beijing/uninstall.sh"
        sha256sum "Terminal-Bash-Installers/Beijing/required-files/SubwaySurfers-Beijing-Linux-x86_64.AppImage"
        sha256sum "Terminal-Bash-Installers/Beijing/required-files/SubwaySurfers-Beijing-Linux-amd64.deb"
        sha256sum "Terminal-Bash-Installers/Beijing/required-files/subwaysurfers-beijing.png"
        sha256sum "Terminal-Bash-Installers/Beijing/required-files/subwaysurfers-beijing.desktop"
    } > SHA256SUMS
    echo "Generated SHA256SUMS:"
    cat SHA256SUMS
fi

sha256sum -c SHA256SUMS
