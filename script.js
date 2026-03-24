// =========================================
// FIREBASE CONFIG & INIT
// =========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxugLnXNprHNyCSwkHHICZ35cLd1RSer8",
  authDomain: "tabungan-kurban-c45ef.firebaseapp.com",
  projectId: "tabungan-kurban-c45ef",
  storageBucket: "tabungan-kurban-c45ef.firebasestorage.app",
  messagingSenderId: "517067471636",
  appId: "1:517067471636:web:ca682e6a1baceab66f6001",
  measurementId: "G-XRCV7SD4RQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =========================================
// STATE
// =========================================
let jamaahList = [];
let transaksiList = [];
let currentPage = 'dashboard';

// =========================================
// UTILITIES
// =========================================
function formatRupiah(num) {
  const n = Number(num);
  if (isNaN(n)) return 'Rp 0';
  return 'Rp ' + n.toLocaleString('id-ID');
}

// Tangani semua format tanggal: Firestore Timestamp, string "YYYY-MM-DD", Date object
function parseDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'string') return new Date(val + 'T00:00:00');
  if (val instanceof Date) return val;
  return new Date(val);
}

function formatDate(val) {
  const d = parseDate(val);
  if (!d || isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getPercent(saldo, target) {
  const s = Number(saldo) || 0;
  const t = Number(target) || 0;
  if (t <= 0) return 0;
  return Math.min(100, Math.round((s / t) * 100));
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escape khusus untuk nilai di dalam atribut onclick agar kutip tunggal tidak rusak
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').textContent =
    type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// =========================================
// NAVIGASI
// =========================================
window.showPage = function (page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  currentPage = page;
  if (page === 'setoran') populateSetoranDropdown();
};

window.toggleMobileMenu = function () {
  const menu = document.getElementById('mobile-menu');
  const open = document.getElementById('ham-open');
  const close = document.getElementById('ham-close');
  const isHidden = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !isHidden);
  open.classList.toggle('hidden', isHidden);
  close.classList.toggle('hidden', !isHidden);
};

window.closeMobileMenu = function () {
  document.getElementById('mobile-menu').classList.add('hidden');
  document.getElementById('ham-open').classList.remove('hidden');
  document.getElementById('ham-close').classList.add('hidden');
};

// =========================================
// MODAL
// =========================================
window.closeModal = function (id) {
  document.getElementById(id).classList.remove('open');
};
window.closeModalOutside = function (e, id) {
  if (e.target.id === id) closeModal(id);
};
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

// =========================================
// FIRESTORE REALTIME LISTENERS
// =========================================
function initListeners() {
  // Listener jamaah — urut nama A-Z
  onSnapshot(
    query(collection(db, 'jamaah'), orderBy('nama')),
    (snap) => {
      jamaahList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderJamaahTable();
      renderProgressList();
      updateStats();
      if (currentPage === 'setoran') populateSetoranDropdown();
    },
    (err) => {
      console.error('Jamaah listener error:', err);
      showToast('Gagal memuat data jamaah', 'error');
    }
  );

  // Listener transaksi — urut createdAt descending (terbaru di atas)
  onSnapshot(
    query(collection(db, 'transaksi'), orderBy('createdAt', 'desc')),
    (snap) => {
      transaksiList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderRiwayatTable();
      renderRecentTx();
      updateStats();
    },
    (err) => {
      console.error('Transaksi listener error:', err);
      showToast('Gagal memuat riwayat transaksi', 'error');
    }
  );
}

// =========================================
// STATS / DASHBOARD
// =========================================
function updateStats() {
  // Total saldo: jumlahkan saldo semua jamaah
  const totalSaldo = jamaahList.reduce((s, j) => s + (Number(j.saldo) || 0), 0);
  document.getElementById('stat-total-saldo').textContent = formatRupiah(totalSaldo);

  // Jumlah jamaah
  document.getElementById('stat-jamaah').textContent = jamaahList.length + ' Orang';

  // Setoran bulan ini: filter transaksi berdasarkan bulan & tahun berjalan
  const now = new Date();
  const bulanIni = transaksiList
    .filter(tx => {
      const d = parseDate(tx.tanggal);
      return d && !isNaN(d.getTime()) &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
    })
    .reduce((s, tx) => s + (Number(tx.jumlah) || 0), 0);
  document.getElementById('stat-bulan-ini').textContent = formatRupiah(bulanIni);

  // Total jumlah transaksi
  document.getElementById('stat-total-tx').textContent = transaksiList.length + ' Tx';
}

// =========================================
// RECENT TRANSACTIONS (Dashboard)
// =========================================
function renderRecentTx() {
  const el = document.getElementById('recent-tx-list');
  const recent = transaksiList.slice(0, 5);

  if (recent.length === 0) {
    el.innerHTML = '<div class="p-6 text-center text-gray-400 text-sm">Belum ada transaksi</div>';
    return;
  }

  el.innerHTML = recent.map(tx => `
    <div class="px-5 py-3.5 flex items-center justify-between hover:bg-emerald-50 transition-colors">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">💸</div>
        <div>
          <div class="font-semibold text-gray-800 text-sm">${escapeHtml(tx.namaJamaah || '-')}</div>
          <div class="text-xs text-gray-400">${formatDate(tx.tanggal)}</div>
        </div>
      </div>
      <div class="text-emerald-600 font-bold text-sm">${formatRupiah(tx.jumlah)}</div>
    </div>
  `).join('');
}

// =========================================
// PROGRESS LIST (Dashboard)
// =========================================
function renderProgressList() {
  const el = document.getElementById('progress-list');
  if (jamaahList.length === 0) {
    el.innerHTML = '<div class="text-center text-gray-400 text-sm p-4">Belum ada jamaah terdaftar</div>';
    return;
  }

  el.innerHTML = jamaahList.slice(0, 8).map(j => {
    const pct = getPercent(j.saldo, j.target);
    const color = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-400' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400';
    return `
      <div>
        <div class="flex justify-between items-center mb-1">
          <span class="text-sm font-medium text-gray-700">${escapeHtml(j.nama)}</span>
          <span class="text-xs font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-gray-500'}">${pct}%</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
          <div class="progress-bar ${color} h-2 rounded-full" style="width:${pct}%"></div>
        </div>
        <div class="text-xs text-gray-400 mt-0.5">${formatRupiah(j.saldo || 0)} / ${formatRupiah(j.target || 0)}</div>
      </div>
    `;
  }).join('');
}

// =========================================
// JAMAAH
// =========================================
function renderJamaahTable(filter = '') {
  const tbody = document.getElementById('jamaah-tbody');
  let list = jamaahList;
  if (filter) {
    const q = filter.toLowerCase();
    list = list.filter(j => j.nama.toLowerCase().includes(q));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-10">
      ${filter ? 'Tidak ada hasil pencarian' : 'Belum ada jamaah terdaftar'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(j => {
    const pct = getPercent(j.saldo, j.target);
    const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-400' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400';
    const badgeClass = pct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';
    return `
      <tr class="border-t border-gray-50">
        <td class="px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-sm flex-shrink-0">
              ${escapeHtml(j.nama.charAt(0).toUpperCase())}
            </div>
            <span class="font-semibold text-gray-800 text-sm">${escapeHtml(j.nama)}</span>
          </div>
        </td>
        <td class="px-5 py-4 text-sm text-gray-600">${escapeHtml(j.hp || '-')}</td>
        <td class="px-5 py-4 text-right text-sm font-medium text-gray-700">${formatRupiah(j.target)}</td>
        <td class="px-5 py-4 text-right text-sm font-bold text-emerald-700">${formatRupiah(j.saldo || 0)}</td>
        <td class="px-5 py-4">
          <div class="flex items-center gap-2 min-w-[100px]">
            <div class="flex-1 bg-gray-100 rounded-full h-2">
              <div class="${barColor} h-2 rounded-full transition-all" style="width:${pct}%"></div>
            </div>
            <span class="text-xs font-bold ${badgeClass} px-1.5 py-0.5 rounded-md">${pct}%</span>
          </div>
        </td>
        <td class="px-5 py-4">
          <div class="flex items-center justify-center gap-2">
            <button onclick="openEditJamaah('${escapeAttr(j.id)}')"
              class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition-all">
              Edit
            </button>
            <button onclick="confirmHapusJamaah('${escapeAttr(j.id)}', '${escapeAttr(j.nama)}')"
              class="btn-danger px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-semibold transition-all">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterJamaah = function () {
  renderJamaahTable(document.getElementById('search-jamaah').value);
};

window.openAddJamaah = function () {
  document.getElementById('modal-title').textContent = 'Tambah Jamaah';
  document.getElementById('jamaah-id').value = '';
  document.getElementById('jamaah-nama').value = '';
  document.getElementById('jamaah-hp').value = '';
  document.getElementById('jamaah-target').value = '';
  openModal('modal-jamaah');
};

window.openEditJamaah = function (id) {
  const j = jamaahList.find(x => x.id === id);
  if (!j) return;
  document.getElementById('modal-title').textContent = 'Edit Jamaah';
  document.getElementById('jamaah-id').value = id;
  document.getElementById('jamaah-nama').value = j.nama || '';
  document.getElementById('jamaah-hp').value = j.hp || '';
  document.getElementById('jamaah-target').value = j.target || '';
  openModal('modal-jamaah');
};

window.saveJamaah = async function () {
  const id = document.getElementById('jamaah-id').value.trim();
  const nama = document.getElementById('jamaah-nama').value.trim();
  const hp = document.getElementById('jamaah-hp').value.trim();
  const target = parseFloat(document.getElementById('jamaah-target').value) || 0;

  if (!nama) { showToast('Nama tidak boleh kosong', 'error'); return; }
  if (target <= 0) { showToast('Target harus lebih dari 0', 'error'); return; }

  showLoading();
  try {
    if (id) {
      // Edit — hanya update profil, saldo tidak diubah manual di sini
      await updateDoc(doc(db, 'jamaah', id), { nama, hp, target });
      showToast('Data jamaah berhasil diperbarui');
    } else {
      // Tambah baru — saldo awal 0
      await addDoc(collection(db, 'jamaah'), {
        nama, hp, target,
        saldo: 0,
        createdAt: Timestamp.now()
      });
      showToast('Jamaah berhasil ditambahkan');
    }
    closeModal('modal-jamaah');
  } catch (e) {
    console.error(e);
    showToast('Gagal menyimpan data: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
};

window.confirmHapusJamaah = function (id, nama) {
  document.getElementById('hapus-message').textContent =
    `Hapus jamaah "${nama}"? Data jamaah akan dihapus permanen.`;
  document.getElementById('hapus-confirm-btn').onclick = () => hapusJamaah(id);
  openModal('modal-hapus');
};

async function hapusJamaah(id) {
  closeModal('modal-hapus');
  showLoading();
  try {
    await deleteDoc(doc(db, 'jamaah', id));
    showToast('Jamaah berhasil dihapus');
  } catch (e) {
    console.error(e);
    showToast('Gagal menghapus jamaah: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// =========================================
// SETORAN
// =========================================
function populateSetoranDropdown() {
  const sel = document.getElementById('setoran-jamaah');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">-- Pilih Jamaah --</option>';
  jamaahList.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = j.nama;
    sel.appendChild(opt);
  });
  // Pertahankan pilihan sebelumnya jika jamaah masih ada
  if (currentVal && jamaahList.find(x => x.id === currentVal)) {
    sel.value = currentVal;
    updateInfoCard(currentVal);
  }
}

function updateInfoCard(jamaahId) {
  const j = jamaahList.find(x => x.id === jamaahId);
  const card = document.getElementById('setoran-info-card');
  if (j) {
    card.classList.remove('hidden');
    document.getElementById('info-nama').textContent = j.nama;
    document.getElementById('info-hp').textContent = j.hp || '-';
    document.getElementById('info-target').textContent = formatRupiah(j.target);
    document.getElementById('info-saldo').textContent = formatRupiah(j.saldo || 0);
    const pct = getPercent(j.saldo, j.target);
    document.getElementById('info-persen').textContent = pct + '%';
    document.getElementById('info-progress-bar').style.width = pct + '%';
  } else {
    card.classList.add('hidden');
  }
}

window.submitSetoran = async function () {
  const jamaahId = document.getElementById('setoran-jamaah').value;
  const tanggal = document.getElementById('setoran-tanggal').value;
  const jumlah = parseFloat(document.getElementById('setoran-jumlah').value) || 0;
  const catatan = document.getElementById('setoran-catatan').value.trim();

  if (!jamaahId) { showToast('Pilih jamaah terlebih dahulu', 'error'); return; }
  if (!tanggal) { showToast('Tanggal tidak boleh kosong', 'error'); return; }
  if (jumlah <= 0) { showToast('Jumlah setoran harus lebih dari 0', 'error'); return; }

  const j = jamaahList.find(x => x.id === jamaahId);
  if (!j) { showToast('Jamaah tidak ditemukan', 'error'); return; }

  const saldoBaru = (Number(j.saldo) || 0) + jumlah;

  showLoading();
  try {
    // Simpan transaksi & update saldo secara PARALEL
    await Promise.all([
      addDoc(collection(db, 'transaksi'), {
        jamaahId,
        namaJamaah: j.nama,
        tanggal,        // string "YYYY-MM-DD"
        jumlah,
        catatan,
        createdAt: Timestamp.now()
      }),
      updateDoc(doc(db, 'jamaah', jamaahId), { saldo: saldoBaru })
    ]);

    showToast(`Setoran ${formatRupiah(jumlah)} berhasil disimpan`);

    // Reset form setoran
    document.getElementById('setoran-jamaah').value = '';
    document.getElementById('setoran-jumlah').value = '';
    document.getElementById('setoran-catatan').value = '';
    document.getElementById('setoran-tanggal').value = new Date().toISOString().slice(0, 10);
    document.getElementById('setoran-info-card').classList.add('hidden');
  } catch (e) {
    console.error(e);
    showToast('Gagal menyimpan setoran: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
};

// =========================================
// RIWAYAT TRANSAKSI
// =========================================
function renderRiwayatTable(filter = '') {
  const tbody = document.getElementById('riwayat-tbody');
  let list = transaksiList;
  if (filter) {
    const q = filter.toLowerCase();
    list = list.filter(tx => (tx.namaJamaah || '').toLowerCase().includes(q));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-10">
      ${filter ? 'Tidak ada hasil pencarian' : 'Belum ada transaksi'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(tx => `
    <tr class="border-t border-gray-50">
      <td class="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">${formatDate(tx.tanggal)}</td>
      <td class="px-5 py-4">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xs flex-shrink-0">
            ${escapeHtml((tx.namaJamaah || '?').charAt(0).toUpperCase())}
          </div>
          <span class="font-medium text-gray-800 text-sm">${escapeHtml(tx.namaJamaah || '-')}</span>
        </div>
      </td>
      <td class="px-5 py-4 text-right font-bold text-emerald-600 text-sm whitespace-nowrap">${formatRupiah(tx.jumlah)}</td>
      <td class="px-5 py-4 text-sm text-gray-500">${escapeHtml(tx.catatan || '-')}</td>
      <td class="px-5 py-4 text-center">
        <button onclick="confirmHapusTx('${escapeAttr(tx.id)}', '${escapeAttr(tx.namaJamaah || '')}', ${Number(tx.jumlah) || 0}, '${escapeAttr(tx.jamaahId || '')}')"
          class="btn-danger px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-semibold transition-all">
          Hapus
        </button>
      </td>
    </tr>
  `).join('');
}

window.filterRiwayat = function () {
  renderRiwayatTable(document.getElementById('search-riwayat').value);
};

window.confirmHapusTx = function (id, nama, jumlah, jamaahId) {
  document.getElementById('hapus-message').textContent =
    `Hapus setoran ${formatRupiah(jumlah)} dari "${nama}"? Saldo jamaah akan berkurang sejumlah ini.`;
  document.getElementById('hapus-confirm-btn').onclick = () => hapusTx(id, jumlah, jamaahId);
  openModal('modal-hapus');
};

async function hapusTx(id, jumlah, jamaahId) {
  closeModal('modal-hapus');
  showLoading();
  try {
    const j = jamaahId ? jamaahList.find(x => x.id === jamaahId) : null;
    const ops = [deleteDoc(doc(db, 'transaksi', id))];

    if (j) {
      // Saldo tidak boleh minus
      const saldoBaru = Math.max(0, (Number(j.saldo) || 0) - (Number(jumlah) || 0));
      ops.push(updateDoc(doc(db, 'jamaah', jamaahId), { saldo: saldoBaru }));
    }

    // Hapus & update saldo secara PARALEL
    await Promise.all(ops);
    showToast('Transaksi berhasil dihapus dan saldo diperbarui');
  } catch (e) {
    console.error(e);
    showToast('Gagal menghapus transaksi: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// =========================================
// EXPORT CSV
// =========================================
window.exportCSV = function () {
  if (jamaahList.length === 0 && transaksiList.length === 0) {
    showToast('Tidak ada data untuk diekspor', 'error');
    return;
  }

  const rows = [];

  rows.push('=== DATA JAMAAH ===');
  rows.push('Nama,No HP,Target (Rp),Saldo (Rp),Progress (%)');
  jamaahList.forEach(j => {
    const pct = getPercent(j.saldo, j.target);
    const nama = (j.nama || '').replace(/"/g, '""');
    const hp = (j.hp || '').replace(/"/g, '""');
    rows.push(`"${nama}","${hp}",${j.target || 0},${j.saldo || 0},${pct}`);
  });

  rows.push('');
  rows.push('=== RIWAYAT TRANSAKSI ===');
  rows.push('Tanggal,Nama Jamaah,Jumlah (Rp),Catatan');
  transaksiList.forEach(tx => {
    const tgl = formatDate(tx.tanggal);
    const nama = (tx.namaJamaah || '').replace(/"/g, '""');
    const catatan = (tx.catatan || '').replace(/"/g, '""');
    rows.push(`"${tgl}","${nama}",${tx.jumlah || 0},"${catatan}"`);
  });

  // BOM \uFEFF agar Excel baca karakter Indonesia dengan benar
  const csv = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tabungan-kurban-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Data berhasil diekspor ke CSV');
};

// =========================================
// INIT
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  // Set tanggal hari ini di form setoran
  const tglEl = document.getElementById('setoran-tanggal');
  if (tglEl) tglEl.value = new Date().toISOString().slice(0, 10);

  // Update info card saat pilih jamaah berubah
  document.getElementById('setoran-jamaah').addEventListener('change', function () {
    updateInfoCard(this.value);
  });

  // Mulai semua Firestore listener
  initListeners();
});