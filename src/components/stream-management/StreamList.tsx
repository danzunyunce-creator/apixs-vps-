import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stream, Node } from '../../types';
import { ChannelSummaryBadge } from './ChannelSummaryBadge';

interface StreamListProps {
    streams: Stream[];
    nodes: Node[];
    onAction: (id: string, action: 'start' | 'stop') => void;
    onDelete?: (id: string) => void;
    onEdit?: (stream: Stream) => void;
    selectedStreams: string[];
    onToggleSelect: (id: string) => void;
    onSelectAll: (checked: boolean) => void;
}

export const StreamList: React.FC<StreamListProps> = ({ 
    streams, 
    nodes, 
    onAction, 
    onDelete, 
    onEdit,
    selectedStreams,
    onToggleSelect,
    onSelectAll
}) => {
    const isAllSelected = streams.length > 0 && selectedStreams.length === streams.length;
    const navigate = useNavigate();

    return (
        <section className="streams-data-table-container">
            <ChannelSummaryBadge />

            <div className="streams-table-wrapper">
                <table className="rosi-styled-table">
                    <thead>
                        <tr>
                            <th className="t-check"><input type="checkbox" checked={isAllSelected} onChange={(e) => onSelectAll(e.target.checked)} /></th>
                            <th className="t-no">NO</th>
                            <th className="t-aksi">AKSI</th>
                            <th className="t-nama">NAMA</th>
                            <th className="t-thumb">THUMBNAIL</th>
                            <th className="t-nama-live">NAMA LIVE</th>
                            <th className="t-file">FILE</th>
                            <th className="t-stream-id">STREAM ID</th>
                            <th className="t-broad-id">BROADCAST ID</th>
                            <th className="t-priv">PRIVACY</th>
                            <th className="t-stat-job">STATUS JOB</th>
                            <th className="t-stat-yt">STATUS YOUTUBE</th>
                            <th className="t-jadwal">JADWALKAN ULANG</th>
                            <th className="t-retry">JADWAL RETRY</th>
                        </tr>
                    </thead>
                    <tbody>
                        {streams.length === 0 && (
                            <tr><td colSpan={14} style={{textAlign: 'center', padding: '2rem'}}>Belum ada daftar live</td></tr>
                        )}
                        {streams.map((s, idx) => {
                            const isChecked = selectedStreams.includes(s.id);
                            const isActive = s.status === 'RUNNING' || s.status === 'LIVE' || s.status === 'MULAI';
                            
                            return (
                                <tr key={s.id} className={isChecked ? 'row-selected' : ''}>
                                    <td className="t-check">
                                        <input type="checkbox" checked={isChecked} onChange={() => onToggleSelect(s.id)} />
                                    </td>
                                    <td className="t-no">{idx + 1}</td>
                                    <td className="t-aksi">
                                        <div className="table-actions">
                                            {onEdit && <button className="btn-table btn-redo" onClick={() => onEdit(s)}>Edit</button>}
                                            {isActive ? (
                                                <>
                                                    <button className="btn-table btn-stop" onClick={() => onAction(s.id, 'stop')}>Stop</button>
                                                    <button className="btn-table btn-redo" style={{background: '#6366f1'}} onClick={() => navigate(`/live-chat/${s.id}`)}>Chat</button>
                                                </>
                                            ) : (
                                                <button className="btn-table btn-start" onClick={() => onAction(s.id, 'start')}>Start</button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="t-nama"><strong>{(s as any).channel_name || s.title}</strong></td>
                                    <td className="t-thumb">
                                        <div className="thumb-box">
                                            <div className="img-placeholder" title="No Thumb">🎥</div>
                                        </div>
                                    </td>
                                    <td className="t-nama-live">{s.title}</td>
                                    <td className="t-file">
                                        <span className="file-chip" title={s.playlist_path}>{s.playlist_path?.split('/').pop() || s.playlist_path}</span>
                                    </td>
                                    <td className="t-stream-id">{s.id.slice(-6)}</td>
                                    <td className="t-broad-id">{s.youtube_broadcast_id || '-'}</td>
                                    <td className="t-priv" style={{textTransform: 'capitalize'}}>{s.privacy_status || 'public'}</td>
                                    <td className="t-stat-job">
                                        <span className={`badge-job ${isActive ? 'running' : s.is_queued ? 'queued' : 'done'}`}>
                                            {isActive ? 'RUNNING' : s.is_queued ? 'QUEUED' : 'DONE'}
                                        </span>
                                    </td>
                                    <td className="t-stat-yt">{s.youtube_job_status || (isActive ? 'Sedang Diproses' : 'Selesai Diproses')}</td>
                                    <td className="t-jadwal">Harian</td>
                                    <td className="t-retry">-</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
};
