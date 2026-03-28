# 🚀 ApixsLive - Advanced Web Stream Dashboard

ApixsLive adalah sistem manajemen siaran langsung (live streaming) berbasis web yang kuat dan premium. Dirancang untuk stasiun TV lokal, kreator konten, dan streamer 24/7 yang membutuhkan otomatisasi tinggi dan stabilitas dalam mengelola siaran multi-platform.

---

## ✨ Fitur Utama

- **Unified Port Architecture**: Frontend and Backend berjalan di satu port (3001) untuk performa maksimal dan kemudahan instalasi.
- **24/7 Automation Engine**: Penjadwalan cerdas untuk memulai siaran secara otomatis berdasarkan jam atau siklus playlist.
- **Playlist Manager**: Kelola ribuan video dengan rundown yang dapat dikustomisasi, shuffle, dan loop tanpa henti.
- **YouTube OAuth Integration**: Otorisasi channel YouTube secara resmi untuk mengubah judul, deskripsi, dan thumbnail secara real-time.
- **Telegram Notifications**: Dapatkan laporan langsung ke ponsel Anda jika stream dimulai, berhenti, atau terjadi error.
- **Multi-Level Auth & RBAC**: Sistem login yang aman dengan pemisahan peran antara Admin dan Operator.
- **Real-time Metrics**: Pantau CPU, RAM, dan status streaming secara instan melalui dashboard yang responsif.

---

## 🛠️ Persyaratan Sistem

- **Node.js**: v18.0.0 atau lebih tinggi.
- **FFmpeg**: Wajib terinstal di PATH sistem untuk melakukan encode streaming.
- **Database**: SQLite (Bawaan, tidak perlu instalasi tambahan).

---

## 🚀 Cara Instalasi

1. **Clone & Install**:
   ```bash
   # Install dependensi frontend
   npm install
   
   # Install dependensi backend
   cd backend && npm install
   ```

2. **Konfigurasi**:
   Salin `.env.example` menjadi `.env` di folder root dan sesuaikan jika perlu.

3. **Build & Jalankan**:
   ```bash
   # Bangun aplikasi frontend
   npm run build
   
   # Jalankan server (Produksi)
   cd backend && npm start
   ```

4. **Akses**:
   Buka browser dan akses `http://localhost:3001`.

---

## 🔒 Catatan Keamanan

- Ganti password default administrator (`zainulapixs` / `liveapixs`) segera setelah login pertama.
- Gunakan Reverse Proxy (seperti Nginx) dengan HTTPS untuk instalasi di VPS publik.
- Pastikan registrasi pengguna ditutup di menu Pengaturan jika sudah selesai dikonfigurasi.

### Developer: zainulapixs
---
Powered by **Apixs Technology**
