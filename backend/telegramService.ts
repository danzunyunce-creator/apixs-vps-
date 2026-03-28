import axios from 'axios';
import * as dbLayer from './database';

export class TelegramService {
    private async getTelegramConfig(): Promise<{ token: string; chatId: string }> {
        return new Promise((resolve, reject) => {
            dbLayer.db.all(`SELECT key, value FROM app_config WHERE key IN ('telegram_bot_token', 'telegram_chat_id')`, [], (err, rows: any[]) => {
                if (err) return reject(err);
                const cfg: any = {};
                rows.forEach(r => { cfg[r.key] = r.value; });
                if (!cfg.telegram_bot_token || !cfg.telegram_chat_id) {
                    return reject(new Error('Telegram credentials not configured.'));
                }
                resolve({ token: cfg.telegram_bot_token, chatId: cfg.telegram_chat_id });
            });
        });
    }

    public async sendMessage(message: string): Promise<void> {
        try {
            const { token, chatId } = await this.getTelegramConfig();
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            await axios.post(url, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
            console.log('[TelegramService] Notification sent successfully.');
        } catch (err: any) {
            console.error('[TelegramService] Failed to send notification:', err.message);
        }
    }
}

export const telegramService = new TelegramService();
