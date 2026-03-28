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
const express_1 = __importDefault(require("express"));
const dbLayer = __importStar(require("../database"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// 1. GET PUBLIC CONFIG (No Auth)
router.get('/public', (req, res) => {
    dbLayer.db.all(`SELECT key, value FROM app_config WHERE key = 'register_enabled'`, [], (err, rows) => {
        if (err)
            return res.status(500).json({ error: err.message });
        const cfg = {};
        rows.forEach(r => { cfg[r.key] = r.value; });
        res.json(cfg);
    });
});
// 2. GET ALL CONFIG (As Flat Object)
router.get('/', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    dbLayer.db.all(`SELECT * FROM app_config ORDER BY key ASC`, [], (err, rows) => {
        if (err)
            return res.status(500).json({ error: err.message });
        const cfg = {};
        rows.forEach(r => { cfg[r.key] = r.value; });
        res.json(cfg);
    });
});
// 3. BULK UPDATE CONFIG (Accepts Flat Object)
router.put('/', auth_1.authMiddleware, auth_1.adminOnly, async (req, res) => {
    const configData = req.body;
    try {
        const keys = Object.keys(configData);
        for (const key of keys) {
            await new Promise((resolve, reject) => {
                dbLayer.db.run(`INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`, [key, configData[key]], (err) => err ? reject(err) : resolve(true));
            });
        }
        res.json({ message: 'Settings updated successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 3. SINGLE UPDATE CONFIG
router.put('/:key', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    dbLayer.db.run(`INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`, [key, value], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ message: `Setting ${key} updated` });
    });
});
exports.default = router;
