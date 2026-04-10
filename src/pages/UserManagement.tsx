import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import './UserManagement.css';

export default function UserManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ username: '', password: '', role: 'user' });

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const data = await apiFetch('/api/auth/users'); // Consistent path
            setUsers(data || []);
        } catch (err) {
            console.error('Gagal memuat pengguna', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!form.username || !form.password) return toast.error('Username dan Password wajib diisi.');
        try {
            await apiFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(form)
            });
            toast.success('User berhasil diregistrasi!');
            setShowAdd(false);
            setForm({ username: '', password: '', role: 'user' });
            load();
        } catch (err: any) {
            toast.error('Gagal menambah user: ' + err.message);
        }
    };

    const deleteUser = async (username: string) => {
        if (username === 'zainulapixs') return toast.error('Admin utama tidak dapat dihapus.');
        if (!confirm(`Permanen hapus user ${username}?`)) return;
        try {
            await apiFetch(`/api/auth/users/${username}`, { method: 'DELETE' });
            toast.success('User dihapus.');
            load();
        } catch (err: any) {
             toast.error('Gagal menghapus user: ' + err.message);
        }
    };

    return (
        <div className="users-premium-container">
            <Toaster position="top-right" />
            <div className="up-header">
                <div>
                    <h1>👥 User Control Hub</h1>
                    <p className="subtitle">Kelola akses administratif dan izin pengguna platform.</p>
                </div>
                <button className={`btn-toggle-add ${showAdd ? 'cancel' : ''}`} onClick={() => setShowAdd(!showAdd)}>
                    {showAdd ? '× Batalkan' : '+ Tambah User'}
                </button>
            </div>

            <div className="up-stats">
                <div className="up-stat-box">
                    <span>Total Account</span>
                    <strong>{users.length}</strong>
                </div>
                <div className="up-stat-box">
                    <span>Admin Level</span>
                    <strong>{users.filter(u => u.user_role === 'admin').length}</strong>
                </div>
            </div>

            {showAdd && (
                <div className="up-add-card">
                    <h3>Registrasi User Baru</h3>
                    <div className="up-form">
                        <input type="text" placeholder="Username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                        <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                            <option value="user">USER (Operator)</option>
                            <option value="admin">ADMIN (Full Access)</option>
                        </select>
                        <button className="btn-confirm-add" onClick={handleAdd}>Simpan Perubahan</button>
                    </div>
                </div>
            )}

            <div className="up-list-card">
                <div className="table-responsive">
                    <table className="up-table">
                        <thead>
                            <tr>
                                <th>IDENTITY</th>
                                <th>ACCESS LEVEL</th>
                                <th>JOIN DATE</th>
                                <th style={{ textAlign: 'right' }}>OPTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="up-u-info">
                                            <div className="up-u-avatar">{u.username[0].toUpperCase()}</div>
                                            <span>{u.username}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`up-badge ${u.user_role}`}>
                                            {u.user_role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {u.username !== 'zainulapixs' && (
                                            <button className="up-btn-del" onClick={() => deleteUser(u.username)}>
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
