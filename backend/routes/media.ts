import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import * as dbLayer from '../database';
import config from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Server } from 'socket.io';
import { MediaProcessor } from '../utils/mediaProcessor';

const router = express.Router();
const UPLOADS_DIR = config.UPLOADS_DIR;

export default function createMediaRouter(io: Server) {
    const mediaProcessor = new MediaProcessor(io);

// Multer Config
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `vid_${Date.now()}_${file.originalname}`)
});
const uploadVideo = multer({ storage: videoStorage, limits: { fileSize: 5000 * 1024 * 1024 } });

// --- UTILS ---
const getMediaMetadata = (filePath: string): Promise<any> => {
    return new Promise((resolve) => {
        exec(`ffprobe -v error -select_streams v:0 -show_entries format=duration,bit_rate:stream=width,height,avg_frame_rate -of json "${filePath}"`, (err, stdout) => {
            if (err) return resolve({});
            try {
                const data = JSON.parse(stdout);
                const fmt = data.format || {};
                const st = (data.streams && data.streams[0]) || {};
                resolve({
                    duration: parseFloat(fmt.duration || 0),
                    resolution: st.width ? `${st.width}x${st.height}` : null,
                    bitrate: parseInt(fmt.bit_rate || 0),
                    fps: st.avg_frame_rate || null
                });
            } catch (e) { resolve({}); }
        });
    });
};

const extractVideoThumb = (videoPath: string, thumbPath: string): Promise<boolean> => {
    return new Promise((resolve) => {
        exec(`ffmpeg -i "${videoPath}" -ss 00:00:02 -vframes 1 -s 320x180 "${thumbPath}" -y`, (err) => {
            resolve(!err);
        });
    });
};

// --- ROUTES ---

// 1. LIST VIDEOS
router.get('/videos', authMiddleware, (req: AuthRequest, res) => {
    const { search, category, sort } = req.query;
    const user = req.user!;
    
    let sql = `SELECT * FROM videos`;
    const params: any[] = [];

    if (user.user_role !== 'admin') {
        sql += ` WHERE (user_id = ? OR user_id IS NULL)`;
        params.push(user.id);
    } else {
        sql += ` WHERE (1=1)`;
    }

    if (search) {
        sql += ` AND title LIKE ?`;
        params.push(`%${search}%`);
    }
    if (category) {
        sql += ` AND category = ?`;
        params.push(category);
    }

    if (sort === 'size') sql += ` ORDER BY file_size DESC`;
    else if (sort === 'duration') sql += ` ORDER BY duration DESC`;
    else sql += ` ORDER BY upload_date DESC`;

    dbLayer.db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. UPLOAD VIDEOS
router.post('/videos/upload', authMiddleware, uploadVideo.array('videos', 10), async (req: AuthRequest, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const { category, tags } = req.body;
    const userId = req.user!.id;
    const results: any[] = [];

    for (const file of files) {
        const id = 'vid-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const filepath = file.path.replace(/\\/g, '/');
        const thumbName = `thumb_${id}.jpg`;
        const thumbPath = path.join(UPLOADS_DIR, thumbName).replace(/\\/g, '/');
        
        const meta = await getMediaMetadata(file.path);
        await extractVideoThumb(file.path, thumbPath);

        await new Promise((resolve) => {
            dbLayer.db.run(
                `INSERT INTO videos (id, title, filepath, thumbnail_path, file_size, duration, resolution, bitrate, fps, category, tags, user_id, upload_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [id, file.originalname, filepath, thumbName, file.size, meta.duration, meta.resolution, meta.bitrate, meta.fps, category || 'Uncategorized', tags || '', userId],
                function(err) {
                    results.push({ id, title: file.originalname, success: !err });
                    resolve(null);
                }
            );
        });
    }
    
    res.json({ message: 'Upload process completed', results });
});

// 3. PROCESS VIDEO (OPTIMIZE)
router.post('/videos/:id/process', authMiddleware, async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { targetRes } = req.body; // e.g. 720, 1080
    
    dbLayer.db.get(`SELECT filepath FROM videos WHERE id = ?`, [id], async (err, row: any) => {
        if (!row) return res.status(404).json({ error: 'Video not found' });
        
        try {
            const input = row.filepath;
            // The process is handled in background by mediaProcessor
            const resStr = String(targetRes || '720');
            mediaProcessor.compressVideo(id as string, input as string, resStr)
                .catch(err => console.error(`[Process Error] ${id}:`, err));

            res.json({ message: 'Optimization started in background', id });
        } catch (err: any) {
            res.status(500).json({ error: 'Failed to start processing: ' + err.message });
        }
    });
});

// 4. BULK DELETE
router.post('/videos/bulk-delete', authMiddleware, async (req: AuthRequest, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'IDs must be an array' });
    
    try {
        for (const id of ids) {
            await new Promise<void>((resolve) => {
                dbLayer.db.get(`SELECT filepath, thumbnail_path FROM videos WHERE id = ?`, [id], (err, row: any) => {
                    if (row) {
                        try {
                            if (fs.existsSync(row.filepath)) fs.unlinkSync(row.filepath);
                            if (row.thumbnail_path) {
                                const fullThumb = path.join(UPLOADS_DIR, row.thumbnail_path);
                                if (fs.existsSync(fullThumb)) fs.unlinkSync(fullThumb);
                            }
                        } catch (e) {}
                    }
                    dbLayer.db.run(`DELETE FROM videos WHERE id = ?`, [id], () => resolve());
                });
            });
        }
        res.json({ message: `${ids.length} files deleted successfully` });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 5. UPDATE METADATA
router.put('/videos/:id', authMiddleware, (req: AuthRequest, res) => {
    const { id } = req.params;
    const { title, category } = req.body;
    const user = req.user!;
    
    let sql = `UPDATE videos SET title = ?, category = ? WHERE id = ?`;
    const params = [title, category, id];
    
    if (user.user_role !== 'admin') {
        sql += ` AND user_id = ?`;
        params.push(user.id);
    }

    dbLayer.db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(403).json({ error: 'Akses ditolak atau media tidak ditemukan.' });
        res.json({ message: 'Media updated' });
    });
});

// 6. DELETE VIDEO
router.delete('/videos/:id', authMiddleware, (req: AuthRequest, res) => {
    dbLayer.db.get(`SELECT filepath, thumbnail_path FROM videos WHERE id = ?`, [req.params.id], (err, row: any) => {
        if (row) {
            try {
                if (fs.existsSync(row.filepath)) fs.unlinkSync(row.filepath);
                if (row.thumbnail_path) {
                    const fullThumb = path.join(UPLOADS_DIR, row.thumbnail_path);
                    if (fs.existsSync(fullThumb)) fs.unlinkSync(fullThumb);
                }
            } catch (e) {}
        }
        dbLayer.db.run(`DELETE FROM videos WHERE id = ?`, [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Video deleted' });
        });
    });
});

// 7. PLAYLISTS
router.get('/playlists', authMiddleware, (req: AuthRequest, res) => {
    dbLayer.db.all(`SELECT * FROM playlists ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.post('/playlists', authMiddleware, (req: AuthRequest, res) => {
    const { name, clips } = req.body;
    const userId = req.user!.id;
    const id = 'pl-' + Date.now();
    dbLayer.db.run(
        `INSERT INTO playlists (id, name, clips_json, user_id) VALUES (?, ?, ?, ?)`,
        [id, name, JSON.stringify(clips || []), userId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Playlist created', id });
        }
    );
});

    return router;
}
