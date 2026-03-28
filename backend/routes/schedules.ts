import express from 'express';
import * as dbLayer from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { StreamManager } from '../streamManager';
import config from '../config';
import { Server } from 'socket.io';

const router = express.Router();

export const createScheduleRouter = (streamManager: StreamManager, io: Server) => {
    
    // 1. LIST SCHEDULES
    router.get('/', authMiddleware, (req: AuthRequest, res) => {
        const userId = req.user!.id;
        dbLayer.db.all(`SELECT * FROM schedules WHERE user_id = ? OR user_id IS NULL ORDER BY start_time ASC`, [userId], (err, rows: any[]) => {
            if (err) return res.status(500).json({ error: err.message });
            const mapped = rows.map(r => ({ ...r, start: r.start_time, end: r.end_time }));
            res.json(mapped);
        });
    });

    // 2. CREATE SCHEDULE
    router.post('/', authMiddleware, (req: AuthRequest, res) => {
        const { name, start, end, stream_id, is_recurring, stream_key, playlist_path } = req.body;
        const userId = req.user!.id;
        const id = 'sched-' + Date.now();
        
        dbLayer.db.run(
            `INSERT INTO schedules (id, name, start_time, end_time, stream_id, status, is_recurring, stream_key, playlist_path, user_id) 
             VALUES (?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?)`,
            [id, name, start, end, stream_id, 'SCHEDULED', is_recurring ? 1 : 0, stream_key || '', playlist_path || '', userId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id, message: 'Jadwal berhasil dibuat!', status: 'SCHEDULED' });
            }
        );
    });

    // 3. UPDATE SCHEDULE
    router.put('/:id', authMiddleware, (req, res) => {
        const { name, start, end, stream_id, is_recurring, stream_key, playlist_path } = req.body;
        const { id } = req.params;

        dbLayer.db.run(
            `UPDATE schedules SET name = ?, start_time = ?, end_time = ?, stream_id = ?, is_recurring = ?, stream_key = ?, playlist_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [name, start, end, stream_id, is_recurring ? 1 : 0, stream_key, playlist_path, id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Schedule updated' });
            }
        );
    });

    // 4. UPDATE STATUS (START/STOP)
    router.put('/:id/status', authMiddleware, (req, res) => {
        const { status } = req.body;
        dbLayer.db.run(`UPDATE schedules SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
             if (err) return res.status(500).json({ error: err.message });
             
             if (status === 'RUNNING') {
                 dbLayer.db.get(`SELECT * FROM schedules WHERE id = ?`, [req.params.id], (err, sched: any) => {
                     if (sched && !streamManager.activeStreams.has(`sched-${sched.id}`)) {
                         const meta = {
                             server_id: 'manual-start',
                             input_source: sched.playlist_path || 'testsrc=size=1280x720',
                             rtmp_url: config.RTMP_BASE_URL,
                             stream_key: sched.stream_key || 'testkey',
                             channel_name: sched.name,
                             niche: sched.sourceName || sched.name,
                             is_concat: !!sched.playlist_path,
                             loop_mode: 'repeat_all'
                         };
                         streamManager.startStream(`sched-${sched.id}`, meta);
                     }
                 });
             } else if (status === 'SCHEDULED' || status === 'COMPLETED') {
                 streamManager.stopStream(`sched-${req.params.id}`);
             }
             
             io.emit('stream_status_change', { id: `sched-${req.params.id}`, status: status === 'RUNNING' ? 'MULAI' : 'STOP' });
             res.json({ message: 'Status updated', status });
        });
    });

    // 5. DELETE SCHEDULE
    router.delete('/:id', authMiddleware, (req, res) => {
        dbLayer.db.run(`DELETE FROM schedules WHERE id = ?`, [req.params.id], function(err) {
             if (err) return res.status(500).json({ error: err.message });
             res.json({ message: 'Schedule deleted' });
        });
    });

    // 6. BATCH UPDATE
    router.put('/batch/status', authMiddleware, async (req, res) => {
        const { ids, status } = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ error: 'IDs must be an array' });

        try {
            const placeholders = ids.map(() => '?').join(',');
            await new Promise((resolve, reject) => {
                dbLayer.db.run(`UPDATE schedules SET status = ? WHERE id IN (${placeholders})`, [status, ...ids], (err) => {
                    if (err) reject(err); else resolve(true);
                });
            });

            for (const id of ids) {
                if (status === 'RUNNING') {
                    dbLayer.db.get(`SELECT * FROM schedules WHERE id = ?`, [id], (err, sched: any) => {
                        if (sched && !streamManager.activeStreams.has(`sched-${sched.id}`)) {
                            const meta = {
                                server_id: 'bulk-start',
                                input_source: sched.playlist_path || 'testsrc=size=1280x720',
                                rtmp_url: config.RTMP_BASE_URL,
                                stream_key: sched.stream_key || 'testkey',
                                channel_name: sched.name,
                                niche: sched.sourceName || sched.name,
                                is_concat: !!sched.playlist_path,
                                loop_mode: 'repeat_all'
                            };
                            streamManager.startStream(`sched-${id}`, meta);
                        }
                    });
                } else if (status === 'SCHEDULED' || status === 'COMPLETED') {
                    streamManager.stopStream(`sched-${id}`);
                }
                io.emit('stream_status_change', { id: `sched-${id}`, status: status === 'RUNNING' ? 'MULAI' : 'STOP' });
            }

            res.json({ message: 'Batch update successful' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};

export default router;
