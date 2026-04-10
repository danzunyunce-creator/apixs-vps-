const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('--- MONITORING: VIDEO OPTIMIZATION PROGRESS ---');
db.all("SELECT * FROM system_logs WHERE message LIKE '%Optim%' ORDER BY created_at DESC LIMIT 5", (err, rows) => {
    if (err) {
        console.error('DB Error:', err);
    } else {
        if (rows.length === 0) {
            console.log('ℹ️ No optimization logs found yet.');
        } else {
            rows.forEach(r => {
                const icon = r.level === 'info' ? '🎬' : (r.level === 'error' ? '❌' : '⚠️');
                console.log(`${icon} [${r.created_at}] ${r.message}`);
            });
        }
    }
    db.close();
});
