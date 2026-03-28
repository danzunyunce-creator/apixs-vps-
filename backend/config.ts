import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });

export interface Config {
  PORT: string | number;
  UPLOADS_DIR: string;
  DB_PATH: string;
  RTMP_BASE_URL: string;
  FRONTEND_DIST: string;
  API_PREFIX: string;
  JWT_SECRET: string;
  FFMPEG_PATH: string;
  TELEGRAM: {
    TEST_MSG: string;
  };
}

const config: Config = {
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
export default config;
