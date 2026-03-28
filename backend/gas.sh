#!/bin/bash
# ApixsLive One-Click Automation Script

echo "🚀 [ApixsLive] Memulai proses update sakti..."

# 1. Pastikan di folder yang benar (backend atau root)
if [ -f "server.ts" ]; then
    # Jika sudah di folder backend
    BACKEND_DIR=$(pwd)
elif [ -d "backend" ]; then
    # Jika di folder root, masuk ke backend
    cd backend
    BACKEND_DIR=$(pwd)
else
    echo "❌ Folder backend/server.ts tidak ditemukan!"
    exit 1
fi

# 2. Bersihkan error git lokal
echo "🧹 [Git] Membersihkan perubahan lokal..."
# Go up to the root to pull
cd ..
git stash > /dev/null 2>&1

# 3. Ambil kode terbaru
echo "📥 [Git] Menarik kode terbaru dari GitHub..."
git pull

# 4. Kembali ke backend untuk install dan jalankan
cd "$BACKEND_DIR"

echo "📦 [Deps] Cek ketersediaan modul..."
npm install --no-audit --no-fund --loglevel error

# 5. Hidupkan ulang server
echo "⚡ [PM2] Menghidupkan ulang mesin stream..."
./node_modules/.bin/pm2 delete apixs-backend > /dev/null 2>&1
./node_modules/.bin/pm2 start server.ts --name apixs-backend --interpreter ./node_modules/.bin/tsx

# 6. Simpan konfigurasi PM2 agar otomatis nyala saat VPS reboot
./node_modules/.bin/pm2 save > /dev/null 2>&1

echo "----------------------------------------------------"
echo "✅ [SELESAI] Dashboard Premium Bos Berhasil LIVE!"
echo "👉 Buka Alamat: http://103.127.132.124:3001"
echo "----------------------------------------------------"
