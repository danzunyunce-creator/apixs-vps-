import { spawn, ChildProcess } from 'child_process';
import { telegramService } from './telegramService';
import * as dbLayer from './database';
import { Server } from 'socket.io';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import config from './config';

export interface StreamMeta {
    rtmp_url?: string;
    stream_key?: string;
    filepath?: string;
    input_source?: string;
    loop_mode?: string;
    loop_video?: boolean;
    is_concat?: boolean;
    server_id?: string;
    destinations?: Array<{ rtmp_url: string; stream_key: string; name: string }>;
    channel_name?: string;
    niche?: string;
    youtube_account_id?: string;
    auto_restart?: number | boolean;
}

export interface StreamDesc {
    process: ChildProcess;
    autoRestart: boolean;
    restartTimer: NodeJS.Timeout | null;
    lastLogTime: number;
    startedAt: number;
    uptime: string;
    viewers: number;
    restartCount: number;
    bitrate: string;
    meta: StreamMeta;
    lastDataTime: number; // For Frozen Watchdog
}

export class StreamManager {
    private io: Server;
    public activeStreams: Map<string, StreamDesc>;
    private MAX_RESTARTS = 5;
    private RESTART_TIMEOUT_MS = 5000;
    private LOG_THROTTLE_MS = 500;
    private autoEngine: any = null;
    private availableEncoder: string = 'libx264'; 
    private lastCpuStats: { idle: number, total: number, prevIdle?: number, prevTotal?: number } | null = null;

    constructor(io: Server) {
        this.io = io;
        this.activeStreams = new Map();
        this.startMetricsBroadcast();
        this.startZombieWatchdog(); // Lifecycle management
        this.probeEncoders();
        this.setupExitHandlers();
    }

    private setupExitHandlers() {
        const killAll = () => {
            console.log('\n🛑 [ProcessSentinel] Server shutting down. Reaping all child processes...');
            this.emergencyStopAll();
        };

        process.on('exit', killAll);
        process.on('SIGINT', () => { killAll(); process.exit(); });
        process.on('SIGTERM', () => { killAll(); process.exit(); });
    }

    private probeEncoders() {
        exec(`"${config.FFMPEG_PATH}" -encoders`, (err, stdout) => {
            if (err) return;
            if (stdout.includes('h264_nvenc')) {
                this.availableEncoder = 'h264_nvenc';
                console.log('🚀 [StreamManager] NVIDIA NVENC Hardware detected! Using for streams.');
            } else if (stdout.includes('h264_vaapi')) {
                this.availableEncoder = 'h264_vaapi';
                console.log('🚀 [StreamManager] VAAPI Hardware (Intel/AMD) detected! Using for streams.');
            } else {
                this.availableEncoder = 'libx264';
                console.log('💻 [StreamManager] No GPU detected. Using libx264 (CPU) with ultrafast preset.');
            }
        });
    }

    attachAutomationEngine(engine: any) {
        this.autoEngine = engine;
    }

    async startStream(id: string, meta: StreamMeta) {
        if (this.activeStreams.has(id)) {
            console.log(`Stream ${id} is already running.`);
            return;
        }

        // --- 🚀 PERFORMANCE GUARD: CPU THRESHOLD ---
        if (this.lastCpuStats) {
            const idleDiff = this.lastCpuStats.idle - (this.lastCpuStats.prevIdle || 0);
            const totalDiff = this.lastCpuStats.total - (this.lastCpuStats.prevTotal || 0);
            const usage = totalDiff > 0 ? (100 - (100 * idleDiff / totalDiff)) : 0;
            
            if (usage > 90) {
                const errMsg = `⚠️ [Performance] Gagal: Beban CPU VPS sangat tinggi (${Math.floor(usage)}%). Harap tunggu sebentar atau matikan stream lain.`;
                this.emitLog(id, 'error', errMsg);
                dbLayer.saveSystemLog(id, 'error', errMsg).catch(() => {});
                await dbLayer.updateStreamStatus(id, 'ERROR');
                return;
            }
        }

        console.log(`[StreamManager] Starting Stream for ID: ${id}`);
        
        // Resolve YouTube Credentials if account ID is provided
        if (meta.youtube_account_id || !meta.stream_key) {
            try {
                const streamRow: any = await new Promise((res) => {
                    dbLayer.db.get(`SELECT youtube_account_id, stream_key, rtmp_url FROM streams WHERE id = ?`, [id], (e, r) => res(r));
                });

                const accId = meta.youtube_account_id || streamRow?.youtube_account_id;
                if (accId) {
                    const channel: any = await new Promise((res) => {
                        dbLayer.db.get(`SELECT * FROM youtube_channels WHERE id = ?`, [accId], (e, r) => res(r));
                    });

                    if (channel) {
                        meta.stream_key = channel.stream_key || meta.stream_key; // if channel has its own key
                        // YouTube standard RTMP if not specified
                        if (!meta.rtmp_url) meta.rtmp_url = 'rtmp://a.rtmp.youtube.com/live2';
                        console.log(`[StreamManager] Resolved account ${channel.channel_name} for stream ${id}`);
                    }
                }
            } catch (e) {
                console.error('[StreamManager] Account resolution failed', e);
            }
        }

        this._spawnFFmpeg(id, meta);
    }

    stopStream(id: string) {
        const streamDesc = this.activeStreams.get(id);
        if (!streamDesc) {
            console.log(`Stream ${id} not found to stop.`);
            return;
        }

        streamDesc.autoRestart = false; // Disable auto-restart logic
        if (streamDesc.restartTimer) {
            clearTimeout(streamDesc.restartTimer);
            streamDesc.restartTimer = null;
        }

        console.log(`[StreamManager] Attempting graceful stop for ${id} (SIGTERM)...`);
        
        // Critical: Check if process is still alive before killing
        if (streamDesc.process && !streamDesc.process.killed) {
            streamDesc.process.kill('SIGTERM'); 

            // Wait 3 seconds then force kill if still alive
            setTimeout(() => {
                const stillActive = this.activeStreams.get(id);
                if (stillActive && stillActive.process && !stillActive.process.killed) {
                    console.log(`[StreamManager] Graceful stop timed out for ${id}. Force killing (SIGKILL)...`);
                    stillActive.process.kill('SIGKILL');
                }
            }, 3000);
        } else {
            this.activeStreams.delete(id);
        }

        if (this.autoEngine && typeof this.autoEngine.onStreamStop === 'function') {
            this.autoEngine.onStreamStop(id);
        }

        this.emitLog(id, 'success', `Stream ${id} termination sequence initiated.`);
        dbLayer.updateStreamStatus(id, 'STOP').catch(console.error);
    }

    public emergencyStopAll() {
        const ids = Array.from(this.activeStreams.keys());
        ids.forEach(id => this.stopStream(id));
        if (this.io) {
            this.io.emit('system_alert', { 
                type: 'CRITICAL', 
                message: 'EMERGENCY STOP TRIGGERED: Seluruh stream telah dihentikan oleh pusat.' 
            });
        }
        return ids.length;
    }

    private _buildArgs(meta: StreamMeta): string[] {
        const rtmpDest = `${meta.rtmp_url || 'rtmp://a.rtmp.youtube.com/live2'}/${meta.stream_key || ''}`;
        const inputSource = meta.filepath || meta.input_source || 'testsrc=size=1280x720';
        
        const args: string[] = [];
        
        // --- INDESTRUCTIBLE RECONNECT (Level Network Resilience) ---
        if (inputSource.startsWith('http') || inputSource.startsWith('rtmp')) {
            args.push(
                '-reconnect', '1', 
                '-reconnect_at_eof', '1', 
                '-reconnect_streamed', '1', 
                '-reconnect_delay_max', '5',
                '-timeout', '20000000', // 20 Seconds timeout for socket
                '-err_detect', 'ignore_err'
            );
        }
        
        args.push('-thread_queue_size', '512'); // Prevent buffer overflow for long streams
        
        if (meta.loop_mode === 'repeat_all' || meta.loop_video) {
            args.push('-stream_loop', '-1');
        }
        
        args.push('-re');
        
        if (meta.is_concat) {
            args.push('-f', 'concat', '-safe', '0', '-i', inputSource);
        } else {
            if (inputSource.includes('testsrc')) {
                args.push('-f', 'lavfi', '-i', inputSource);
            } else {
                args.push('-i', inputSource);
            }
        }
        
        // --- HW ACCELERATED ENCODING & QUALITY FILTER ---
        if (meta.is_concat || this.availableEncoder !== 'libx264') {
            const videoFilters: string[] = [];

            // Jika playlist atau ada GPU, gunakan transcode
            args.push('-c:v', this.availableEncoder);
            
            if (this.availableEncoder === 'h264_nvenc') {
                args.push('-preset', 'p1', '-rc:v', 'vbr', '-cq:v', '26', '-maxrate', '3000k', '-bufsize', '6000k');
            } else if (this.availableEncoder === 'h264_vaapi') {
                args.push('-vaapi_device', '/dev/dri/renderD128');
                videoFilters.push('format=nv12', 'hwupload');
                args.push('-qp', '26');
            } else {
                // Default CPU
                args.push('-preset', 'ultrafast', '-crf', '26', '-maxrate', '3000k', '-bufsize', '6000k');
            }
            
            // --- PREMIUM SHARPENING (Jernih!) ---
            videoFilters.push('unsharp=3:3:1.5:3:3:0.5');
            
            if (videoFilters.length > 0) {
                args.push('-vf', videoFilters.join(','));
            }

            args.push('-pix_fmt', 'yuv420p', '-g', '60');
            
        } else {
            // Direct Copy if single file and no GPU needed (to save CPU)
            args.push('-c:v', 'copy');
        }
        
        if (meta.destinations && meta.destinations.length > 1) {
            // --- HYPER-SCALE SIMULCAST (Tee Muxer) ---
            const teeArgs = meta.destinations.map(d => {
                const fullUrl = d.rtmp_url.endsWith('/') ? `${d.rtmp_url}${d.stream_key}` : `${d.rtmp_url}/${d.stream_key}`;
                return `[f=flv]${fullUrl.replace(/[\[\]\|]/g, '\\$&')}`; // Escape tee chars
            }).join('|');

            args.push(
                '-af', 'dynaudnorm',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '44100',
                '-f', 'tee',
                teeArgs
            );
        } else {
            // Single Destination (Standard)
            args.push(
                '-af', 'dynaudnorm',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '44100',
                '-f', 'flv',
                rtmpDest
            );
        }
        
        return args;
    }

    private async _spawnFFmpeg(id: string, meta: StreamMeta, currentRestartCount = 0) {
        const inputSource = meta.filepath || meta.input_source || '';
        
        // --- 🛡️ PATH JAIL & SSRF PROTECTION (Expert Level) ---
        if (inputSource && !inputSource.includes('testsrc')) {
            if (inputSource.startsWith('http')) {
                const { isSafeUrl } = require('./middleware/security');
                if (!isSafeUrl(inputSource)) {
                    const errMsg = `🛡️ [Security] Gagal: Percobaan SSRF terdeteksi (Internal IP Blocked).`;
                    this.emitLog(id, 'error', errMsg);
                    dbLayer.saveSystemLog(id, 'error', errMsg).catch(() => {});
                    await dbLayer.updateStreamStatus(id, 'ERROR');
                    return;
                }
            } else if (!inputSource.startsWith('rtmp')) {
                // local path check
                const normalizedBase = path.resolve(config.UPLOADS_DIR);
                const normalizedTarget = path.resolve(inputSource);
                if (!normalizedTarget.startsWith(normalizedBase) && !inputSource.includes('concat')) {
                    const errMsg = `🛡️ [Security] Gagal: Akses file di luar jail dilarang (Path Traversal attempt).`;
                    this.emitLog(id, 'error', errMsg);
                    dbLayer.saveSystemLog(id, 'error', errMsg).catch(() => {});
                    await dbLayer.updateStreamStatus(id, 'ERROR');
                    return;
                }
            }
        }

        if (inputSource && !inputSource.includes('testsrc') && !fs.existsSync(inputSource) && !inputSource.startsWith('http') && !inputSource.startsWith('rtmp')) {
            const errMsg = `Gagal memulai stream: Input source tidak valid atau tidak ditemukan.`;
            this.emitLog(id, 'error', errMsg);
            dbLayer.saveSystemLog(id, 'error', errMsg).catch(() => {});
            await dbLayer.updateStreamStatus(id, 'ERROR');
            return;
        }

        const args = this._buildArgs(meta);

        try {
            const ffmpegProc = spawn(config.FFMPEG_PATH, args);

            const streamDesc: StreamDesc = {
                process: ffmpegProc,
                autoRestart: meta.auto_restart !== undefined ? Boolean(meta.auto_restart) : true,
                restartTimer: null,
                lastLogTime: 0,
                startedAt: Date.now(),
                uptime: '00:00:00',
                viewers: 0,
                restartCount: currentRestartCount,
                bitrate: '0 kbps',
                meta: meta,
                lastDataTime: Date.now()
            };

            this.activeStreams.set(id, streamDesc);

            // Mask sensitive stream key in logs targeting URLs
            const maskedArgs = args.map(arg => {
                const streamKey = meta.stream_key || '';
                if (streamKey && (arg.startsWith('rtmp://') || arg.startsWith('http'))) {
                    return arg.replace(streamKey, '••••••••••••');
                }
                return arg;
            });

            const startMsg = `[Worker: ${meta.server_id || 'Auto'}] Process injected: ffmpeg ${maskedArgs.join(' ')}`;
            this.emitLog(id, 'info', startMsg);
            dbLayer.saveSystemLog(id, 'info', startMsg).catch(() => {});

            if (this.autoEngine && currentRestartCount === 0) {
                this.autoEngine.onStreamStart(id, meta);
                telegramService.sendMessage(`🟢 <b>LIVE!</b> Stream starting ID: <b>${id}</b>\nNode: ${meta.server_id || 'Main VPS'}`).catch(() => {});
            }

            ffmpegProc.stdout?.on('data', () => {});

            ffmpegProc.stderr?.on('data', (data) => {
                const now = Date.now();
                const desc = this.activeStreams.get(id);
                if (!desc) return;

                const textChunk = data.toString().trim();
                if (!textChunk) return;

                // 1. Bitrate & Metric Parsing
                const bitrateMatch = textChunk.match(/bitrate=\s*([\d.]+kbits\/s)/i);
                if (bitrateMatch && desc) {
                    desc.bitrate = bitrateMatch[1].replace('kbits', ' kbps');
                    desc.lastDataTime = now; // Update heartbeat on data
                    const diffS = Math.floor((now - desc.startedAt) / 1000);
                    const h = Math.floor(diffS / 3600);
                    const m = Math.floor((diffS % 3600) / 60);
                    const s = diffS % 60;
                    desc.uptime = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                }

                // 2. Throttled UI Logging
                if (now - desc.lastLogTime < this.LOG_THROTTLE_MS) return;
                desc.lastLogTime = now;

                const lower = textChunk.toLowerCase();
                let level = 'info';
                if (lower.includes('error')) {
                    level = 'error';
                    dbLayer.saveSystemLog(id, 'error', textChunk).catch(() => {});
                } else if (lower.includes('warning')) {
                    level = 'warn';
                } else if (textChunk.includes('frame=')) {
                    level = 'success';
                }

                this.emitLog(id, level, textChunk);
            });

            ffmpegProc.on('error', (err) => {
                console.error(`[StreamManager] Stream ${id} spawn error:`, err);
                this.emitLog(id, 'error', `Gagal menjalankan FFmpeg: ${err.message}. Pastikan FFmpeg terinstall di server.`);

                const desc = this.activeStreams.get(id);
                if (desc) desc.autoRestart = false;
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

                // ONLY DELETE FROM MAP ON ACTUAL CLOSE
                this.activeStreams.delete(id);

                if (this.autoEngine && typeof this.autoEngine.onStreamStop === 'function') {
                    this.autoEngine.onStreamStop(id);
                    telegramService.sendMessage(`🔴 <b>STOPPED / OFFLINE!</b> Stream ID: <b>${id}</b>`).catch(() => {});
                }

                if (desc && desc.autoRestart) {
                    try {
                        desc.restartCount = (desc.restartCount || 0) + 1;
                        const newCount = desc.restartCount;
                        const failMsg = `Stream crashed! Restart count updated to: ${newCount}`;
                        this.emitLog(id, 'error', failMsg);
                        dbLayer.saveSystemLog(id, 'error', failMsg).catch(() => {});

                        if (newCount <= this.MAX_RESTARTS) {
                            const warnMsg = `Watchdog: Restarting stream in ${this.RESTART_TIMEOUT_MS / 1000}s... (Attempt ${newCount}/${this.MAX_RESTARTS})`;
                            this.emitLog(id, 'warn', warnMsg);

                            this.activeStreams.set(id, desc);

                            desc.restartTimer = setTimeout(() => {
                                if (desc.meta) {
                                    this._spawnFFmpeg(id, desc.meta, newCount);
                                }
                            }, this.RESTART_TIMEOUT_MS);
                        } else {
                            const fatalMsg = `🛑 <b>CRITICAL FAILURE:</b> Max restarts (${this.MAX_RESTARTS}) reached for <b>${id}</b>. Watchdog gave up.`;
                            this.emitLog(id, 'error', fatalMsg);
                            dbLayer.saveSystemLog(id, 'error', fatalMsg).catch(() => {});
                            telegramService.sendMessage(fatalMsg).catch(() => {});
                            
                            await dbLayer.updateStreamStatus(id, 'ERROR').catch(() => {});
                            this.io.emit('stream_status_change', { id, status: 'ERROR' });
                        }
                    } catch (err) {
                        console.error('Failed to handle auto restart logic:', err);
                    }
                }
            });

        } catch (err: any) {
            this.emitLog(id, 'error', `Failed to spawn FFmpeg: ${err.message}`);
        }
    }

    public stopAllStreams() {
        console.log(`[StreamManager] Stopping all ${this.activeStreams.size} active streams...`);
        for (const [id, desc] of this.activeStreams.entries()) {
            desc.autoRestart = false;
            if (desc.restartTimer) clearTimeout(desc.restartTimer);
            desc.process?.kill('SIGKILL');
        }
        this.activeStreams.clear();
    }

    public emitLog(streamId: string, level: string, message: string) {
        const timestamp = new Date().toLocaleTimeString('id-ID');
        const logObj = { timestamp, level, message: `[${streamId}] ${message}` };

        console.log(`[LOG] ${logObj.message}`);
        this.io.emit('streamLog', logObj);
    }

    /**
     * ZOMBIE WATCHDOG: Reaps orphaned FFmpeg processes every 60 seconds.
     * Prevents resource leakage if the server restarts or crashes ungracefully.
     */
    private startZombieWatchdog() {
        setInterval(() => {
            const platform = os.platform();
            const cmd = platform === 'win32' ? 'tasklist' : 'ps aux | grep ffmpeg';
            
            exec(cmd, (err, stdout) => {
                if (err) return;
                
                // Simplified strategy: Kill FFmpeg if activeStreams is empty 
                // (More advanced logic would involve checking PIDs)
                if (this.activeStreams.size === 0 && stdout.toLowerCase().includes('ffmpeg')) {
                    console.warn('⚠️ [Watchdog] Detected stray FFmpeg processes while no streams are active. Reaping...');
                    const killCmd = platform === 'win32' ? 'taskkill /F /IM ffmpeg.exe' : 'pkill -9 ffmpeg';
                    exec(killCmd);
                }
            });
        }, 60000); // Check every minute
    }

    private startMetricsBroadcast() {
        setInterval(async () => {
            if (this.io.sockets.sockets.size === 0) return; // Only calculate if someone is watching

            try {
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                
                // Real CPU Calculation (Delta-based)
                const cpus = os.cpus();
                let idle = 0;
                let total = 0;
                cpus.forEach(cpu => {
                    for (let type in cpu.times) {
                        total += (cpu.times as any)[type];
                    }
                    idle += cpu.times.idle;
                });

                let cpuUsage = 0;
                if (this.lastCpuStats) {
                    const idleDiff = idle - this.lastCpuStats.idle;
                    const totalDiff = total - this.lastCpuStats.total;
                    cpuUsage = totalDiff > 0 ? Math.floor(100 - (100 * idleDiff / totalDiff)) : 0;
                    
                    // Store deltas for startStream check
                    (this.lastCpuStats as any).prevIdle = this.lastCpuStats.idle;
                    (this.lastCpuStats as any).prevTotal = this.lastCpuStats.total;
                }
                this.lastCpuStats = { idle, total };
                
                const ffmpegStatus = (config.FFMPEG_PATH === 'ffmpeg' || fs.existsSync(config.FFMPEG_PATH)) ? 'OK' : 'ERROR';

                let diskSpace = 'Unknown';
                try {
                    const stats = fs.statfsSync(config.UPLOADS_DIR);
                    const freeGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
                    diskSpace = `${freeGB.toFixed(1)} GB Free`;
                } catch (e) {}

                const dbStatus = await new Promise<string>((resolve) => {
                    dbLayer.db.get('SELECT 1', (err) => resolve(err ? 'ERROR' : 'OK'));
                });

                const streamStats = Array.from(this.activeStreams.entries()).map(([id, desc]) => ({
                    id: id,
                    cpu: Math.floor(Math.random() * 15) + 5, // Simulated per-stream CPU
                    bitrate: parseInt(desc.bitrate.replace(' kbps', '')) || 0,
                    fps: 30, // Default for now, can be parsed from stderr if needed
                    status: 'OK' as const
                }));

                const payload = {
                    metrics: {
                        cpu: Math.min(cpuUsage, 100),
                        memory: Math.round(((totalMem - freeMem) / totalMem) * 100),
                        health: {
                            ffmpeg: ffmpegStatus,
                            database: dbStatus,
                            encoder: this.availableEncoder.replace('h264_', '').toUpperCase(),
                            disk: diskSpace
                        }
                    },
                    streams: streamStats,
                    timestamp: new Date().toISOString()
                };

                this.io.emit('DASHBOARD_UPDATE', payload);
            } catch (err) {
                console.error('[Metrics] Failed to broadcast:', err);
            }
        }, 7000); // Hemat Quota: 7 seconds interval
    }
}

export default StreamManager;
