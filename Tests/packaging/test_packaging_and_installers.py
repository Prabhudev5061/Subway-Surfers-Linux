#!/usr/bin/env python3
"""Packaging, Naming, Icon Integrity, and Standalone Installer Tests."""
import hashlib
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SF_LOGO_SHA256 = "95ea7b903bf206b293c1f2fcfcbcfc40d3e6391c78fbbec4672c360b5fb694c3"
BJ_LOGO_SHA256 = "0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class PackagingTests(unittest.TestCase):
    def test_six_release_artifacts_and_checksums(self):
        sf_appimg = REPO_ROOT / "App images" / "SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"
        bj_appimg = REPO_ROOT / "App images" / "SubwaySurfers-Beijing-Linux-x86_64.AppImage"
        sf_deb = REPO_ROOT / "Debian installers" / "SubwaySurfers-SanFrancisco-Linux-amd64.deb"
        bj_deb = REPO_ROOT / "Debian installers" / "SubwaySurfers-Beijing-Linux-amd64.deb"
        sf_inst = REPO_ROOT / "Terminal-Bash-Installers" / "SanFrancisco" / "install.sh"
        bj_inst = REPO_ROOT / "Terminal-Bash-Installers" / "Beijing" / "install.sh"

        for p in (sf_appimg, bj_appimg, sf_deb, bj_deb, sf_inst, bj_inst):
            self.assertTrue(p.is_file(), f"Missing artifact: {p}")

        # Verify distribution directories only contain expected file types
        appimg_files = list((REPO_ROOT / "App images").iterdir())
        self.assertEqual(len(appimg_files), 2)
        for f in appimg_files:
            self.assertTrue(f.name.endswith(".AppImage"))

        deb_files = list((REPO_ROOT / "Debian installers").iterdir())
        self.assertEqual(len(deb_files), 2)
        for f in deb_files:
            self.assertTrue(f.name.endswith(".deb"))

        # Verify SHA256SUMS passes
        res = subprocess.run(["sha256sum", "-c", "SHA256SUMS"], cwd=REPO_ROOT, capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, res.stdout + res.stderr)

    def test_original_logos_and_no_typo(self):
        self.assertEqual(sha256_file(REPO_ROOT / "Source" / "SanFrancisco" / "assets" / "subwaysurfers.png"), SF_LOGO_SHA256)
        self.assertEqual(sha256_file(REPO_ROOT / "Source" / "Beijing" / "assets" / "4399.png"), BJ_LOGO_SHA256)
        self.assertEqual(
            sha256_file(REPO_ROOT / "Terminal-Bash-Installers" / "SanFrancisco" / "required-files" / "subwaysurfers-sanfrancisco.png"),
            SF_LOGO_SHA256,
        )
        self.assertEqual(
            sha256_file(REPO_ROOT / "Terminal-Bash-Installers" / "Beijing" / "required-files" / "subwaysurfers-beijing.png"),
            BJ_LOGO_SHA256,
        )

        # Ensure old SanFranciso typo is absent across Source, Scripts, Terminal-Bash-Installers
        for folder in ("Source", "Scripts", "Terminal-Bash-Installers"):
            for p in (REPO_ROOT / folder).rglob("*"):
                if p.is_file() and p.suffix in (".js", ".sh", ".json", ".desktop", ".html", ".md", ".py") or p.name in ("control", "AppRun", "postinst", "postrm"):
                    txt = p.read_text(encoding="utf-8", errors="ignore")
                    self.assertNotIn("SanFranciso", txt, f"Found typo 'SanFranciso' in {p}")

    def test_deb_contents_and_isolation(self):
        sf_deb = REPO_ROOT / "Debian installers" / "SubwaySurfers-SanFrancisco-Linux-amd64.deb"
        bj_deb = REPO_ROOT / "Debian installers" / "SubwaySurfers-Beijing-Linux-amd64.deb"

        sf_info = subprocess.check_output(["dpkg-deb", "--info", str(sf_deb)], text=True)
        self.assertIn("Package: subwaysurfers-sanfrancisco-linux", sf_info)
        bj_info = subprocess.check_output(["dpkg-deb", "--info", str(bj_deb)], text=True)
        self.assertIn("Package: subwaysurfers-beijing-linux", bj_info)

        sf_list = subprocess.check_output(["dpkg-deb", "--contents", str(sf_deb)], text=True)
        self.assertIn("/opt/subwaysurfers-sanfrancisco/", sf_list)
        self.assertIn("/usr/bin/subwaysurfers-sanfrancisco", sf_list)
        self.assertIn("/usr/share/applications/subwaysurfers-sanfrancisco.desktop", sf_list)
        self.assertIn("/usr/share/pixmaps/subwaysurfers-sanfrancisco.png", sf_list)
        self.assertNotIn("Beijing_2", sf_list)

        bj_list = subprocess.check_output(["dpkg-deb", "--contents", str(bj_deb)], text=True)
        self.assertIn("/opt/subwaysurfers-beijing/", bj_list)
        self.assertIn("/usr/bin/subwaysurfers-beijing", bj_list)
        self.assertIn("/usr/share/applications/subwaysurfers-beijing.desktop", bj_list)
        self.assertIn("/usr/share/pixmaps/subwaysurfers-beijing.png", bj_list)
        self.assertNotIn("SanFrancisco", bj_list)
        self.assertNotIn("icon-placeholder", bj_list)

    def test_standalone_bash_installers_independent_of_repo(self):
        with tempfile.TemporaryDirectory(prefix="subway-inst-test-") as tmp:
            tmp_path = Path(tmp)
            # Copy ONLY the Terminal-Bash-Installers bundles outside the repo (simulating moved source dir)
            copied_sf = tmp_path / "copied_sf_installer"
            copied_bj = tmp_path / "copied_bj_installer"
            shutil.copytree(REPO_ROOT / "Terminal-Bash-Installers" / "SanFrancisco", copied_sf)
            shutil.copytree(REPO_ROOT / "Terminal-Bash-Installers" / "Beijing", copied_bj)

            fake_home = tmp_path / "fake_home"
            fake_home.mkdir()
            env = dict(os.environ)
            env["HOME"] = str(fake_home)
            env["XDG_DATA_HOME"] = str(fake_home / ".local" / "share")
            env["XDG_CONFIG_HOME"] = str(fake_home / ".config")

            # Seed a shared save file to verify install/uninstall preserves it
            save_dir = fake_home / ".local" / "share" / "SubwaySurfers-Linux" / "Save"
            save_dir.mkdir(parents=True, exist_ok=True)
            sentinel = save_dir / "cloud"
            sentinel.write_bytes(b"SENTINEL_SAVE_DATA")

            # Install both SF and Beijing from copied standalone folders
            subprocess.check_call(["bash", str(copied_sf / "install.sh"), "--user"], env=env)
            subprocess.check_call(["bash", str(copied_bj / "install.sh"), "--user"], env=env)

            self.assertTrue((fake_home / ".local" / "bin" / "subwaysurfers-sanfrancisco").is_symlink())
            self.assertTrue((fake_home / ".local" / "bin" / "subwaysurfers-beijing").is_symlink())
            self.assertTrue((fake_home / ".local" / "share" / "applications" / "subwaysurfers-sanfrancisco.desktop").is_file())
            self.assertTrue((fake_home / ".local" / "share" / "applications" / "subwaysurfers-beijing.desktop").is_file())
            self.assertEqual(
                sha256_file(fake_home / ".local" / "share" / "icons" / "hicolor" / "512x512" / "apps" / "subwaysurfers-sanfrancisco.png"),
                SF_LOGO_SHA256,
            )
            self.assertEqual(
                sha256_file(fake_home / ".local" / "share" / "icons" / "hicolor" / "512x512" / "apps" / "subwaysurfers-beijing.png"),
                BJ_LOGO_SHA256,
            )
            self.assertEqual(sentinel.read_bytes(), b"SENTINEL_SAVE_DATA")

            # Uninstall SF only -> Beijing and shared saves MUST remain intact
            subprocess.check_call(["bash", str(copied_sf / "uninstall.sh")], env=env)
            self.assertFalse((fake_home / ".local" / "bin" / "subwaysurfers-sanfrancisco").exists())
            self.assertFalse((fake_home / ".local" / "share" / "applications" / "subwaysurfers-sanfrancisco.desktop").exists())
            self.assertTrue((fake_home / ".local" / "bin" / "subwaysurfers-beijing").exists())
            self.assertTrue((fake_home / ".local" / "share" / "applications" / "subwaysurfers-beijing.desktop").is_file())
            self.assertEqual(sentinel.read_bytes(), b"SENTINEL_SAVE_DATA")

            # Uninstall Beijing -> shared saves STILL remain intact
            subprocess.check_call(["bash", str(copied_bj / "uninstall.sh")], env=env)
            self.assertFalse((fake_home / ".local" / "bin" / "subwaysurfers-beijing").exists())
            self.assertEqual(sentinel.read_bytes(), b"SENTINEL_SAVE_DATA")


if __name__ == "__main__":
    unittest.main(verbosity=2)
