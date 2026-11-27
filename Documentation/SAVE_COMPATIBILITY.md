# Save Compatibility — `SubwaySurfers-Linux 1.0`

## 1. Summary

All three packaged builds (**San Francisco**, **Beijing**, and **Zurich**) are based on *Subway Surfers* **1.94.0** and share an identical binary save format and schema.

## 2. Format & Schema Verification (`Source/Shared/bson_adapter.py`)

Decoded live save files booted across all three AppImages:

| File | Container Format | Top-Level Keys | Missing / Extra Keys Across Versions | Type Mismatches |
|---|---|---|---|---|
| `Save/cloud` | Kiloo 28-byte SHA-1 header + BSON | `142` (SF, Beijing, Zurich) | `0` | `0` |
| `Save/local` | Kiloo 28-byte SHA-1 header + BSON | `30` (SF, Beijing, Zurich) | `0` | `0` |
| `PlayerPrefs` | Unity `UnityPrf` binary container | Identical header (`353` B active) | N/A | `0` |

Key shared progression fields verified across all three builds:
- `obfuscatedCoins` (`BSON_INT32`)
- `obfuscatedKeys` (`BSON_INT32`)
- `highScore` (`BSON_INT32`)
- `completedRunCount` (`BSON_INT32`)
- `currentCharacterId` / `currentBoardId` (`BSON_STRING`)
- `unlockedCharacters` / `unlockedBoards` (`BSON_ARRAY`)
- `upgrades` / `powerups` (`BSON_DOCUMENT`)

## 3. Live Cross-Version Verification

All six directed transitions (`SF -> Beijing`, `Beijing -> SF`, `SF -> Zurich`, `Zurich -> SF`, `Beijing -> Zurich`, `Zurich -> Beijing`) are tested automatically in [`Tests/integration/test_cross_version_and_ui.js`](../Tests/integration/test_cross_version_and_ui.js), confirming that every build loads and updates the exact same physical files in `~/.local/share/SubwaySurfers-Linux/Save/`.

Unknown or build-specific BSON fields are preserved losslessly by `bson_adapter.py` (verified via automated round-trip tests in `Tests/shared-storage/test_shared_storage.js`).
