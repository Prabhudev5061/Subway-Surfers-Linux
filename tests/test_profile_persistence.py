#!/usr/bin/env python3
"""
Test Suite 5: Profile Isolation, Backup Integrity, and App Launch Verification
"""

import os
import sys
import time
import shutil
import hashlib
import tempfile
import subprocess

EXPECTED_ORIG_SHA256 = "84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35"

def run_tests():
    print("=== RUNNING TEST SUITE 5: PROFILE ISOLATION & BACKUP INTEGRITY ===")
    tests_passed = 0
    tests_total = 0

    def assert_test(name, condition, msg=""):
        nonlocal tests_passed, tests_total
        tests_total += 1
        if condition:
            print(f"[PASS] {name}")
            tests_passed += 1
        else:
            print(f"[FAIL] {name}: {msg}")
            raise AssertionError(f"{name}: {msg}")

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    workspace_root = os.path.abspath(os.path.join(base_dir, ".."))

    # 1. Verify Original AppImage Backup
    orig_appimage = os.path.join(workspace_root, "SubwaySurfers-x86-64.AppImage")
    backup_appimage = os.path.join(base_dir, "backups", "SubwaySurfers-x86-64.AppImage.orig")
    
    assert_test("Original AppImage Exists", os.path.exists(orig_appimage))
    assert_test("Backup AppImage Exists", os.path.exists(backup_appimage))

    with open(orig_appimage, "rb") as f:
        orig_hash = hashlib.sha256(f.read()).hexdigest()
    assert_test("Original AppImage SHA256 matches specification", orig_hash == EXPECTED_ORIG_SHA256)

    with open(backup_appimage, "rb") as f:
        backup_hash = hashlib.sha256(f.read()).hexdigest()
    assert_test("Backup AppImage SHA256 is byte-identical", backup_hash == EXPECTED_ORIG_SHA256)

    # 2. Verify Original Player Save Backup
    backup_profile = os.path.join(base_dir, "backups", "original_profile_backup.tar.gz")
    assert_test("Original Profile Archive Exists", os.path.exists(backup_profile) and os.path.getsize(backup_profile) > 1000)

    # 3. Test Profile Isolation with Temporary Directory
    temp_profile_dir = tempfile.mkdtemp(prefix="subway_test_profile_")
    candidate_bins = [
        os.path.join(base_dir, "app", "SubwaySurfers-AutoSave-Fixed-x86_64.AppImage"),
        os.path.join(base_dir, "app", "squashfs-root", "SubwaySurfers"),
        os.path.join(base_dir, "app", "SubwaySurfers")
    ]
    app_binary = None
    for c in candidate_bins:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            app_binary = os.path.abspath(c)
            break
    assert_test("App Binary Exists and Executable", app_binary is not None and os.access(app_binary, os.X_OK))

    # Note the modification time of real profile before launch
    real_profile_dir = os.path.expanduser("~/.config/SubwaySurfersSanfrancisco")
    orig_mtime = os.path.getmtime(real_profile_dir) if os.path.exists(real_profile_dir) else 0

    # Launch app with temporary profile in its own process group
    proc = subprocess.Popen(
        [app_binary, f"--user-data-dir={temp_profile_dir}", "--no-sandbox"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    # Allow application to boot and initialize storage profile
    time.sleep(3)
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            proc.kill()
        proc.wait()

    # Verify temp profile was populated
    temp_files = os.listdir(temp_profile_dir)
    assert_test("Temporary Profile Initialized", len(temp_files) > 0, f"Found files: {temp_files}")

    # Verify real profile was NOT modified during isolated run
    new_mtime = os.path.getmtime(real_profile_dir) if os.path.exists(real_profile_dir) else 0
    assert_test("Real User Profile Untouched During Test", new_mtime == orig_mtime)

    # Clean up temp profile
    shutil.rmtree(temp_profile_dir, ignore_errors=True)
    assert_test("Temporary Test Profile Cleaned Up", not os.path.exists(temp_profile_dir))

    print(f"\nTest Suite 5 Completed: {tests_passed}/{tests_total} Passed.")
    return tests_passed == tests_total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
