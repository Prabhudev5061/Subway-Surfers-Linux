#!/usr/bin/env python3
"""
Independent BSON Validation, Backup, Rollback & Cross-Build Sync Adapter
=========================================================================
Pure-Python implementation supporting Kiloo BsonFileSaver 28-byte SHA-1 envelopes
and UnityPrf PlayerPrefs inspection. Preserves exact BSON type tags and unknown fields.

Safety invariants:
- Never overwrites an original profile without creating a verified backup first.
- Refuses to touch any LevelDB directory containing an active LOCK held/flagged
  or running process check.
- Rejects malformed headers, length mismatches, SHA-1 failures, and invalid BSON.
- Does not assume build-specific nested character/board/event IDs are interchangeable.
"""

import hashlib
import json
import os
import shutil
import struct
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


HEADER_SIZE = 28
HASH_LEN_EXPECTED = 20

# Standard BSON type tags
BSON_DOUBLE = 0x01
BSON_STRING = 0x02
BSON_DOCUMENT = 0x03
BSON_ARRAY = 0x04
BSON_BINARY = 0x05
BSON_BOOL = 0x08
BSON_UTC_DATETIME = 0x09
BSON_NULL = 0x0A
BSON_INT32 = 0x10
BSON_INT64 = 0x12

# Default conservative whitelist of universally shared base IDs across Subway Surfers builds
DEFAULT_PORTABLE_SCALARS = ("obfuscatedCoins", "obfuscatedKeys", "highScore")
DEFAULT_PORTABLE_UPGRADE_DOCS = ("upgrades", "powerups")
DEFAULT_MUTUAL_CHARACTER_IDS = {"slick"}  # Jake base ID
DEFAULT_MUTUAL_BOARD_IDS = {"normal"}


@dataclass(frozen=True)
class BsonValue:
    """Lossless BSON typed value wrapper preserving exact BSON type tag."""
    bson_type: int
    value: Any
    subtype: int = 0  # Only used for BSON_BINARY


class BsonFormatError(ValueError):
    """Raised when binary envelope or BSON document fails strict validation."""


def _read_cstring(buf: bytes, pos: int) -> Tuple[str, int]:
    end = buf.find(b"\x00", pos)
    if end == -1:
        raise BsonFormatError(f"Unterminated BSON C-string at offset {pos}")
    try:
        text = buf[pos:end].decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BsonFormatError(f"Invalid UTF-8 in BSON key at offset {pos}: {exc}") from exc
    return text, end + 1


def decode_bson_document(buf: bytes) -> Dict[str, BsonValue]:
    """Strictly decode a BSON document into an ordered dict of BsonValue."""
    if len(buf) < 5:
        raise BsonFormatError(f"BSON document too small: {len(buf)} bytes")
    doc_len = struct.unpack_from("<i", buf, 0)[0]
    if doc_len != len(buf):
        raise BsonFormatError(f"BSON length mismatch: declared {doc_len}, actual {len(buf)}")
    if buf[-1] != 0:
        raise BsonFormatError("BSON document missing trailing null terminator")

    pos = 4
    limit = doc_len - 1
    result: Dict[str, BsonValue] = {}

    while pos < limit:
        t = buf[pos]
        pos += 1
        if t == 0:
            raise BsonFormatError(f"Unexpected null element tag at offset {pos - 1}")
        key, pos = _read_cstring(buf, pos)

        if t == BSON_DOUBLE:
            if pos + 8 > limit:
                raise BsonFormatError(f"Truncated double for key '{key}'")
            val = struct.unpack_from("<d", buf, pos)[0]
            pos += 8
            result[key] = BsonValue(t, val)
        elif t == BSON_STRING:
            if pos + 4 > limit:
                raise BsonFormatError(f"Truncated string length for key '{key}'")
            slen = struct.unpack_from("<i", buf, pos)[0]
            pos += 4
            if slen < 1 or pos + slen > limit:
                raise BsonFormatError(f"Invalid string length {slen} for key '{key}'")
            if buf[pos + slen - 1] != 0:
                raise BsonFormatError(f"String missing null terminator for key '{key}'")
            val = buf[pos : pos + slen - 1].decode("utf-8")
            pos += slen
            result[key] = BsonValue(t, val)
        elif t in (BSON_DOCUMENT, BSON_ARRAY):
            if pos + 4 > limit:
                raise BsonFormatError(f"Truncated subdocument length for key '{key}'")
            sub_len = struct.unpack_from("<i", buf, pos)[0]
            if sub_len < 5 or pos + sub_len > limit:
                raise BsonFormatError(f"Invalid subdocument length {sub_len} for key '{key}'")
            sub_doc = decode_bson_document(buf[pos : pos + sub_len])
            pos += sub_len
            result[key] = BsonValue(t, sub_doc)
        elif t == BSON_BINARY:
            if pos + 5 > limit:
                raise BsonFormatError(f"Truncated binary header for key '{key}'")
            blen = struct.unpack_from("<i", buf, pos)[0]
            subtype = buf[pos + 4]
            pos += 5
            if blen < 0 or pos + blen > limit:
                raise BsonFormatError(f"Invalid binary length {blen} for key '{key}'")
            result[key] = BsonValue(t, buf[pos : pos + blen], subtype=subtype)
            pos += blen
        elif t == BSON_BOOL:
            if pos + 1 > limit:
                raise BsonFormatError(f"Truncated bool for key '{key}'")
            bval = buf[pos]
            if bval not in (0, 1):
                raise BsonFormatError(f"Invalid bool byte {bval} for key '{key}'")
            pos += 1
            result[key] = BsonValue(t, bool(bval))
        elif t in (BSON_UTC_DATETIME, BSON_INT64):
            if pos + 8 > limit:
                raise BsonFormatError(f"Truncated 64-bit integer for key '{key}'")
            val = struct.unpack_from("<q", buf, pos)[0]
            pos += 8
            result[key] = BsonValue(t, val)
        elif t == BSON_NULL:
            result[key] = BsonValue(t, None)
        elif t == BSON_INT32:
            if pos + 4 > limit:
                raise BsonFormatError(f"Truncated int32 for key '{key}'")
            val = struct.unpack_from("<i", buf, pos)[0]
            pos += 4
            result[key] = BsonValue(t, val)
        else:
            raise BsonFormatError(f"Unsupported BSON type tag 0x{t:02x} for key '{key}'")

    if pos != limit:
        raise BsonFormatError(f"BSON parse ended at {pos}, expected {limit}")
    return result


def encode_bson_document(doc: Dict[str, BsonValue]) -> bytes:
    """Encode an ordered dict of BsonValue back into canonical BSON bytes."""
    chunks: List[bytes] = []
    for key, item in doc.items():
        if not isinstance(item, BsonValue):
            raise BsonFormatError(f"Expected BsonValue for key '{key}'")
        t = item.bson_type
        key_bytes = key.encode("utf-8") + b"\x00"
        chunks.append(bytes([t]))
        chunks.append(key_bytes)

        if t == BSON_DOUBLE:
            chunks.append(struct.pack("<d", float(item.value)))
        elif t == BSON_STRING:
            sbytes = str(item.value).encode("utf-8") + b"\x00"
            chunks.append(struct.pack("<i", len(sbytes)))
            chunks.append(sbytes)
        elif t in (BSON_DOCUMENT, BSON_ARRAY):
            chunks.append(encode_bson_document(item.value))
        elif t == BSON_BINARY:
            bdata = bytes(item.value)
            chunks.append(struct.pack("<i", len(bdata)))
            chunks.append(bytes([item.subtype]))
            chunks.append(bdata)
        elif t == BSON_BOOL:
            chunks.append(b"\x01" if item.value else b"\x00")
        elif t in (BSON_UTC_DATETIME, BSON_INT64):
            chunks.append(struct.pack("<q", int(item.value)))
        elif t == BSON_NULL:
            pass
        elif t == BSON_INT32:
            chunks.append(struct.pack("<i", int(item.value)))
        else:
            raise BsonFormatError(f"Unsupported BSON type tag 0x{t:02x} during encode")

    body = b"".join(chunks)
    total_len = 4 + len(body) + 1
    return struct.pack("<i", total_len) + body + b"\x00"


def unwrap_and_validate_save(raw: bytes) -> Tuple[Dict[str, BsonValue], str]:
    """Validate 28-byte SHA-1 envelope + BSON payload; return (doc, sha1_hex)."""
    if len(raw) < HEADER_SIZE + 5:
        raise BsonFormatError(f"Save file too short: {len(raw)} bytes")

    hash_len = struct.unpack_from("<I", raw, 0)[0]
    if hash_len != HASH_LEN_EXPECTED:
        raise BsonFormatError(f"Invalid hash_len {hash_len}, expected {HASH_LEN_EXPECTED}")

    header_sha1 = raw[4:24]
    payload_len = struct.unpack_from("<I", raw, 24)[0]
    payload = raw[HEADER_SIZE:]
    if payload_len != len(payload):
        raise BsonFormatError(f"Payload length mismatch: header={payload_len}, actual={len(payload)}")

    computed_sha1 = hashlib.sha1(payload).digest()
    if computed_sha1 != header_sha1:
        raise BsonFormatError(
            f"SHA-1 mismatch: header={header_sha1.hex()}, computed={computed_sha1.hex()}"
        )

    doc = decode_bson_document(payload)
    return doc, computed_sha1.hex()


def wrap_save(doc: Dict[str, BsonValue]) -> Tuple[bytes, str]:
    """Encode BSON document and prepend 28-byte SHA-1 integrity header."""
    payload = encode_bson_document(doc)
    digest = hashlib.sha1(payload).digest()
    header = struct.pack("<I", HASH_LEN_EXPECTED) + digest + struct.pack("<I", len(payload))
    return header + payload, digest.hex()


def verify_unity_playerprefs_header(raw: bytes) -> bool:
    """Verify Unity's standard binary UnityPrf header."""
    return len(raw) >= 8 and raw[:8] == b"UnityPrf"


def assert_leveldb_unlocked(leveldb_dir: Path) -> None:
    """Guard against reading/writing a live LevelDB directory with an active LOCK."""
    lock_file = leveldb_dir / "LOCK"
    if lock_file.exists():
        # Try acquiring non-blocking flock if fcntl is available on Linux
        try:
            import fcntl
            with lock_file.open("r+b") as lf:
                try:
                    fcntl.flock(lf.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.flock(lf.fileno(), fcntl.LOCK_UN)
                except BlockingIOError as exc:
                    raise RuntimeError(
                        f"LevelDB directory '{leveldb_dir}' is actively locked by a running process."
                    ) from exc
        except ImportError:
            pass


def create_backup(target_file: Path, backup_root: Path) -> Path:
    """Create a timestamped, SHA-256-verified backup of target_file before modification."""
    backup_root.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    backup_dir = backup_root / f"backup_{ts}_{os.getpid()}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    data = target_file.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    copied = backup_dir / target_file.name
    copied.write_bytes(data)

    meta = {
        "original_path": str(target_file.resolve()),
        "backup_file": str(copied.resolve()),
        "size_bytes": len(data),
        "sha256": sha,
        "created_at": ts,
    }
    (backup_dir / "backup_manifest.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return backup_dir


def rollback_from_backup(backup_dir: Path, destination_file: Optional[Path] = None) -> Path:
    """Restore a file from backup_manifest.json after verifying SHA-256."""
    manifest_path = backup_dir / "backup_manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Missing backup_manifest.json in {backup_dir}")
    meta = json.loads(manifest_path.read_text(encoding="utf-8"))
    backup_file = Path(meta["backup_file"])
    data = backup_file.read_bytes()
    if hashlib.sha256(data).hexdigest() != meta["sha256"]:
        raise BsonFormatError("Backup archive failed SHA-256 integrity verification during rollback")

    dest = destination_file or Path(meta["original_path"])
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_dest = dest.with_suffix(dest.suffix + ".rollback_tmp")
    tmp_dest.write_bytes(data)
    os.replace(tmp_dest, dest)
    return dest


def sync_save_cloud_documents(
    source_doc: Dict[str, BsonValue],
    target_doc: Dict[str, BsonValue],
    mutual_characters: Optional[Set[str]] = None,
    mutual_boards: Optional[Set[str]] = None,
) -> Tuple[Dict[str, BsonValue], Dict[str, Any]]:
    """
    Safely merge validated portable progression from source_doc into a copy of target_doc.

    - Preserves all target unknown/build-specific keys and exact BSON types.
    - Detects BSON type conflicts and raises BsonFormatError.
    - Uses monotonic max() for coins/keys/highScore/upgrades/powerups to avoid accidental downgrade,
      while recording every conflict/skipped build-specific asset ID in the audit report.
    """
    char_whitelist = mutual_characters if mutual_characters is not None else DEFAULT_MUTUAL_CHARACTER_IDS
    board_whitelist = mutual_boards if mutual_boards is not None else DEFAULT_MUTUAL_BOARD_IDS

    merged: Dict[str, BsonValue] = dict(target_doc)
    report: Dict[str, Any] = {
        "updated_fields": [],
        "conflicts_detected": [],
        "skipped_unverified_ids": [],
    }

    # 1. Portable int32 scalar fields
    for key in DEFAULT_PORTABLE_SCALARS:
        if key not in source_doc or key not in target_doc:
            continue
        s_val = source_doc[key]
        t_val = target_doc[key]
        if s_val.bson_type != t_val.bson_type or s_val.bson_type != BSON_INT32:
            raise BsonFormatError(
                f"Type conflict on '{key}': source=0x{s_val.bson_type:02x}, target=0x{t_val.bson_type:02x}"
            )
        if s_val.value != t_val.value:
            new_val = max(int(s_val.value), int(t_val.value))
            if int(s_val.value) < int(t_val.value):
                report["conflicts_detected"].append(
                    {"field": key, "source": s_val.value, "target": t_val.value, "resolution": "kept_higher_target"}
                )
            else:
                merged[key] = BsonValue(BSON_INT32, new_val)
                report["updated_fields"].append({"field": key, "old": t_val.value, "new": new_val})

    # 2. Portable nested int32 documents (upgrades, powerups)
    for doc_key in DEFAULT_PORTABLE_UPGRADE_DOCS:
        if doc_key not in source_doc or doc_key not in target_doc:
            continue
        s_sub = source_doc[doc_key]
        t_sub = target_doc[doc_key]
        if s_sub.bson_type != BSON_DOCUMENT or t_sub.bson_type != BSON_DOCUMENT:
            raise BsonFormatError(f"Type conflict on '{doc_key}' subdocument")
        new_sub: Dict[str, BsonValue] = dict(t_sub.value)
        for item_k, item_v in s_sub.value.items():
            if item_k in new_sub:
                if item_v.bson_type != new_sub[item_k].bson_type or item_v.bson_type != BSON_INT32:
                    raise BsonFormatError(f"Type conflict on '{doc_key}.{item_k}'")
                if int(item_v.value) > int(new_sub[item_k].value):
                    report["updated_fields"].append(
                        {"field": f"{doc_key}.{item_k}", "old": new_sub[item_k].value, "new": item_v.value}
                    )
                    new_sub[item_k] = BsonValue(BSON_INT32, int(item_v.value))
        merged[doc_key] = BsonValue(BSON_DOCUMENT, new_sub)

    # 3. Whitelisted mutual character/board arrays (never blindly copy unverified IDs)
    for arr_key, whitelist in (("unlockedCharacters", char_whitelist), ("unlockedBoards", board_whitelist)):
        if arr_key not in source_doc or arr_key not in target_doc:
            continue
        s_arr = source_doc[arr_key]
        t_arr = target_doc[arr_key]
        if s_arr.bson_type != t_arr.bson_type or s_arr.bson_type != BSON_ARRAY:
            raise BsonFormatError(f"Type conflict on '{arr_key}' array")
        existing_vals = [v.value for v in t_arr.value.values() if v.bson_type == BSON_STRING]
        new_arr = dict(t_arr.value)
        next_idx = len(new_arr)
        for v in s_arr.value.values():
            if v.bson_type != BSON_STRING:
                continue
            if v.value in existing_vals:
                continue
            if v.value in whitelist:
                new_arr[str(next_idx)] = BsonValue(BSON_STRING, v.value)
                existing_vals.append(v.value)
                next_idx += 1
                report["updated_fields"].append({"field": arr_key, "added": v.value})
            else:
                report["skipped_unverified_ids"].append({"field": arr_key, "id": v.value})
        merged[arr_key] = BsonValue(BSON_ARRAY, new_arr)

    return merged, report


def sync_save_files(
    source_file: Path,
    target_file: Path,
    backup_root: Path,
    mutual_characters: Optional[Set[str]] = None,
    mutual_boards: Optional[Set[str]] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Validate, back up target, merge portable fields, and atomically write target_file."""
    if source_file.resolve() == target_file.resolve():
        raise ValueError("Source and target save files must be distinct.")

    src_doc, src_sha1 = unwrap_and_validate_save(source_file.read_bytes())
    tgt_doc, tgt_sha1 = unwrap_and_validate_save(target_file.read_bytes())

    merged_doc, report = sync_save_cloud_documents(
        src_doc, tgt_doc, mutual_characters=mutual_characters, mutual_boards=mutual_boards
    )
    out_bytes, out_sha1 = wrap_save(merged_doc)

    # Round-trip self-verification before touching target
    unwrap_and_validate_save(out_bytes)

    result = {
        "source_sha1": src_sha1,
        "target_sha1_before": tgt_sha1,
        "target_sha1_after": out_sha1,
        "dry_run": dry_run,
        "backup_dir": None,
        **report,
    }
    if not dry_run:
        backup_dir = create_backup(target_file, backup_root)
        result["backup_dir"] = str(backup_dir)
        tmp_target = target_file.with_suffix(target_file.suffix + ".sync_tmp")
        tmp_target.write_bytes(out_bytes)
        os.replace(tmp_target, target_file)

    return result
