import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface VideoCompressorProps {
    file: File;
    onComplete: (compressedFile: File, stats: { original: number, compressed: number }) => void;
    onCancel: () => void;
}

export default function VideoCompressor({ file, onComplete, onCancel }: VideoCompressorProps) {
    const [status, setStatus] = useState<'loading' | 'processing' | 'finishing' | 'error'>('loading');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const ffmpegRef = useRef(new FFmpeg());

    const loadFFmpeg = async () => {
        const ffmpeg = ffmpegRef.current;
        try {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            startCompression();
        } catch (err: any) {
            setError('Gagal memuat engine kompresi: ' + err.message);
            setStatus('error');
        }
    };

    const startCompression = async () => {
        const ffmpeg = ffmpegRef.current;
        setStatus('processing');
        
        try {
            ffmpeg.on('progress', ({ progress: p }) => {
                setProgress(Math.round(p * 100));
            });

            const inputName = 'input_' + Date.now() + '.mp4';
            const outputName = 'output_' + Date.now() + '.mp4';

            await ffmpeg.writeFile(inputName, await fetchFile(file));

            // Optimized FFmpeg Args:
            // - Ensuring even dimensions with: scale=720:trunc(ih*720/iw/2)*2
            // - Balanced quality with: -crf 28
            // - Speed with: -preset veryfast
            await ffmpeg.exec([
                '-i', inputName,
                '-vcodec', 'libx264',
                '-crf', '28',
                '-preset', 'veryfast',
                '-vf', 'scale=720:trunc(ih*720/iw/2)*2',
                '-acodec', 'aac',
                '-b:a', '128k',
                outputName
            ]);

            setStatus('finishing');
            const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
            const compressedBlob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
            
            const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + "_compressed.mp4", {
                type: 'video/mp4'
            });

            // Cleanup
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);

            onComplete(compressedFile, {
                original: file.size,
                compressed: compressedFile.size
            });
        } catch (err: any) {
            setError('Proses kompresi gagal: ' + err.message);
            setStatus('error');
        }
    };

    useEffect(() => {
        loadFFmpeg();
        return () => {
             // In real apps, you might want to terminate FFmpeg if unmounted
             // but here we let it finish or use cleanup in parent
        };
    }, []);

    return (
        <div className="compressor-overlay">
            <div className="compressor-card">
                <div className="compressor-header">
                    <h3>⚡ Video Optimizer</h3>
                    <p>Mengecilkan ukuran video tanpa kehilangan banyak kualitas.</p>
                </div>

                <div className="compressor-body">
                    {status === 'loading' && (
                        <div className="status-loader">
                            <div className="spinner" />
                            <span>Menyiapkan FFmpeg Engine...</span>
                        </div>
                    )}

                    {status === 'processing' && (
                        <div className="progress-container">
                            <div className="file-info">
                                <span className="filename">{file.name}</span>
                                <span className="percentage">{progress}%</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="status-text">Sedang mengompresi... Harap jangan tutup tab ini.</p>
                        </div>
                    )}

                    {status === 'finishing' && (
                        <div className="status-loader">
                            <div className="spinner" />
                            <span>Menyelesaikan file...</span>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="error-box">
                            <span className="error-icon">⚠️</span>
                            <p>{error}</p>
                            <button onClick={onCancel}>Tutup</button>
                        </div>
                    )}
                </div>

                {status !== 'error' && (
                    <div className="compressor-footer">
                        <button className="btn-cancel-comp" onClick={onCancel} disabled={status === 'finishing'}>
                            Batalkan
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
