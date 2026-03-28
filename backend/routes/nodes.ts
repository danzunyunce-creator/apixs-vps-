import express from 'express';
import * as dbLayer from '../database';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = express.Router();

// 1. GET ALL NODES
router.get('/', authMiddleware, (req, res) => {
    dbLayer.db.all(`SELECT * FROM nodes ORDER BY name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. REGISTER/UPDATE NODE
router.post('/', authMiddleware, adminOnly, (req, res) => {
    const { id, name, url } = req.body;
    const nodeId = id || 'node-' + Date.now();
    
    dbLayer.db.run(
        `INSERT INTO nodes (id, name, url, status) VALUES (?, ?, ?, 'ONLINE')
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, last_seen=CURRENT_TIMESTAMP`,
        [nodeId, name, url],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: nodeId, message: 'Node registered/updated' });
        }
    );
});

// 3. UPDATE LOAD (For VPS reporting)
router.post('/:id/report', (req, res) => {
    const { load, status } = req.body;
    dbLayer.db.run(
        `UPDATE nodes SET load = ?, status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
        [load, status || 'ONLINE', req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Report received' });
        }
    );
});

// 4. DELETE NODE
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
    dbLayer.db.run(`DELETE FROM nodes WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Node deleted' });
    });
});

export default router;
