const sqlite3 = require('sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('--- PRODUCTION MONITOR: OPTIMIZATION STATUS ---');
db.all("SELECT * FROM system_logs WHERE message LIKE '%Optim%' ORDER BY created_at DESC LIMIT 10", (err, rows) => {
    if (err) {
        console.error('❌ Error querying logs:', err.message);
    } else if (rows.length === 0) {
        console.log('ℹ️ No optimization logs found in system_logs.');
    } else {
        rows.forEach(r => {
            const statusIcon = r.message.includes('✅') ? '✅' : (r.message.includes('❌') ? '❌' : '🎬');
            console.log(`${statusIcon} [${r.created_at}] ${r.message}`);
        });
    }
    db.close();
});
