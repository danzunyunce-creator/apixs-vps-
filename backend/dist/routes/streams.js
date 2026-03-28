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
exports.createStreamRouter = void 0;
const express_1 = __importDefault(require("express"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const dbLayer = __importStar(require("../database"));
const auth_1 = require("../middleware/auth");
const config_1 = __importDefault(require("../config"));
const router = express_1.default.Router();
const createStreamRouter = (streamManager, io) => {
    // 1. SYSTEM METRICS
    router.get('/metrics', auth_1.authMiddleware, async (req, res) => {
        try {
            const totalMem = os_1.default.totalmem();
            const freeMem = os_1.default.freemem();
            const usedMem = totalMem - freeMem;
            const memUsage = Math.round((usedMem / totalMem) * 100);
            const ffmpegStatus = await new Promise((resolve) => {
                (0, child_process_1.exec)(`"${config_1.default.FFMPEG_PATH}" -version`, (err) => resolve(err ? 'NOT_FOUND' : 'OK'));
            });
            const dbStatus = await new Promise((resolve) => {
                dbLayer.db.get('SELECT 1', (err) => resolve(err ? 'ERROR' : 'OK'));
            });
            res.json({
                cpu: Math.floor(Math.random() * 20) + 5,
                memory: memUsage,
                activeProcesses: streamManager.activeStreams.size,
                ffmpegStatus,
                dbStatus,
                nodeVersion: process.version,
                platform: process.platform,
                uptime: Math.floor(process.uptime())
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 2. LOGS
    router.get('/logs', auth_1.authMiddleware, auth_1.adminOnly, async (req, res) => {
        try {
            const logs = await dbLayer.getSystemLogs(100);
            res.json(logs);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 3. ANALYTICS SUMMARY
    router.get('/analytics/summary', auth_1.authMiddleware, async (req, res) => {
        try {
            dbLayer.db.get(`SELECT COUNT(*) as count, SUM(total_duration_seconds) as total_sec FROM stream_sessions`, [], (err, row) => {
                if (err)
                    return res.status(500).json({ error: err.message });
                dbLayer.db.all(`SELECT * FROM stream_sessions ORDER BY start_time DESC LIMIT 20`, [], (err, history) => {
                    if (err)
                        return res.status(500).json({ error: err.message });
                    dbLayer.db.all(`SELECT platform, COUNT(*) as count FROM streams GROUP BY platform`, [], (err, platforms) => {
                        dbLayer.db.all(`SELECT video_id, COUNT(*) as usage FROM streams GROUP BY video_id ORDER BY usage DESC LIMIT 5`, [], (err, topVideos) => {
                            res.json({
                                totalSessions: row.count || 0,
                                totalHours: ((row.total_sec || 0) / 3600).toFixed(1),
                                history,
                                platforms: platforms || [],
                                topVideos: topVideos || []
                            });
                        });
                    });
                });
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 4. DASHBOARD SUMMARY
    router.get('/dashboard/summary', auth_1.authMiddleware, async (req, res) => {
        try {
            const result = {};
            const totalMem = os_1.default.totalmem();
            const freeMem = os_1.default.freemem();
            const ffmpegStatus = fs_1.default.existsSync(config_1.default.FFMPEG_PATH) ? 'OK' : 'NOT_FOUND';
            const dbStatus = await new Promise((resolve) => {
                dbLayer.db.get('SELECT 1', (err) => resolve(err ? 'ERROR' : 'OK'));
            });
            result.metrics = {
                cpu: Math.floor(Math.random() * 20) + 5,
                memory: Math.round(((totalMem - freeMem) / totalMem) * 100),
                uptime: Math.floor(process.uptime()),
                health: { ffmpeg: ffmpegStatus, database: dbStatus }
            };
            const streams = await new Promise((res) => dbLayer.db.all(`SELECT status FROM streams`, [], (e, r) => res(r || [])));
            result.activeStreamsCount = streams.filter(s => s.status === 'MULAI' || s.status === 'LIVE').length;
            const stats = await new Promise((res) => dbLayer.db.get(`SELECT COUNT(*) as count FROM stream_sessions`, [], (e, r) => res(r || {})));
            result.totalSessions = stats.count || 0;
            result.recentLogs = await dbLayer.getSystemLogs(8);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 5. LIST STREAMS
    router.get('/', auth_1.authMiddleware, (req, res) => {
        dbLayer.db.all(`SELECT * FROM streams ORDER BY created_at DESC`, [], (err, rows) => {
            if (err)
                return res.status(500).json({ error: err.message });
            // Add real-time info from streamManager
            const enriched = rows.map((s) => {
                const active = streamManager.activeStreams.get(s.id);
                return { ...s, viewer_count: active?.viewers || 0 };
            });
            res.json(enriched);
        });
    });
    // 6. CREATE STREAM
    router.post('/', auth_1.authMiddleware, (req, res) => {
        const { title, playlist_path, platform, stream_key, rtmp_url } = req.body;
        const id = 'str-' + Date.now();
        const userId = req.user.id;
        dbLayer.db.run(`INSERT INTO streams (id, title, playlist_path, platform, stream_key, rtmp_url, status, user_id) VALUES (?, ?, ?, ?, ?, ?, 'OFFLINE', ?)`, [id, title, playlist_path || '', platform || 'YOUTUBE', stream_key || '', rtmp_url || '', userId], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json({ id, title, status: 'OFFLINE' });
        });
    });
    // 7. START STREAM
    router.post('/:id/start', auth_1.authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            const row = await new Promise((resolve, reject) => {
                dbLayer.db.get(`SELECT * FROM streams WHERE id = ?`, [id], (err, r) => {
                    if (err)
                        reject(err);
                    else
                        resolve(r);
                });
            });
            if (!row)
                return res.status(404).json({ error: 'Stream not found' });
            const meta = {
                server_id: 'local-node',
                input_source: row.playlist_path,
                stream_key: row.stream_key,
                rtmp_url: row.rtmp_url,
                channel_name: row.title,
                youtube_account_id: row.youtube_account_id,
                is_concat: row.playlist_path.includes(','),
                loop_mode: 'repeat_all'
            };
            await streamManager.startStream(id, meta);
            dbLayer.db.run(`UPDATE streams SET status = 'RUNNING' WHERE id = ?`, [id]);
            res.json({ message: 'Stream starting...', id });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 8. STOP STREAM
    router.post('/:id/stop', auth_1.authMiddleware, (req, res) => {
        const { id } = req.params;
        streamManager.stopStream(id);
        dbLayer.db.run(`UPDATE streams SET status = 'OFFLINE' WHERE id = ?`, [id]);
        res.json({ message: 'Stream stopped', id });
    });
    // 9. DELETE STREAM
    router.delete('/:id', auth_1.authMiddleware, (req, res) => {
        const { id } = req.params;
        streamManager.stopStream(id);
        dbLayer.db.run(`DELETE FROM streams WHERE id = ?`, [id], (err) => {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json({ message: 'Stream deleted' });
        });
    });
    return router;
};
exports.createStreamRouter = createStreamRouter;
exports.default = router;
