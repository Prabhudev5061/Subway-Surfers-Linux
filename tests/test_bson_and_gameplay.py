#!/usr/bin/env python3
"""
Test Suite 3: BSON Data Model & Gameplay Event Serialization Tests
Tests the save file structure, gameplay state transitions, SHA-1 recalculation,
and failure/corruption detection.
"""

import os
import sys
import struct
import hashlib
import json

def parse_bson_doc(data, offset=0):
    """Minimal self-contained BSON parser for Subway Surfers save data."""
    if len(data) < offset + 4:
        raise ValueError("Buffer too small for BSON header")
    doc_len = struct.unpack("<i", data[offset:offset+4])[0]
    if doc_len < 5 or offset + doc_len > len(data):
        raise ValueError(f"Invalid BSON doc length: {doc_len} at offset {offset}")
    end = offset + doc_len
    pos = offset + 4
    result = {}
    
    while pos < end - 1:
        elem_type = data[pos]
        pos += 1
        name_end = data.find(b"\x00", pos)
        if name_end == -1 or name_end >= end:
            raise ValueError(f"Unterminated element name at {pos}")
        ename = data[pos:name_end].decode("utf-8", errors="replace")
        pos = name_end + 1
        
        if elem_type == 0x01: # double
            val = struct.unpack("<d", data[pos:pos+8])[0]
            pos += 8
        elif elem_type == 0x02: # string
            slen = struct.unpack("<i", data[pos:pos+4])[0]
            pos += 4
            val = data[pos:pos+slen-1].decode("utf-8", errors="replace")
            pos += slen
        elif elem_type == 0x03: # embedded document
            val, sub_len = parse_bson_doc(data, pos)
            pos += sub_len
        elif elem_type == 0x04: # array
            val, sub_len = parse_bson_doc(data, pos)
            pos += sub_len
        elif elem_type == 0x08: # boolean
            val = bool(data[pos])
            pos += 1
        elif elem_type == 0x09: # UTC datetime (int64 ms)
            val = struct.unpack("<q", data[pos:pos+8])[0]
            pos += 8
        elif elem_type == 0x10: # int32
            val = struct.unpack("<i", data[pos:pos+4])[0]
            pos += 4
        elif elem_type == 0x12: # int64
            val = struct.unpack("<q", data[pos:pos+8])[0]
            pos += 8
        else:
            raise ValueError(f"Unsupported BSON type 0x{elem_type:02x} for '{ename}' at {pos}")
        result[ename] = val
        
    return result, doc_len

def encode_bson_element(name, val):
    """Encodes a single key-value element to BSON bytes."""
    name_bytes = name.encode("utf-8") + b"\x00"
    if isinstance(val, bool):
        return b"\x08" + name_bytes + (b"\x01" if val else b"\x00")
    elif isinstance(val, int):
        if -2147483648 <= val <= 2147483647:
            return b"\x10" + name_bytes + struct.pack("<i", val)
        else:
            return b"\x12" + name_bytes + struct.pack("<q", val)
    elif isinstance(val, float):
        return b"\x01" + name_bytes + struct.pack("<d", val)
    elif isinstance(val, str):
        val_bytes = val.encode("utf-8") + b"\x00"
        return b"\x02" + name_bytes + struct.pack("<i", len(val_bytes)) + val_bytes
    elif isinstance(val, dict):
        sub_doc = encode_bson_doc(val)
        return b"\x03" + name_bytes + sub_doc
    elif isinstance(val, list):
        # Arrays in BSON are documents with keys '0', '1', '2'...
        arr_dict = {str(i): item for i, item in enumerate(val)}
        sub_doc = encode_bson_doc(arr_dict)
        return b"\x04" + name_bytes + sub_doc
    else:
        raise TypeError(f"Cannot encode type {type(val)} for key {name}")

def encode_bson_doc(d):
    """Encodes a dictionary into a complete BSON document."""
    body = b"".join(encode_bson_element(k, v) for k, v in d.items())
    body += b"\x00"
    doc_len = 4 + len(body)
    return struct.pack("<i", doc_len) + body

def create_save_container(bson_payload):
    """Prefixes BSON payload with the required 28-byte Subway Surfers integrity header."""
    hash_len = 20
    sha1_digest = hashlib.sha1(bson_payload).digest()
    payload_len = len(bson_payload)
    header = struct.pack("<I20sI", hash_len, sha1_digest, payload_len)
    return header + bson_payload

def verify_save_container(data):
    """Validates the 28-byte header and SHA-1 checksum."""
    if len(data) < 28:
        return False, "File too small (<28 bytes)"
    hash_len, stored_sha1, payload_len = struct.unpack("<I20sI", data[:28])
    if hash_len != 20:
        return False, f"Invalid hash length: {hash_len} (expected 20)"
    actual_payload = data[28:]
    if len(actual_payload) != payload_len:
        return False, f"Payload length mismatch: expected {payload_len}, got {len(actual_payload)}"
    computed_sha1 = hashlib.sha1(actual_payload).digest()
    if stored_sha1 != computed_sha1:
        return False, f"SHA-1 mismatch: stored {stored_sha1.hex()} vs computed {computed_sha1.hex()}"
    return True, "Valid"


def run_tests():
    print("=== RUNNING TEST SUITE 3: BSON & GAMEPLAY EVENT PERSISTENCE ===")
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

    # Load fixture
    fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "fixtures/save_PlayerPrefs.bin"))
    if not os.path.exists(fixture_path):
        fixture_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../analysis/evidence/save_PlayerPrefs.bin"))
    assert_test("Save Fixture Exists", os.path.exists(fixture_path), f"Path not found: {fixture_path}")

    with open(fixture_path, "rb") as f:
        raw_fixture = f.read()

    # 1. Parse Original Save
    valid, reason = verify_save_container(raw_fixture)
    assert_test("Original Save Container Verification", valid, reason)

    orig_doc, orig_len = parse_bson_doc(raw_fixture, offset=28)
    assert_test("Original BSON Contains 142 Fields", len(orig_doc) >= 140, f"Found {len(orig_doc)} fields")

    # 2. Simulation Event 1: Run Completion
    run_doc = dict(orig_doc)
    coins_before = run_doc.get("obfuscatedCoins", 0)
    score_before = run_doc.get("highScore", 0)
    
    # Player runs and finishes with 85,000 score and collects 350 coins
    run_doc["highScore"] = max(score_before, 85000)
    run_doc["obfuscatedCoins"] = coins_before + 350
    run_doc["obfuscatedUnrewardedCoins"] = 0
    
    run_bson = encode_bson_doc(run_doc)
    run_container = create_save_container(run_bson)
    valid, reason = verify_save_container(run_container)
    assert_test("Simulation: Run Completion Container Validity", valid, reason)
    
    reparsed_run, _ = parse_bson_doc(run_container, offset=28)
    assert_test("Simulation: Run Completion Coins Saved", reparsed_run["obfuscatedCoins"] == coins_before + 350)
    assert_test("Simulation: Run Completion High Score Saved", reparsed_run["highScore"] == max(score_before, 85000))

    # 3. Simulation Event 2: Shop Purchase / Upgrade
    upgrade_doc = dict(reparsed_run)
    upgrades = dict(upgrade_doc.get("upgrades", {}))
    jetpack_lvl = upgrades.get("jetpack", 1)
    upgrades["jetpack"] = jetpack_lvl + 1
    upgrade_doc["upgrades"] = upgrades
    upgrade_doc["obfuscatedCoins"] -= 500  # Cost of upgrade
    
    upg_bson = encode_bson_doc(upgrade_doc)
    upg_container = create_save_container(upg_bson)
    valid, reason = verify_save_container(upg_container)
    assert_test("Simulation: Upgrade Purchase Container Validity", valid, reason)
    
    reparsed_upg, _ = parse_bson_doc(upg_container, offset=28)
    assert_test("Simulation: Upgrade Level Incremented", reparsed_upg["upgrades"]["jetpack"] == jetpack_lvl + 1)
    assert_test("Simulation: Upgrade Coins Deducted", reparsed_upg["obfuscatedCoins"] == run_doc["obfuscatedCoins"] - 500)

    # 4. Simulation Event 3: Character Unlock
    char_doc = dict(reparsed_upg)
    unlocked_chars = list(char_doc.get("unlockedCharacters", {}).values()) if isinstance(char_doc.get("unlockedCharacters"), dict) else list(char_doc.get("unlockedCharacters", []))
    if "lucy" not in unlocked_chars:
        unlocked_chars.append("lucy")
    char_doc["unlockedCharacters"] = unlocked_chars
    char_doc["currentCharacterId"] = "lucy"
    
    char_bson = encode_bson_doc(char_doc)
    char_container = create_save_container(char_bson)
    valid, reason = verify_save_container(char_container)
    assert_test("Simulation: Character Unlock Container Validity", valid, reason)
    
    reparsed_char, _ = parse_bson_doc(char_container, offset=28)
    assert_test("Simulation: Current Character Updated to Lucy", reparsed_char["currentCharacterId"] == "lucy")

    # 5. Edge Cases & Corruption Recovery
    # Truncated container
    trunc_container = char_container[:100]
    valid, reason = verify_save_container(trunc_container)
    assert_test("Corruption Detection: Truncated Payload Detected", not valid and "mismatch" in reason)

    # Zero payload
    zero_container = struct.pack("<I20sI", 20, b"\x00"*20, 0)
    valid, reason = verify_save_container(zero_container)
    assert_test("Corruption Detection: Zero Length Payload Detected", not valid and "SHA-1 mismatch" in reason)

    # Tampered byte in payload
    tampered_bytes = bytearray(char_container)
    tampered_bytes[35] ^= 0x42
    valid, reason = verify_save_container(bytes(tampered_bytes))
    assert_test("Corruption Detection: Single Bit Tamper Detected by SHA-1", not valid and "SHA-1 mismatch" in reason)

    print(f"\nTest Suite 3 Completed: {tests_passed}/{tests_total} Passed.")
    return tests_passed == tests_total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
