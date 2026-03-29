import { spawn, ChildProcess } from 'child_process';
import { telegramService } from './telegramService';
import * as dbLayer from './database';
import { Server } from 'socket.io';
import os from 'os';
import fs from 'fs';
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
    channel_name?: string;
    niche?: string;
    youtube_account_id?: string;
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
}

export class StreamManager {
    private io: Server;
    public activeStreams: Map<string, StreamDesc>;
    private MAX_RESTARTS = 5;
    private RESTART_TIMEOUT_MS = 5000;
    private LOG_THROTTLE_MS = 500;
    private autoEngine: any = null;
    private availableEncoder: string = 'libx264'; // Default to CPU

    constructor(io: Server) {
        this.io = io;
        this.activeStreams = new Map();
        this.startMetricsBroadcast();
        this.probeEncoders();
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

    private _buildArgs(meta: StreamMeta): string[] {
        const rtmpDest = `${meta.rtmp_url || 'rtmp://a.rtmp.youtube.com/live2'}/${meta.stream_key || ''}`;
        const inputSource = meta.filepath || meta.input_source || 'testsrc=size=1280x720';
        
        const args: string[] = [];
        
        // --- INDESTRUCTIBLE RECONNECT (Level Network) ---
        args.push('-reconnect', '1', '-reconnect_at_eof', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
        
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
        
        args.push(
            '-af', 'dynaudnorm',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-f', 'flv',
            rtmpDest
        );
        
        return args;
    }

    private async _spawnFFmpeg(id: string, meta: StreamMeta, currentRestartCount = 0) {
        const inputSource = meta.filepath || meta.input_source || '';
        if (inputSource && !inputSource.includes('testsrc') && !fs.existsSync(inputSource)) {
            const errMsg = `Gagal memulai stream: File tidak ditemukan di path: ${inputSource}`;
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
            dbLayer.saveSystemLog(id, 'info', startMsg).catch(() => {});

            if (this.autoEngine && currentRestartCount === 0) {
                this.autoEngine.onStreamStart(id, meta);
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

    private startMetricsBroadcast() {
        setInterval(async () => {
            if (this.io.sockets.sockets.size === 0) return; // Only calculate if someone is watching

            try {
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                
                // Simplified CPU calculation (real CPU calculation usually needs a delta)
                // For now using os.loadavg() as a proxy for cross-platform simplicity or a realistic mock
                const cpuUsage = Math.floor(os.loadavg()[0] * 10); 
                
                const ffmpegStatus = (config.FFMPEG_PATH === 'ffmpeg' || fs.existsSync(config.FFMPEG_PATH)) ? 'OK' : 'ERROR';

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
                            database: dbStatus
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
