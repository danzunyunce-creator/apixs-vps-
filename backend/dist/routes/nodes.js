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
// 1. GET ALL NODES
router.get('/', auth_1.authMiddleware, (req, res) => {
    dbLayer.db.all(`SELECT * FROM nodes ORDER BY name ASC`, [], (err, rows) => {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
// 2. REGISTER/UPDATE NODE
router.post('/', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    const { id, name, url } = req.body;
    const nodeId = id || 'node-' + Date.now();
    dbLayer.db.run(`INSERT INTO nodes (id, name, url, status) VALUES (?, ?, ?, 'ONLINE')
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, last_seen=CURRENT_TIMESTAMP`, [nodeId, name, url], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ id: nodeId, message: 'Node registered/updated' });
    });
});
// 3. UPDATE LOAD (For VPS reporting)
router.post('/:id/report', (req, res) => {
    const { load, status } = req.body;
    dbLayer.db.run(`UPDATE nodes SET load = ?, status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`, [load, status || 'ONLINE', req.params.id], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ message: 'Report received' });
    });
});
// 4. DELETE NODE
router.delete('/:id', auth_1.authMiddleware, auth_1.adminOnly, (req, res) => {
    dbLayer.db.run(`DELETE FROM nodes WHERE id = ?`, [req.params.id], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ message: 'Node deleted' });
    });
});
exports.default = router;
