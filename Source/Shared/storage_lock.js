/**
 * Exclusive Process Lock for Shared SubwaySurfers-Linux Save Storage
 *
 * Uses atomic O_CREAT|O_EXCL lockfile creation combined with Linux /proc/<pid>/stat
 * start-time verification to prevent simultaneous instances (e.g., San Francisco
 * and Beijing running at the same time) from corrupting shared save files while
 * safely recovering stale locks left behind after crashes (SIGKILL / power loss).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOCK_FILENAME = '.storage.lock';

function readProcStartTime(pid) {
    if (!pid || !Number.isInteger(pid) || pid <= 0) return null;
    try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
        // Field 2 is (comm) which may contain spaces/parens; find last ')'
        const closeParen = stat.lastIndexOf(')');
        if (closeParen === -1) return null;
        const rest = stat.slice(closeParen + 2).trim().split(/\s+/);
        // After state (index 0 = field 3), starttime is field 22 -> index 19
        const state = rest[0];
        if (state === 'Z') return null; // zombie
        const startTime = rest[19] || null;
        return startTime;
    } catch (e) {
        return null;
    }
}

function isPidAlive(pid) {
    if (!pid || !Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === 'EPERM';
    }
}

function isOwnerStillAlive(ownerMeta) {
    if (!ownerMeta || typeof ownerMeta.pid !== 'number') return false;
    if (ownerMeta.hostname && ownerMeta.hostname !== os.hostname()) {
        // Different host on shared storage — treat as potentially live unless explicitly expired
        return true;
    }
    if (!isPidAlive(ownerMeta.pid)) return false;
    if (ownerMeta.startTimeTicks) {
        const currentTicks = readProcStartTime(ownerMeta.pid);
        if (!currentTicks || currentTicks !== ownerMeta.startTimeTicks) {
            return false; // PID was recycled or process is zombie/gone
        }
    }
    return true;
}

function acquireStorageLock(saveDir, options = {}) {
    const appName = options.appName || 'SubwaySurfers-Linux';
    const version = options.version || 'unknown';
    const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 3;

    fs.mkdirSync(saveDir, { recursive: true });
    const lockPath = path.join(saveDir, LOCK_FILENAME);

    const selfMeta = {
        pid: process.pid,
        startTimeTicks: readProcStartTime(process.pid),
        appName,
        version,
        hostname: os.hostname(),
        acquiredAt: new Date().toISOString()
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const fd = fs.openSync(lockPath, 'wx', 0o644);
            try {
                fs.writeFileSync(fd, JSON.stringify(selfMeta, null, 2) + '\n', 'utf8');
                fs.fsyncSync(fd);
            } finally {
                fs.closeSync(fd);
            }

            let released = false;
            const release = () => {
                if (released) return false;
                released = true;
                try {
                    if (!fs.existsSync(lockPath)) return true;
                    const raw = fs.readFileSync(lockPath, 'utf8');
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.pid === process.pid) {
                        fs.unlinkSync(lockPath);
                        return true;
                    }
                } catch (e) {
                    // Best-effort cleanup if lock file disappeared
                }
                return false;
            };

            return {
                acquired: true,
                lockPath,
                meta: selfMeta,
                recoveredStale: attempt > 0,
                release
            };
        } catch (err) {
            if (err.code !== 'EEXIST') {
                return {
                    acquired: false,
                    lockPath,
                    error: err.message,
                    message: `Failed to acquire save storage lock (${lockPath}): ${err.message}`
                };
            }

            // Lock file exists: inspect owner
            let owner = null;
            try {
                owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
            } catch (readErr) {
                // Corrupt/empty lockfile left mid-crash; if file is older than 2s or unreadable, recover
                try {
                    const st = fs.statSync(lockPath);
                    if (Date.now() - st.mtimeMs > 1500) {
                        fs.unlinkSync(lockPath);
                        continue;
                    }
                } catch (e2) {}
            }

            if (owner && isOwnerStillAlive(owner)) {
                return {
                    acquired: false,
                    lockPath,
                    owner,
                    message:
                        `Another Subway Surfers instance (${owner.appName || 'unknown'}, PID ${owner.pid}) ` +
                        `is currently using the shared save storage at "${saveDir}".\n\n` +
                        `Close the running instance before launching another version so shared progress cannot be corrupted.`
                };
            }

            // Stale lock from a crashed process: remove safely and retry
            try {
                fs.unlinkSync(lockPath);
            } catch (unlinkErr) {
                if (unlinkErr.code !== 'ENOENT') {
                    return {
                        acquired: false,
                        lockPath,
                        owner,
                        message: `Found stale lock at "${lockPath}" but could not clear it: ${unlinkErr.message}`
                    };
                }
            }
        }
    }

    return {
        acquired: false,
        lockPath,
        message: `Could not acquire exclusive save lock at "${lockPath}" after retries.`
    };
}

module.exports = {
    LOCK_FILENAME,
    readProcStartTime,
    isPidAlive,
    isOwnerStillAlive,
    acquireStorageLock
};
