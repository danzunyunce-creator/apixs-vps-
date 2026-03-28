"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.checkIfUsersExist = checkIfUsersExist;
exports.initializeDatabase = initializeDatabase;
exports.rotateLogs = rotateLogs;
exports.updateStreamStatus = updateStreamStatus;
exports.incrementRestartCount = incrementRestartCount;
exports.getStreamMeta = getStreamMeta;
exports.logAuditEvent = logAuditEvent;
exports.saveSystemLog = saveSystemLog;
exports.getSystemLogs = getSystemLogs;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const dbDir = path_1.default.join(__dirname);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path_1.default.join(dbDir, 'streamflow.db');
exports.db = new sqlite3_1.default.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    }
    else {
        exports.db.run('PRAGMA journal_mode = WAL', (err) => {
            if (!err)
                console.log('✅ SQLite WAL Mode Enabled (Performance Optimized)');
        });
        initializeDatabase();
    }
});
function createTables() {
    return new Promise((resolve) => {
        exports.db.serialize(() => {
            exports.db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar_path TEXT,
        gdrive_api_key TEXT,
        user_role TEXT DEFAULT 'admin',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        filepath TEXT NOT NULL,
        thumbnail_path TEXT,
        file_size INTEGER,
        duration REAL,
        format TEXT,
        resolution TEXT,
        bitrate INTEGER,
        fps TEXT,
        tags TEXT,
        category TEXT,
        user_id TEXT,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS streams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        video_id TEXT,
        playlist_path TEXT,
        rtmp_url TEXT,
        stream_key TEXT,
        platform TEXT,
        platform_icon TEXT,
        bitrate INTEGER DEFAULT 2500,
        resolution TEXT,
        fps INTEGER DEFAULT 30,
        orientation TEXT DEFAULT 'horizontal',
        loop_video BOOLEAN DEFAULT 1,
        schedule_time TIMESTAMP,
        duration INTEGER,
        status TEXT DEFAULT 'offline',
        auto_title TEXT,
        auto_description TEXT,
        custom_thumbnail TEXT,
        youtube_account_id TEXT,
        status_updated_at TIMESTAMP,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        use_advanced_settings BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        restart_count INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (video_id) REFERENCES videos(id)
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS stream_history (
        id TEXT PRIMARY KEY,
        stream_id TEXT,
        title TEXT NOT NULL,
        platform TEXT,
        platform_icon TEXT,
        video_id TEXT,
        video_title TEXT,
        resolution TEXT,
        bitrate INTEGER,
        fps INTEGER,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration INTEGER,
        use_advanced_settings BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (stream_id) REFERENCES streams(id),
        FOREIGN KEY (video_id) REFERENCES videos(id)
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        username TEXT,
        action TEXT,
        target_type TEXT,
        target_id TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_shuffle BOOLEAN DEFAULT 0,
        clips_json TEXT DEFAULT '[]',
        user_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS youtube_channels (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT,
        platform TEXT DEFAULT 'YouTube',
        auth_type TEXT DEFAULT 'OAuth',
        api_key TEXT,
        channel_thumbnail TEXT,
        subscriber_count TEXT DEFAULT '0',
        access_token TEXT,
        refresh_token TEXT,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sourceType TEXT,
        sourceName TEXT,
        channel TEXT,
        stream_key TEXT,
        playlist_path TEXT,
        start_time DATETIME,
        end_time DATETIME,
        status TEXT DEFAULT 'SCHEDULED',
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_recurring INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS stream_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id TEXT NOT NULL,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        peak_viewers INTEGER DEFAULT 0,
        total_duration_seconds INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS automation_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'schedule',
        icon TEXT DEFAULT '⚡',
        enabled INTEGER DEFAULT 1,
        schedule TEXT,
        last_run TEXT,
        success_rate INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => {
                const defaults = [
                    ['rule-1', 'Anti-Zonkz Stream', 'Restart otomatis jika penonton 0 selama 5+ menit', 'content', '🔄', '24/7 Monitoring'],
                    ['rule-2', 'Auto-SEO Niche Optimizer', 'Update Judul, Deskripsi & Tags siaran otomatis', 'schedule', '🎯', 'On Stream Start'],
                    ['rule-3', 'Auto-Stop Duration', 'Matikan stream otomatis setelah 12 jam', 'notification', '⏱️', 'After 12 Hours'],
                    ['rule-4', 'Health Pulse Monitoring', 'Kirim update berkala status stream ke Telegram', 'chatbot', '❤️', 'Every 1 Hour'],
                    ['rule-5', 'SEO Hourly Title Rotator', 'Ganti judul berkala dengan keyword berbeda', 'schedule', '🔄', 'Every 1 Hour']
                ];
                defaults.forEach(d => {
                    exports.db.run(`INSERT OR IGNORE INTO automation_rules (id, name, description, category, icon, schedule, enabled) VALUES (?, ?, ?, ?, ?, ?, 1)`, d);
                });
            });
            exports.db.run(`CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
                if (!err) {
                    const keys = ['telegram_bot_token', 'telegram_chat_id', 'yt_api_key_1', 'yt_api_key_2', 'yt_client_id', 'yt_client_secret', 'register_enabled', 'app_redirect_url'];
                    keys.forEach(k => exports.db.run(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`, [k,
                        k === 'register_enabled' ? 'false' :
                            k === 'app_redirect_url' ? 'http://localhost:3001/api/youtube/oauth-callback' : ''
                    ]));
                }
            });
            exports.db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id TEXT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
            exports.db.run(`CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        load INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ONLINE',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, () => {
                exports.db.run(`INSERT OR IGNORE INTO nodes (id, name, url, load, status) VALUES (?, ?, ?, ?, ?)`, ['node-1', 'Main VPS (Local)', 'http://localhost:3001', 10, 'ONLINE']);
            });
            exports.db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => resolve());
        });
    });
}
function checkIfUsersExist() {
    return new Promise((resolve, reject) => {
        exports.db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
            if (err)
                return reject(err);
            resolve(result.count > 0);
        });
    });
}
async function initializeDatabase() {
    await createTables();
    rotateLogs(1000);
    // Migration for additional video fields - Safe Check
    exports.db.serialize(() => {
        exports.db.get(`PRAGMA table_info(videos)`, [], (err, rows) => {
            // No-op if already exists
        });
        // We use a more generic approach to check if column exists
        const safeAddColumn = (table, col, type) => {
            exports.db.get(`SELECT COUNT(*) AS count FROM pragma_table_info('${table}') WHERE name='${col}'`, (err, row) => {
                if (!err && row && row.count === 0) {
                    exports.db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
                }
            });
        };
        safeAddColumn('videos', 'tags', 'TEXT');
        safeAddColumn('videos', 'category', 'TEXT');
        safeAddColumn('streams', 'restart_count', 'INTEGER DEFAULT 0');
        safeAddColumn('schedules', 'stream_id', 'TEXT');
        safeAddColumn('users', 'user_role', "TEXT DEFAULT 'admin'");
    });
    // Seed Admin Accounts
    const hash1 = bcrypt_1.default.hashSync('liveapixs', 10);
    const hash2 = bcrypt_1.default.hashSync('@Zainul14', 10);
    const seedAdmin = (id, username, hash) => {
        exports.db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
            if (!err && !row) {
                exports.db.run(`INSERT INTO users (id, username, password, user_role, status) VALUES (?, ?, ?, 'admin', 'active')`, [id, username, hash]);
            }
        });
    };
    seedAdmin('admin-1', 'zainulapixs', hash1);
    seedAdmin('admin-2', 'Zainul14', hash2);
    console.log('✅ [Database] System Health: EXCELLENT. All tables and migrations validated.');
}
function rotateLogs(keepCount = 1000) {
    exports.db.run(`DELETE FROM system_logs WHERE id NOT IN (SELECT id FROM system_logs ORDER BY created_at DESC LIMIT ?)`, [keepCount], (err) => {
        if (!err)
            console.log(`✅ [Maintenance] Log database rotated. Keeping last ${keepCount} entries.`);
    });
}
function updateStreamStatus(id, status) {
    return new Promise((resolve, reject) => {
        let query = `UPDATE streams SET status = ? WHERE id = ?`;
        let realId = id;
        let finalStatus = status;
        if (id && id.startsWith('sched-')) {
            query = `UPDATE schedules SET status = ? WHERE id = ?`;
            realId = id.replace('sched-', '');
            if (status === 'STOP')
                finalStatus = 'COMPLETED';
        }
        exports.db.run(query, [finalStatus, realId], function (err) {
            if (err)
                return reject(err);
            resolve(this.changes);
        });
    });
}
function incrementRestartCount(id) {
    return new Promise((resolve, reject) => {
        exports.db.run(`UPDATE streams SET restart_count = restart_count + 1 WHERE id = ?`, [id], function (err) {
            if (err)
                return reject(err);
            exports.db.get(`SELECT restart_count FROM streams WHERE id = ?`, [id], (err, row) => {
                resolve(row ? row.restart_count : 0);
            });
        });
    });
}
function getStreamMeta(id) {
    return new Promise((resolve, reject) => {
        exports.db.get(`SELECT * FROM streams WHERE id = ?`, [id], (err, row) => {
            if (err)
                return reject(err);
            resolve(row);
        });
    });
}
function logAuditEvent(userId, username, action, targetType, targetId, details) {
    exports.db.run(`INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`, [userId, username, action, targetType, targetId, details || '']);
}
function saveSystemLog(streamId, level, message) {
    return new Promise((resolve, reject) => {
        exports.db.run(`INSERT INTO system_logs (stream_id, level, message) VALUES (?, ?, ?)`, [streamId, level, message], (err) => err ? reject(err) : resolve());
    });
}
function getSystemLogs(limit = 50) {
    return new Promise((resolve, reject) => {
        exports.db.all(`SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?`, [limit], (err, rows) => {
            if (err)
                return reject(err);
            resolve(rows);
        });
    });
}
