import { google, youtube_v3 } from 'googleapis';
import * as dbLayer from './database';
import { telegramService } from './telegramService';
import https from 'https';
import { CryptoProvider } from './utils/cryptoProvider';

const httpsAgent = new https.Agent({ keepAlive: true });

class YoutubeApiManager {
    private quotaLockUntil: number | null = null;
    private usingBackupKey: boolean = false;
    private backupKeyExhausted: boolean = false;

    constructor() {
        this.quotaLockUntil = null;
    }

    private getResetDelayMs(): number {
        const resetTime = new Date();
        resetTime.setHours(16, 0, 0, 0); // YouTube quota reset at 16:00 WIB (UTC+8 = 08:00 UTC)
        if (Date.now() > resetTime.getTime()) resetTime.setDate(resetTime.getDate() + 1);
        return resetTime.getTime() - Date.now();
    }

    private async getOAuthConfig(): Promise<{ yt_client_id: string; yt_client_secret: string }> {
        return new Promise((resolve, reject) => {
            // Jika sedang failover, coba ambil Backup OAuth Credentials dulu
            const keys = this.usingBackupKey
                ? ['yt_client_id_2', 'yt_client_secret_2']
                : ['yt_client_id', 'yt_client_secret'];

            const keyPlaceholders = keys.map(() => '?').join(', ');
            dbLayer.db.all(
                `SELECT key, value FROM app_config WHERE key IN (${keyPlaceholders})`,
                keys,
                (err, rows: any[]) => {
                    if (err) return reject(err);
                    const cfg: any = {};
                    rows.forEach(r => { cfg[r.key] = r.value; });

                    const clientIdKey   = this.usingBackupKey ? 'yt_client_id_2'     : 'yt_client_id';
                    const clientSecKey  = this.usingBackupKey ? 'yt_client_secret_2'  : 'yt_client_secret';

                    const clientId     = CryptoProvider.decrypt(cfg[clientIdKey]);
                    const clientSecret = CryptoProvider.decrypt(cfg[clientSecKey]);

                    if (!clientId || !clientSecret) {
                        const label = this.usingBackupKey ? 'Backup' : 'Primary';
                        return reject(new Error(`${label} OAuth Credentials belum di-set di Pengaturan.`));
                    }
                    resolve({ yt_client_id: clientId, yt_client_secret: clientSecret });
                }
            );
        });
    }

    private async getChannelAuth(targetChannelId: string | null = null): Promise<any> {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM youtube_channels WHERE auth_type = 'OAuth' AND refresh_token IS NOT NULL AND refresh_token != ''`;
            let params: any[] = [];
            if (targetChannelId) {
                query += ` AND channel_id = ?`;
                params.push(targetChannelId);
            }
            query += ` ORDER BY created_at DESC LIMIT 1`;

            dbLayer.db.get(query, params, (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('Tidak ada channel terhubung dengan OAuth. Harap login kembali di Manajemen Akun.'));
                resolve(row);
            });
        });
    }

    /** 
     * Beralih ke Backup OAuth Key saat primary quota habis.
     * Reset otomatis ke Primary setelah jam reset YouTube (16:00 WIB).
     */
    private async activateBackupKeyFailover(): Promise<boolean> {
        if (this.backupKeyExhausted) return false;

        // Cek apakah backup key tersedia di database
        return new Promise((resolve) => {
            dbLayer.db.get(
                `SELECT value FROM app_config WHERE key = 'yt_client_id_2'`,
                [],
                (err, row: any) => {
                    const backupId = row?.value ? CryptoProvider.decrypt(row.value) : null;
                    if (backupId) {
                        this.usingBackupKey = true;
                        const msg = '🔄 <b>API FAILOVER:</b> Primary YouTube OAuth Key kuota habis. Beralih ke <b>Backup Key</b> secara otomatis.';
                        console.warn('[YoutubeApiManager] ' + msg);
                        telegramService.sendMessage(msg).catch(() => {});
                        dbLayer.saveSystemLog(null, 'warn', msg).catch(() => {});

                        // Auto-reset ke primary key setelah jam reset quota
                        const resetDelay = this.getResetDelayMs();
                        setTimeout(() => {
                            this.usingBackupKey = false;
                            this.backupKeyExhausted = false;
                            this.quotaLockUntil = null;
                            console.log('[YoutubeApiManager] ✅ Quota reset \u2014 kembali ke Primary Key.');
                            telegramService.sendMessage('✅ <b>API RECOVERY:</b> Quota YouTube direset. Kembali menggunakan Primary API Key.').catch(() => {});
                        }, resetDelay);

                        resolve(true);
                    } else {
                        resolve(false); // Tidak ada backup key
                    }
                }
            );
        });
    }

    public async execute<T>(actionFn: (youtube: youtube_v3.Youtube, channel: any) => Promise<T>, targetChannelId: string | null = null): Promise<T> {
        if (this.quotaLockUntil && Date.now() < this.quotaLockUntil) {
            throw new Error('Sistem API Terkunci (Global Limit). Menunggu reset jam 16:00.');
        }

        try {
            const cfg = await this.getOAuthConfig();
            const channel = await this.getChannelAuth(targetChannelId);

            const redirectRow: any = await new Promise((res, rej) => {
                dbLayer.db.get(`SELECT value FROM app_config WHERE key = 'app_redirect_url'`, [], (e, r) => e ? rej(e) : res(r));
            });
            const REDIRECT_URL = (redirectRow && redirectRow.value) 
                ? redirectRow.value 
                : 'http://localhost:3001/api/youtube/oauth-callback';

            const oauth2Client = new google.auth.OAuth2(
                cfg.yt_client_id,
                cfg.yt_client_secret,
                REDIRECT_URL
            );

            // Optimization: Keep-alive for low-latency API calls
            (oauth2Client as any).transporter.defaults.httpsAgent = httpsAgent;

            oauth2Client.setCredentials({ refresh_token: channel.refresh_token });

            const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

            return await actionFn(youtube, channel);
            
        } catch (err: any) {
            // --- 🔄 SMART FAILOVER: Primary Key Quota Exceeded ---
            if (err.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
                if (!this.usingBackupKey) {
                    // Coba failover ke backup key
                    const failedOver = await this.activateBackupKeyFailover();
                    if (failedOver) {
                        console.log('[YoutubeApiManager] Retrying dengan Backup Key...');
                        return this.execute(actionFn, targetChannelId); // Retry dengan backup
                    }
                } else {
                    // Backup key juga habis
                    this.backupKeyExhausted = true;
                }

                const msg = '🚨 <b>API CRITICAL:</b> Semua YouTube API Key habis kuota. Fitur SEO & Analytics dinonaktifkan sampai reset jam 16:00 WIB.';
                console.warn('[YoutubeApiManager] ' + msg);
                dbLayer.saveSystemLog(null, 'warn', msg).catch(() => {});
                telegramService.sendMessage(msg).catch(() => {});

                this.quotaLockUntil = Date.now() + this.getResetDelayMs();
                throw new Error('Semua API Key kehabisan Kuota. Smart Delay diaktifkan hingga reset jam 16:00.');
            }
            throw err;
        }
    }
}

export const youtubeApi = new YoutubeApiManager();
export const execute = youtubeApi.execute.bind(youtubeApi);

