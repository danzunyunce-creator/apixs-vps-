const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('--- DB INSPECTOR: ALL VIDEOS ---');
db.all('SELECT id, title, upload_date FROM videos ORDER BY upload_date DESC', (err, rows) => {
    if (err) {
        console.error('❌ DB Error:', err.message);
    } else {
        console.log(`Total videos: ${rows.length}`);
        rows.forEach(r => {
            console.log(`[${r.id}] ${r.title} (${r.upload_date})`);
        });
    }
    db.close();
});
