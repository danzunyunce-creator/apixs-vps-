const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = path.join(__dirname, 'streamflow.db');
const db = new sqlite3.Database(dbPath);

const videoId = 'vid-1775542367165-860';

console.log(`--- DIAGNOSTIC: Video ID ${videoId} ---`);

db.serialize(() => {
    // 1. Check video record
    db.get('SELECT * FROM videos WHERE id = ?', [videoId], (err, row) => {
        if (err) {
            console.error('❌ Error fetching video:', err.message);
        } else if (!row) {
            console.error('❌ Video not found in database.');
        } else {
            console.log('✅ Video Record Found:');
            console.log(`   - Title: ${row.title}`);
            console.log(`   - Filepath: ${row.filepath}`);
            console.log(`   - Status: ${row.status || 'N/A'}`);
            
            if (fs.existsSync(row.filepath)) {
                console.log('✅ File exists on disk.');
            } else {
                console.error(`❌ File DOES NOT exist at ${row.filepath}`);
            }
        }
    });

    // 2. Check logs for this video
    db.all('SELECT * FROM system_logs WHERE stream_id = ? OR message LIKE ? ORDER BY created_at DESC', [videoId, `%${videoId}%`], (err, rows) => {
        if (err) {
            console.error('❌ Error fetching logs:', err.message);
        } else if (rows.length === 0) {
            console.log('ℹ️ No system logs found for this video.');
        } else {
            console.log('--- SYSTEM LOGS ---');
            rows.forEach(r => {
                console.log(`[${r.level}] ${r.created_at}: ${r.message}`);
            });
        }
        db.close();
    });
});
