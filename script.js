// script.js
// Firebase Config (sesuai permintaan)
const firebaseConfig = {
    apiKey: "AIzaSyDxugLnXNprHNyCSwkHHICZ35cLd1RSer8",
    authDomain: "tabungan-kurban-c45ef.firebaseapp.com",
    projectId: "tabungan-kurban-c45ef",
    storageBucket: "tabungan-kurban-c45ef.firebasestorage.app",
    messagingSenderId: "517067471636",
    appId: "1:517067471636:web:ca682e6a1baceab66f6001",
    measurementId: "G-XRCV7SD4RQ"
};

// Variabel global
let db;
let jamaahData = [];
let transaksiData = [];
let currentPage = 'dashboard';

// Format Rupiah
function formatRupiah(amount) {
    return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

// Format tanggal Indonesia
function formatTanggal(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast flex items-center gap-x-3 bg-white border shadow-xl px-6 py-4 rounded-3xl text-sm font-medium max-w-xs`;
    
    if (type === 'success') {
        toast.innerHTML = `
            <span class="text-emerald-500 text-2xl">✅</span>
            <span>${message}</span>
        `;
        toast.style.borderColor = '#10b981';
    } else {
        toast.innerHTML = `
            <span class="text-red-500 text-2xl">⚠️</span>
            <span>${message}</span>
        `;
        toast.style.borderColor = '#ef4444';
    }
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Inisialisasi Firebase
function initFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log('%c✅ Firebase terhubung', 'color:#10b981;font-weight:600');
    } catch (e) {
        console.error(e);
        showToast('Gagal menghubungkan Firebase', 'error');
    }
}

// Setup realtime listeners
function setupListeners() {
    // Jamaah
    db.collection("jamaah").onSnapshot((snapshot) => {
        jamaahData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => a.nama.localeCompare(b.nama));
        
        updateUI();
    }, (error) => {
        console.error("Jamaah listener error:", error);
    });

    // Transaksi (urutkan terbaru)
    db.collection("transaksi")
        .orderBy("tanggal", "desc")
        .onSnapshot((snapshot) => {
            transaksiData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            updateUI();
        }, (error) => {
            console.error("Transaksi listener error:", error);
        });
}

// Render semua UI berdasarkan halaman aktif
function updateUI() {
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
        lastUpdated.innerHTML = `🕒 Terakhir diperbarui <span class="font-medium">${new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>`;
    }

    if (currentPage === 'dashboard') renderDashboard();
    else if (currentPage === 'jamaah') renderJamaah();
    else if (currentPage === 'tabungan') renderTabungan();
    else if (currentPage === 'riwayat') renderRiwayat();
}

// Switch halaman
function switchPage(page) {
    document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
    const target = document.getElementById(page + '-page');
    if (target) target.classList.remove('hidden');
    
    // Update active nav
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById('nav-' + page);
    if (activeLink) activeLink.classList.add('active');
    
    currentPage = page;
    updateUI();
}

// Toggle mobile menu
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

// DASHBOARD
function renderDashboard() {
    // Total saldo
    const totalSaldo = jamaahData.reduce((sum, j) => sum + (j.saldo || 0), 0);
    document.getElementById('total-saldo').textContent = formatRupiah(totalSaldo);
    
    // Jumlah jamaah
    document.getElementById('jumlah-jamaah').textContent = jamaahData.length;
    
    // Tabungan bulan ini
    const now = new Date();
    const thisMonthTrans = transaksiData.filter(t => {
        const d = t.tanggal.toDate ? t.tanggal.toDate() : new Date(t.tanggal);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const bulanIni = thisMonthTrans.reduce((sum, t) => sum + (t.jumlah || 0), 0);
    document.getElementById('tabungan-bulan').textContent = formatRupiah(bulanIni);
    
    // Progress grid
    const grid = document.getElementById('progress-grid');
    grid.innerHTML = '';
    
    jamaahData.forEach(jamaah => {
        const progress = jamaah.target ? Math.min(Math.round((jamaah.saldo || 0) / jamaah.target * 100), 100) : 0;
        
        const cardHTML = `
            <div class="card bg-white rounded-3xl p-5 border border-emerald-100">
                <div class="flex justify-between items-start">
                    <div class="font-medium">${jamaah.nama}</div>
                    <div class="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-3xl">${progress}%</div>
                </div>
                <div class="mt-4 h-2 bg-emerald-100 rounded-3xl overflow-hidden">
                    <div class="h-full bg-emerald-500 transition-all" style="width: ${progress}%"></div>
                </div>
                <div class="flex justify-between text-xs mt-3 text-slate-500">
                    <span>${formatRupiah(jamaah.saldo || 0)}</span>
                    <span class="font-medium">${formatRupiah(jamaah.target || 0)}</span>
                </div>
            </div>`;
        grid.innerHTML += cardHTML;
    });
    
    if (jamaahData.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400">Belum ada jamaah. Tambahkan dulu di Data Jamaah.</div>`;
    }
    
    // 5 transaksi terbaru
    const recentBody = document.getElementById('recent-table');
    recentBody.innerHTML = '';
    
    const recent5 = transaksiData.slice(0, 5);
    if (recent5.length === 0) {
        recentBody.innerHTML = `<tr><td colspan="4" class="text-center py-12 text-slate-400">Belum ada transaksi</td></tr>`;
        return;
    }
    
    recent5.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-5 px-8">${formatTanggal(t.tanggal)}</td>
            <td class="py-5 px-8 font-medium">${t.nama || '—'}</td>
            <td class="py-5 px-8 text-right font-semibold text-emerald-600">${formatRupiah(t.jumlah)}</td>
            <td class="py-5 px-8 text-slate-500">${t.catatan || '—'}</td>
        `;
        recentBody.appendChild(row);
    });
}

// DATA JAMAAH
function renderJamaah() {
    const tbody = document.getElementById('jamaah-table');
    const searchTerm = (document.getElementById('search-jamaah').value || '').toLowerCase().trim();
    
    tbody.innerHTML = '';
    
    const filtered = jamaahData.filter(j => 
        j.nama.toLowerCase().includes(searchTerm) || 
        (j.nohp || '').includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-16 text-center text-slate-400">Tidak ada jamaah ditemukan</td></tr>`;
        return;
    }
    
    filtered.forEach(j => {
        const progress = j.target ? Math.min(Math.round((j.saldo || 0) / j.target * 100), 100) : 0;
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-emerald-50 transition';
        row.innerHTML = `
            <td class="py-6 px-8 font-medium">${j.nama}</td>
            <td class="py-6 px-8">${j.nohp || '—'}</td>
            <td class="py-6 px-8 text-right font-semibold">${formatRupiah(j.target || 0)}</td>
            <td class="py-6 px-8 text-right font-semibold text-emerald-600">${formatRupiah(j.saldo || 0)}</td>
            <td class="py-6 px-8">
                <div class="flex items-center justify-center gap-3">
                    <div class="flex-1 max-w-[120px] h-2.5 bg-emerald-100 rounded-3xl overflow-hidden">
                        <div class="h-full bg-emerald-500" style="width:${progress}%"></div>
                    </div>
                    <span class="text-xs font-medium text-emerald-700">${progress}%</span>
                </div>
            </td>
            <td class="py-6 px-8">
                <div class="flex gap-x-2">
                    <button onclick="editJamaah('${j.id}')" 
                            class="text-emerald-600 hover:bg-emerald-100 px-4 py-1 rounded-2xl text-xs font-medium">Edit</button>
                    <button onclick="deleteJamaah('${j.id}')" 
                            class="text-red-500 hover:bg-red-50 px-4 py-1 rounded-2xl text-xs font-medium">Hapus</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterJamaah() {
    renderJamaah();
}

// Modal Jamaah
let isEditMode = false;

function showAddJamaahModal() {
    isEditMode = false;
    document.getElementById('modal-title').textContent = 'Tambah Jamaah Baru';
    document.getElementById('jamaah-form').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('jamaah-modal').classList.remove('hidden');
    document.getElementById('jamaah-modal').classList.add('flex');
}

function hideJamaahModal() {
    const modal = document.getElementById('jamaah-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function editJamaah(id) {
    const jamaah = jamaahData.find(j => j.id === id);
    if (!jamaah) return;
    
    isEditMode = true;
    document.getElementById('modal-title').textContent = 'Edit Jamaah';
    document.getElementById('edit-id').value = id;
    document.getElementById('nama').value = jamaah.nama || '';
    document.getElementById('nohp').value = jamaah.nohp || '';
    document.getElementById('target').value = jamaah.target || '';
    
    document.getElementById('jamaah-modal').classList.remove('hidden');
    document.getElementById('jamaah-modal').classList.add('flex');
}

async function handleJamaahForm(e) {
    e.preventDefault();
    
    const nama = document.getElementById('nama').value.trim();
    const nohp = document.getElementById('nohp').value.trim();
    const target = parseInt(document.getElementById('target').value) || 0;
    const editId = document.getElementById('edit-id').value;
    
    if (!nama || !nohp || target <= 0) {
        showToast('Semua field harus diisi dengan benar', 'error');
        return;
    }
    
    try {
        if (isEditMode && editId) {
            await db.collection('jamaah').doc(editId).update({
                nama,
                nohp,
                target
            });
            showToast('Jamaah berhasil diperbarui');
        } else {
            await db.collection('jamaah').add({
                nama,
                nohp,
                target,
                saldo: 0
            });
            showToast('Jamaah baru berhasil ditambahkan');
        }
        
        hideJamaahModal();
    } catch (err) {
        showToast('Gagal menyimpan jamaah: ' + err.message, 'error');
    }
}

async function deleteJamaah(id) {
    if (!confirm('Hapus jamaah ini secara permanen?')) return;
    
    try {
        await db.collection('jamaah').doc(id).delete();
        showToast('Jamaah berhasil dihapus');
    } catch (err) {
        showToast('Gagal menghapus jamaah', 'error');
    }
}

// TABUNGAN
function renderTabungan() {
    const select = document.getElementById('select-jamaah');
    select.innerHTML = `<option value="">— Pilih jamaah —</option>`;
    
    jamaahData.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j.id;
        opt.textContent = `${j.nama} (${formatRupiah(j.saldo || 0)})`;
        select.appendChild(opt);
    });
    
    // Set tanggal hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggal').value = today;
    
    // Reset info
    document.getElementById('jamaah-info').classList.add('hidden');
}

function updateJamaahInfo() {
    const select = document.getElementById('select-jamaah');
    const id = select.value;
    const infoBox = document.getElementById('jamaah-info');
    
    if (!id) {
        infoBox.classList.add('hidden');
        return;
    }
    
    const jamaah = jamaahData.find(j => j.id === id);
    if (!jamaah) return;
    
    const saldo = jamaah.saldo || 0;
    const progress = jamaah.target ? Math.min(Math.round(saldo / jamaah.target * 100), 100) : 0;
    
    document.getElementById('info-saldo').innerHTML = formatRupiah(saldo);
    document.getElementById('info-progress-bar').style.width = `${progress}%`;
    document.getElementById('info-progress-text').textContent = `${progress}%`;
    
    infoBox.classList.remove('hidden');
}

async function handleTabunganSubmit(e) {
    e.preventDefault();
    
    const jamaahId = document.getElementById('select-jamaah').value;
    if (!jamaahId) {
        showToast('Pilih jamaah terlebih dahulu', 'error');
        return;
    }
    
    const jumlahStr = document.getElementById('jumlah').value;
    const jumlah = parseInt(jumlahStr);
    if (!jumlah || jumlah <= 0) {
        showToast('Jumlah tabungan harus lebih dari 0', 'error');
        return;
    }
    
    const tanggalStr = document.getElementById('tanggal').value;
    const catatan = document.getElementById('catatan').value.trim();
    
    const jamaah = jamaahData.find(j => j.id === jamaahId);
    
    try {
        // Tambah transaksi
        await db.collection('transaksi').add({
            jamaahId: jamaahId,
            nama: jamaah.nama,
            tanggal: firebase.firestore.Timestamp.fromDate(new Date(tanggalStr)),
            jumlah: jumlah,
            catatan: catatan,
            createdAt: firebase.firestore.Timestamp.now()
        });
        
        // Update saldo pakai increment
        await db.collection('jamaah').doc(jamaahId).update({
            saldo: firebase.firestore.FieldValue.increment(jumlah)
        });
        
        showToast('✅ Tabungan berhasil dicatat!', 'success');
        
        // Reset form
        e.target.reset();
        document.getElementById('jamaah-info').classList.add('hidden');
        document.getElementById('select-jamaah').value = '';
        
        // Kembali ke dashboard otomatis
        setTimeout(() => switchPage('dashboard'), 800);
    } catch (err) {
        console.error(err);
        showToast('Gagal menyimpan tabungan', 'error');
    }
}

// RIWAYAT
function renderRiwayat() {
    const tbody = document.getElementById('riwayat-table');
    const searchTerm = (document.getElementById('search-riwayat').value || '').toLowerCase().trim();
    
    tbody.innerHTML = '';
    
    let filtered = transaksiData;
    
    if (searchTerm) {
        filtered = transaksiData.filter(t => 
            (t.nama || '').toLowerCase().includes(searchTerm) ||
            (t.catatan || '').toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-16 text-slate-400">Tidak ada transaksi ditemukan</td></tr>`;
        return;
    }
    
    filtered.forEach(t => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-emerald-50 transition-colors';
        row.innerHTML = `
            <td class="px-8 py-6">${formatTanggal(t.tanggal)}</td>
            <td class="px-8 py-6 font-medium">${t.nama || '—'}</td>
            <td class="px-8 py-6 text-right font-semibold text-emerald-600">${formatRupiah(t.jumlah)}</td>
            <td class="px-8 py-6 text-slate-500">${t.catatan || '—'}</td>
            <td class="px-8 py-6">
                <button onclick="deleteTransaksi('${t.id}')" 
                        class="text-red-500 hover:text-red-600 transition px-3 py-2 rounded-2xl text-xl">🗑</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterRiwayat() {
    renderRiwayat();
}

async function deleteTransaksi(id) {
    const trans = transaksiData.find(t => t.id === id);
    if (!trans) return;
    
    if (!confirm(`Hapus transaksi ${formatRupiah(trans.jumlah)} untuk ${trans.nama}?\nSaldo jamaah akan dikurangi.`)) return;
    
    try {
        // Hapus transaksi
        await db.collection('transaksi').doc(id).delete();
        
        // Kurangi saldo
        await db.collection('jamaah').doc(trans.jamaahId).update({
            saldo: firebase.firestore.FieldValue.increment(-trans.jumlah)
        });
        
        showToast('Transaksi berhasil dihapus');
    } catch (err) {
        showToast('Gagal menghapus transaksi', 'error');
    }
}

// Inisialisasi aplikasi
function initializeApp() {
    initFirebase();
    setupListeners();
    
    // Tailwind sudah otomatis dari CDN
    // Set default page
    switchPage('dashboard');
    
    console.log('%c🚀 Website Tabungan Kurban Jamaah siap!', 'color:#10b981;background:#ecfdf5;padding:2px 6px;border-radius:9999px');
}

// Jalankan saat halaman selesai load
window.onload = initializeApp;