import { Router } from 'express';
import * as dbLayer from '../database';
import { exec } from 'child_process';
import os from 'os';
import path from 'path';
import { StreamManager } from '../streamManager';

const router = Router();

// GET /api/system/health - Get VPS Real-time Performance
router.get('/health', (req, res) => {
    const cpuLoad = os.loadavg()[0]; // 1-min load average
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsage = ((totalMem - freeMem) / totalMem) * 100;

    dbLayer.db.get("SELECT COUNT(*) as active FROM streams WHERE status='RUNNING'", [], (err, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            cpu: Math.round(cpuLoad * 100) / 100,
            ram: Math.round(ramUsage * 100) / 100,
            activeStreams: row.active,
            uptime: Math.round(os.uptime()),
            platform: os.platform(),
            arch: os.arch()
        });
    });
});

// GET /api/system/logs - Get System Alert & Error Logs
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const logs = await dbLayer.getSystemLogs(limit);
        res.json(logs);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/system/audit - Get Audit Trail History
router.get('/audit', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    dbLayer.db.all(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`, [limit], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/system/maintenance - Run Optimization (Vacuum + Zombie Reap)
router.post('/maintenance', async (req, res) => {
    try {
        console.log('[SystemAPI] Starting Magic Maintenance...');
        
        // 1. Optimize Database
        await new Promise((resolve, reject) => {
            dbLayer.db.run("VACUUM", (err) => err ? reject(err) : resolve(true));
        });
        
        // 2. Reap Zombie processes
        exec('pkill -u $(whoami) -f "ffmpeg.*orphan"', (err) => {
            // Error here is fine if no processes found
        });

        res.json({ success: true, message: 'Optimization Complete! System is light and fresh.' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/system/fix-ports - Emergency Port Rescue
router.post('/fix-ports', (req, res) => {
    const port = 3001;
    console.log(`[SystemAPI] Attempting to clear port ${port}...`);
    
    // Command to kill process on port
    const cmd = os.platform() === 'win32' 
        ? `powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port}).OwningProcess -Force"`
        : `fuser -k ${port}/tcp`;

    exec(cmd, (err) => {
        // We expect an error if the process is killed (connection lost)
        res.json({ success: true, message: 'Port clearing request sent. Engine may restart.' });
    });
});

// POST /api/system/deploy - Trigger Full CI/CD Pipeline
router.post('/deploy', (req, res) => {
    console.log('[SystemAPI] 🚀 UI-Triggered Deployment Initiated...');
    const gasPath = path.join(__dirname, '..', 'gas.sh');
    
    // Execute in background
    exec(`bash "${gasPath}"`, (err, stdout, stderr) => {
        if (err) console.error('[Deploy Error]', err);
        else console.log('[Deploy Success]', stdout);
    });

    res.json({ 
        success: true, 
        message: 'Deployment started. System will be offline for ~60s while rebuilding UI and restarting engine.' 
    });
});

export default router;
