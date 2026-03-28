import express from 'express';
import { google } from 'googleapis';
import * as dbLayer from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { AutomationEngine } from '../automationEngine';
import config from '../config';
import * as ytApi from '../youtubeApi';

const router = express.Router();

export const createAutomationRouter = (autoEngine: AutomationEngine) => {
    
    // 1. YT OAUTH URL
    router.get('/youtube/auth-url', async (req, res) => {
        dbLayer.db.all(`SELECT key, value FROM app_config WHERE key IN ('yt_client_id', 'yt_client_secret')`, [], async (err, rows: any[]) => {
            if (err) return res.status(500).json({ error: err.message });
            const cfg: any = {};
            rows.forEach(r => { cfg[r.key] = r.value; });
            
            if (!cfg.yt_client_id || !cfg.yt_client_secret) {
                return res.status(400).json({ error: 'Client ID dan Client Secret belum dikonfigurasi di Pengaturan.' });
            }
            
            const redirectRow: any = await new Promise((res) => {
                dbLayer.db.get(`SELECT value FROM app_config WHERE key = 'app_redirect_url'`, [], (e, r) => res(r));
            });
            const REDIRECT_URL = (redirectRow && redirectRow.value) 
                ? redirectRow.value 
                : `${req.protocol}://${req.get('host')}/api/youtube/oauth-callback`;

            const oauth2Client = new google.auth.OAuth2(cfg.yt_client_id, cfg.yt_client_secret, REDIRECT_URL);
            
            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                prompt: 'consent',
                scope: [
                    'https://www.googleapis.com/auth/youtube.readonly',
                    'https://www.googleapis.com/auth/youtube.force-ssl'
                ]
            });
            
            res.json({ url });
        });
    });

    // 2. YT OAUTH CALLBACK
    router.get('/youtube/oauth-callback', (req, res) => {
        const code = req.query.code as string;
        if (!code) return res.status(400).send('No code provided');

        dbLayer.db.all(`SELECT key, value FROM app_config WHERE key IN ('yt_client_id', 'yt_client_secret')`, [], async (err, rows: any[]) => {
            if (err) return res.status(500).send(err.message);
            const cfg: any = {};
            rows.forEach(r => { cfg[r.key] = r.value; });
            
            const redirectRow: any = await new Promise((res) => {
                dbLayer.db.get(`SELECT value FROM app_config WHERE key = 'app_redirect_url'`, [], (e, r) => res(r));
            });
            const REDIRECT_URL = (redirectRow && redirectRow.value) 
                ? redirectRow.value 
                : `${req.protocol}://${req.get('host')}/api/youtube/oauth-callback`;

            const oauth2Client = new google.auth.OAuth2(cfg.yt_client_id, cfg.yt_client_secret, REDIRECT_URL);
            
            try {
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);
                
                const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
                const channelRes = await youtube.channels.list({
                    part: ['snippet', 'statistics'],
                    mine: true
                });
                
                if (!channelRes.data.items || channelRes.data.items.length === 0) {
                    return res.status(404).send('No YouTube channel found for this account.');
                }
                
                const ch = channelRes.data.items[0];
                const channelId = ch.id!;
                const channelName = ch.snippet?.title || 'Unknown';
                const channelThumb = ch.snippet?.thumbnails?.default?.url || '';
                const subs = ch.statistics?.subscriberCount || '0';
                
                const id = 'ch-' + Date.now();
                dbLayer.db.run(
                    `INSERT INTO youtube_channels (id, user_id, channel_id, channel_name, channel_thumbnail, subscriber_count, platform, auth_type, access_token, refresh_token) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, 'user-1', channelId, channelName, channelThumb, subs, 'YouTube', 'OAuth', tokens.access_token, tokens.refresh_token || ''],
                    function (err) {
                        if (err) return res.status(500).send(err.message);
                        res.send(`<html><body><h2>Autentikasi Berhasil!</h2><p>Channel <b>${channelName}</b> terhubung. Jendela tutup otomatis.</p><script>setTimeout(() => window.close(), 3000)</script></body></html>`);
                    }
                );
            } catch (error: any) {
                res.status(500).send('Authentication failed: ' + error.message);
            }
        });
    });

    // 3. CHANNELS
    router.get('/youtube/channels', authMiddleware, (req: AuthRequest, res) => {
        const userId = req.user!.id;
        dbLayer.db.all(`SELECT * FROM youtube_channels WHERE user_id = ? OR user_id = 'user-1' ORDER BY created_at DESC`, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    router.delete('/youtube/channels/:id', authMiddleware, (req, res) => {
        dbLayer.db.run(`DELETE FROM youtube_channels WHERE id = ?`, [req.params.id], function(err) {
             if (err) return res.status(500).json({ error: err.message });
             res.json({ message: 'Channel deleted' });
        });
    });

    router.get('/rules', authMiddleware, (req, res) => {
        dbLayer.db.all(`SELECT * FROM automation_rules ORDER BY created_at ASC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    router.put('/rules/:id/toggle', authMiddleware, (req, res) => {
        const { enabled } = req.body;
        dbLayer.db.run(`UPDATE automation_rules SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });

    router.get('/logs', authMiddleware, async (req, res) => {
        dbLayer.db.all(`SELECT * FROM system_logs WHERE stream_id = 'AUTOMATION' ORDER BY created_at DESC LIMIT 50`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    router.post('/trigger-seo', authMiddleware, async (req, res) => {
        try {
            (autoEngine as any).runHourlyTasks(); // Trigger manually
            res.json({ message: 'SEO Rotation Triggered' });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    // 5. GENERIC SEO GENERATOR (For Pipeline)
    router.post('/seo', authMiddleware, async (req, res) => {
        const { videoId, streamId } = req.body;
        const prefixes = ['🔴 LIVE!', '🔥 NON-STOP', '🚀 24/7:', '✨ BEST OF'];
        const autoTitle = `${prefixes[Math.floor(Math.random()*prefixes.length)]} Stream ${Date.now().toString().slice(-4)}`;
        const autoDesc = `Otomatis dihasilkan oleh AI Pipeline.\n\n#Live #Stream #24/7`;
        
        if (streamId) {
            dbLayer.db.run(`UPDATE streams SET auto_title = ?, auto_description = ? WHERE id = ?`, [autoTitle, autoDesc, streamId]);
        }
        res.json({ title: autoTitle, description: autoDesc });
    });

    // 6. THUMBNAIL GENERATOR (For Pipeline)
    router.post('/thumbnail', authMiddleware, async (req, res) => {
        const { videoId } = req.body;
        dbLayer.db.get(`SELECT filepath FROM videos WHERE id = ?`, [videoId], async (err, row: any) => {
            if (!row) return res.status(404).json({ error: 'Video not found' });
            res.json({ thumbnail: `thumb_auto_${videoId}.jpg`, message: 'Thumbnail queued' });
        });
    });

    return router;
};

export default router;
