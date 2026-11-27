#!/usr/bin/env python3
"""Generate clean synthetic BSON & UnityPrf test fixtures (no copyrighted game data)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "persistence"))

from bson_adapter import (
    BSON_ARRAY,
    BSON_BINARY,
    BSON_BOOL,
    BSON_DOCUMENT,
    BSON_DOUBLE,
    BSON_INT32,
    BSON_INT64,
    BSON_NULL,
    BSON_STRING,
    BSON_UTC_DATETIME,
    BsonValue,
    wrap_save,
)


def generate_fixtures() -> None:
    fixtures_dir = Path(__file__).resolve().parent
    fixtures_dir.mkdir(parents=True, exist_ok=True)

    source_cloud = {
        "obfuscatedCoins": BsonValue(BSON_INT32, 2500),
        "obfuscatedKeys": BsonValue(BSON_INT32, 18),
        "highScore": BsonValue(BSON_INT32, 120000),
        "upgrades": BsonValue(BSON_DOCUMENT, {
            "jetpack": BsonValue(BSON_INT32, 4),
            "supersneakers": BsonValue(BSON_INT32, 2),
            "coinmagnet": BsonValue(BSON_INT32, 3),
            "doubleMultiplier": BsonValue(BSON_INT32, 1),
        }),
        "powerups": BsonValue(BSON_DOCUMENT, {
            "hoverboard": BsonValue(BSON_INT32, 12),
            "headstart2000": BsonValue(BSON_INT32, 2),
            "scorebooster": BsonValue(BSON_INT32, 1),
        }),
        "unlockedCharacters": BsonValue(BSON_ARRAY, {
            "0": BsonValue(BSON_STRING, "slick"),
            "1": BsonValue(BSON_STRING, "unverified_build_exclusive_char"),
        }),
        "unlockedBoards": BsonValue(BSON_ARRAY, {
            "0": BsonValue(BSON_STRING, "normal"),
            "1": BsonValue(BSON_STRING, "unverified_board_xyz"),
        }),
        "analyticsSamplingKey": BsonValue(BSON_DOUBLE, 0.42),
        "firstInstallDate": BsonValue(BSON_UTC_DATETIME, 1795759000000),
        "customUnknownField": BsonValue(BSON_STRING, "preserve-me-source"),
    }

    target_cloud = {
        "obfuscatedCoins": BsonValue(BSON_INT32, 500),
        "obfuscatedKeys": BsonValue(BSON_INT32, 25),  # higher than source -> triggers conflict resolution keep_higher_target
        "highScore": BsonValue(BSON_INT32, 40000),
        "upgrades": BsonValue(BSON_DOCUMENT, {
            "jetpack": BsonValue(BSON_INT32, 1),
            "supersneakers": BsonValue(BSON_INT32, 5),
            "coinmagnet": BsonValue(BSON_INT32, 1),
            "doubleMultiplier": BsonValue(BSON_INT32, 1),
        }),
        "powerups": BsonValue(BSON_DOCUMENT, {
            "hoverboard": BsonValue(BSON_INT32, 3),
            "headstart2000": BsonValue(BSON_INT32, 0),
            "scorebooster": BsonValue(BSON_INT32, 0),
        }),
        "unlockedCharacters": BsonValue(BSON_ARRAY, {
            "0": BsonValue(BSON_STRING, "slick"),
        }),
        "unlockedBoards": BsonValue(BSON_ARRAY, {}),
        "targetOnlyUnknownInt64": BsonValue(BSON_INT64, 9876543210123),
        "targetOnlyUnknownBlob": BsonValue(BSON_BINARY, b"\xde\xad\xbe\xef", subtype=0),
        "targetOnlyUnknownNull": BsonValue(BSON_NULL, None),
        "soundEffectsEnabled": BsonValue(BSON_BOOL, True),
    }

    local_meta = {
        "hasMigratedPlayerInfo": BsonValue(BSON_BOOL, False),
        "migratedPlayerPrefsVersion": BsonValue(BSON_INT32, 1),
        "cloudSaveEnabled": BsonValue(BSON_BOOL, False),
        "lastTimeAppWasUpdatedOrInstalled": BsonValue(BSON_UTC_DATETIME, 1795759200000),
    }

    src_bytes, _ = wrap_save(source_cloud)
    tgt_bytes, _ = wrap_save(target_cloud)
    loc_bytes, _ = wrap_save(local_meta)

    (fixtures_dir / "synthetic_source_save_cloud.bin").write_bytes(src_bytes)
    (fixtures_dir / "synthetic_target_save_cloud.bin").write_bytes(tgt_bytes)
    (fixtures_dir / "synthetic_save_local.bin").write_bytes(loc_bytes)
    (fixtures_dir / "synthetic_playerprefs.bin").write_bytes(
        b"UnityPrf\x00\x00\x01\x00\x00\x00\x10\x00\x19CloudSaveLastUsedKilooTag\x00"
    )
    print(f"Generated synthetic fixtures in {fixtures_dir}")


if __name__ == "__main__":
    generate_fixtures()
