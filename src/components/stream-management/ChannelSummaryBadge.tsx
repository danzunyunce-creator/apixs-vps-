import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api';

export const ChannelSummaryBadge: React.FC = () => {
    const [stats, setStats] = useState({
        totalLive: 0,
        kemarin: 0,
        hariIni: 0,
        mingguIni: 0,
        bulanIni: 0
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await apiFetch('/api/analytics/channel-summary');
                setStats(data);
            } catch (e) {
                console.error("Gagal memuat ringkasan channel", e);
            }
        };
        fetchStats();
        
        const interval = setInterval(fetchStats, 60000); // 1 minute sync
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="channel-summary-bar">
            <div className="summary-title">
                <strong>Ringkasan Channel:</strong>
            </div>
            <div className="summary-pills">
                <span className="s-pill">Total Live <span className="s-val">{stats.totalLive}</span></span>
                <span className="s-pill">Kemarin <span className="s-val">{stats.kemarin}</span></span>
                <span className="s-pill">Hari Ini <span className="s-val">{stats.hariIni}</span></span>
                <span className="s-pill">Minggu Ini <span className="s-val">{stats.mingguIni}</span></span>
                <span className="s-pill">Bulan Ini <span className="s-val">{stats.bulanIni}</span></span>
            </div>
        </div>
    );
};
