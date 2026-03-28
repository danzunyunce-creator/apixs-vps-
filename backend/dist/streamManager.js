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
exports.StreamManager = void 0;
const child_process_1 = require("child_process");
const telegramService_1 = require("./telegramService");
const dbLayer = __importStar(require("./database"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const config_1 = __importDefault(require("./config"));
class StreamManager {
    io;
    activeStreams;
    MAX_RESTARTS = 5;
    RESTART_TIMEOUT_MS = 5000;
    LOG_THROTTLE_MS = 500;
    autoEngine = null;
    constructor(io) {
        this.io = io;
        this.activeStreams = new Map();
        this.startMetricsBroadcast();
    }
    attachAutomationEngine(engine) {
        this.autoEngine = engine;
    }
    async startStream(id, meta) {
        if (this.activeStreams.has(id)) {
            console.log(`Stream ${id} is already running.`);
            return;
        }
        console.log(`[StreamManager] Starting Stream for ID: ${id}`);
        // Resolve YouTube Credentials if account ID is provided
        if (meta.youtube_account_id || !meta.stream_key) {
            try {
                const streamRow = await new Promise((res) => {
                    dbLayer.db.get(`SELECT youtube_account_id, stream_key, rtmp_url FROM streams WHERE id = ?`, [id], (e, r) => res(r));
                });
                const accId = meta.youtube_account_id || streamRow?.youtube_account_id;
                if (accId) {
                    const channel = await new Promise((res) => {
                        dbLayer.db.get(`SELECT * FROM youtube_channels WHERE id = ?`, [accId], (e, r) => res(r));
                    });
                    if (channel) {
                        meta.stream_key = channel.stream_key || meta.stream_key; // if channel has its own key
                        // YouTube standard RTMP if not specified
                        if (!meta.rtmp_url)
                            meta.rtmp_url = 'rtmp://a.rtmp.youtube.com/live2';
                        console.log(`[StreamManager] Resolved account ${channel.channel_name} for stream ${id}`);
                    }
                }
            }
            catch (e) {
                console.error('[StreamManager] Account resolution failed', e);
            }
        }
        this._spawnFFmpeg(id, meta);
    }
    stopStream(id) {
        const streamDesc = this.activeStreams.get(id);
        if (!streamDesc) {
            console.log(`Stream ${id} not found to stop.`);
            return;
        }
        streamDesc.autoRestart = false;
        if (streamDesc.restartTimer) {
            clearTimeout(streamDesc.restartTimer);
        }
        console.log(`[StreamManager] Force stopping stream ${id}`);
        streamDesc.process?.kill('SIGTERM');
        this.activeStreams.delete(id);
        if (this.autoEngine) {
            this.autoEngine.onStreamStop(id);
        }
        this.emitLog(id, 'success', `Stream ${id} intentionally stopped by user.`);
        dbLayer.updateStreamStatus(id, 'STOP').catch(console.error);
    }
    _buildArgs(meta) {
        const rtmpDest = `${meta.rtmp_url || 'rtmp://a.rtmp.youtube.com/live2'}/${meta.stream_key || ''}`;
        const inputSource = meta.filepath || meta.input_source || 'testsrc=size=1280x720';
        const args = [];
        if (meta.loop_mode === 'repeat_all' || meta.loop_video) {
            args.push('-stream_loop', '-1');
        }
        args.push('-re');
        if (meta.is_concat) {
            args.push('-f', 'concat', '-safe', '0', '-i', inputSource);
        }
        else {
            if (inputSource.includes('testsrc')) {
                args.push('-f', 'lavfi', '-i', inputSource);
            }
            else {
                args.push('-i', inputSource);
            }
        }
        if (meta.is_concat) {
            // Jika playlist (multidile), gunakan transcode ringan agar resolusi berbeda tidak crash
            args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-maxrate', '3000k', '-bufsize', '6000k', '-pix_fmt', 'yuv420p', '-g', '60');
        }
        else {
            args.push('-c:v', 'copy');
        }
        args.push('-af', 'dynaudnorm', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-f', 'flv', rtmpDest);
        return args;
    }
    async _spawnFFmpeg(id, meta, currentRestartCount = 0) {
        const inputSource = meta.filepath || meta.input_source || '';
        if (inputSource && !inputSource.includes('testsrc') && !fs_1.default.existsSync(inputSource)) {
            const errMsg = `Gagal memulai stream: File tidak ditemukan di path: ${inputSource}`;
            this.emitLog(id, 'error', errMsg);
            dbLayer.saveSystemLog(id, 'error', errMsg).catch(() => { });
            await dbLayer.updateStreamStatus(id, 'ERROR');
            return;
        }
        const args = this._buildArgs(meta);
        try {
            const ffmpegProc = (0, child_process_1.spawn)(config_1.default.FFMPEG_PATH, args);
            const streamDesc = {
                process: ffmpegProc,
                autoRestart: true,
                restartTimer: null,
                lastLogTime: 0,
                startedAt: Date.now(),
                uptime: '00:00:00',
                viewers: 0,
                restartCount: currentRestartCount,
                bitrate: '0 kbps',
                meta: meta
            };
            this.activeStreams.set(id, streamDesc);
            // Mask sensitive stream key in logs
            const maskedArgs = args.map(arg => {
                const streamKey = meta.stream_key || '';
                if (streamKey && arg.includes(streamKey)) {
                    return arg.replace(streamKey, '••••••••••••');
                }
                return arg;
            });
            const startMsg = `[Worker: ${meta.server_id || 'Auto'}] Process injected: ffmpeg ${maskedArgs.join(' ')}`;
            this.emitLog(id, 'info', startMsg);
            dbLayer.saveSystemLog(id, 'info', startMsg).catch(() => { });
            if (this.autoEngine && currentRestartCount === 0) {
                this.autoEngine.onStreamStart(id, meta);
            }
            ffmpegProc.stdout?.on('data', () => { });
            ffmpegProc.stderr?.on('data', (data) => {
                const now = Date.now();
                const desc = this.activeStreams.get(id);
                if (!desc)
                    return;
                const textChunk = data.toString().trim();
                if (!textChunk)
                    return;
                // 1. Bitrate & Metric Parsing
                const bitrateMatch = textChunk.match(/bitrate=\s*([\d.]+kbits\/s)/i);
                if (bitrateMatch && desc) {
                    desc.bitrate = bitrateMatch[1].replace('kbits', ' kbps');
                    const diffS = Math.floor((now - desc.startedAt) / 1000);
                    const h = Math.floor(diffS / 3600);
                    const m = Math.floor((diffS % 3600) / 60);
                    const s = diffS % 60;
                    desc.uptime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                }
                // 2. Throttled UI Logging
                if (now - desc.lastLogTime < this.LOG_THROTTLE_MS)
                    return;
                desc.lastLogTime = now;
                const lower = textChunk.toLowerCase();
                let level = 'info';
                if (lower.includes('error')) {
                    level = 'error';
                    dbLayer.saveSystemLog(id, 'error', textChunk).catch(() => { });
                }
                else if (lower.includes('warning')) {
                    level = 'warn';
                }
                else if (textChunk.includes('frame=')) {
                    level = 'success';
                }
                this.emitLog(id, level, textChunk);
            });
            ffmpegProc.on('error', (err) => {
                console.error(`[StreamManager] Stream ${id} spawn error:`, err);
                this.emitLog(id, 'error', `Gagal menjalankan FFmpeg: ${err.message}. Pastikan FFmpeg terinstall di server.`);
                const desc = this.activeStreams.get(id);
                if (desc)
                    desc.autoRestart = false;
            });
            dbLayer.db.run(`INSERT INTO stream_sessions (stream_id, start_time, status) VALUES (?, CURRENT_TIMESTAMP, 'RUNNING')`, [id]);
            ffmpegProc.on('close', async (code) => {
                console.log(`[StreamManager] Stream ${id} closed with code ${code}`);
                const desc = this.activeStreams.get(id);
                if (desc) {
                    const durationSec = Math.floor((Date.now() - desc.startedAt) / 1000);
                    dbLayer.db.run(`UPDATE stream_sessions SET end_time = CURRENT_TIMESTAMP, status = 'COMPLETED', total_duration_seconds = ? WHERE stream_id = ? AND status = 'RUNNING'`, [durationSec, id]);
                }
                this.emitLog(id, 'warn', `FFmpeg proc closed (code ${code}).`);
                this.activeStreams.delete(id);
                if (this.autoEngine) {
                    this.autoEngine.onStreamStop(id);
                }
                if (desc && desc.autoRestart) {
                    try {
                        desc.restartCount = (desc.restartCount || 0) + 1;
                        const newCount = desc.restartCount;
                        const failMsg = `Stream crashed! Restart count updated to: ${newCount}`;
                        this.emitLog(id, 'error', failMsg);
                        dbLayer.saveSystemLog(id, 'error', failMsg).catch(() => { });
                        if (newCount <= this.MAX_RESTARTS) {
                            const warnMsg = `Watchdog: Restarting stream in ${this.RESTART_TIMEOUT_MS / 1000}s... (Attempt ${newCount}/${this.MAX_RESTARTS})`;
                            this.emitLog(id, 'warn', warnMsg);
                            this.activeStreams.set(id, desc);
                            desc.restartTimer = setTimeout(() => {
                                if (desc.meta) {
                                    this._spawnFFmpeg(id, desc.meta, newCount);
                                }
                            }, this.RESTART_TIMEOUT_MS);
                        }
                        else {
                            const fatalMsg = `🛑 <b>CRITICAL FAILURE:</b> Max restarts (${this.MAX_RESTARTS}) reached for <b>${id}</b>. Watchdog gave up.`;
                            this.emitLog(id, 'error', fatalMsg);
                            dbLayer.saveSystemLog(id, 'error', fatalMsg).catch(() => { });
                            telegramService_1.telegramService.sendMessage(fatalMsg).catch(() => { });
                            await dbLayer.updateStreamStatus(id, 'ERROR').catch(() => { });
                            this.io.emit('stream_status_change', { id, status: 'ERROR' });
                        }
                    }
                    catch (err) {
                        console.error('Failed to handle auto restart logic:', err);
                    }
                }
            });
        }
        catch (err) {
            this.emitLog(id, 'error', `Failed to spawn FFmpeg: ${err.message}`);
        }
    }
    stopAllStreams() {
        console.log(`[StreamManager] Stopping all ${this.activeStreams.size} active streams...`);
        for (const [id, desc] of this.activeStreams.entries()) {
            desc.autoRestart = false;
            if (desc.restartTimer)
                clearTimeout(desc.restartTimer);
            desc.process?.kill('SIGKILL');
        }
        this.activeStreams.clear();
    }
    emitLog(streamId, level, message) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const logObj = { timestamp, level, message: `[${streamId}] ${message}` };
        console.log(`[LOG] ${logObj.message}`);
        this.io.emit('streamLog', logObj);
    }
    startMetricsBroadcast() {
        setInterval(async () => {
            if (this.io.sockets.sockets.size === 0)
                return; // Only calculate if someone is watching
            try {
                const totalMem = os_1.default.totalmem();
                const freeMem = os_1.default.freemem();
                // Simplified CPU calculation (real CPU calculation usually needs a delta)
                // For now using os.loadavg() as a proxy for cross-platform simplicity or a realistic mock
                const cpuUsage = Math.floor(os_1.default.loadavg()[0] * 10);
                const ffmpegStatus = fs_1.default.existsSync(config_1.default.FFMPEG_PATH) ? 'OK' : 'ERROR';
                const dbStatus = await new Promise((resolve) => {
                    dbLayer.db.get('SELECT 1', (err) => resolve(err ? 'ERROR' : 'OK'));
                });
                const streamStats = Array.from(this.activeStreams.entries()).map(([id, desc]) => ({
                    id: id,
                    cpu: Math.floor(Math.random() * 15) + 5, // Simulated per-stream CPU
                    bitrate: parseInt(desc.bitrate.replace(' kbps', '')) || 0,
                    fps: 30, // Default for now, can be parsed from stderr if needed
                    status: 'OK'
                }));
                const payload = {
                    metrics: {
                        cpu: Math.min(cpuUsage, 100),
                        memory: Math.round(((totalMem - freeMem) / totalMem) * 100),
                        health: {
                            ffmpeg: ffmpegStatus,
                            database: dbStatus
                        }
                    },
                    streams: streamStats,
                    timestamp: new Date().toISOString()
                };
                this.io.emit('DASHBOARD_UPDATE', payload);
            }
            catch (err) {
                console.error('[Metrics] Failed to broadcast:', err);
            }
        }, 2000);
    }
}
exports.StreamManager = StreamManager;
exports.default = StreamManager;
