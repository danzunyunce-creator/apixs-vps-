#!/bin/bash
# ApixsLive One-Click Automation Script

echo "🚀 [ApixsLive] Memulai proses update sakti..."

# 1. Pastikan di folder yang benar
cd ~/backend || { echo "❌ Folder backend tidak ditemukan!"; exit 1; }

# 2. Bersihkan error git lokal
echo "🧹 [Git] Membersihkan perubahan lokal..."
git stash > /dev/null 2>&1

# 3. Ambil kode terbaru
echo "📥 [Git] Menarik kode terbaru dari GitHub..."
git pull

# 4. Install dependencies jika ada yang baru
echo "📦 [Deps] Cek ketersediaan modul..."
npm install --no-audit --no-fund --loglevel error

# 5. Hidupkan ulang server
echo "⚡ [PM2] Menghidupkan ulang mesin stream..."
# Hapus pendaftaran lama jika ada
./node_modules/.bin/pm2 delete apixs-backend > /dev/null 2>&1
# Jalankan pendaftaran baru yang segar
./node_modules/.bin/pm2 start server.ts --name apixs-backend --interpreter ./node_modules/.bin/tsx

# 6. Simpan konfigurasi PM2 agar otomatis nyala saat VPS reboot
./node_modules/.bin/pm2 save > /dev/null 2>&1

echo "----------------------------------------------------"
echo "✅ [SELESAI] Dashboard Premium Bos Berhasil LIVE!"
echo "👉 Buka Alamat: http://103.127.132.124:3001"
echo "----------------------------------------------------"
