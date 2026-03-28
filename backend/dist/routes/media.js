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
exports.default = createMediaRouter;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const dbLayer = __importStar(require("../database"));
const config_1 = __importDefault(require("../config"));
const auth_1 = require("../middleware/auth");
const mediaProcessor_1 = require("../utils/mediaProcessor");
const router = express_1.default.Router();
const UPLOADS_DIR = config_1.default.UPLOADS_DIR;
function createMediaRouter(io) {
    const mediaProcessor = new mediaProcessor_1.MediaProcessor(io);
    // Multer Config
    const videoStorage = multer_1.default.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR),
        filename: (req, file, cb) => cb(null, `vid_${Date.now()}_${file.originalname}`)
    });
    const uploadVideo = (0, multer_1.default)({ storage: videoStorage, limits: { fileSize: 5000 * 1024 * 1024 } });
    // --- UTILS ---
    const getMediaMetadata = (filePath) => {
        return new Promise((resolve) => {
            (0, child_process_1.exec)(`ffprobe -v error -select_streams v:0 -show_entries format=duration,bit_rate:stream=width,height,avg_frame_rate -of json "${filePath}"`, (err, stdout) => {
                if (err)
                    return resolve({});
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
                }
                catch (e) {
                    resolve({});
                }
            });
        });
    };
    const extractVideoThumb = (videoPath, thumbPath) => {
        return new Promise((resolve) => {
            (0, child_process_1.exec)(`ffmpeg -i "${videoPath}" -ss 00:00:02 -vframes 1 -s 320x180 "${thumbPath}" -y`, (err) => {
                resolve(!err);
            });
        });
    };
    // --- ROUTES ---
    // 1. LIST VIDEOS
    router.get('/videos', auth_1.authMiddleware, (req, res) => {
        const { search, category, sort } = req.query;
        const user = req.user;
        let sql = `SELECT * FROM videos`;
        const params = [];
        if (user.user_role !== 'admin') {
            sql += ` WHERE (user_id = ? OR user_id IS NULL)`;
            params.push(user.id);
        }
        else {
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
        if (sort === 'size')
            sql += ` ORDER BY file_size DESC`;
        else if (sort === 'duration')
            sql += ` ORDER BY duration DESC`;
        else
            sql += ` ORDER BY upload_date DESC`;
        dbLayer.db.all(sql, params, (err, rows) => {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
    // 2. UPLOAD VIDEOS
    router.post('/videos/upload', auth_1.authMiddleware, uploadVideo.array('videos', 10), async (req, res) => {
        const files = req.files;
        if (!files || files.length === 0)
            return res.status(400).json({ error: 'No files uploaded' });
        const { category, tags } = req.body;
        const userId = req.user.id;
        const results = [];
        for (const file of files) {
            const id = 'vid-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const filepath = file.path.replace(/\\/g, '/');
            const thumbName = `thumb_${id}.jpg`;
            const thumbPath = path_1.default.join(UPLOADS_DIR, thumbName).replace(/\\/g, '/');
            const meta = await getMediaMetadata(file.path);
            await extractVideoThumb(file.path, thumbPath);
            await new Promise((resolve) => {
                dbLayer.db.run(`INSERT INTO videos (id, title, filepath, thumbnail_path, file_size, duration, resolution, bitrate, fps, category, tags, user_id, upload_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [id, file.originalname, filepath, thumbName, file.size, meta.duration, meta.resolution, meta.bitrate, meta.fps, category || 'Uncategorized', tags || '', userId], function (err) {
                    results.push({ id, title: file.originalname, success: !err });
                    resolve(null);
                });
            });
        }
        res.json({ message: 'Upload process completed', results });
    });
    // 3. PROCESS VIDEO (OPTIMIZE)
    router.post('/videos/:id/process', auth_1.authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { targetRes } = req.body; // e.g. 720, 1080
        dbLayer.db.get(`SELECT filepath FROM videos WHERE id = ?`, [id], async (err, row) => {
            if (!row)
                return res.status(404).json({ error: 'Video not found' });
            try {
                const input = row.filepath;
                // The process is handled in background by mediaProcessor
                const resStr = String(targetRes || '720');
                mediaProcessor.compressVideo(id, input, resStr)
                    .catch(err => console.error(`[Process Error] ${id}:`, err));
                res.json({ message: 'Optimization started in background', id });
            }
            catch (err) {
                res.status(500).json({ error: 'Failed to start processing: ' + err.message });
            }
        });
    });
    // 4. BULK DELETE
    router.post('/videos/bulk-delete', auth_1.authMiddleware, async (req, res) => {
        const { ids } = req.body;
        if (!Array.isArray(ids))
            return res.status(400).json({ error: 'IDs must be an array' });
        try {
            for (const id of ids) {
                await new Promise((resolve) => {
                    dbLayer.db.get(`SELECT filepath, thumbnail_path FROM videos WHERE id = ?`, [id], (err, row) => {
                        if (row) {
                            try {
                                if (fs_1.default.existsSync(row.filepath))
                                    fs_1.default.unlinkSync(row.filepath);
                                if (row.thumbnail_path) {
                                    const fullThumb = path_1.default.join(UPLOADS_DIR, row.thumbnail_path);
                                    if (fs_1.default.existsSync(fullThumb))
                                        fs_1.default.unlinkSync(fullThumb);
                                }
                            }
                            catch (e) { }
                        }
                        dbLayer.db.run(`DELETE FROM videos WHERE id = ?`, [id], () => resolve());
                    });
                });
            }
            res.json({ message: `${ids.length} files deleted successfully` });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // 5. UPDATE METADATA
    router.put('/videos/:id', auth_1.authMiddleware, (req, res) => {
        const { id } = req.params;
        const { title, category } = req.body;
        const user = req.user;
        let sql = `UPDATE videos SET title = ?, category = ? WHERE id = ?`;
        const params = [title, category, id];
        if (user.user_role !== 'admin') {
            sql += ` AND user_id = ?`;
            params.push(user.id);
        }
        dbLayer.db.run(sql, params, function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            if (this.changes === 0)
                return res.status(403).json({ error: 'Akses ditolak atau media tidak ditemukan.' });
            res.json({ message: 'Media updated' });
        });
    });
    // 6. DELETE VIDEO
    router.delete('/videos/:id', auth_1.authMiddleware, (req, res) => {
        dbLayer.db.get(`SELECT filepath, thumbnail_path FROM videos WHERE id = ?`, [req.params.id], (err, row) => {
            if (row) {
                try {
                    if (fs_1.default.existsSync(row.filepath))
                        fs_1.default.unlinkSync(row.filepath);
                    if (row.thumbnail_path) {
                        const fullThumb = path_1.default.join(UPLOADS_DIR, row.thumbnail_path);
                        if (fs_1.default.existsSync(fullThumb))
                            fs_1.default.unlinkSync(fullThumb);
                    }
                }
                catch (e) { }
            }
            dbLayer.db.run(`DELETE FROM videos WHERE id = ?`, [req.params.id], (err) => {
                if (err)
                    return res.status(500).json({ error: err.message });
                res.json({ message: 'Video deleted' });
            });
        });
    });
    // 7. PLAYLISTS
    router.get('/playlists', auth_1.authMiddleware, (req, res) => {
        dbLayer.db.all(`SELECT * FROM playlists ORDER BY created_at DESC`, [], (err, rows) => {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
    router.post('/playlists', auth_1.authMiddleware, (req, res) => {
        const { name, clips } = req.body;
        const userId = req.user.id;
        const id = 'pl-' + Date.now();
        dbLayer.db.run(`INSERT INTO playlists (id, name, clips_json, user_id) VALUES (?, ?, ?, ?)`, [id, name, JSON.stringify(clips || []), userId], function (err) {
            if (err)
                return res.status(500).json({ error: err.message });
            res.json({ message: 'Playlist created', id });
        });
    });
    return router;
}
