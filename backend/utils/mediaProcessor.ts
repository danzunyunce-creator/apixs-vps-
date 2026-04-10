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
    private queue: { videoId: string; inputPath: string; targetRes: string; resolve: Function; reject: Function }[] = [];
    private isProcessing = false;

    constructor(io: Server) {
        this.io = io;
    }

    /**
     * Compress a video file. Now wraps into a queue system.
     */
    async compressVideo(videoId: string, inputPath: string, targetRes: string): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log(`📥 [MediaProcessor] Task queued for ${videoId} (${targetRes}p)`);
            this.queue.push({ videoId, inputPath, targetRes, resolve, reject });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const task = this.queue.shift();
        if (!task) {
            this.isProcessing = false;
            return;
        }

        const { videoId, inputPath, targetRes, resolve, reject } = task;

        try {
            const result = await this.executeCompression(videoId, inputPath, targetRes);
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            this.isProcessing = false;
            // Process next task in queue with a small delay to let system breathe
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    private async executeCompression(videoId: string, inputPath: string, targetRes: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const ext = path.extname(inputPath);
            const outputPath = inputPath.replace(ext, `_proc_${targetRes}p${ext}`);
            
            const scale = targetRes === '720' ? '1280:720' : '1920:1080';
            const scaleFilter = `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2`;

            console.log(`🎬 [MediaProcessor] Starting compression: ${videoId}`);

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
                    this.io.emit('compressionStarted', { videoId, targetRes });
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        const percent = Math.round(progress.percent);
                        this.io.emit('compressionProgress', { videoId, percent });
                    }
                })
                .on('error', (err) => {
                    console.error(`❌ [${videoId}] Compression Error:`, err.message);
                    this.io.emit('compressionError', { videoId, message: err.message });
                    reject(err);
                })
                .on('end', async () => {
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

    private async syncDatabase(videoId: string, newPath: string) {
        return new Promise((resolve, reject) => {
            try {
                const stats = fs.statSync(newPath);
                const fileSize = stats.size;

                dbLayer.db.run(
                    `UPDATE videos SET filepath = ?, file_size = ? WHERE id = ?`,
                    [newPath.replace(/\\/g, '/'), fileSize, videoId],
                    (err) => {
                        if (err) return reject(err);
                        resolve(null);
                    }
                );
            } catch (e) {
                reject(e);
            }
        });
    }
}
