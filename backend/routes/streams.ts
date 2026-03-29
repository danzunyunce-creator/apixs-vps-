import express from 'express';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import * as dbLayer from '../database';
import { authMiddleware, AuthRequest, adminOnly } from '../middleware/auth';
import { StreamManager } from '../streamManager';
import { Server } from 'socket.io';
import config from '../config';

const router = express.Router();

export const createStreamRouter = (streamManager: StreamManager, io: Server) => {
    
    // 1. SYSTEM METRICS
    router.get('/metrics', authMiddleware, async (req: AuthRequest, res) => {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memUsage = Math.round((usedMem / totalMem) * 100);
            
            const ffmpegStatus = await new Promise<string>((resolve) => {
                exec(`"${config.FFMPEG_PATH}" -version`, (err) => resolve(err ? 'NOT_FOUND' : 'OK'));
            });

            const dbStatus = await new Promise<string>((resolve) => {
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
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // 2. LOGS
    router.get('/logs', authMiddleware, adminOnly, async (req, res) => {
        try {
            const logs = await dbLayer.getSystemLogs(100);
            res.json(logs);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // 3. ANALYTICS SUMMARY
    router.get('/analytics/summary', authMiddleware, async (req, res) => {
        try {
            dbLayer.db.get(`SELECT COUNT(*) as count, SUM(total_duration_seconds) as total_sec FROM stream_sessions`, [], (err, row: any) => {
                if (err) return res.status(500).json({ error: err.message });
                
                dbLayer.db.all(`SELECT * FROM stream_sessions ORDER BY start_time DESC LIMIT 20`, [], (err, history) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    dbLayer.db.all(`SELECT platform, COUNT(*) as count FROM streams GROUP BY platform`, [], (err, platforms) => {
                        dbLayer.db.all(`SELECT video_id, COUNT(*) as usage FROM streams GROUP BY video_id ORDER BY usage DESC LIMIT 5`, [], (err, topVideos) => {
                            res.json({
                                totalSessions: row.count || 0,
                                totalHours: ( (row.total_sec || 0) / 3600 ).toFixed(1),
                                history,
                                platforms: platforms || [],
                                topVideos: topVideos || []
                            });
                        });
                    });
                });
            });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // 4. DASHBOARD SUMMARY
    router.get('/dashboard/summary', authMiddleware, async (req, res) => {
        try {
            const result: any = {};
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            
            const ffmpegStatus = fs.existsSync(config.FFMPEG_PATH) ? 'OK' : 'NOT_FOUND';
            const dbStatus = await new Promise<string>((resolve) => {
                dbLayer.db.get('SELECT 1', (err) => resolve(err ? 'ERROR' : 'OK'));
            });

            result.metrics = {
                cpu: Math.floor(Math.random() * 20) + 5,
                memory: Math.round(((totalMem - freeMem) / totalMem) * 100),
                uptime: Math.floor(process.uptime()),
                health: { ffmpeg: ffmpegStatus, database: dbStatus }
            };

            const streams: any[] = await new Promise((res) => dbLayer.db.all(`SELECT status FROM streams`, [], (e, r) => res(r || [])));
            result.activeStreamsCount = streams.filter(s => s.status === 'MULAI' || s.status === 'LIVE').length;
            
            const stats: any = await new Promise((res) => dbLayer.db.get(`SELECT COUNT(*) as count FROM stream_sessions`, [], (e, r) => res(r || {})));
            result.totalSessions = stats.count || 0;

            result.recentLogs = await dbLayer.getSystemLogs(8);

            res.json(result);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // 5. LIST STREAMS
    router.get('/', authMiddleware, (req, res) => {
        dbLayer.db.all(`SELECT * FROM streams ORDER BY created_at DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            // Add real-time info from streamManager
            const enriched = rows.map((s: any) => {
                const active = streamManager.activeStreams.get(s.id);
                return { ...s, viewer_count: active?.viewers || 0 };
            });
            res.json(enriched);
        });
    });

    // 6. CREATE STREAM
    router.post('/', authMiddleware, (req: AuthRequest, res) => {
        const { title, playlist_path, platform, stream_key, rtmp_url } = req.body;
        const id = 'str-' + Date.now();
        const userId = req.user!.id;
        
        dbLayer.db.run(
            `INSERT INTO streams (id, title, playlist_path, platform, stream_key, rtmp_url, status, user_id) VALUES (?, ?, ?, ?, ?, ?, 'OFFLINE', ?)`,
            [id, title, playlist_path || '', platform || 'YOUTUBE', stream_key || '', rtmp_url || '', userId],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id, title, status: 'OFFLINE' });
            }
        );
    });

    // 7. START STREAM
    router.post('/:id/start', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            const row: any = await new Promise((resolve, reject) => {
                dbLayer.db.get(`SELECT * FROM streams WHERE id = ?`, [id], (err, r) => {
                    if (err) reject(err); else resolve(r);
                });
            });

            if (!row) return res.status(404).json({ error: 'Stream not found' });
            
            // Fetch all enabled destinations for this stream
            const destinations: any[] = await new Promise((res) => {
                dbLayer.db.all(`SELECT name, rtmp_url, stream_key FROM stream_destinations WHERE stream_id = ? AND is_enabled = 1`, [id], (e, r) => res(r || []));
            });

            const meta = {
                server_id: 'local-node',
                input_source: row.playlist_path,
                stream_key: row.stream_key,
                rtmp_url: row.rtmp_url,
                destinations: destinations.length > 0 ? destinations : [{ name: 'Default', rtmp_url: row.rtmp_url, stream_key: row.stream_key }],
                channel_name: row.title,
                youtube_account_id: row.youtube_account_id,
                is_concat: row.playlist_path.includes(','),
                loop_mode: 'repeat_all'
            };

            await streamManager.startStream(id as string, meta);
            dbLayer.db.run(`UPDATE streams SET status = 'RUNNING' WHERE id = ?`, [id]);
            res.json({ message: 'Stream starting...', id, platforms: meta.destinations.length });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // 7.1 MANAGE DESTINATIONS
    router.get('/:id/destinations', authMiddleware, (req, res) => {
        const { id } = req.params;
        dbLayer.db.all(`SELECT * FROM stream_destinations WHERE stream_id = ?`, [id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    router.post('/:id/destinations', authMiddleware, (req, res) => {
        const { id } = req.params;
        const { name, platform, rtmp_url, stream_key } = req.body;
        const destId = 'dest-' + Date.now();
        dbLayer.db.run(
            `INSERT INTO stream_destinations (id, stream_id, name, platform, rtmp_url, stream_key) VALUES (?, ?, ?, ?, ?, ?)`,
            [destId, id, name, platform || 'OTHER', rtmp_url, stream_key],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: destId, name, message: 'Destination added' });
            }
        );
    });

    router.delete('/destinations/:destId', authMiddleware, (req, res) => {
        const { destId } = req.params;
        dbLayer.db.run(`DELETE FROM stream_destinations WHERE id = ?`, [destId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Destination deleted' });
        });
    });

    // 8. STOP STREAM
    router.post('/:id/stop', authMiddleware, (req, res) => {
        const { id } = req.params;
        streamManager.stopStream(id as string);
        dbLayer.db.run(`UPDATE streams SET status = 'OFFLINE' WHERE id = ?`, [id]);
        res.json({ message: 'Stream stopped', id });
    });

    // 9. DELETE STREAM
    router.delete('/:id', authMiddleware, (req, res) => {
        const { id } = req.params;
        streamManager.stopStream(id as string);
        dbLayer.db.run(`DELETE FROM streams WHERE id = ?`, [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Stream deleted' });
        });
    });

    return router;
};

export default router;
