#!/usr/bin/env python3
"""
Master Test Suite Runner for Subway Surfers AutoSave System.
Executes all test modules, logs outputs to logs/automated_tests.log,
and produces a summary report.
"""

import os
import sys
import time
import subprocess

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    tests_dir = os.path.join(base_dir, "tests")
    logs_dir = os.path.join(tests_dir, "test_logs")
    os.makedirs(logs_dir, exist_ok=True)
    log_file_path = os.path.join(logs_dir, "automated_tests.log")

    app_bin = None
    candidate_bins = [
        os.path.join(base_dir, "app", "SubwaySurfers-AutoSave-Fixed-x86_64.AppImage"),
        os.path.join(base_dir, "app", "squashfs-root", "SubwaySurfers"),
        os.path.join(base_dir, "app", "SubwaySurfers")
    ]
    for c in candidate_bins:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            app_bin = os.path.abspath(c)
            break

    test_commands = [
        {
            "id": "TC-01",
            "name": "Header & SHA-1 Cryptographic Integrity",
            "cmd": [app_bin, os.path.join(tests_dir, "test_header_and_sha1.js")],
            "env": dict(os.environ, ELECTRON_RUN_AS_NODE="1")
        },
        {
            "id": "TC-02",
            "name": "AutoSaveManager State Machine & Queueing",
            "cmd": [app_bin, os.path.join(tests_dir, "test_autosave_manager.js")],
            "env": dict(os.environ, ELECTRON_RUN_AS_NODE="1")
        },
        {
            "id": "TC-03",
            "name": "BSON Data Model & Gameplay Event Persistence",
            "cmd": [sys.executable, os.path.join(tests_dir, "test_bson_and_gameplay.py")],
            "env": os.environ
        },
        {
            "id": "TC-04",
            "name": "Electron IPC Bridge & Shutdown Lifecycle",
            "cmd": [app_bin, os.path.join(tests_dir, "test_ipc_lifecycle.js")],
            "env": dict(os.environ, ELECTRON_RUN_AS_NODE="1")
        },
        {
            "id": "TC-05",
            "name": "Profile Isolation & Backup Verification",
            "cmd": [sys.executable, os.path.join(tests_dir, "test_profile_persistence.py")],
            "env": os.environ
        },
        {
            "id": "TC-06",
            "name": "Live End-to-End Save Persistence & Restart Verification",
            "cmd": [app_bin, os.path.join(tests_dir, "test_live_save_persistence.js")],
            "env": dict(os.environ, ELECTRON_RUN_AS_NODE="1")
        }
    ]

    total_start = time.time()
    results = []

    with open(log_file_path, "w", encoding="utf-8") as log_f:
        log_f.write("=" * 80 + "\n")
        log_f.write("SUBWAY SURFERS LINUX — AUTOMATED TEST SUITE EXECUTION LOG\n")
        log_f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n")
        log_f.write("=" * 80 + "\n\n")

        print("=" * 80)
        print("SUBWAY SURFERS LINUX — EXECUTING AUTOMATED TEST SUITE")
        print("=" * 80)

        all_passed = True
        for tc in test_commands:
            print(f"\nRunning {tc['id']}: {tc['name']}...")
            log_f.write(f"\n--- [{tc['id']}] {tc['name']} ---\n")
            log_f.flush()

            t0 = time.time()
            try:
                proc = subprocess.run(
                    tc["cmd"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    env=tc["env"],
                    text=True,
                    timeout=120
                )
                duration = time.time() - t0
                output = proc.stdout
                passed = (proc.returncode == 0)
            except Exception as e:
                duration = time.time() - t0
                output = f"Execution error: {str(e)}"
                passed = False

            log_f.write(output + "\n")
            status_str = "PASS" if passed else "FAIL"
            log_f.write(f"[{tc['id']}] Status: {status_str} (Duration: {duration:.2f}s)\n")
            log_f.flush()

            print(f"[{tc['id']}] Result: {status_str} in {duration:.2f}s")
            results.append({
                "id": tc["id"],
                "name": tc["name"],
                "status": status_str,
                "duration": f"{duration:.2f}s"
            })

            if not passed:
                all_passed = False
                print(output)

        total_duration = time.time() - total_start
        summary_header = f"\n\n{'=' * 80}\nTEST EXECUTION SUMMARY\n{'=' * 80}\n"
        print(summary_header)
        log_f.write(summary_header)

        for r in results:
            line = f"{r['id']:8s} | {r['status']:6s} | {r['duration']:8s} | {r['name']}\n"
            print(line, end="")
            log_f.write(line)

        final_line = f"\nTotal Duration: {total_duration:.2f}s | All Suites Passed: {all_passed}\n"
        print(final_line)
        log_f.write(final_line)

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
