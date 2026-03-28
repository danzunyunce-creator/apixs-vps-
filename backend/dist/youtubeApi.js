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
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.youtubeApi = void 0;
const googleapis_1 = require("googleapis");
const dbLayer = __importStar(require("./database"));
class YoutubeApiManager {
    quotaLockUntil = null;
    constructor() {
        this.quotaLockUntil = null;
    }
    getResetDelayMs() {
        const resetTime = new Date();
        resetTime.setHours(16, 0, 0, 0); // Reset at 16:00
        if (Date.now() > resetTime.getTime())
            resetTime.setDate(resetTime.getDate() + 1);
        return resetTime.getTime() - Date.now();
    }
    async getOAuthConfig() {
        return new Promise((resolve, reject) => {
            dbLayer.db.all(`SELECT key, value FROM app_config WHERE key IN ('yt_client_id', 'yt_client_secret')`, [], (err, rows) => {
                if (err)
                    return reject(err);
                const cfg = {};
                rows.forEach(r => { cfg[r.key] = r.value; });
                if (!cfg.yt_client_id || !cfg.yt_client_secret) {
                    return reject(new Error('OAuth Credentials belum di-set di Pengaturan (Client ID / Secret).'));
                }
                resolve(cfg);
            });
        });
    }
    async getChannelAuth(targetChannelId = null) {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM youtube_channels WHERE auth_type = 'OAuth' AND refresh_token IS NOT NULL AND refresh_token != ''`;
            let params = [];
            if (targetChannelId) {
                query += ` AND channel_id = ?`;
                params.push(targetChannelId);
            }
            query += ` ORDER BY created_at DESC LIMIT 1`;
            dbLayer.db.get(query, params, (err, row) => {
                if (err)
                    return reject(err);
                if (!row)
                    return reject(new Error('Tidak ada channel terhubung dengan OAuth. Harap login kembali di Manajemen Akun.'));
                resolve(row);
            });
        });
    }
    async execute(actionFn, targetChannelId = null) {
        if (this.quotaLockUntil && Date.now() < this.quotaLockUntil) {
            throw new Error('Sistem API Terkunci (Global Limit). Menunggu reset jam 16:00.');
        }
        try {
            const cfg = await this.getOAuthConfig();
            const channel = await this.getChannelAuth(targetChannelId);
            const redirectRow = await new Promise((res, rej) => {
                dbLayer.db.get(`SELECT value FROM app_config WHERE key = 'app_redirect_url'`, [], (e, r) => e ? rej(e) : res(r));
            });
            const REDIRECT_URL = (redirectRow && redirectRow.value)
                ? redirectRow.value
                : 'http://localhost:3001/api/youtube/oauth-callback';
            const oauth2Client = new googleapis_1.google.auth.OAuth2(cfg.yt_client_id, cfg.yt_client_secret, REDIRECT_URL);
            oauth2Client.setCredentials({ refresh_token: channel.refresh_token });
            const youtube = googleapis_1.google.youtube({ version: 'v3', auth: oauth2Client });
            return await actionFn(youtube, channel);
        }
        catch (err) {
            if (err.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
                console.warn(`[API] OAuth Quota Limit reached.`);
                this.quotaLockUntil = Date.now() + this.getResetDelayMs();
                throw new Error('Semua API Key kehabisan Kuota. Smart Delay diaktifkan.');
            }
            throw err;
        }
    }
}
exports.youtubeApi = new YoutubeApiManager();
// Add back compatible direct exports if needed, or update consumers
exports.execute = exports.youtubeApi.execute.bind(exports.youtubeApi);
