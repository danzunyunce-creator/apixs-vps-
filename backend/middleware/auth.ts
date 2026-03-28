import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as dbLayer from '../database';
import config from '../config';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        user_role: string;
    };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Sesi habis atau tidak terautentikasi. Silakan login kembali.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
    }

    // Support legacy session for transition if needed, 
    // but here we force JWT if it doesn't look like the old one
    if (token.startsWith('apixs-ses-')) {
        const userId = token.replace('apixs-ses-', '');
        dbLayer.db.get(`SELECT id, username, user_role FROM users WHERE id = ?`, [userId], (err, row: any) => {
            if (err || !row) return res.status(401).json({ error: 'User tidak ditemukan.' });
            req.user = row;
            next();
        });
        return;
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        dbLayer.db.get(`SELECT id, username, user_role FROM users WHERE id = ?`, [decoded.id], (err, row: any) => {
            if (err || !row) return res.status(401).json({ error: 'Sesi tidak valid atau user telah dihapus.' });
            req.user = row;
            next();
        });
    } catch (err) {
        return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa.' });
    }
};

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.user_role !== 'admin') {
        return res.status(403).json({ error: 'Akses Khusus Admin: Anda tidak memiliki izin untuk aksi ini.' });
    }
    next();
};
