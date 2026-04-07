import express from 'express';
import * as dbLayer from '../database';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { CryptoProvider } from '../utils/cryptoProvider';

const router = express.Router();

// 1. GET PUBLIC CONFIG (No Auth)
router.get('/public', (req, res) => {
    dbLayer.db.all(`SELECT key, value FROM app_config WHERE key = 'register_enabled'`, [], (err, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        const cfg: any = {};
        rows.forEach(r => { cfg[r.key] = r.value; });
        res.json(cfg);
    });
});

// 2. GET ALL CONFIG (As Flat Object)
router.get('/', authMiddleware, adminOnly, (req, res) => {
    dbLayer.db.all(`SELECT * FROM app_config ORDER BY key ASC`, [], (err, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        const cfg: any = {};
        const sensitiveKeys = ['yt_client_id', 'yt_client_secret', 'openai_api_key'];
        rows.forEach(r => { 
            if (sensitiveKeys.includes(r.key) && r.value) {
                // Return masked value to UI for security
                cfg[r.key] = '••••••••••••••••';
            } else {
                cfg[r.key] = r.value; 
            }
        });
        res.json(cfg);
    });
});

// 3. BULK UPDATE CONFIG (Accepts Flat Object)
router.put('/', authMiddleware, adminOnly, async (req, res) => {
    const configData = req.body;
    try {
        const keys = Object.keys(configData);
        const sensitiveKeys = ['yt_client_id', 'yt_client_secret', 'openai_api_key'];
        
        for (const key of keys) {
            let val = configData[key];
            if (sensitiveKeys.includes(key) && val && val !== '••••••••••••••••') {
                val = CryptoProvider.encrypt(val);
            } else if (sensitiveKeys.includes(key) && val === '••••••••••••••••') {
                // If UI returns masked value, don't overwrite the existing encrypted value
                continue; 
            }

            await new Promise((resolve, reject) => {
                dbLayer.db.run(
                    `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
                    [key, val],
                    (err) => err ? reject(err) : resolve(true)
                );
            });
        }
        res.json({ message: 'Settings updated successfully' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 3. SINGLE UPDATE CONFIG
router.put('/:key', authMiddleware, adminOnly, (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    dbLayer.db.run(
        `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: `Setting ${key} updated` });
        }
    );
});

export default router;
