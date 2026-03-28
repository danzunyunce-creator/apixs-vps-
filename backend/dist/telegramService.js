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
exports.telegramService = exports.TelegramService = void 0;
const axios_1 = __importDefault(require("axios"));
const dbLayer = __importStar(require("./database"));
class TelegramService {
    async getTelegramConfig() {
        return new Promise((resolve, reject) => {
            dbLayer.db.all(`SELECT key, value FROM app_config WHERE key IN ('telegram_bot_token', 'telegram_chat_id')`, [], (err, rows) => {
                if (err)
                    return reject(err);
                const cfg = {};
                rows.forEach(r => { cfg[r.key] = r.value; });
                if (!cfg.telegram_bot_token || !cfg.telegram_chat_id) {
                    return reject(new Error('Telegram credentials not configured.'));
                }
                resolve({ token: cfg.telegram_bot_token, chatId: cfg.telegram_chat_id });
            });
        });
    }
    async sendMessage(message) {
        try {
            const { token, chatId } = await this.getTelegramConfig();
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            await axios_1.default.post(url, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
            console.log('[TelegramService] Notification sent successfully.');
        }
        catch (err) {
            console.error('[TelegramService] Failed to send notification:', err.message);
        }
    }
}
exports.TelegramService = TelegramService;
exports.telegramService = new TelegramService();
