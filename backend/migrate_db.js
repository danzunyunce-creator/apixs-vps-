const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'streamflow.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check if column exists
    db.all("PRAGMA table_info(streams)", (err, rows) => {
        if (err) {
            console.error('Error info:', err);
            process.exit(1);
        }
        
        const hasPlaylistPath = rows.some(r => r.name === 'playlist_path');
        const hasRtmpUrl = rows.some(r => r.name === 'rtmp_url');
        const hasStreamKey = rows.some(r => r.name === 'stream_key');

        if (!hasPlaylistPath) {
            console.log('Adding column playlist_path...');
            db.run("ALTER TABLE streams ADD COLUMN playlist_path TEXT");
        } else {
            console.log('Column playlist_path already exists.');
        }

        if (!hasRtmpUrl) {
           console.log('Adding column rtmp_url...');
           db.run("ALTER TABLE streams ADD COLUMN rtmp_url TEXT");
        }

        if (!hasStreamKey) {
           console.log('Adding column stream_key...');
           db.run("ALTER TABLE streams ADD COLUMN stream_key TEXT");
        }

        console.log('Migration check complete.');
    });
});
