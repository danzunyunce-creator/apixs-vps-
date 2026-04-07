const sqlite3 = require('sqlite3');
const path = require('path');
// Path must be absolute for reliable access
const dbPath = 'd:/apixs live apps/backend/streamflow.db';
const db = new sqlite3.Database(dbPath);

console.log('--- DIAGNOSTIC: VIDEOS TABLE ---');
db.all('SELECT id, title, user_id FROM videos ORDER BY created_at DESC LIMIT 5', (err, rows) => {
    if (err) {
        console.error('DB Error:', err);
    } else {
        console.log('Last 5 videos found:', rows.length);
        rows.forEach(r => {
            console.log(`- ID: [${r.id}] | Title: [${r.title}] | User: [${r.user_id}]`);
        });
    }
    db.close();
});
