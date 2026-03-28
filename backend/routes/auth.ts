import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as dbLayer from '../database';
import config from '../config';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 1. LOGIN
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    dbLayer.db.get(`SELECT id, username, password as dbPass, user_role, status FROM users WHERE username = ?`,
        [username], (err, row: any) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(401).json({ error: 'Username atau password salah.' });

            let isMatch = false;
            let isLegacy = false;

            if (row.dbPass.startsWith('$2b$')) {
                isMatch = bcrypt.compareSync(password, row.dbPass);
            } else {
                isMatch = (password === row.dbPass);
                isLegacy = true;
            }

            if (!isMatch) return res.status(401).json({ error: 'Username atau password salah.' });

            if (isLegacy) {
                dbLayer.db.run(`UPDATE users SET password = ? WHERE id = ?`, [bcrypt.hashSync(password, 10), row.id]);
            }

            const safeUser = { id: row.id, username: row.username, user_role: row.user_role, status: row.status };
            
            // GENERATE JWT
            const token = jwt.sign(
                { id: row.id, username: row.username, role: row.user_role },
                config.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({ token, user: safeUser });
        });
});

// 2. REGISTER (Default user-mode closed by admin config)
router.post('/register', (req, res) => {
    const { username, password } = req.body;
    dbLayer.db.get(`SELECT value FROM app_config WHERE key = 'register_enabled'`, [], (err, row: any) => {
        const isEnabled = row && row.value === 'true';
        if (!isEnabled) {
            return res.status(403).json({ error: 'Pendaftaran mandiri ditutup oleh Admin.' });
        }
        const id = 'user-' + Date.now();
        const hash = bcrypt.hashSync(password, 10);
        dbLayer.db.run(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`,
            [id, username, hash], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                
                const token = jwt.sign({ id, username, role: 'user' }, config.JWT_SECRET, { expiresIn: '7d' });
                res.json({ message: 'User registered successfully', userId: id, token });
            });
    });
});

// 3. ADMIN: ADD USER
router.post('/users', authMiddleware, adminOnly, (req, res) => {
    const { username, password, role } = req.body;
    const id = 'user-' + Date.now();
    const hash = bcrypt.hashSync(password, 10);
    dbLayer.db.run(`INSERT INTO users (id, username, password, user_role) VALUES (?, ?, ?, ?)`,
        [id, username, hash, role || 'user'], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'User added by admin', userId: id });
        });
});

// 4. ADMIN: LIST USERS
router.get('/users', authMiddleware, adminOnly, (req, res) => {
    dbLayer.db.all(`SELECT id, username, user_role, status, created_at FROM users ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 5. ADMIN: UPDATE PASSWORD
router.put('/users/:username/password', authMiddleware, adminOnly, (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    const hash = bcrypt.hashSync(newPassword, 10);
    dbLayer.db.run(`UPDATE users SET password = ? WHERE username = ?`, [hash, username], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Password updated successfully' });
    });
});

// 6. ADMIN: DELETE USER
router.delete('/users/:username', authMiddleware, adminOnly, (req, res) => {
    const { username } = req.params;
    if (username === 'zainulapixs' || username === 'Zainul14') {
        return res.status(403).json({ error: 'Cannot delete main admin accounts' });
    }
    
    dbLayer.db.run(`DELETE FROM users WHERE username = ?`, [username], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'User deleted' });
    });
});

// 7. BACKUP (Admin Only)
router.get('/backup', authMiddleware, adminOnly, (req, res) => {
    const dbPath = config.DB_PATH;
    if (fs.existsSync(dbPath)) {
        res.download(dbPath, `apixs_backup_${new Date().toISOString().split('T')[0]}.db`);
    } else {
        res.status(404).json({ error: 'Database file not found' });
    }
});

import fs from 'fs';

export default router;
