import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('backend/streamflow.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database users...');
db.all("SELECT id, username, user_role FROM users", (err, rows) => {
    if (err) {
        console.error('Error reading users:', err);
    } else {
        console.log('Users in DB:');
        console.table(rows);
    }
    db.close();
});
