import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'streamflow.db');
export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    db.run('PRAGMA journal_mode = WAL', (err) => {
        if (!err) console.log('✅ SQLite WAL Mode Enabled (Performance Optimized)');
    });
    initializeDatabase();
  }
});

function createTables(): Promise<void> {
  return new Promise((resolve) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
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

      db.run(`CREATE TABLE IF NOT EXISTS videos (
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

      db.run(`CREATE TABLE IF NOT EXISTS streams (
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

      db.run(`CREATE TABLE IF NOT EXISTS stream_history (
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

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
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

      db.run(`CREATE TABLE IF NOT EXISTS playlists (
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

      db.run(`CREATE TABLE IF NOT EXISTS youtube_channels (
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

      db.run(`CREATE TABLE IF NOT EXISTS schedules (
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

      db.run(`CREATE TABLE IF NOT EXISTS stream_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id TEXT NOT NULL,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        peak_viewers INTEGER DEFAULT 0,
        total_duration_seconds INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS automation_rules (
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
              db.run(`INSERT OR IGNORE INTO automation_rules (id, name, description, category, icon, schedule, enabled) VALUES (?, ?, ?, ?, ?, ?, 1)`, d);
          });
      });

      db.run(`CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (!err) {
          const keys = ['telegram_bot_token','telegram_chat_id','yt_api_key_1','yt_api_key_2','yt_client_id','yt_client_secret','register_enabled', 'app_redirect_url'];
          keys.forEach(k => db.run(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`, [k, 
            k === 'register_enabled' ? 'false' : 
            k === 'app_redirect_url' ? 'http://localhost:3001/api/youtube/oauth-callback' : ''
          ]));
        }
      });

      db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id TEXT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        load INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ONLINE',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, () => {
          db.run(`INSERT OR IGNORE INTO nodes (id, name, url, load, status) VALUES (?, ?, ?, ?, ?)`, 
              ['node-1', 'Main VPS (Local)', 'http://localhost:3001', 10, 'ONLINE']);
      });

      db.run(`CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => resolve());
    });
  });
}

export function checkIfUsersExist(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result: any) => {
      if (err) return reject(err);
      resolve(result.count > 0);
    });
  });
}

export async function initializeDatabase(): Promise<void> {
  await createTables();
  rotateLogs(1000); 

  // Migration for additional video fields - Safe Check
  db.serialize(() => {
    db.get(`PRAGMA table_info(videos)`, [], (err, rows) => {
        // No-op if already exists
    });
    // We use a more generic approach to check if column exists
    const safeAddColumn = (table: string, col: string, type: string) => {
        db.get(`SELECT COUNT(*) AS count FROM pragma_table_info('${table}') WHERE name='${col}'`, (err, row: any) => {
            if (!err && row && row.count === 0) {
                db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
            }
        });
    };

    safeAddColumn('videos', 'tags', 'TEXT');
    safeAddColumn('videos', 'category', 'TEXT');
    safeAddColumn('streams', 'restart_count', 'INTEGER DEFAULT 0');
    safeAddColumn('schedules', 'stream_id', 'TEXT');
    safeAddColumn('schedules', 'youtube_account_id', 'TEXT');
    safeAddColumn('schedules', 'is_recurring', 'INTEGER DEFAULT 0');
    safeAddColumn('users', 'user_role', "TEXT DEFAULT 'admin'");
  });

  // Seed Admin Accounts
  const hash1 = bcrypt.hashSync('liveapixs', 10);
  const hash2 = bcrypt.hashSync('@Zainul14', 10);

  const seedAdmin = (id: string, username: string, hash: string) => {
    db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
      if (!err && !row) {
        db.run(`INSERT INTO users (id, username, password, user_role, status) VALUES (?, ?, ?, 'admin', 'active')`, [id, username, hash]);
      }
    });
  };

  seedAdmin('admin-1', 'zainulapixs', hash1);
  seedAdmin('admin-2', 'Zainul14', hash2);
  
  console.log('✅ [Database] System Health: EXCELLENT. All tables and migrations validated.');
}

export function rotateLogs(maxRows: number = 2000): void {
  db.run(`DELETE FROM system_logs WHERE id NOT IN (SELECT id FROM system_logs ORDER BY created_at DESC LIMIT ?)`, [maxRows], (err) => {
    if (err) console.error('[Database] Failed to rotate logs:', err);
    else console.log(`[Database] Logs rotated to last ${maxRows} records.`);
  });
}

/**
 * Rotasi Sesi: Menghapus riwayat stream yang sudah lebih dari 30 hari.
 * Menjaga ukuran database tetap ramping (Industrial Standard).
 */
export function rotateSessions(daysBack: number = 30): void {
  db.run(`DELETE FROM stream_sessions WHERE start_time < datetime('now', '-${daysBack} days')`, [], (err) => {
    if (err) console.error('[Database] Failed to rotate sessions:', err);
    else console.log(`[Database] Old sessions (> ${daysBack} days) purged.`);
  });
}

export function updateStreamStatus(id: string, status: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let query = `UPDATE streams SET status = ? WHERE id = ?`;
    let realId = id;
    let finalStatus = status;

    if (id && id.startsWith('sched-')) {
        query = `UPDATE schedules SET status = ? WHERE id = ?`;
        realId = id.replace('sched-', '');
        if (status === 'STOP') finalStatus = 'COMPLETED';
    }

    db.run(query, [finalStatus, realId], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });
}

export function incrementRestartCount(id: string): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE streams SET restart_count = restart_count + 1 WHERE id = ?`, [id], function (err) {
      if (err) return reject(err);
      db.get(`SELECT restart_count FROM streams WHERE id = ?`, [id], (err, row: any) => {
        resolve(row ? (row.restart_count as number) : 0);
      });
    });
  });
}

export function getStreamMeta(id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM streams WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export function logAuditEvent(userId: string, username: string, action: string, targetType: string, targetId: string, details?: string): void {
  db.run(`INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)`, 
    [userId, username, action, targetType, targetId, details || '']);
}

export function saveSystemLog(streamId: string | null, level: string, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO system_logs (stream_id, level, message) VALUES (?, ?, ?)`,
      [streamId, level, message],
      (err) => err ? reject(err) : resolve()
    );
  });
}

export function getSystemLogs(limit: number = 50): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}
