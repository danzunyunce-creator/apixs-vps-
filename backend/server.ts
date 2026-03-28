import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import compression from 'compression';

import * as dbLayer from './database';
import StreamManager from './streamManager';
import AutomationEngine from './automationEngine';
import config from './config';

// ── Routes ──
import authRoutes from './routes/auth';
import createMediaRouter from './routes/media';
import { createStreamRouter } from './routes/streams';
import { createScheduleRouter } from './routes/schedules';
import { createAutomationRouter } from './routes/automation';
import settingsRoutes from './routes/settings';
import nodesRoutes from './routes/nodes'; // Added import for nodesRoutes

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

const UPLOADS_DIR = config.UPLOADS_DIR;
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Inisialisasi Core ──
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const streamManager = new StreamManager(io);
const autoEngine = new AutomationEngine(streamManager);
streamManager.attachAutomationEngine(autoEngine);

// ── API Routing ──
app.use('/api/auth', authRoutes);
app.use('/api/media', createMediaRouter(io));
app.use('/api/streams', createStreamRouter(streamManager, io));
app.use('/api/schedules', createScheduleRouter(streamManager, io));
app.use('/api/automation', createAutomationRouter(autoEngine));
app.use('/api/nodes', nodesRoutes);
app.use('/api/config', settingsRoutes);

// ── Serve Frontend (dist/ folder) ──
const DIST_PATH = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));
}

// ── Serve Frontend Fallback ──
app.use((req, res, next) => {
    if (fs.existsSync(DIST_PATH) && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        return res.sendFile(path.join(DIST_PATH, 'index.html'));
    }
    next();
});

// ── Startup Cleanup ──
const cleanupTempFiles = () => {
    try {
        if (!fs.existsSync(UPLOADS_DIR)) return;
        const files = fs.readdirSync(UPLOADS_DIR);
        let count = 0;
        files.forEach(f => {
            if ((f.startsWith('playlist_live-') || f.startsWith('sched_')) && f.endsWith('.txt')) {
                try {
                    fs.unlinkSync(path.join(UPLOADS_DIR, f));
                    count++;
                } catch (err) { }
            }
        });
        if (count > 0) console.log(`✅ [Cleanup] Berhasil membersihkan ${count} file cache manifest lama.`);
    } catch (e) {
        console.error('[Cleanup Error]', e);
    }
};
cleanupTempFiles();

// ── Graceful Shutdown ──
const gracefulShutdown = () => {
    console.log('\n🛑 [Server] Menutup semua proses stream sebelum keluar...');
    streamManager.stopAllStreams();
    setTimeout(() => { process.exit(0); }, 1000);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = config.PORT;
server.listen(PORT, () => {
    console.log(`🚀 [ApixsLive] Server engine running on port ${PORT}`);
    console.log(`📂 [Config] Database: ${config.DB_PATH}`);
    console.log(`🎥 [FFmpeg] Path: ${config.FFMPEG_PATH}`);
    console.log(`⚡ [Auth] JWT Transition Active.`);
}).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ [Fatal] Port ${PORT} is already in use. Please stop the existing process.`);
        process.exit(1);
    } else {
        console.error('❌ [Fatal] Server failed to start:', err);
    }
});

export default app;
