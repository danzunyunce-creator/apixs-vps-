import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import * as dbLayer from '../database';

/**
 * MediaProcessor Utility
 * Handles video compression and metadata extraction using fluent-ffmpeg.
 */
export class MediaProcessor {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
    }

    /**
     * Compress a video file with optimized settings and real-time progress updates.
     */
    async compressVideo(videoId: string, inputPath: string, targetRes: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const outputDir = path.dirname(inputPath);
            const ext = path.extname(inputPath);
            const outputPath = inputPath.replace(ext, `_proc_${targetRes}p${ext}`);
            
            // Scaling logic: Ensuring even dimensions for libx264
            // 720p: 1280x720, 1080p: 1920x1080
            const scale = targetRes === '720' ? '1280:720' : '1920:1080';
            const scaleFilter = `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2`;

            console.log(`🎬 [MediaProcessor] Starting compression for ${videoId} to ${targetRes}p...`);

            ffmpeg(inputPath)
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
                    } catch (dbErr) {
                        reject(dbErr);
                    }
                })
                .save(outputPath);
        });
    }

    /**
     * Sync database record with new compressed file details.
     */
    private async syncDatabase(videoId: string, newPath: string) {
        return new Promise((resolve, reject) => {
            const stats = fs.statSync(newPath);
            const fileSize = stats.size;
            const filename = path.basename(newPath);

            dbLayer.db.run(
                `UPDATE videos SET filepath = ?, file_size = ? WHERE id = ?`,
                [newPath.replace(/\\/g, '/'), fileSize, videoId],
                (err) => {
                    if (err) {
                        console.error('❌ [Database] Failed to sync compressed video metadata:', err.message);
                        return reject(err);
                    }
                    console.log(`💾 [Database] Synced metadata for compressed video ${videoId}.`);
                    resolve(null);
                }
            );
        });
    }
}
