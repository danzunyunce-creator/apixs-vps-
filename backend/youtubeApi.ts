import { google, youtube_v3 } from 'googleapis';
import * as dbLayer from './database';
import { telegramService } from './telegramService';
import https from 'https';

const httpsAgent = new https.Agent({ keepAlive: true });

class YoutubeApiManager {
    private quotaLockUntil: number | null = null;

    constructor() {
        this.quotaLockUntil = null;
    }

    private getResetDelayMs(): number {
        const resetTime = new Date();
        resetTime.setHours(16, 0, 0, 0); // Reset at 16:00
        if (Date.now() > resetTime.getTime()) resetTime.setDate(resetTime.getDate() + 1);
        return resetTime.getTime() - Date.now();
    }

    private async getOAuthConfig(): Promise<{ yt_client_id: string; yt_client_secret: string }> {
        return new Promise((resolve, reject) => {
            dbLayer.db.all(`SELECT key, value FROM app_config WHERE key IN ('yt_client_id', 'yt_client_secret')`, [], (err, rows: any[]) => {
                if (err) return reject(err);
                const cfg: any = {};
                rows.forEach(r => { cfg[r.key] = r.value; });
                if (!cfg.yt_client_id || !cfg.yt_client_secret) {
                    return reject(new Error('OAuth Credentials belum di-set di Pengaturan (Client ID / Secret).'));
                }
                resolve(cfg as { yt_client_id: string; yt_client_secret: string });
            });
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
            if (err.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
                const msg = '⚠️ [API] YouTube Quota Exceeded. Fitur SEO & Analytics akan tertidur sampai reset jam 16:00 WIB.';
                console.warn(msg);
                
                dbLayer.saveSystemLog(null, 'warn', msg).catch(() => {});
                telegramService.sendMessage(`🚨 <b>API ALERT:</b> ${msg}`).catch(() => {});

                this.quotaLockUntil = Date.now() + this.getResetDelayMs();
                throw new Error('Semua API Key kehabisan Kuota. Smart Delay diaktifkan.');
            }
            throw err;
        }
    }
}

export const youtubeApi = new YoutubeApiManager();
// Add back compatible direct exports if needed, or update consumers
export const execute = youtubeApi.execute.bind(youtubeApi);
