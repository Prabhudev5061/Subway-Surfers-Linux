/**
 * Unified Shared Save Storage Manager for SubwaySurfers-Linux
 *
 * Canonical directory:
 *   $XDG_DATA_HOME/SubwaySurfers-Linux/Save/
 *   (defaults to ~/.local/share/SubwaySurfers-Linux/Save/)
 *
 * Physical layout:
 *   Save/
 *     ├── cloud
 *     ├── cloud_old
 *     ├── local
 *     ├── local_old
 *     ├── PlayerPrefs
 *     └── recovery/
 *         ├── cloud.recovery
 *         ├── local.recovery
 *         └── PlayerPrefs.recovery
 *
 * Guarantees:
 * - Strict path allowlist & traversal protection
 * - 28-byte Kiloo SHA-1 header validation on all BSON save files
 * - UnityPrf magic validation on PlayerPrefs
 * - Atomic POSIX write-temp -> fsync -> rename updates
 * - Rolling recovery backups before overwriting valid saves
 * - Automatic startup crash recovery from _old or recovery/ backups
 * - Corrupted backups are rejected safely
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyHeaderAndSha1, verifyPlayerPrefsHeader } = require('./sha1_header');

// Logical keys used by HostIDBFS <-> physical relative path under Save/
const LOGICAL_TO_DISK = {
    'Save/cloud': 'cloud',
    'Save/cloud_old': 'cloud_old',
    'Save/local': 'local',
    'Save/local_old': 'local_old',
    'PlayerPrefs': 'PlayerPrefs'
};

const BSON_FILES = new Set(['cloud', 'cloud_old', 'local', 'local_old']);
const RECOVERY_TARGETS = [
    { primary: 'cloud', backups: ['cloud_old', 'recovery/cloud.recovery'], validator: 'bson' },
    { primary: 'local', backups: ['local_old', 'recovery/local.recovery'], validator: 'bson' },
    { primary: 'PlayerPrefs', backups: ['recovery/PlayerPrefs.recovery'], validator: 'playerprefs' }
];

function getCanonicalRootDir() {
    if (process.env.SUBWAY_SHARED_ROOT_DIR) {
        return path.resolve(process.env.SUBWAY_SHARED_ROOT_DIR);
    }
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    return path.join(dataHome, 'SubwaySurfers-Linux');
}

function getCanonicalSaveDir() {
    if (process.env.SUBWAY_SHARED_SAVE_DIR) {
        return path.resolve(process.env.SUBWAY_SHARED_SAVE_DIR);
    }
    return path.join(getCanonicalRootDir(), 'Save');
}

function getRecoveryDir(saveDir) {
    return path.join(saveDir, 'recovery');
}

function resolveSafeSavePath(saveDir, relPath) {
    if (typeof relPath !== 'string' || !relPath || relPath.includes('\0')) {
        throw new Error(`Invalid relative save path: ${String(relPath)}`);
    }
    if (path.isAbsolute(relPath)) {
        throw new Error(`Absolute paths are not allowed: ${relPath}`);
    }
    const normalized = relPath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (segments.some((s) => !s || s === '.' || s === '..')) {
        throw new Error(`Path traversal rejected: ${relPath}`);
    }

    const mapped = LOGICAL_TO_DISK[normalized];
    let diskRel = mapped;
    if (!diskRel) {
        // Allow canonical disk names directly or Unity/Analytics/config
        if (BSON_FILES.has(normalized) || normalized === 'PlayerPrefs') {
            diskRel = normalized;
        } else if (normalized.startsWith('Unity/') && /^Unity\/[A-Za-z0-9._/-]+$/.test(normalized)) {
            diskRel = normalized;
        } else {
            throw new Error(`Disallowed save path: ${relPath}`);
        }
    }

    const baseReal = path.resolve(saveDir);
    const resolved = path.resolve(baseReal, diskRel);
    if (!resolved.startsWith(baseReal + path.sep)) {
        throw new Error(`Resolved path escapes Save directory: ${resolved}`);
    }
    return { diskRel, resolved };
}

function validateSaveBytes(diskRel, bytes) {
    if (!bytes || !(bytes instanceof Uint8Array || Buffer.isBuffer(bytes))) {
        return { valid: false, reason: 'Invalid buffer' };
    }
    if (BSON_FILES.has(diskRel)) {
        return verifyHeaderAndSha1(bytes);
    }
    if (diskRel === 'PlayerPrefs') {
        return verifyPlayerPrefsHeader(bytes);
    }
    // Optional Unity/Analytics/config may be 0 bytes
    return { valid: true, reason: 'OK' };
}

function atomicWriteFileSync(targetPath, dataBuffer) {
    const dir = path.dirname(targetPath);
    fs.mkdirSync(dir, { recursive: true });
    const base = path.basename(targetPath);
    const tmpPath = path.join(dir, `.${base}.tmp.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`);
    const fd = fs.openSync(tmpPath, 'w', 0o600);
    try {
        fs.writeFileSync(fd, dataBuffer);
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, targetPath);
}

function cleanupStaleTempFiles(saveDir) {
    const removed = [];
    for (const dir of [saveDir, getRecoveryDir(saveDir)]) {
        if (!fs.existsSync(dir)) continue;
        for (const entry of fs.readdirSync(dir)) {
            if (entry.startsWith('.') && entry.includes('.tmp.')) {
                const full = path.join(dir, entry);
                try {
                    const st = fs.lstatSync(full);
                    if (st.isFile()) {
                        fs.unlinkSync(full);
                        removed.push(full);
                    }
                } catch (e) {}
            }
        }
    }
    return removed;
}

function ensureSaveDirectories(saveDir) {
    fs.mkdirSync(saveDir, { recursive: true });
    fs.mkdirSync(getRecoveryDir(saveDir), { recursive: true });
}

function isValidForTarget(diskRel, bytes) {
    return validateSaveBytes(diskRel, bytes).valid;
}

function recoverCorruptedFiles(saveDir) {
    ensureSaveDirectories(saveDir);
    const recovered = [];
    const rejectedBackups = [];

    for (const spec of RECOVERY_TARGETS) {
        const primaryPath = path.join(saveDir, spec.primary);
        let primaryOk = false;
        if (fs.existsSync(primaryPath)) {
            try {
                const pBytes = fs.readFileSync(primaryPath);
                primaryOk = isValidForTarget(spec.primary, pBytes);
            } catch (e) {
                primaryOk = false;
            }
        }
        if (primaryOk) continue;

        // Primary missing or corrupted: evaluate candidate backups by newest mtime
        const candidates = [];
        for (const relBak of spec.backups) {
            const bakPath = path.join(saveDir, relBak);
            if (!fs.existsSync(bakPath)) continue;
            try {
                const st = fs.statSync(bakPath);
                if (!st.isFile()) continue;
                const bBytes = fs.readFileSync(bakPath);
                const check = validateSaveBytes(spec.primary, bBytes);
                if (check.valid) {
                    candidates.push({ relBak, bakPath, bytes: bBytes, mtimeMs: st.mtimeMs });
                } else {
                    rejectedBackups.push({ target: spec.primary, backup: relBak, reason: check.reason });
                }
            } catch (e) {
                rejectedBackups.push({ target: spec.primary, backup: relBak, reason: e.message });
            }
        }

        if (candidates.length > 0) {
            candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
            const best = candidates[0];
            if (fs.existsSync(primaryPath)) {
                try {
                    const badBytes = fs.readFileSync(primaryPath);
                    atomicWriteFileSync(
                        path.join(getRecoveryDir(saveDir), `${spec.primary}.corrupt.${Date.now()}`),
                        badBytes
                    );
                } catch (e) {}
            }
            atomicWriteFileSync(primaryPath, best.bytes);
            recovered.push({
                target: spec.primary,
                restoredFrom: best.relBak,
                size: best.bytes.length
            });
        }
    }

    return { recovered, rejectedBackups };
}

function loadAllSaves(saveDir = getCanonicalSaveDir()) {
    ensureSaveDirectories(saveDir);
    const cleanedTemp = cleanupStaleTempFiles(saveDir);
    const recoveryResult = recoverCorruptedFiles(saveDir);

    const files = {};
    const mtimes = {};
    const sha256s = {};

    const diskToLogical = {
        'cloud': 'Save/cloud',
        'cloud_old': 'Save/cloud_old',
        'local': 'Save/local',
        'local_old': 'Save/local_old',
        'PlayerPrefs': 'PlayerPrefs'
    };

    for (const [diskRel, logical] of Object.entries(diskToLogical)) {
        const fullPath = path.join(saveDir, diskRel);
        if (!fs.existsSync(fullPath)) continue;
        try {
            const st = fs.statSync(fullPath);
            if (!st.isFile()) continue;
            const buf = fs.readFileSync(fullPath);
            const check = validateSaveBytes(diskRel, buf);
            if (!check.valid) {
                // Never feed corrupted data into Unity
                continue;
            }
            files[logical] = buf;
            mtimes[logical] = Math.round(st.mtimeMs);
            sha256s[logical] = crypto.createHash('sha256').update(buf).digest('hex');
        } catch (e) {}
    }

    // Also load Unity/Analytics/config if present
    const unityDir = path.join(saveDir, 'Unity');
    if (fs.existsSync(unityDir)) {
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.isFile()) {
                    const rel = path.relative(saveDir, full).replace(/\\/g, '/');
                    const st = fs.statSync(full);
                    const buf = fs.readFileSync(full);
                    files[rel] = buf;
                    mtimes[rel] = Math.round(st.mtimeMs);
                }
            }
        };
        walk(unityDir);
    }

    return {
        saveDir,
        files,
        mtimes,
        sha256s,
        cleanedTemp,
        recovered: recoveryResult.recovered,
        rejectedBackups: recoveryResult.rejectedBackups
    };
}

function commitSaves(entries, saveDir = getCanonicalSaveDir()) {
    ensureSaveDirectories(saveDir);
    if (!Array.isArray(entries)) {
        throw new Error('commitSaves requires an array of { path, data } entries');
    }

    const committed = [];
    const skippedUnchanged = [];
    const rejected = [];

    for (const entry of entries) {
        if (!entry || typeof entry.path !== 'string') continue;
        const { diskRel, resolved } = resolveSafeSavePath(saveDir, entry.path);
        const buf = Buffer.isBuffer(entry.data)
            ? entry.data
            : Buffer.from(entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data || []));

        const validation = validateSaveBytes(diskRel, buf);
        if (!validation.valid) {
            rejected.push({ path: entry.path, diskRel, reason: validation.reason });
            continue;
        }

        const newHash = crypto.createHash('sha256').update(buf).digest('hex');
        let existingValid = false;
        let existingBuf = null;
        if (fs.existsSync(resolved)) {
            try {
                existingBuf = fs.readFileSync(resolved);
                const existingHash = crypto.createHash('sha256').update(existingBuf).digest('hex');
                if (existingHash === newHash) {
                    skippedUnchanged.push(diskRel);
                    continue;
                }
                existingValid = validateSaveBytes(diskRel, existingBuf).valid;
            } catch (e) {}
        }

        // Preserve rolling recovery backup before replacing primary files
        if (existingValid && (diskRel === 'cloud' || diskRel === 'local' || diskRel === 'PlayerPrefs')) {
            const recPath = path.join(getRecoveryDir(saveDir), `${diskRel}.recovery`);
            atomicWriteFileSync(recPath, existingBuf);
        }

        atomicWriteFileSync(resolved, buf);
        const st = fs.statSync(resolved);
        committed.push({
            path: entry.path,
            diskRel,
            size: buf.length,
            sha256: newHash,
            mtimeMs: Math.round(st.mtimeMs)
        });
    }

    return { saveDir, committed, skippedUnchanged, rejected };
}

function hasValidSharedSave(saveDir = getCanonicalSaveDir()) {
    const cloudPath = path.join(saveDir, 'cloud');
    if (fs.existsSync(cloudPath)) {
        try {
            if (verifyHeaderAndSha1(fs.readFileSync(cloudPath)).valid) return true;
        } catch (e) {}
    }
    const ppPath = path.join(saveDir, 'PlayerPrefs');
    if (fs.existsSync(ppPath)) {
        try {
            if (verifyPlayerPrefsHeader(fs.readFileSync(ppPath)).valid) return true;
        } catch (e) {}
    }
    return false;
}

module.exports = {
    LOGICAL_TO_DISK,
    BSON_FILES,
    getCanonicalRootDir,
    getCanonicalSaveDir,
    getRecoveryDir,
    resolveSafeSavePath,
    validateSaveBytes,
    atomicWriteFileSync,
    cleanupStaleTempFiles,
    recoverCorruptedFiles,
    loadAllSaves,
    commitSaves,
    hasValidSharedSave
};
