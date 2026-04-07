import React from 'react';
import { LogEntry } from '../../types';

interface LogViewerProps {
    logs: LogEntry[];
    onClear: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear }) => {
    return (
        <div className="logs-area">
            <div className="section-title">
                <h3>📡 Active Logs</h3>
                <button className="btn-clear" onClick={onClear}>Clear</button>
            </div>
            <div className="log-list">
                {logs.length === 0 ? (
                    <p className="empty-logs">Menunggu aktivitas sistem...</p>
                ) : (
                    logs.map((l, i) => (
                        <div key={i} className={`log-item ${l.type}`}>
                            <span className="log-time">[{l.time}]</span>
                            <span className="log-msg">{l.msg}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
