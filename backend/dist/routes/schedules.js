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
exports.createScheduleRouter = void 0;
const express_1 = __importDefault(require("express"));
const dbLayer = __importStar(require("../database"));
const auth_1 = require("../middleware/auth");
const config_1 = __importDefault(require("../config"));
const router = express_1.default.Router();
const createScheduleRouter = (streamManager, io) => {
    // 1. LIST SCHEDULES
    router.get('/', auth_1.authMiddleware, (req, res) => {
        const userId = req.user.id;
        dbLayer.db.all(`SELECT * FROM schedules WHERE user_id = ? OR user_id IS NULL ORDER BY start_time ASC`, [userId], (err, rows) => {
            if (err)
                return res.status(500).json({ error: err.message });
            const mapped = rows.map(r => ({ ...r, start: r.start_time, end: r.end_time }));
            res.json(mapped);
        });
    });
    // 2. CREATE SCHEDULE
    router.post('/', auth_1.authMiddleware, (req, res) => {
        const { name, start, end, stream_id, is_recurring, stream_key, playlist_path } = req.body;
        const userId = req.user.id;
        const id = 'sched-' + Date.now();
        dbLayer.db.run(`INSERT INTO schedules (id, name, start_time, end_time, stream_id, status, is_recurring, stream_key, playlist_path, user_id) 
             VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?)`, [id, name, start, end, stream_id, 'SCHEDULED', is_recurring ? 1 : 0, stream_key || '', playlist_path || '', userId], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json({ id, message: 'Jadwal berhasil dibuat!', status: 'SCHEDULED' });
        });
    });
    // 3. UPDATE SCHEDULE
    router.put('/:id', auth_1.authMiddleware, (req, res) => {
        const { name, start, end, stream_id, is_recurring, stream_key, playlist_path } = req.body;
        const { id } = req.params;
        dbLayer.db.run(`UPDATE schedules SET name = ?, start_time = ?, end_time = ?, stream_id = ?, is_recurring = ?, stream_key = ?, playlist_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [name, start, end, stream_id, is_recurring ? 1 : 0, stream_key, playlist_path, id], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json({ message: 'Schedule updated' });
        });
    });
    // 4. UPDATE STATUS (START/STOP)
    router.put('/:id/status', auth_1.authMiddleware, (req, res) => {
        const { status } = req.body;
        dbLayer.db.run(`UPDATE schedules SET status = ? WHERE id = ?`, [status, req.params.id], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            if (status === 'RUNNING') {
                dbLayer.db.get(`SELECT * FROM schedules WHERE id = ?`, [req.params.id], (err, sched) => {
                    if (sched && !streamManager.activeStreams.has(`sched-${sched.id}`)) {
                        const meta = {
                            server_id: 'manual-start',
                            input_source: sched.playlist_path || 'testsrc=size=1280x720',
                            rtmp_url: config_1.default.RTMP_BASE_URL,
                            stream_key: sched.stream_key || 'testkey',
                            channel_name: sched.name,
                            niche: sched.sourceName || sched.name,
                            is_concat: !!sched.playlist_path,
                            loop_mode: 'repeat_all'
                        };
                        streamManager.startStream(`sched-${sched.id}`, meta);
                    }
                });
            }
            else if (status === 'SCHEDULED' || status === 'COMPLETED') {
                streamManager.stopStream(`sched-${req.params.id}`);
            }
            io.emit('stream_status_change', { id: `sched-${req.params.id}`, status: status === 'RUNNING' ? 'MULAI' : 'STOP' });
            res.json({ message: 'Status updated', status });
        });
    });
    // 5. DELETE SCHEDULE
    router.delete('/:id', auth_1.authMiddleware, (req, res) => {
        dbLayer.db.run(`DELETE FROM schedules WHERE id = ?`, [req.params.id], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json({ message: 'Schedule deleted' });
        });
    });
    // 6. BATCH UPDATE
    router.put('/batch/status', auth_1.authMiddleware, async (req, res) => {
        const { ids, status } = req.body;
        if (!Array.isArray(ids))
            return res.status(400).json({ error: 'IDs must be an array' });
        try {
            const placeholders = ids.map(() => '?').join(',');
            await new Promise((resolve, reject) => {
                dbLayer.db.run(`UPDATE schedules SET status = ? WHERE id IN (${placeholders})`, [status, ...ids], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve(true);
                });
            });
            for (const id of ids) {
                if (status === 'RUNNING') {
                    dbLayer.db.get(`SELECT * FROM schedules WHERE id = ?`, [id], (err, sched) => {
                        if (sched && !streamManager.activeStreams.has(`sched-${sched.id}`)) {
                            const meta = {
                                server_id: 'bulk-start',
                                input_source: sched.playlist_path || 'testsrc=size=1280x720',
                                rtmp_url: config_1.default.RTMP_BASE_URL,
                                stream_key: sched.stream_key || 'testkey',
                                channel_name: sched.name,
                                niche: sched.sourceName || sched.name,
                                is_concat: !!sched.playlist_path,
                                loop_mode: 'repeat_all'
                            };
                            streamManager.startStream(`sched-${id}`, meta);
                        }
                    });
                }
                else if (status === 'SCHEDULED' || status === 'COMPLETED') {
                    streamManager.stopStream(`sched-${id}`);
                }
                io.emit('stream_status_change', { id: `sched-${id}`, status: status === 'RUNNING' ? 'MULAI' : 'STOP' });
            }
            res.json({ message: 'Batch update successful' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    return router;
};
exports.createScheduleRouter = createScheduleRouter;
exports.default = router;
