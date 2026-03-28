"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbLayer = __importStar(require("../database"));
const config_1 = __importDefault(require("../config"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// 1. LOGIN
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    dbLayer.db.get(`SELECT id, username, password as dbPass, user_role, status FROM users WHERE username = ?`, [username], (err, row) => {
        if (err)
            return res.status(500).json({ error: err.message });
        if (!row)
            return res.status(401).json({ error: 'Username atau password salah.' });
        let isMatch = false;
        let isLegacy = false;
        if (row.dbPass.startsWith('$2b$')) {
            isMatch = bcrypt_1.default.compareSync(password, row.dbPass);
        }
        else {
            isMatch = (password === row.dbPass);
            isLegacy = true;
        }
        if (!isMatch)
            return res.status(401).json({ error: 'Username atau password salah.' });
        if (isLegacy) {
            dbLayer.db.run(`UPDATE users SET password = ? WHERE id = ?`, [bcrypt_1.default.hashSync(password, 10), row.id]);
        }
        const safeUser = { id: row.id, username: row.username, user_role: row.user_role, status: row.status };
        // GENERATE JWT
        const token = jsonwebtoken_1.default.sign({ id: row.id, username: row.username, role: row.user_role }, config_1.default.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: safeUser });
    });
});
// 2. REGISTER (Default user-mode closed by admin config)
router.post('/register', (req, res) => {
    const { username, password } = req.body;
    dbLayer.db.get(`SELECT value FROM app_config WHERE key = 'register_enabled'`, [], (err, row) => {
        const isEnabled = row && row.value === 'true';
        if (!isEnabled) {
            return res.status(403).json({ error: 'Pendaftaran mandiri ditutup oleh Admin.' });
        }
        const id = 'user-' + Date.now();
        const hash = bcrypt_1.default.hashSync(password, 10);
        dbLayer.db.run(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`, [id, username, hash], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            const token = jsonwebtoken_1.default.sign({ id, username, role: 'user' }, config_1.default.JWT_SECRET, { expiresIn: '7d' });
            res.json({ message: 'User registered successfully', userId: id, token });
        });
    });
});
// 3. ADMIN: ADD USER
router.post('/users', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    const { username, password, role } = req.body;
    const id = 'user-' + Date.now();
    const hash = bcrypt_1.default.hashSync(password, 10);
    dbLayer.db.run(`INSERT INTO users (id, username, password, user_role) VALUES (?, ?, ?, ?)`, [id, username, hash, role || 'user'], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ message: 'User added by admin', userId: id });
    });
});
// 4. ADMIN: LIST USERS
router.get('/users', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    dbLayer.db.all(`SELECT id, username, user_role, status, created_at FROM users ORDER BY created_at DESC`, [], (err, rows) => {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
// 5. ADMIN: UPDATE PASSWORD
router.put('/users/:username/password', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    const hash = bcrypt_1.default.hashSync(newPassword, 10);
    dbLayer.db.run(`UPDATE users SET password = ? WHERE username = ?`, [hash, username], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        if (this.changes === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Password updated successfully' });
    });
});
// 6. ADMIN: DELETE USER
router.delete('/users/:username', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    const { username } = req.params;
    if (username === 'zainulapixs' || username === 'Zainul14') {
        return res.status(403).json({ error: 'Cannot delete main admin accounts' });
    }
    dbLayer.db.run(`DELETE FROM users WHERE username = ?`, [username], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ message: 'User deleted' });
    });
});
// 7. BACKUP (Admin Only)
router.get('/backup', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    const dbPath = config_1.default.DB_PATH;
    if (fs_1.default.existsSync(dbPath)) {
        res.download(dbPath, `apixs_backup_${new Date().toISOString().split('T')[0]}.db`);
    }
    else {
        res.status(404).json({ error: 'Database file not found' });
    }
});
const fs_1 = __importDefault(require("fs"));
exports.default = router;
