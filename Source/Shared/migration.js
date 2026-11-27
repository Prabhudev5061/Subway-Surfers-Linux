/**
 * First-Launch Safe Save Migration for SubwaySurfers-Linux
 *
 * Migrates legacy per-version Chromium IndexedDB profiles:
 *   - San Francisco: $XDG_CONFIG_HOME/SubwaySurfersSanfrancisco
 *   - Beijing:       $XDG_CONFIG_HOME/SubwaySurfersBeijing2 (and SubwaySurfersBeijing)
 * into the canonical unified save storage:
 *   $XDG_DATA_HOME/SubwaySurfers-Linux/Save/
 *
 * Strict safety guarantees:
 * - Never modifies or deletes legacy directories during migration.
 * - Creates SHA-256-verified backups of any detected legacy profiles before migrating.
 * - Validates 28-byte SHA-1 headers and UnityPrf headers before & after migration.
 * - Never silently resolves a conflict when both SF and Beijing contain player data;
 *   stops and reports the conflict unless an explicit --migrate-source is chosen.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    getCanonicalRootDir,
    getCanonicalSaveDir,
    atomicWriteFileSync,
    validateSaveBytes,
    hasValidSharedSave,
    loadAllSaves
} = require('./shared_storage');

function getLegacyProfilePaths() {
    const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    return {
        sanfrancisco: [path.join(configHome, 'SubwaySurfersSanfrancisco')],
        beijing: [
            path.join(configHome, 'SubwaySurfersBeijing2'),
            path.join(configHome, 'SubwaySurfersBeijing')
        ]
    };
}

function findLegacyIndexedDbDir(profileDir) {
    const idbRoot = path.join(profileDir, 'IndexedDB');
    if (!fs.existsSync(idbRoot)) return null;
    try {
        const entries = fs.readdirSync(idbRoot, { withFileTypes: true });
        for (const e of entries) {
            if (e.isDirectory() && e.name.endsWith('.indexeddb.leveldb')) {
                return path.join(idbRoot, e.name);
            }
        }
    } catch (e) {}
    return null;
}

function originFromLevelDbDirName(dirName) {
    if (dirName.startsWith('file__0')) return 'file:///tmp/SubwaySurfers';
    // e.g., http_127.0.0.1_47321.indexeddb.leveldb
    const m = /^http_([^_]+)_(\d+)\.indexeddb\.leveldb$/.exec(dirName);
    if (m) return `http://${m[1]}:${m[2]}`;
    return 'http://127.0.0.1:47321';
}

function copyDirRecursive(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dst, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(s, d);
        } else if (entry.isFile()) {
            fs.copyFileSync(s, d);
        }
    }
}

function generateSha256Manifest(rootDir) {
    const lines = [];
    const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.isFile() && e.name !== 'SHA256SUMS') {
                const rel = path.relative(rootDir, full).replace(/\\/g, '/');
                const sha = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
                lines.push(`${sha}  ${rel}`);
            }
        }
    };
    walk(rootDir);
    return lines.join('\n') + (lines.length ? '\n' : '');
}

function backupLegacyProfiles(detectedProfiles, backupBaseDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(backupBaseDir, `pre_migration_${stamp}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const backedUp = {};
    for (const [version, info] of Object.entries(detectedProfiles)) {
        if (!info) continue;
        const targetDir = path.join(backupDir, version, path.basename(info.profileDir));
        const idbSrc = path.join(info.profileDir, 'IndexedDB');
        if (fs.existsSync(idbSrc)) {
            copyDirRecursive(idbSrc, path.join(targetDir, 'IndexedDB'));
        }
        const winState = path.join(info.profileDir, 'window_state.json');
        if (fs.existsSync(winState)) {
            fs.mkdirSync(targetDir, { recursive: true });
            fs.copyFileSync(winState, path.join(targetDir, 'window_state.json'));
        }
        backedUp[version] = targetDir;
    }

    const manifest = generateSha256Manifest(backupDir);
    fs.writeFileSync(path.join(backupDir, 'SHA256SUMS'), manifest, 'utf8');

    // Verify backup integrity immediately
    for (const line of manifest.trim().split('\n').filter(Boolean)) {
        const [expectedSha, rel] = line.split('  ');
        const actualSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(backupDir, rel))).digest('hex');
        if (actualSha !== expectedSha) {
            throw new Error(`Backup verification failed for ${rel}`);
        }
    }

    return { backupDir, backedUp };
}

/**
 * Inspects an extracted /idbfs dump map: { 'Save/cloud': Buffer, 'Save/local': Buffer, 'PlayerPrefs': Buffer, ... }
 * Selects the newest valid copy across any hash directories if passed raw /idbfs keys.
 */
function normalizeExtractedEntries(rawEntries) {
    const targets = ['Save/cloud', 'Save/cloud_old', 'Save/local', 'Save/local_old', 'PlayerPrefs'];
    const best = {};

    for (const entry of rawEntries) {
        if (!entry || !entry.key || !entry.data) continue;
        // key like /idbfs/<32-hex>/Save/cloud or Save/cloud
        let logical = entry.key;
        const m = /^\/idbfs\/[a-f0-9]{32}\/(.+)$/i.exec(entry.key);
        if (m) logical = m[1];
        if (!targets.includes(logical)) continue;

        const diskMap = {
            'Save/cloud': 'cloud',
            'Save/cloud_old': 'cloud_old',
            'Save/local': 'local',
            'Save/local_old': 'local_old',
            'PlayerPrefs': 'PlayerPrefs'
        };
        const diskRel = diskMap[logical];
        const buf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
        const check = validateSaveBytes(diskRel, buf);
        if (!check.valid) continue;

        const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
        if (!best[diskRel] || ts > best[diskRel].ts || (ts === best[diskRel].ts && buf.length > best[diskRel].buf.length)) {
            best[diskRel] = { buf, ts, logical };
        }
    }
    return best;
}

/**
 * Summarize meaningful progress from a normalized save map without requiring external BSON dependencies.
 */
function summarizeSaveMap(normalized) {
    const files = {};
    for (const [k, v] of Object.entries(normalized)) {
        files[k] = { size: v.buf.length, sha256: crypto.createHash('sha256').update(v.buf).digest('hex') };
    }
    const hasCloud = Boolean(normalized.cloud);
    const hasPlayerPrefs = Boolean(normalized.PlayerPrefs);
    return {
        hasMeaningfulData: hasCloud || hasPlayerPrefs,
        hasCloud,
        hasPlayerPrefs,
        files
    };
}

/**
 * Performs deterministic migration given extracted save maps for SF and/or Beijing.
 */
function runMigrationFromMaps({
    sfEntries = null,
    bjEntries = null,
    saveDir = getCanonicalSaveDir(),
    rootDir = getCanonicalRootDir(),
    explicitSource = null,
    backupInfo = null
}) {
    const statePath = path.join(rootDir, 'migration', 'migration_state.json');
    const conflictPath = path.join(rootDir, 'migration', 'migration_conflict.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });

    if (hasValidSharedSave(saveDir)) {
        return { status: 'already_present', saveDir };
    }

    const sfNorm = sfEntries ? normalizeExtractedEntries(sfEntries) : {};
    const bjNorm = bjEntries ? normalizeExtractedEntries(bjEntries) : {};
    const sfSummary = summarizeSaveMap(sfNorm);
    const bjSummary = summarizeSaveMap(bjNorm);

    if (!sfSummary.hasMeaningfulData && !bjSummary.hasMeaningfulData) {
        fs.mkdirSync(saveDir, { recursive: true });
        fs.mkdirSync(path.join(saveDir, 'recovery'), { recursive: true });
        const state = {
            status: 'initialized_empty',
            completedAt: new Date().toISOString(),
            saveDir
        };
        atomicWriteFileSync(statePath, Buffer.from(JSON.stringify(state, null, 2) + '\n', 'utf8'));
        return state;
    }

    let chosenVersion = null;
    let chosenMap = null;

    if (sfSummary.hasMeaningfulData && !bjSummary.hasMeaningfulData) {
        chosenVersion = 'sanfrancisco';
        chosenMap = sfNorm;
    } else if (!sfSummary.hasMeaningfulData && bjSummary.hasMeaningfulData) {
        chosenVersion = 'beijing';
        chosenMap = bjNorm;
    } else {
        // Both San Francisco and Beijing contain meaningful player data!
        if (explicitSource === 'sanfrancisco') {
            chosenVersion = 'sanfrancisco';
            chosenMap = sfNorm;
        } else if (explicitSource === 'beijing') {
            chosenVersion = 'beijing';
            chosenMap = bjNorm;
        } else if (explicitSource === 'fresh') {
            fs.mkdirSync(saveDir, { recursive: true });
            fs.mkdirSync(path.join(saveDir, 'recovery'), { recursive: true });
            const state = {
                status: 'initialized_fresh_by_user',
                completedAt: new Date().toISOString(),
                saveDir,
                backupInfo
            };
            atomicWriteFileSync(statePath, Buffer.from(JSON.stringify(state, null, 2) + '\n', 'utf8'));
            return state;
        } else {
            const conflictReport = {
                status: 'conflict',
                detectedAt: new Date().toISOString(),
                reason: 'Both legacy San Francisco and Beijing profiles contain valid player save data. Refusing to silently overwrite either.',
                sanfrancisco: sfSummary,
                beijing: bjSummary,
                backupInfo,
                resolutionOptions: [
                    '--migrate-source=sanfrancisco',
                    '--migrate-source=beijing',
                    '--migrate-source=fresh'
                ]
            };
            atomicWriteFileSync(conflictPath, Buffer.from(JSON.stringify(conflictReport, null, 2) + '\n', 'utf8'));
            return conflictReport;
        }
    }

    // Write validated files atomically into canonical Save/
    fs.mkdirSync(saveDir, { recursive: true });
    fs.mkdirSync(path.join(saveDir, 'recovery'), { recursive: true });

    const migratedFiles = [];
    for (const [diskRel, item] of Object.entries(chosenMap)) {
        const dest = path.join(saveDir, diskRel);
        const check = validateSaveBytes(diskRel, item.buf);
        if (!check.valid) {
            throw new Error(`Refusing to migrate invalid ${diskRel} from ${chosenVersion}: ${check.reason}`);
        }
        atomicWriteFileSync(dest, item.buf);
        // Also seed recovery/ copy for primary files
        if (diskRel === 'cloud' || diskRel === 'local' || diskRel === 'PlayerPrefs') {
            atomicWriteFileSync(path.join(saveDir, 'recovery', `${diskRel}.recovery`), item.buf);
        }
        migratedFiles.push({
            file: diskRel,
            size: item.buf.length,
            sha256: crypto.createHash('sha256').update(item.buf).digest('hex')
        });
    }

    // Post-migration validation
    const loaded = loadAllSaves(saveDir);
    if (chosenMap.cloud && !loaded.files['Save/cloud']) {
        throw new Error('Post-migration validation failed: Save/cloud missing or invalid after write');
    }
    if (chosenMap.PlayerPrefs && !loaded.files['PlayerPrefs']) {
        throw new Error('Post-migration validation failed: PlayerPrefs missing or invalid after write');
    }

    if (fs.existsSync(conflictPath)) {
        try { fs.unlinkSync(conflictPath); } catch (e) {}
    }

    const state = {
        status: 'migrated',
        sourceVersion: chosenVersion,
        completedAt: new Date().toISOString(),
        saveDir,
        migratedFiles,
        backupInfo
    };
    atomicWriteFileSync(statePath, Buffer.from(JSON.stringify(state, null, 2) + '\n', 'utf8'));
    return state;
}

function detectLegacyProfiles() {
    const paths = getLegacyProfilePaths();
    const detected = { sanfrancisco: null, beijing: null };
    for (const [ver, candidates] of Object.entries(paths)) {
        for (const p of candidates) {
            const idbDir = findLegacyIndexedDbDir(p);
            if (idbDir) {
                detected[ver] = {
                    profileDir: p,
                    indexedDbDir: idbDir,
                    originUrl: originFromLevelDbDirName(path.basename(idbDir))
                };
                break;
            }
        }
    }
    return detected;
}

async function performFirstLaunchMigration({
    extractLegacyProfileFn,
    saveDir = getCanonicalSaveDir(),
    rootDir = getCanonicalRootDir(),
    explicitSource = null
}) {
    if (hasValidSharedSave(saveDir)) {
        return { status: 'already_present', saveDir };
    }

    const detected = detectLegacyProfiles();
    if (!detected.sanfrancisco && !detected.beijing) {
        return runMigrationFromMaps({ sfEntries: null, bjEntries: null, saveDir, rootDir, explicitSource });
    }

    const backupBase = path.join(rootDir, 'migration', 'backups');
    const backupInfo = backupLegacyProfiles(detected, backupBase);

    const sfEntries = detected.sanfrancisco && extractLegacyProfileFn
        ? await extractLegacyProfileFn(detected.sanfrancisco)
        : null;
    const bjEntries = detected.beijing && extractLegacyProfileFn
        ? await extractLegacyProfileFn(detected.beijing)
        : null;

    return runMigrationFromMaps({
        sfEntries,
        bjEntries,
        saveDir,
        rootDir,
        explicitSource,
        backupInfo
    });
}

module.exports = {
    getLegacyProfilePaths,
    findLegacyIndexedDbDir,
    originFromLevelDbDirName,
    backupLegacyProfiles,
    normalizeExtractedEntries,
    summarizeSaveMap,
    runMigrationFromMaps,
    detectLegacyProfiles,
    performFirstLaunchMigration
};
