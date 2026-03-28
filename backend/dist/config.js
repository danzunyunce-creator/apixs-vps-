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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
dotenv.config({ path: path.join(__dirname, '../.env') });
const config = {
    PORT: process.env.PORT || 3001,
    UPLOADS_DIR: path.join(__dirname, 'uploads'),
    DB_PATH: path.join(__dirname, 'streamflow.db'),
    RTMP_BASE_URL: process.env.RTMP_BASE_URL || 'rtmp://a.rtmp.youtube.com/live2',
    FRONTEND_DIST: path.join(__dirname, '../dist'),
    API_PREFIX: '/api',
    JWT_SECRET: process.env.JWT_SECRET || 'apixs_secret_key_2024_secure',
    FFMPEG_PATH: process.env.FFMPEG_PATH || (fs.existsSync(path.join(__dirname, 'bin/ffmpeg.exe')) ? path.join(__dirname, 'bin/ffmpeg.exe') : 'ffmpeg'),
    TELEGRAM: {
        TEST_MSG: '🔴 <b>Test Notifikasi ApixsLive</b>\n\nKonfigurasi Telegram berhasil terhubung!'
    }
};
console.log(`[Config] FFMPEG_PATH resolved to: ${config.FFMPEG_PATH}`);
exports.default = config;
