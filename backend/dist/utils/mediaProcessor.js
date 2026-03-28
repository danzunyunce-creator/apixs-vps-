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
exports.MediaProcessor = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dbLayer = __importStar(require("../database"));
/**
 * MediaProcessor Utility
 * Handles video compression and metadata extraction using fluent-ffmpeg.
 */
class MediaProcessor {
    io;
    constructor(io) {
        this.io = io;
    }
    /**
     * Compress a video file with optimized settings and real-time progress updates.
     */
    async compressVideo(videoId, inputPath, targetRes) {
        return new Promise((resolve, reject) => {
            const outputDir = path_1.default.dirname(inputPath);
            const ext = path_1.default.extname(inputPath);
            const outputPath = inputPath.replace(ext, `_proc_${targetRes}p${ext}`);
            // Scaling logic: Ensuring even dimensions for libx264
            // 720p: 1280x720, 1080p: 1920x1080
            const scale = targetRes === '720' ? '1280:720' : '1920:1080';
            const scaleFilter = `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2`;
            console.log(`🎬 [MediaProcessor] Starting compression for ${videoId} to ${targetRes}p...`);
            (0, fluent_ffmpeg_1.default)(inputPath)
                .outputOptions([
                '-vcodec libx264',
                '-crf 28',
                '-preset fast',
                '-acodec aac',
                '-b:a 128k'
            ])
                .videoFilters(scaleFilter)
                .on('start', (commandLine) => {
                console.log('🎥 Spawned FFmpeg with command: ' + commandLine);
                this.io.emit('compressionStarted', { videoId, targetRes });
            })
                .on('progress', (progress) => {
                if (progress.percent) {
                    const percent = Math.round(progress.percent);
                    this.io.emit('compressionProgress', { videoId, percent });
                    console.log(`📽️ [${videoId}] Compression: ${percent}%`);
                }
            })
                .on('error', (err) => {
                console.error(`❌ [${videoId}] Compression Error:`, err.message);
                this.io.emit('compressionError', { videoId, message: err.message });
                reject(err);
            })
                .on('end', async () => {
                console.log(`✅ [${videoId}] Compression Finished!`);
                this.io.emit('compressionFinished', { videoId, outputPath });
                try {
                    await this.syncDatabase(videoId, outputPath);
                    resolve(outputPath);
                }
                catch (dbErr) {
                    reject(dbErr);
                }
            })
                .save(outputPath);
        });
    }
    /**
     * Sync database record with new compressed file details.
     */
    async syncDatabase(videoId, newPath) {
        return new Promise((resolve, reject) => {
            const stats = fs_1.default.statSync(newPath);
            const fileSize = stats.size;
            const filename = path_1.default.basename(newPath);
            dbLayer.db.run(`UPDATE videos SET filepath = ?, file_size = ? WHERE id = ?`, [newPath.replace(/\\/g, '/'), fileSize, videoId], (err) => {
                if (err) {
                    console.error('❌ [Database] Failed to sync compressed video metadata:', err.message);
                    return reject(err);
                }
                console.log(`💾 [Database] Synced metadata for compressed video ${videoId}.`);
                resolve(null);
            });
        });
    }
}
exports.MediaProcessor = MediaProcessor;
