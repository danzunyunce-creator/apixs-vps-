const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('--- DIAGNOSTIC: VIDEOS TABLE ---');
db.all('SELECT id, title, user_id FROM videos', (err, rows) => {
    if (err) {
        console.error('DB Error:', err);
    } else {
        console.log('Total videos found:', rows.length);
        rows.forEach(r => {
            console.log(`- ID: [${r.id}] | Title: [${r.title}] | User: [${r.user_id}]`);
        });
    }
    db.close();
});
