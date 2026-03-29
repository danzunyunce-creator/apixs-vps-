import * as ytApi from './youtubeApi';
import * as dbLayer from './database';
import { StreamManager, StreamMeta } from './streamManager';
import { telegramService } from './telegramService';
import config from './config';
import fs from 'fs';
import path from 'path';

export class AutomationEngine {
    private sm: StreamManager;
    private autoEndTimers: Map<string, NodeJS.Timeout>;
    private rotateCooldown: Map<string, number>;

    constructor(streamManager: StreamManager) {
        this.sm = streamManager;
        this.autoEndTimers = new Map();
        this.rotateCooldown = new Map();

        console.log('[AutomationEngine] Yt Automation Engine initialized.');

        setInterval(() => this.checkScheduledAutoStarts(), 30000);
        setInterval(() => this.syncLiveViewers(), 300000); // 5 Minutes
        setInterval(() => this.watchEmptyViewers(), 600000); // 10 Minutes
        setInterval(() => this.runHourlyTasks(), 3600000); // 1 Hour
    }

    private async syncLiveViewers() {
        console.log('[AutomationEngine] Syncing live viewer counts from YouTube API...');
        for (let [id, desc] of this.sm.activeStreams) {
            // Kita fokus pada channel OAuth yang terhubung
            const searchName = desc.meta?.channel_name;
            if (!searchName) continue;

            try {
                dbLayer.db.get(`SELECT channel_id FROM youtube_channels WHERE channel_name = ? AND auth_type = 'OAuth' LIMIT 1`, 
                [searchName], async (err, row: any) => {
                    if (row) {
                        await ytApi.execute(async (youtube) => {
                            const res = await youtube.liveBroadcasts.list({
                                part: ['statistics', 'status'],
                                broadcastStatus: 'active',
                                broadcastType: 'all'
                            });

                            if (res.data.items && res.data.items.length > 0) {
                                const stats = res.data.items[0].statistics;
                                const concurrentViewers = parseInt(stats?.concurrentViewers || '0');
                                desc.viewers = concurrentViewers;
                                console.log(`[AutomationEngine] Updated viewers for ${searchName}: ${concurrentViewers}`);
                                
                                // Milestone Alert
                                if (concurrentViewers >= 100 && (desc as any).lastMilestone !== 100) {
                                    (desc as any).lastMilestone = 100;
                                    telegramService.sendMessage(`🚀 <b>HOT STREAM!</b> Channel <i>${searchName}</i> menembus <b>100 penonton</b>!`).catch(() => {});
                                }
                            }
                        }, row.channel_id);
                    }
                });
            } catch (e) {
                console.warn(`[AutomationEngine] Failed to sync viewers for ${id}:`, (e as any).message);
            }
        }
    }

    private async runHourlyTasks() {
        // Buang Sampah (Cleanup)
        this.trashCleanup();
        dbLayer.rotateLogs(2000); // Bertambah: Simpan 2000 log terakhir setiap jam
        
        if (await this.isRuleEnabled('Health Pulse Monitoring')) {
            this.sendHealthPulse();
        }
        if (await this.isRuleEnabled('SEO Hourly Title Rotator')) {
            this.rotateStreamSEO();
        }
    }

    private async sendHealthPulse() {
        const activeCount = this.sm.activeStreams.size;
        let message = `💓 <b>Apixs Health Pulse:</b> System OK.\nStreams Active: <b>${activeCount}</b>\nServer Uptime: <b>${Math.floor(process.uptime() / 3600)}h</b>`;
        
        if (activeCount > 0) {
            message += `\n\n<b>Details:</b>`;
            for (let [id, desc] of this.sm.activeStreams) {
                message += `\n• ${id}: ${desc.viewers || 0} viewers`;
            }
        }
        telegramService.sendMessage(message).catch(() => {});
    }

    private async rotateStreamSEO() {
        for (let [id, desc] of this.sm.activeStreams) {
            this.runSeoUpdate(id, desc); 
        }
    }

    async watchEmptyViewers() {
        if (!(await this.isRuleEnabled('Anti-Zonkz Stream'))) return;
        console.log('[AutomationEngine] Checking for empty viewer streams...');
        const now = Date.now();
        for (let [id, desc] of this.sm.activeStreams) {
            const viewers = desc.viewers !== undefined ? desc.viewers : -1; 
            
            const startedAt = desc.startedAt || now;
            const runningMinutes = (now - startedAt) / 60000;
            const lastRotate = this.rotateCooldown.get(id) || 0;
            const cooldownOk = (now - lastRotate) > 600000;

            if (id.startsWith('sched-') && viewers === 0 && runningMinutes > 5 && cooldownOk) {
                const refreshMsg = `[Auto-Refresh] Penonton terdeteksi 0 selama >5 menit. Memutar ulang konten untuk <b>${id}</b>.`;
                this.sm.emitLog(id, 'warn', refreshMsg);
                dbLayer.saveSystemLog('AUTOMATION', 'warn', refreshMsg).catch(() => {});
                this.rotateCooldown.set(id, now);
                this.rotateScheduledStream(id.replace('sched-', ''));
            }
        }
    }

    async rotateScheduledStream(scheduleId: string) {
        dbLayer.db.get(`SELECT * FROM schedules WHERE id = ?`, [scheduleId], (err, schedule: any) => {
            if (err || !schedule) return;
            if (!schedule.stream_key) {
                console.warn('[AutomationEngine] stream_key kosong, rotasi dibatalkan.');
                return;
            }

            const streamUrl = config.RTMP_BASE_URL;
            const meta: StreamMeta = {
                server_id: 'auto-refresh-engine',
                input_source: schedule.playlist_path || 'testsrc=size=1280x720',
                rtmp_url: streamUrl,
                stream_key: schedule.stream_key,
                is_concat: !!schedule.playlist_path,
                loop_mode: 'repeat_all'
            };

            this.sm.stopStream(`sched-${scheduleId}`);
            setTimeout(() => {
                this.sm.startStream(`sched-${scheduleId}`, meta);
            }, 3000);
        });
    }

    async checkScheduledAutoStarts() {
        try {
            dbLayer.db.all(`SELECT * FROM schedules WHERE status = 'SCHEDULED'`, [], async (err, rows: any[]) => {
                if (err) return;
                const now = Date.now();
                const nowStr = new Date().toISOString();

                for (let schedule of rows) {
                    const startTime = new Date(schedule.start_time).getTime();
                    if (startTime <= now) {
                        const startMsg = `[Auto Start Live] Waktu jadwal <b>${schedule.name}</b> telah tiba. Menyiapkan worker...`;
                        this.sm.emitLog(`sched-${schedule.id}`, 'info', startMsg);

                        // Pick Best Node
                        const node = await this.pickBestNode();
                        const nodeId = node ? node.id : 'local-vps';
                        
                        if (schedule.is_recurring) {
                            const nextStart = new Date(startTime + 86400000).toISOString();
                            const nextEnd = schedule.end_time ? new Date(new Date(schedule.end_time).getTime() + 86400000).toISOString() : null;
                            dbLayer.db.run(`UPDATE schedules SET start_time = ?, end_time = ?, status = 'SCHEDULED' WHERE id = ?`, [nextStart, nextEnd, schedule.id]);
                        } else {
                            dbLayer.db.run(`UPDATE schedules SET status = 'RUNNING' WHERE id = ?`, [schedule.id]);
                        }

                        const meta: StreamMeta = {
                            server_id: nodeId,
                            input_source: schedule.playlist_path || 'testsrc=size=1280x720',
                            rtmp_url: config.RTMP_BASE_URL,
                            stream_key: schedule.stream_key || 'testkey123',
                            channel_name: schedule.name,
                            niche: schedule.name,
                            is_concat: !!schedule.playlist_path,
                            loop_mode: 'repeat_all',
                            youtube_account_id: schedule.youtube_account_id
                        };

                        if (!node || node.id === 'node-1') {
                            this.sm.startStream(`sched-${schedule.id}`, meta);
                        } else {
                            console.log(`[AutomationEngine] Remote start on ${node.name}: ${node.url}`);
                            // Logic for remote API call would go here
                        }
                    }
                }
            });

            // Check for Stop Time
            dbLayer.db.all(`SELECT * FROM schedules WHERE status = 'RUNNING' AND end_time IS NOT NULL`, [], (err, rows: any[]) => {
                if (err) return;
                const now = Date.now();
                for (let schedule of rows) {
                    if (new Date(schedule.end_time).getTime() <= now) {
                        const stopMsg = `[Auto Stop Live] Batas waktu jadwal <b>${schedule.name}</b> tercapai. Mematikan worker.`;
                        this.sm.emitLog(`sched-${schedule.id}`, 'warn', stopMsg);
                        this.sm.stopStream(`sched-${schedule.id}`);
                        dbLayer.db.run(`UPDATE schedules SET status = 'COMPLETED' WHERE id = ?`, [schedule.id]);
                    }
                }
            });
        } catch (e) {
            console.error('[AutomationEngine] Error checking schedules:', e);
        }
    }

    private async pickBestNode(): Promise<any> {
        return new Promise((resolve) => {
            dbLayer.db.all(`SELECT * FROM nodes WHERE status = 'ONLINE' ORDER BY load ASC LIMIT 1`, [], (err, rows) => {
                if (err || !rows.length) resolve(null);
                else resolve(rows[0]);
            });
        });
    }

    private trashCleanup() {
        console.log('[AutomationEngine] Running system trash cleanup...');
        try {
            // 1. Rotate Database Logs
            dbLayer.rotateLogs(500);

            // 2. Clean Manifest & Sched Files
            if (fs.existsSync(config.UPLOADS_DIR)) {
                const files = fs.readdirSync(config.UPLOADS_DIR);
                const now = Date.now();
                files.forEach(f => {
                    const fullPath = path.join(config.UPLOADS_DIR, f);
                    const stats = fs.statSync(fullPath);
                    const ageHours = (now - stats.mtimeMs) / 3600000;

                    // Hapus file manifest/sched lama (> 6 jam)
                    if ((f.startsWith('playlist_live-') || f.startsWith('sched_')) && ageHours > 6) {
                        fs.unlinkSync(fullPath);
                    }
                    
                    // Hapus video hasil optimasi (_proc_) yang tidak digunakan (> 48 jam)
                    if (f.includes('_proc_') && ageHours > 48) {
                        fs.unlinkSync(fullPath);
                    }
                });
            }
        } catch (e) {
            console.error('[AutomationEngine] Cleanup error:', e);
        }
    }

    private async isRuleEnabled(ruleName: string): Promise<boolean> {
        return new Promise((resolve) => {
            dbLayer.db.get(`SELECT enabled FROM automation_rules WHERE name = ?`, [ruleName], (err, row: any) => {
                if (err || !row) resolve(false);
                else resolve(row.enabled === 1 || row.enabled === true);
            });
        });
    }

    async onStreamStart(streamId: string, meta: any) {
        if (await this.isRuleEnabled('Auto-SEO Niche Optimizer')) {
            this.sm.emitLog(streamId, 'info', `[Automations] Menjalankan rule otomatisasi untuk stream baru...`);
            this.runSeoUpdate(streamId, meta);
        }

        if (await this.isRuleEnabled('Auto-Stop Duration')) {
            this.setupAutoEnd(streamId);
        }
    }

    private async runSeoUpdate(streamId: string, meta: any) {
        try {
            const searchName = meta.channel_name || meta.title || meta.name;
            
            dbLayer.db.get(`SELECT channel_id FROM youtube_channels WHERE channel_name = ? AND auth_type = 'OAuth' ORDER BY created_at DESC LIMIT 1`, 
                [searchName], 
                async (err, row: any) => {
                    if (err) return this.sm.emitLog(streamId, 'error', `[Auto-SEO Niche] Gagal melacak channel tujuan: ${err.message}`);
                    
                    const targetChannelId = row ? row.channel_id : null;
                    if (!targetChannelId) {
                        this.sm.emitLog(streamId, 'info', `[Auto-SEO Niche] Nama channel "${searchName}" tidak ditemukan di Manajemen Akun. Menggunakan channel default.`);
                    }
                    
                    try {
                        await ytApi.execute(async (youtube) => {
                            const prefixes = ['🔴 MUST WATCH!', '🔥 BEST OF', '24/7 LIVE:', '🚀 NON-STOP:', '💎 PREMIUM:', '✨ HOT!'];
                            const suffixes = ['NOW', 'LIVE', '2024', 'STREAM', 'BEST CONTENT', 'ULTRA HD'];
                            const emojis = ['🔴', '🔥', '🚀', '✨', '💎', '📍', '⭐'];
                            
                            const selectedPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                            const selectedSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
                            const selectedEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                            
                            const safeCategory = (meta.niche || meta.channel_name || 'Livestream').replace(/[^a-zA-Z0-9 -]/g, '').trim();
                            const autoTitle = `${selectedEmoji} ${selectedPrefix} ${safeCategory} | ${selectedSuffix} ${new Date().getFullYear()}`;
                            
                            const broadcasts = await youtube.liveBroadcasts.list({
                                part: ['snippet', 'status'],
                                broadcastStatus: 'active',
                                broadcastType: 'all'
                            });

                            if (broadcasts.data.items && broadcasts.data.items.length > 0) {
                                const activeBroadcast = broadcasts.data.items[0];
                                const wordsForTags = safeCategory.split(' ').filter((w: string) => w.length > 3);
                                const baseTags = ['live', 'stream', '24/7', 'youtube live', 'trending', 'viral', 'latest', 'today', 'live broadcasting'];
                                const autoTags = Array.from(new Set([...baseTags, safeCategory, ...wordsForTags])).slice(0, 15);
                                
                                const descriptions = [
                                    `🔴 LIVE NOW: ${safeCategory} Non-Stop 24/7!\n\nWelcome to our 24/7 non-stop broadcast. Sit back, relax, and enjoy the best ${safeCategory} content happening right now!`,
                                    `🔥 STREAMING 24/7: ${safeCategory} | Non-Stop Entertainment!\n\nEnjoy the most curated ${safeCategory} content live right now. Subscribe for more!`,
                                    `🚀 ${safeCategory} LIVE: The Ultimate 24/7 Experience!\n\nWe bring you the highest quality ${safeCategory} content around the clock. Join the chat and enjoy the vibes!`
                                ];
                                const selectedDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
                                
                                const footer = `\n\n🔔 Show your support by hitting the LIKE, SHARE, and SUBSCRIBE buttons so you won't miss our upcoming broadcasts.\n\n📅 Stream Started: ${new Date().toLocaleString('en-US')}\n🚀 Automated by APIXS Engine 24/7.\n\n#Live #YouTubeLive #Trending #Viral #${safeCategory.replace(/[\s-]+/g, '')} #LiveStream`;
                                
                                const autoDescription = selectedDesc + footer;

                                await youtube.liveBroadcasts.update({
                                    part: ['snippet'],
                                    requestBody: {
                                        id: activeBroadcast.id,
                                        snippet: {
                                            title: autoTitle,
                                            description: autoDescription,
                                            scheduledStartTime: activeBroadcast.snippet?.scheduledStartTime
                                        }
                                    }
                                });
                                const successMsg = `[YouTube API] SEO Update berhasil untuk <b>${meta.channel_name}</b>! (Judul: ${autoTitle})`;
                                this.sm.emitLog(streamId, 'success', successMsg);
                                dbLayer.saveSystemLog('AUTOMATION', 'info', successMsg).catch(() => {});
                                telegramService.sendMessage(`✅ <b>Automation SEO:</b> Judul & Deskripsi updated untuk channel <i>${meta.channel_name}</i>.`).catch(() => {});
                            } else {
                                this.sm.emitLog(streamId, 'warn', `[YouTube API] Tidak ada Active Broadcast yang ditemukan untuk diupdate judulnya.`);
                            }
                        }, targetChannelId);
                    } catch (apiErr: any) {
                        this.sm.emitLog(streamId, 'error', `[Auto Title & Desc] Eksekusi tertunda/gagal: ${apiErr.message}`);
                    }
                }
            );
        } catch (e: any) {
            this.sm.emitLog(streamId, 'error', `[Auto Title & Desc] Error internal sistem: ${e.message}`);
        }
    }

    private setupAutoEnd(streamId: string) {
        const durationHours = 12;
        const delayMs = durationHours * 60 * 60 * 1000;

        if (this.autoEndTimers.has(streamId)) {
            clearTimeout(this.autoEndTimers.get(streamId)!);
        }

        const timer = setTimeout(() => {
            this.sm.emitLog(streamId, 'warn', `[Auto End Stream] Durasi batas ${durationHours} jam tercapai. Mematikan stream secara otomatis untuk menyimpan VOD.`);
            this.sm.stopStream(streamId);
        }, delayMs);

        this.autoEndTimers.set(streamId, timer);
        this.sm.emitLog(streamId, 'info', `[Auto End Stream] Aktif. Sistem akan menghentikan stream ini secara otomatis dalam ${durationHours} jam.`);
    }

    onStreamStop(streamId: string) {
        const timer = this.autoEndTimers.get(streamId);
        if (timer) {
            clearTimeout(timer);
            this.autoEndTimers.delete(streamId);
            console.log(`[AutomationEngine] Auto End timer for ${streamId} cleared.`);
        }
    }
}

export default AutomationEngine;
