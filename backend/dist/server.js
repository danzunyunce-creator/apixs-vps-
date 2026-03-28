"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const streamManager_1 = __importDefault(require("./streamManager"));
const automationEngine_1 = __importDefault(require("./automationEngine"));
const config_1 = __importDefault(require("./config"));
// ── Routes ──
const auth_1 = __importDefault(require("./routes/auth"));
const media_1 = __importDefault(require("./routes/media"));
const streams_1 = require("./routes/streams");
const schedules_1 = require("./routes/schedules");
const automation_1 = require("./routes/automation");
const settings_1 = __importDefault(require("./routes/settings"));
const nodes_1 = __importDefault(require("./routes/nodes")); // Added import for nodesRoutes
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const UPLOADS_DIR = config_1.default.UPLOADS_DIR;
if (!fs_1.default.existsSync(UPLOADS_DIR))
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express_1.default.static(UPLOADS_DIR));
// ── Inisialisasi Core ──
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: '*' } });
const streamManager = new streamManager_1.default(io);
const autoEngine = new automationEngine_1.default(streamManager);
streamManager.attachAutomationEngine(autoEngine);
// ── API Routing ──
app.use('/api/auth', auth_1.default);
app.use('/api/media', (0, media_1.default)(io));
app.use('/api/streams', (0, streams_1.createStreamRouter)(streamManager, io));
app.use('/api/schedules', (0, schedules_1.createScheduleRouter)(streamManager, io));
app.use('/api/automation', (0, automation_1.createAutomationRouter)(autoEngine));
app.use('/api/config', settings_1.default);
app.use('/api/nodes', nodes_1.default);
// ── Startup Cleanup ──
const cleanupTempFiles = () => {
    try {
        if (!fs_1.default.existsSync(UPLOADS_DIR))
            return;
        const files = fs_1.default.readdirSync(UPLOADS_DIR);
        let count = 0;
        files.forEach(f => {
            if ((f.startsWith('playlist_live-') || f.startsWith('sched_')) && f.endsWith('.txt')) {
                try {
                    fs_1.default.unlinkSync(path_1.default.join(UPLOADS_DIR, f));
                    count++;
                }
                catch (err) { }
            }
        });
        if (count > 0)
            console.log(`✅ [Cleanup] Berhasil membersihkan ${count} file cache manifest lama.`);
    }
    catch (e) {
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
const PORT = config_1.default.PORT;
server.listen(PORT, () => {
    console.log(`🚀 [ApixsLive] Server engine running on port ${PORT}`);
    console.log(`📂 [Config] Database: ${config_1.default.DB_PATH}`);
    console.log(`🎥 [FFmpeg] Path: ${config_1.default.FFMPEG_PATH}`);
    console.log(`⚡ [Auth] JWT Transition Active.`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ [Fatal] Port ${PORT} is already in use. Please stop the existing process.`);
        process.exit(1);
    }
    else {
        console.error('❌ [Fatal] Server failed to start:', err);
    }
});
exports.default = app;
