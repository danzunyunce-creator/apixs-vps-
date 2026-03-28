const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database at:', dbPath);

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err);
      return;
    }
    console.log('Tables found:', tables.map(t => t.name).join(', '));
    
    tables.forEach(table => {
      db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
        if (err) {
          console.error(`Error counting ${table.name}:`, err.message);
        } else {
          console.log(`Table ${table.name}: ${row ? row.count : 0} rows`);
          
          if (table.name === 'system_logs' && row.count > 0) {
              db.all(`SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 5`, (err, logs) => {
                  console.log('Recent System Logs:', JSON.stringify(logs, null, 2));
              });
          }
          
          if (table.name === 'streams' && row.count > 0) {
              db.all(`SELECT * FROM streams`, (err, streams) => {
                  console.log('Streams Content:', JSON.stringify(streams, null, 2));
              });
          }
          
          if (table.name === 'schedules' && row.count > 0) {
              db.all(`SELECT * FROM schedules`, (err, rows) => {
                  console.log('Schedules Content:', JSON.stringify(rows, null, 2));
              });
          }
        }
      });
    });
  });
});

setTimeout(() => db.close(), 5000);
