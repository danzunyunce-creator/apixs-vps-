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
exports.adminOnly = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbLayer = __importStar(require("../database"));
const config_1 = __importDefault(require("../config"));
const authMiddleware = (req, res, next) => {
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
        dbLayer.db.get(`SELECT id, username, user_role FROM users WHERE id = ?`, [userId], (err, row) => {
            if (err || !row)
                return res.status(401).json({ error: 'User tidak ditemukan.' });
            req.user = row;
            next();
        });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
        dbLayer.db.get(`SELECT id, username, user_role FROM users WHERE id = ?`, [decoded.id], (err, row) => {
            if (err || !row)
                return res.status(401).json({ error: 'Sesi tidak valid atau user telah dihapus.' });
            req.user = row;
            next();
        });
    }
    catch (err) {
        return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa.' });
    }
};
exports.authMiddleware = authMiddleware;
const adminOnly = (req, res, next) => {
    if (req.user?.user_role !== 'admin') {
        return res.status(403).json({ error: 'Akses Khusus Admin: Anda tidak memiliki izin untuk aksi ini.' });
    }
    next();
};
exports.adminOnly = adminOnly;
