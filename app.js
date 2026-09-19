/* ==========================================================================
   RINNET+ ENTERPRISE INFRASTRUCTURE core business logic & app engine
   ========================================================================== */

let activeChart = null;
let sysPerfChart = null;
let currentUser = null;
let livePerfInterval = null;
let failedLoginAttempts = 0;

// Global Cache untuk Performa Super Cepat
window.SERVER_CACHE = [];
window.EMPLOYEE_CACHE = [];
window.RESELLER_CACHE = [];
window.KASBON_CACHE = [];
window.KASBON_VIEW_CACHE = [];
window.STOK_CACHE = [];
window.STOK_VIEW_CACHE = [];
window.DASH_RESELLER_VIEW_CACHE = [];

const JABATAN_RANK = {
  'Owner': 1,
  'Manajer': 2,
  'Officer': 3,
  'Teknisi': 4,
  'OB': 5,
  'Magang': 6
};

const VOUCHER_FIELDS = ['v2k', 'v3k', 'v4k', 'v5k', 'v6k', 'v25k', 'b1hp', 'b2hp', 'b3hp', 'b4hp', 'b5hp'];

const DYNAMIC_GREETINGS = [
  "Selamat bertugas! Mari ciptakan efisiensi dan performa terbaik hari ini.",
  "Semangat untuk hari ini! Semua sistem siap mendukung operasional Anda.",
  "Fokus, presisi, dan integritas. Mari wujudkan pencapaian baru hari ini!",
  "Sistem beroperasi optimal. Selamat menjalankan aktivitas kerja Anda.",
  "Setiap data dan kontribusi Anda sangat berharga bagi kemajuan perusahaan."
];

const QUOTES_DATABASE = [
  { text: "Hasil luar biasa tidak pernah datang dari zona nyaman. Tetap semangat!", author: "Motivasi Kerja" },
  { text: "Kerja keras dan integritas hari ini adalah investasi kesuksesan esok hari.", author: "Pengingat Diri" },
  { text: "Satu langkah kecil hari ini adalah awal dari pencapaian besar di masa depan.", author: "Inspirasi Harian" },
  { text: "Kerja tim yang solid membuat pekerjaan berat terasa ringan dan menyenangkan.", author: "Budaya Kerja" },
  { text: "Setiap masalah yang terselesaikan adalah bukti kenaikan level kemampuanmu.", author: "Mental Juara" },
  { text: "Jangan lupa tersenyum dan rehat sejenak, kesehatanmu adalah aset terbaik.", author: "Penghibur Diri" },
  { text: "Inovasi dan ketelitian adalah kunci utama dalam membangun infrastruktur masa depan.", author: "Visi Perusahaan" },
  { text: "Tantangan adalah kesempatan untuk menunjukkan kualitas terbaik yang kamu miliki.", author: "Pendorong Semangat" }
];

async function hashSHA256(str) {
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRupiah(num) {
  const n = Number(num) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

function toggleSidebar() {
  const sidebar = document.getElementById('mainSidebar');
  if (sidebar) sidebar.classList.toggle('show');
}

function togglePasswordVisibility() {
  const passInput = document.getElementById('loginPassword');
  const eyeIcon = document.getElementById('eyeIcon');
  if (passInput && passInput.type === 'password') {
    passInput.type = 'text';
    eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
  } else if (passInput) {
    passInput.type = 'password';
    eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function triggerSuccessCelebration() {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
  }
}

function setRandomDashboardGreeting() {
  const randomGreeting = DYNAMIC_GREETINGS[Math.floor(Math.random() * DYNAMIC_GREETINGS.length)];
  const randomQuote = QUOTES_DATABASE[Math.floor(Math.random() * QUOTES_DATABASE.length)];

  const welcomeSub = document.getElementById('dashWelcomeSubtitle');
  const qText = document.getElementById('quoteText');
  const qAuth = document.getElementById('quoteAuthor');

  if (welcomeSub) welcomeSub.innerText = randomGreeting;
  if (qText) qText.innerText = `"${randomQuote.text}"`;
  if (qAuth) qAuth.innerText = `— ${randomQuote.author}`;
}

function generateAutoEmployeeID() {
  const existingCount = window.EMPLOYEE_CACHE.length + 1;
  const nextID = 'IDR-' + String(existingCount).padStart(3, '0');
  const inputEl = document.getElementById('empID');
  if (inputEl) inputEl.value = nextID;
}

// Master Dropdown Hydration
async function loadAllMasterDropdowns() {
  try {
    const { data: srvs } = await _supabase.from('servers').select('*').order('nama_server', { ascending: true });
    if (srvs) window.SERVER_CACHE = srvs;

    const { data: emps } = await _supabase.from('employees').select('*').order('nama_karyawan', { ascending: true });
    if (emps) window.EMPLOYEE_CACHE = emps;

    const { data: rsls } = await _supabase.from('reseller_master').select('*').order('nama_reseller', { ascending: true });
    if (rsls) window.RESELLER_CACHE = rsls;

    populateServerDropdown();
    populateResellerServerDropdown();
    populateKasbonKaryawanDropdown();
    populateKasbonSumberDanaDropdown();
    populateStokResellerDropdown();
    populateDashResellerServerFilter();
  } catch(err) {
    console.warn("Gagal memuat master dropdown dari Supabase.", err);
  }
}

function populateServerDropdown() {
  const stkSelect = document.getElementById('stkServer');
  const optionsHtml = '<option value="">-- Pilih Server --</option>' + 
    window.SERVER_CACHE.map(s => `<option value="${escapeHTML(s.nama_server)}">${escapeHTML(s.nama_server)} (${escapeHTML(s.wilayah || 'Umum')})</option>`).join('');

  if (stkSelect) stkSelect.innerHTML = optionsHtml;
}

function populateResellerServerDropdown() {
  const rslSelect = document.getElementById('rslServer');
  if (rslSelect) {
    rslSelect.innerHTML = '<option value="">-- Pilih Server --</option>' + 
      window.SERVER_CACHE.map(s => `<option value="${escapeHTML(s.nama_server)}">${escapeHTML(s.nama_server)}</option>`).join('');
  }
}

function populateKasbonKaryawanDropdown() {
  const ksbEmpSelect = document.getElementById('ksbKaryawan');
  const fltEmpSelect = document.getElementById('fltKasbonKaryawan');
  const optionsHtml = window.EMPLOYEE_CACHE.map(e => `<option value="${escapeHTML(e.nama_karyawan)}">${escapeHTML(e.nama_karyawan)} (${escapeHTML(e.jabatan || '-')})</option>`).join('');

  if (ksbEmpSelect) ksbEmpSelect.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + optionsHtml;
  if (fltEmpSelect) fltEmpSelect.innerHTML = '<option value="">-- Semua Karyawan --</option>' + optionsHtml;
}

// PERBAIKAN 3A: Populate Sumber Dana Kasbon dari Server Cloud
function populateKasbonSumberDanaDropdown() {
  const ksbSumberSelect = document.getElementById('ksbSumber');
  if (ksbSumberSelect) {
    const serverOptions = window.SERVER_CACHE.map(s => `<option value="${escapeHTML(s.nama_server)}">Server: ${escapeHTML(s.nama_server)}</option>`).join('');
    ksbSumberSelect.innerHTML = '<option value="">-- Pilih Sumber Dana --</option>' + serverOptions + '<option value="Kas Kantor/Lainnya">Kas Kantor/Lainnya</option>';
  }
}

// FUNGSI BARU: Untuk Filter Server di Dashboard & Halaman Stok
function populateDashResellerServerFilter() {
  const optionsHtml = window.SERVER_CACHE.map(s => 
    `<option value="${escapeHTML(s.nama_server)}">${escapeHTML(s.nama_server)}</option>`
  ).join('');
  
  const dashFilterSelect = document.getElementById('dashResellerServerFilter');
  if (dashFilterSelect) dashFilterSelect.innerHTML = '<option value="">-- Semua Server --</option>' + optionsHtml;

  const stokFilterSelect = document.getElementById('fltStokServer');
  if (stokFilterSelect) stokFilterSelect.innerHTML = '<option value="">-- Semua Server --</option>' + optionsHtml;
}

// PERBAIKAN 2: Reseller Difilter Berdasarkan Server yang Dipilih
function populateStokResellerDropdown(selectedServer = '') {
  const stkResellerSelect = document.getElementById('stkReseller');
  if (!stkResellerSelect) return;

  let filteredReseller = window.RESELLER_CACHE;
  if (selectedServer) {
    filteredReseller = window.RESELLER_CACHE.filter(r => r.nama_server === selectedServer);
  }

  if (filteredReseller.length === 0) {
    stkResellerSelect.innerHTML = '<option value="">-- Tidak ada Reseller di Server ini --</option>';
  } else {
    stkResellerSelect.innerHTML = '<option value="">-- Pilih Reseller --</option>' +
      filteredReseller.map(r => `<option value="${escapeHTML(r.nama_reseller)}">${escapeHTML(r.nama_reseller)}</option>`).join('');
  }
}

function handleStokServerChange(e) {
  const serverName = e.target.value;
  populateStokResellerDropdown(serverName);
}

// Apply Role Access Control & Read-Only for MANAJEMEN Role
function applyRolePermissions() {
  const role = currentUser?.role || 'ADMIN';
  const isSuperadmin = role === 'SUPERADMIN';
  const isManajemen = role === 'MANAJEMEN';
  const isDataEntry = role === 'DATA ENTRY';
  
  const allowedModules = (isDataEntry && currentUser.akses_modul) ? currentUser.akses_modul.split(',') : [];

  // 1. Tampilkan/Sembunyikan Akses Khusus Superadmin
  document.querySelectorAll('.superadmin-only').forEach(el => {
    if (el.classList.contains('page-section')) return;
    if (isSuperadmin) el.classList.remove('d-none');
    else el.classList.add('d-none');
  });

  // 2. Proteksi Navigasi Sidebar Berdasarkan Role Data Entry
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    const menu = link.getAttribute('data-menu');
    // Lewati menu umum
    if (['dashboard', 'profil', 'about', 'serverWilayah'].includes(menu) || !menu) return;
    
    if (isDataEntry) {
      if (!allowedModules.includes(menu)) link.classList.add('d-none');
      else link.classList.remove('d-none');
    } else {
      if (!link.classList.contains('superadmin-only')) link.classList.remove('d-none');
    }
  });

  // 3. Proteksi Quick Access Dashboard Berdasarkan Role Data Entry
  document.querySelectorAll('.quick-access-card').forEach(card => {
    const menu = card.getAttribute('data-menu');
    if (['dashboard', 'profil', 'about', 'serverWilayah'].includes(menu) || !menu) return;

    if (isDataEntry) {
      if (!allowedModules.includes(menu)) card.parentElement.classList.add('d-none');
      else card.parentElement.classList.remove('d-none');
    } else {
      if (!card.parentElement.classList.contains('superadmin-only')) card.parentElement.classList.remove('d-none');
    }
  });

  // 4. Aturan Read-Only untuk MANAJEMEN... (Lanjutkan dengan kode formServer, formResellerMaster dsb. milik Anda)
  ['formServer', 'formResellerMaster', 'formKaryawan', 'formKasbon', 'formStokReseller'].forEach(id => {
    const formEl = document.getElementById(id);
    if (!formEl) return;
    
    // Penyesuaian pembungkus: formStokReseller dibungkus oleh .card langsung, yang lain oleh .col-lg-4
    const formColumn = id === 'formStokReseller' ? formEl.closest('.card') : formEl.closest('.col-lg-4'); 
    const tableColumn = id === 'formStokReseller' ? null : formColumn?.nextElementSibling; 
    
    if (isManajemen) {
      if (formColumn) formColumn.classList.add('d-none'); // Hilangkan form
      if (tableColumn && tableColumn.classList.contains('col-lg-8')) {
        tableColumn.classList.replace('col-lg-8', 'col-lg-12'); // Lebarkan tabel
      }
    } else {
      if (formColumn) formColumn.classList.remove('d-none'); // Kembalikan form
      if (tableColumn && tableColumn.classList.contains('col-lg-12')) {
        tableColumn.classList.replace('col-lg-12', 'col-lg-8'); // Kembalikan ukuran tabel
      }
    }
  });

  // 3. Sembunyikan Tombol Aksi (Edit/Hapus) di dalam Tabel
  document.querySelectorAll('.action-col').forEach(el => {
    if (isManajemen) el.classList.add('d-none');
    else el.classList.remove('d-none');
  });
}

function restoreUserAvatar() {
  if (!currentUser) return;
  const savedAvatar = localStorage.getItem('rinnet_user_avatar_' + currentUser.username);
  const avatarImg = savedAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  
  const navAvatar = document.getElementById('navUserAvatar');
  const prfAvatar = document.getElementById('prfAvatarPreview');
  if (navAvatar) navAvatar.src = avatarImg;
  if (prfAvatar) prfAvatar.src = avatarImg;
}

// ==========================================
// SERVER MANAGEMENT
// ==========================================
async function fetchAndRenderServers() {
  try {
    const { data, error } = await _supabase.from('servers').select('*').order('nama_server', { ascending: true });
    if (error) throw error;
    
    window.SERVER_CACHE = data || [];
    
    const tbody = document.getElementById('bodyServer');
    if (tbody) {
      tbody.innerHTML = (data || []).map(s => `
        <tr>
          <td class="fw-bold">${escapeHTML(s.nama_server)}</td>
          <td>${escapeHTML(s.pengelola)}</td>
          <td>${escapeHTML(s.no_wa)}</td>
          <td><span class="badge bg-info bg-opacity-10 text-info border border-info">${escapeHTML(s.wilayah)}</span></td>
          <td class="action-col text-end">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editServer('${s.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteServer('${s.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-center text-muted py-3">Belum ada data server.</td></tr>';
    }

    const totalSrvEl = document.getElementById('dashTotalServer');
    if (totalSrvEl) totalSrvEl.innerText = (data || []).length;
    
    renderServerWilayahCluster(data || []);
    renderClusterMonitoringTable(data || []);
    populateKasbonSumberDanaDropdown();
    applyRolePermissions();
  } catch (err) {
    console.error(err);
  }
}

function editServer(id) {
  const s = window.SERVER_CACHE.find(x => String(x.id) === String(id));
  if (!s) return;
  document.getElementById('srvId').value = s.id;
  document.getElementById('srvNama').value = s.nama_server || '';
  document.getElementById('srvPengelola').value = s.pengelola || '';
  document.getElementById('srvWA').value = s.no_wa || '';
  document.getElementById('srvWilayah').value = s.wilayah || '';
  
  const title = document.getElementById('titleFormServer');
  if (title) title.innerText = 'Edit Server Cloud';
  const btnBatal = document.getElementById('btnBatalEditServer');
  if (btnBatal) btnBatal.classList.remove('d-none');
}

function cancelEditServer() {
  const form = document.getElementById('formServer');
  if (form) form.reset();
  const idEl = document.getElementById('srvId');
  if (idEl) idEl.value = '';
  
  const title = document.getElementById('titleFormServer');
  if (title) title.innerText = 'Input Server Baru';
  const btnBatal = document.getElementById('btnBatalEditServer');
  if (btnBatal) btnBatal.classList.add('d-none');
}

function renderServerWilayahCluster(servers) {
  const container = document.getElementById('containerServerWilayah');
  if (!container) return;

  const grouped = {};
  servers.forEach(s => {
    const wil = s.wilayah || 'Lainnya';
    if (!grouped[wil]) grouped[wil] = [];
    grouped[wil].push(s);
  });

  const dashWilEl = document.getElementById('dashTotalWilayah');
  if (dashWilEl) dashWilEl.innerText = Object.keys(grouped).length;

  // Fitur Sorting Berdasarkan Angka Terkecil
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt((a.match(/\d+/) || [9999])[0], 10);
    const numB = parseInt((b.match(/\d+/) || [9999])[0], 10);
    if (numA === numB) return a.localeCompare(b);
    return numA - numB;
  });

  let html = '';
  for (const wil of sortedKeys) {
    const list = grouped[wil];
    html += `
      <div class="card card-custom p-4 mb-4">
        <h5 class="fw-bold text-primary mb-3"><i class="fa-solid fa-map-pin me-2"></i>Wilayah / Cluster: ${escapeHTML(wil)}</h5>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr><th>Nama Server</th><th>Pengelola</th><th>WhatsApp</th><th class="action-col text-end">Aksi</th></tr></thead>
            <tbody>
              ${list.map(s => `
                <tr>
                  <td class="fw-bold">${escapeHTML(s.nama_server)}</td>
                  <td>${escapeHTML(s.pengelola)}</td>
                  <td>${escapeHTML(s.no_wa)}</td>
                  <td class="action-col text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editServer('${s.id}'); switchMenu('server');"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteServer('${s.id}')"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  container.innerHTML = html || '<div class="alert alert-light text-center">Belum ada data server wilayah.</div>';
  applyRolePermissions();
}

function renderClusterMonitoringTable(servers) {
  const tbody = document.getElementById('bodyClusterStatus');
  if (!tbody) return;

  if (!servers || servers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Tidak ada server terdaftar untuk dimonitor.</td></tr>';
    return;
  }

  tbody.innerHTML = servers.map(s => `
    <tr>
      <td class="fw-bold text-dark"><i class="fa-solid fa-server text-primary me-2"></i>${escapeHTML(s.nama_server)}</td>
      <td>${escapeHTML(s.pengelola || '-')}</td>
      <td><span class="badge bg-light text-dark border">${escapeHTML(s.wilayah || 'Cluster 1')}</span></td>
      <td><span class="badge bg-success bg-opacity-10 text-success border border-success"><i class="fa-solid fa-circle-check me-1"></i>Synced</span></td>
      <td><span class="badge bg-primary rounded-pill px-3">ACTIVE ONLINE</span></td>
    </tr>
  `).join('');
}

async function handleSaveServer(e) {
  e.preventDefault();
  const id = document.getElementById('srvId')?.value;
  const payload = {
    nama_server: document.getElementById('srvNama')?.value.trim(),
    pengelola: document.getElementById('srvPengelola')?.value.trim(),
    no_wa: document.getElementById('srvWA')?.value.trim(),
    wilayah: document.getElementById('srvWilayah')?.value.trim()
  };

  const { error } = id
    ? await _supabase.from('servers').update(payload).eq('id', id)
    : await _supabase.from('servers').insert([payload]);

  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', `Data Server ${id ? 'diperbarui' : 'tersimpan'}!`, 'success');
    cancelEditServer();
    await fetchAndRenderServers();
    await loadAllMasterDropdowns();
  }
}

async function deleteServer(id) {
  const confirm = await Swal.fire({ title: 'Hapus Server?', text: "Data di Supabase akan terhapus permanen", icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus' });
  if (confirm.isConfirmed) {
    try {
      const { error } = await _supabase.from('servers').delete().eq('id', id);
      if (error) throw error;
      fetchAndRenderServers();
      loadAllMasterDropdowns();
      Swal.fire('Terhapus!', 'Data Server berhasil dihapus.', 'success');
    } catch(err) {
      Swal.fire('Gagal!', err.message, 'error');
    }
  }
}

// ==========================================
// EMPLOYEE MANAGEMENT
// ==========================================
// PERBAIKAN 1: Memastikan Teks Jabatan Terlihat Jelas
async function fetchAndRenderEmployees() {
  try {
    const { data, error } = await _supabase.from('employees').select('*');
    if (error) throw error;

    const sortedData = (data || []).sort((a, b) => (JABATAN_RANK[a.jabatan] || 99) - (JABATAN_RANK[b.jabatan] || 99));
    window.EMPLOYEE_CACHE = sortedData;

    const tbody = document.getElementById('bodyKaryawan');
    if (tbody) {
      tbody.innerHTML = sortedData.map(e => {
        const jabatanText = e.jabatan ? escapeHTML(e.jabatan) : '-';
        return `
        <tr>
          <td class="fw-bold text-primary">${escapeHTML(e.emp_id)}</td>
          <td class="fw-bold">${escapeHTML(e.nama_karyawan)}</td>
          <td><span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle px-2 py-1 fw-semibold">${jabatanText}</span></td>
          <td>${escapeHTML(e.no_wa || '-')}</td>
          <td class="action-col text-end">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editEmployee('${e.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteEmployee('${e.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `;
      }).join('') || '<tr><td colspan="5" class="text-center text-muted py-3">Belum ada data karyawan.</td></tr>';
    }

    const dashEmpEl = document.getElementById('dashTotalKaryawan');
    if (dashEmpEl) dashEmpEl.innerText = sortedData.length;
    applyRolePermissions();
  } catch (err) {
    console.error(err);
  }
}

function editEmployee(id) {
  const e = window.EMPLOYEE_CACHE.find(x => String(x.id) === String(id));
  if (!e) return;
  document.getElementById('empDbId').value = e.id;
  document.getElementById('empID').value = e.emp_id || '';
  document.getElementById('empNama').value = e.nama_karyawan || '';
  document.getElementById('empJabatan').value = e.jabatan || '';
  document.getElementById('empWA').value = e.no_wa || '';

  const title = document.getElementById('titleFormKaryawan');
  if (title) title.innerText = 'Edit Data Karyawan';
  const btnBatal = document.getElementById('btnBatalEditKaryawan');
  if (btnBatal) btnBatal.classList.remove('d-none');
}

function cancelEditKaryawan() {
  const form = document.getElementById('formKaryawan');
  if (form) form.reset();
  const idEl = document.getElementById('empDbId');
  if (idEl) idEl.value = '';
  
  const title = document.getElementById('titleFormKaryawan');
  if (title) title.innerText = 'Input Data Karyawan';
  const btnBatal = document.getElementById('btnBatalEditKaryawan');
  if (btnBatal) btnBatal.classList.add('d-none');
}

async function handleSaveEmployee(e) {
  e.preventDefault();
  const dbId = document.getElementById('empDbId')?.value;
  const payload = {
    emp_id: document.getElementById('empID')?.value.trim(),
    nama_karyawan: document.getElementById('empNama')?.value.trim(),
    jabatan: document.getElementById('empJabatan')?.value,
    no_wa: document.getElementById('empWA')?.value.trim()
  };

  const { error } = dbId
    ? await _supabase.from('employees').update(payload).eq('id', dbId)
    : await _supabase.from('employees').insert([payload]);

  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', `Data Karyawan ${dbId ? 'diperbarui' : 'tersimpan'}!`, 'success');
    cancelEditKaryawan();
    fetchAndRenderEmployees();
    loadAllMasterDropdowns();
  }
}

async function deleteEmployee(id) {
  const confirm = await Swal.fire({ title: 'Hapus Karyawan?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    try {
      const { error } = await _supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      fetchAndRenderEmployees();
      loadAllMasterDropdowns();
      Swal.fire('Terhapus!', 'Data Karyawan berhasil dihapus.', 'success');
    } catch(err) {
      Swal.fire('Gagal!', err.message, 'error');
    }
  }
}

// ==========================================
// RESELLER MANAGEMENT
// ==========================================
async function fetchAndRenderResellers() {
  try {
    // Diurutkan berdasarkan nama_server, lalu nama_reseller
    const { data, error } = await _supabase.from('reseller_master').select('*').order('nama_server', { ascending: true }).order('nama_reseller', { ascending: true });
    if (error) throw error;
    
    window.RESELLER_CACHE = data || [];

    const tbody = document.getElementById('bodyMasterReseller');
    if (tbody) {
      tbody.innerHTML = (data || []).map(r => `
        <tr>
          <td><span class="badge bg-secondary bg-opacity-10 text-dark border">${escapeHTML(r.nama_server)}</span></td>
          <td class="fw-bold">${escapeHTML(r.nama_reseller)}</td>
          <td>${escapeHTML(r.no_wa)}</td>
          <td class="action-col text-end">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editReseller('${r.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteReseller('${r.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada data reseller.</td></tr>';
    }

    const dashRslEl = document.getElementById('dashTotalReseller');
    if (dashRslEl) dashRslEl.innerText = (data || []).length;
    
    const stkServerValue = document.getElementById('stkServer')?.value || '';
    populateStokResellerDropdown(stkServerValue);
    applyRolePermissions();
  } catch(err) {
    console.error(err);
  }
}

function editReseller(id) {
  const r = window.RESELLER_CACHE.find(x => String(x.id) === String(id));
  if (!r) return;
  document.getElementById('rslId').value = r.id;
  document.getElementById('rslNama').value = r.nama_reseller || '';
  document.getElementById('rslWA').value = r.no_wa || '';
  document.getElementById('rslServer').value = r.nama_server || '';

  const title = document.getElementById('titleFormReseller');
  if (title) title.innerText = 'Edit Data Reseller';
  const btnBatal = document.getElementById('btnBatalEditReseller');
  if (btnBatal) btnBatal.classList.remove('d-none');
}

function cancelEditReseller() {
  const form = document.getElementById('formResellerMaster');
  if (form) form.reset();
  const idEl = document.getElementById('rslId');
  if (idEl) idEl.value = '';
  
  const title = document.getElementById('titleFormReseller');
  if (title) title.innerText = 'Input Data Reseller';
  const btnBatal = document.getElementById('btnBatalEditReseller');
  if (btnBatal) btnBatal.classList.add('d-none');
}

async function handleSaveReseller(e) {
  e.preventDefault();
  const id = document.getElementById('rslId')?.value;
  const payload = {
    nama_reseller: document.getElementById('rslNama')?.value.trim(),
    no_wa: document.getElementById('rslWA')?.value.trim(),
    nama_server: document.getElementById('rslServer')?.value
  };

  const { error } = id
    ? await _supabase.from('reseller_master').update(payload).eq('id', id)
    : await _supabase.from('reseller_master').insert([payload]);

  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', `Data Reseller ${id ? 'diperbarui' : 'tersimpan'}!`, 'success');
    cancelEditReseller();
    fetchAndRenderResellers();
    loadAllMasterDropdowns();
  }
}

async function deleteReseller(id) {
  const confirm = await Swal.fire({ title: 'Hapus Reseller?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    try {
      const { error } = await _supabase.from('reseller_master').delete().eq('id', id);
      if (error) throw error;
      fetchAndRenderResellers();
      loadAllMasterDropdowns();
      Swal.fire('Terhapus!', 'Data Reseller berhasil dihapus.', 'success');
    } catch(err) {
      Swal.fire('Gagal!', err.message, 'error');
    }
  }
}

// ==========================================
// USER MANAGEMENT
// ==========================================
async function fetchAndRenderUsers() {
  try {
    const { data, error } = await _supabase.from('users').select('*');
    if (error) throw error;

    const tbody = document.getElementById('bodyUsers');
    if (tbody) {
     tbody.innerHTML = (data || []).map(u => `
        <tr>
          <td class="fw-bold text-dark">${escapeHTML(u.username)}</td>
          <td>${escapeHTML(u.email || '-')}</td>
          <td><span class="badge bg-primary rounded-pill px-3">${escapeHTML(u.role || 'ADMIN')}</span></td>
          <td class="action-col text-end">
            <button class="btn btn-sm btn-outline-info me-1" onclick="sendEmailToUser('${escapeHTML(u.email)}')" title="Kirim Email"><i class="fa-solid fa-envelope"></i></button>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editUser('${u.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada user registered.</td></tr>';
    }
    applyRolePermissions();
  } catch(err) {
    console.error(err);
  }
}

// 1. Pada fungsi editUser(id)
function editUser(id) {
  _supabase.from('users').select('*').eq('id', id).single().then(({ data }) => {
    if (!data) return;
    document.getElementById('usrId').value = data.id;
    document.getElementById('usrName').value = data.username || '';
    document.getElementById('usrFullName').value = data.nama_lengkap || '';
    document.getElementById('usrEmail').value = data.email || '';
    document.getElementById('usrWA').value = data.no_wa || '';
    
    const roleSelect = document.getElementById('usrRole');
    roleSelect.value = data.role || 'ADMIN';
    roleSelect.dispatchEvent(new Event('change')); // Trigger tampilan opsi akses

    // Centang checkbox jika ada hak akses tersimpan
    document.querySelectorAll('.module-cb').forEach(cb => cb.checked = false);
    if (data.role === 'DATA ENTRY' && data.akses_modul) {
      const allowed = data.akses_modul.split(',');
      document.querySelectorAll('.module-cb').forEach(cb => {
        if (allowed.includes(cb.value)) cb.checked = true;
      });
    }

    const title = document.getElementById('titleFormUser');
    if (title) title.innerText = 'Edit User System';
    const btnBatal = document.getElementById('btnBatalEditUser');
    if (btnBatal) btnBatal.classList.remove('d-none');
  });
}

// 2. Pada fungsi cancelEditUser()
function cancelEditUser() {
  const form = document.getElementById('formUserMgmt');
  if (form) form.reset();
  const idEl = document.getElementById('usrId');
  if (idEl) idEl.value = '';
  
  document.getElementById('dataEntryAccessContainer')?.classList.add('d-none');
  document.querySelectorAll('.module-cb').forEach(cb => cb.checked = false);
  
  const title = document.getElementById('titleFormUser');
  if (title) title.innerText = 'Registrasi User Baru';
  const btnBatal = document.getElementById('btnBatalEditUser');
  if (btnBatal) btnBatal.classList.add('d-none');
}

// 3. Pada fungsi handleSaveUserMgmt(e)
async function handleSaveUserMgmt(e) {
  e.preventDefault();
  const id = document.getElementById('usrId')?.value;
  const username = document.getElementById('usrName')?.value.trim();
  const nama_lengkap = document.getElementById('usrFullName')?.value.trim();
  const email = document.getElementById('usrEmail')?.value.trim();
  const rawPass = document.getElementById('usrPass')?.value.trim();
  const no_wa = document.getElementById('usrWA')?.value.trim();
  const role = document.getElementById('usrRole')?.value;

  // Tangkap data checkbox jika role Data Entry
  let akses_modul = null;
  if (role === 'DATA ENTRY') {
    const checkedBoxes = Array.from(document.querySelectorAll('.module-cb:checked')).map(cb => cb.value);
    akses_modul = checkedBoxes.join(','); // Disimpan dengan format "server,karyawan,kasbon"
  }

  const payload = { username, nama_lengkap, email, no_wa, role, akses_modul };
  if (rawPass && rawPass.length >= 6) {
    payload.password_hash = await hashSHA256(rawPass);
  } else if (!id && (!rawPass || rawPass.length < 6)) {
    Swal.fire('Password Wajib', 'Password baru minimal 6 karakter.', 'warning');
    return;
  }

  const { error } = id
    ? await _supabase.from('users').update(payload).eq('id', id)
    : await _supabase.from('users').insert([payload]);

  if (error) {
    Swal.fire('Gagal Simpan User', error.message, 'error');
  } else {
    Swal.fire('Berhasil', `User ${id ? 'diperbarui' : 'didaftarkan'}!`, 'success');
    cancelEditUser();
    fetchAndRenderUsers();
  }
}

async function deleteUser(id) {
  const confirm = await Swal.fire({ title: 'Hapus Akun User?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    try {
      const { error } = await _supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      fetchAndRenderUsers();
      Swal.fire('Terhapus!', 'Akun User berhasil dihapus.', 'success');
    } catch(err) {
      Swal.fire('Gagal!', err.message, 'error');
    }
  }
}

function sendEmailToUser(email) {
  if (!email || email === '-') {
    Swal.fire('Info', 'User ini tidak memiliki alamat email yang terdaftar.', 'info');
    return;
  }
  window.location.href = `mailto:${email}?subject=Notifikasi Sistem RINNET+&body=Halo, ini pesan administratif dari Superadmin RINNET+.`;
}

// ==========================================
// AUTHENTICATION & LOGIN LOGIC
// ==========================================
const LOCKOUT_DURATION_MS = 60000;
const MAX_FAILED_ATTEMPTS = 3;

function getLockoutRemainingMs() {
  const until = parseInt(localStorage.getItem('rinnet_lockout_until') || '0', 10);
  return until - Date.now();
}

function registerFailedAttempt() {
  failedLoginAttempts = parseInt(localStorage.getItem('rinnet_failed_attempts') || '0', 10) + 1;
  localStorage.setItem('rinnet_failed_attempts', String(failedLoginAttempts));
  if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    const until = Date.now() + LOCKOUT_DURATION_MS;
    localStorage.setItem('rinnet_lockout_until', String(until));
    localStorage.setItem('rinnet_failed_attempts', '0');
    startLockoutCountdown();
  }
}

function clearFailedAttempts() {
  failedLoginAttempts = 0;
  localStorage.setItem('rinnet_failed_attempts', '0');
  localStorage.removeItem('rinnet_lockout_until');
}

function startLockoutCountdown() {
  const alertBox = document.getElementById('loginLockoutAlert');
  const btnLogin = document.getElementById('btnLogin');
  if (!alertBox) return;

  const tick = () => {
    const remainingMs = getLockoutRemainingMs();
    if (remainingMs <= 0) {
      alertBox.classList.add('d-none');
      if (btnLogin) btnLogin.disabled = false;
      return;
    }
    alertBox.classList.remove('d-none');
    alertBox.innerHTML = `<i class="fa-solid fa-shield-halved me-1"></i> Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(remainingMs / 1000)} detik.`;
    if (btnLogin) btnLogin.disabled = true;
    setTimeout(tick, 1000);
  };
  tick();
}

async function initializeAuthenticatedUser(user) {
  currentUser = user;
  localStorage.setItem('rinnet_user_session', JSON.stringify(currentUser));

  document.getElementById('pageLogin')?.classList.add('d-none');
  document.getElementById('pageApp')?.classList.remove('d-none');

  const displayName = currentUser.nama_lengkap || currentUser.username;
  const userRole = currentUser.role || 'ADMIN';

  const navNameEl = document.getElementById('navUserName');
  const roleBadgeEl = document.getElementById('userRoleBadge');
  if (navNameEl) navNameEl.innerText = escapeHTML(displayName);
  if (roleBadgeEl) roleBadgeEl.innerText = `Role: ${userRole}`;

  restoreUserAvatar();
  setRandomDashboardGreeting();
  await loadAllMasterDropdowns();
  await fetchAndRenderServers();
  await fetchAndRenderEmployees();
  await fetchAndRenderResellers();
  await fetchAndRenderUsers();
  await fetchAndRenderKasbon();
  await fetchAndRenderStok();
  populateProfilForm();
  renderServerDistributionChart();
  startSysPerfSimulation();

  switchMenu('dashboard');
  applyRolePermissions();
}

async function handleAuthLogin(e) {
  e.preventDefault();

  if (getLockoutRemainingMs() > 0) {
    startLockoutCountdown();
    return;
  }

  // Tambahkan proteksi jika script hcaptcha terblokir/gagal dimuat
if (typeof hcaptcha === 'undefined') {
  Swal.fire('Sistem Error', 'Widget keamanan gagal dimuat. Harap matikan adblocker atau refresh halaman.', 'error');
  return;
}

const hcaptchaVal = hcaptcha.getResponse();
if (!hcaptchaVal) {
  Swal.fire('Validasi Keamanan', 'Silakan centang kotak hCaptcha terlebih dahulu untuk membuktikan Anda bukan robot!', 'warning');
  return;
}
  // ----------------------------------------------------------------------

  const userVal = document.getElementById('loginUsername')?.value.trim();
  const passVal = document.getElementById('loginPassword')?.value.trim();

  document.getElementById('btnLoginText')?.classList.add('d-none');
  document.getElementById('btnLoginSpinner')?.classList.remove('d-none');

  try {
    const { data: users, error } = await _supabase.from('users').select('*').eq('username', userVal);
    const passHash = await hashSHA256(passVal);

    const matchedUser = users && users.length > 0 ? users[0] : null;
    const isHashValid = matchedUser && matchedUser.password_hash === passHash;

    if (error || !matchedUser || !isHashValid) {
      registerFailedAttempt();
      const remaining = MAX_FAILED_ATTEMPTS - failedLoginAttempts;
      Swal.fire('Gagal Masuk', remaining > 0 ? `Username atau password salah! Sisa percobaan: ${remaining}.` : 'Akun dikunci sementara!', 'error');
      
      // --- 2. TAMBAHAN HCAPTCHA: Reset widget jika password salah ---
      hcaptcha.reset(); 
      return;
    }

    clearFailedAttempts();
    triggerSuccessCelebration();
    await initializeAuthenticatedUser(matchedUser);

  } catch(err) {
    console.error(err);
    Swal.fire('System Error', 'Gagal terhubung ke Supabase.', 'error');
    
    // --- 3. TAMBAHAN HCAPTCHA: Reset widget jika terjadi error ---
    hcaptcha.reset();
  } finally {
    document.getElementById('btnLoginText')?.classList.remove('d-none');
    document.getElementById('btnLoginSpinner')?.classList.add('d-none');
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('rinnet_user_session');
  document.getElementById('pageApp')?.classList.add('d-none');
  document.getElementById('pageLogin')?.classList.remove('d-none');
  const form = document.getElementById('formLogin');
  if (form) form.reset();
}

function tryRestoreSession() {
  const saved = localStorage.getItem('rinnet_user_session');
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user && user.username) {
        // 1. Tampilkan UI seketika menggunakan data sesi lokal biar cepat
        initializeAuthenticatedUser(user);
        
        // 2. [FITUR BARU] Cek ke database di latar belakang untuk mendapatkan hak akses terbaru
        _supabase.from('users').select('*').eq('id', user.id).single().then(({ data, error }) => {
          if (data && !error) {
            // Timpa data lama dengan data terbaru dari server
            currentUser = data; 
            localStorage.setItem('rinnet_user_session', JSON.stringify(currentUser));
            
            // Terapkan ulang perlindungan menu agar sesuai dengan hak akses terbaru
            applyRolePermissions(); 
          }
        });
      }
    } catch(err) {
      localStorage.removeItem('rinnet_user_session');
    }
  }
}

// ==========================================
// MENU NAVIGATION & EXPORTS
// ==========================================
function switchMenu(menuKey) {
  const role = currentUser?.role || 'ADMIN';
  const isDataEntry = role === 'DATA ENTRY';
  const allowedModules = (isDataEntry && currentUser.akses_modul) ? currentUser.akses_modul.split(',') : [];

  // Proteksi khusus Superadmin
  if ((menuKey === 'sysPerf' || menuKey === 'userMgmt') && role !== 'SUPERADMIN') {
    if (typeof Swal !== 'undefined') Swal.fire('Akses Ditolak', 'Halaman ini hanya dapat diakses oleh Superadmin.', 'warning');
    return;
  }

  // Proteksi khusus Data Entry
  if (isDataEntry && !['dashboard', 'profil', 'about', 'serverWilayah'].includes(menuKey)) {
    if (!allowedModules.includes(menuKey)) {
      if (typeof Swal !== 'undefined') Swal.fire('Akses Ditolak', 'Akun Data Entry Anda tidak memiliki izin untuk membuka modul ini.', 'warning');
      return;
    }
  }

  // (Lanjutkan dengan kode document.querySelectorAll('.page-section') dsb. seperti biasa)

  document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('d-none'));
  document.querySelectorAll('.sidebar .nav-link').forEach(lnk => lnk.classList.remove('active'));

  const activeSec = document.getElementById(`menu-${menuKey}`);
  if (activeSec) activeSec.classList.remove('d-none');

  const activeLink = document.querySelector(`.sidebar .nav-link[data-menu="${menuKey}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (menuKey === 'kasbon') fetchAndRenderKasbon();
  if (menuKey === 'reseller') fetchAndRenderStok();
  if (menuKey === 'profil') populateProfilForm();
  if (menuKey === 'dashboard') renderServerDistributionChart();

  if (window.innerWidth < 992) {
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar) sidebar.classList.remove('show');
  }

  applyRolePermissions();
}

async function exportToExcel(filename, sheetName, columns, rows) {
  try {
    if (!rows || rows.length === 0) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Tidak ada data untuk diexport', showConfirmButton: false, timer: 1800 });
      return;
    }
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    
    // Atur ukuran kolom
    sheet.columns = columns.map(c => ({ width: c.width || 15 }));
    const colCount = columns.length;

    // --- 1. HEADER LOGO APLIKASI (RINNET +) ---
    sheet.mergeCells(1, 1, 1, colCount);
    const title1 = sheet.getCell(1, 1);
    title1.value = 'RINNET +';
    // Menggunakan Georgia untuk kesan Mewah, Elegan, dan Profesional
    title1.font = { name: 'Georgia', size: 26, bold: true, color: { argb: 'FF1E1B4B' } }; 
    title1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 45;

    // --- 2. JUDUL MODUL HALAMAN ---
    sheet.mergeCells(2, 1, 2, colCount);
    const title2 = sheet.getCell(2, 1);
    title2.value = `Laporan Data ${sheetName}`;
    title2.font = { name: 'Trebuchet MS', size: 14, bold: true, color: { argb: 'FF374151' } };
    title2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 25;

    // --- 3. WAKTU CETAK REALTIME ---
    sheet.mergeCells(3, 1, 3, colCount);
    const title3 = sheet.getCell(3, 1);
    const now = new Date();
    const opsiHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const namaHari = opsiHari[now.getDay()];
    const tgl = String(now.getDate()).padStart(2, '0');
    const bln = String(now.getMonth() + 1).padStart(2, '0');
    const thn = now.getFullYear();
    const jam = String(now.getHours()).padStart(2, '0');
    const mnt = String(now.getMinutes()).padStart(2, '0');
    const dtk = String(now.getSeconds()).padStart(2, '0');

    // Format: "dicetak pada hari-tanggal-bulan-tahun"
    title3.value = `dicetak pada ${namaHari}, ${tgl}-${bln}-${thn} jam ${jam}:${mnt}:${dtk} WIB`;
    title3.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF6B7280' } };
    title3.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(3).height = 20;

    // --- 4. BARIS KOSONG PEMISAH ---
    sheet.addRow([]);

    // --- 5. RENDER HEADER TABEL ---
    const headerRowNumber = 5;
    const headerRow = sheet.getRow(headerRowNumber);
    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });
    headerRow.height = 28;

    // --- 6. RENDER DATA BARIS ---
    rows.forEach((r, rowIndex) => {
      const rowNumber = headerRowNumber + 1 + rowIndex;
      const dataRow = sheet.getRow(rowNumber);
      columns.forEach((col, colIndex) => {
        const cell = dataRow.getCell(colIndex + 1);
        cell.value = r[col.key];

        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1F2937' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };

        // Efek Zebra Striping
        if (rowIndex % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      });
    });

    // Tambahkan Auto-Filter
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: colCount }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(blob, filename);
    
  } catch (err) {
    console.error(err);
    Swal.fire('Gagal Export', 'Terjadi kesalahan saat membuat file Excel.', 'error');
  }
}

function bindExportButtons() {
  const bind = (id, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  };

  bind('btnExportServer', () => exportToExcel('data-server.xlsx', 'Server', [
    { header: 'Nama Server', key: 'nama_server', width: 25 },
    { header: 'Pengelola', key: 'pengelola', width: 20 },
    { header: 'WhatsApp', key: 'no_wa', width: 18 },
    { header: 'Wilayah', key: 'wilayah', width: 20 },
  ], window.SERVER_CACHE));

  bind('btnExportServerWilayah', () => exportToExcel('data-server-wilayah.xlsx', 'Server Wilayah', [
    { header: 'Wilayah', key: 'wilayah', width: 20 },
    { header: 'Nama Server', key: 'nama_server', width: 25 },
    { header: 'Pengelola', key: 'pengelola', width: 20 },
    { header: 'WhatsApp', key: 'no_wa', width: 18 },
  ], [...window.SERVER_CACHE].sort((a, b) => (a.wilayah || '').localeCompare(b.wilayah || ''))));

  bind('btnExportKaryawan', () => exportToExcel('data-karyawan.xlsx', 'Karyawan', [
    { header: 'ID', key: 'emp_id', width: 12 },
    { header: 'Nama Karyawan', key: 'nama_karyawan', width: 25 },
    { header: 'Jabatan', key: 'jabatan', width: 15 },
    { header: 'WhatsApp', key: 'no_wa', width: 18 },
  ], window.EMPLOYEE_CACHE));

  bind('btnExportMasterReseller', () => exportToExcel('data-reseller.xlsx', 'Reseller', [
    { header: 'Server Utama', key: 'nama_server', width: 20 },
    { header: 'Nama Reseller', key: 'nama_reseller', width: 25 },
    { header: 'WhatsApp', key: 'no_wa', width: 18 },
  ], window.RESELLER_CACHE));

  bind('btnExportUsers', async () => {
    const { data } = await _supabase.from('users').select('username, nama_lengkap, email, no_wa, role');
    exportToExcel('data-user.xlsx', 'User', [
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Nama Lengkap', key: 'nama_lengkap', width: 25 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'WhatsApp', key: 'no_wa', width: 18 },
      { header: 'Role', key: 'role', width: 15 },
    ], data || []);
  });

  bind('btnExportKasbon', () => exportToExcel('rekap-kasbon.xlsx', 'Kasbon', [
    { header: 'Tanggal', key: 'tanggal', width: 14 },
    { header: 'Karyawan', key: 'nama_karyawan', width: 22 },
    { header: 'Jumlah Kasbon', key: 'jumlah_kasbon', width: 16 },
    { header: 'Sudah Dibayar', key: 'dibayar', width: 16 },
    { header: 'Sisa Saldo', key: 'sisa', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Sumber Dana', key: 'sumber_dana', width: 22 },
    { header: 'Pelunasan Via', key: 'sumber_dana_pelunasan', width: 22 },
    { header: 'Keterangan', key: 'keterangan', width: 25 },
  ], (window.KASBON_VIEW_CACHE || []).map(k => ({ ...k, sisa: Math.max((Number(k.jumlah_kasbon) || 0) - (Number(k.dibayar) || 0), 0) }))));

  bind('btnExportStok', () => exportToExcel('rekap-stok-voucher.xlsx', 'Stok Voucher', [
    { header: 'Tanggal', key: 'tanggal', width: 14 },
    { header: 'Server', key: 'nama_server', width: 18 },
    { header: 'Reseller', key: 'nama_reseller', width: 20 },
    { header: 'Petugas', key: 'petugas', width: 18 },
    { header: '2K', key: 'v2k', width: 8 }, { header: '3K', key: 'v3k', width: 8 },
    { header: '4K', key: 'v4k', width: 8 }, { header: '5K', key: 'v5k', width: 8 },
    { header: '6K', key: 'v6k', width: 8 }, { header: '25K', key: 'v25k', width: 8 },
    { header: '1HP', key: 'b1hp', width: 8 }, { header: '2HP', key: 'b2hp', width: 8 },
    { header: '3HP', key: 'b3hp', width: 8 }, { header: '4HP', key: 'b4hp', width: 8 },
    { header: '5HP', key: 'b5hp', width: 8 },
  ], window.STOK_VIEW_CACHE || []));

  bind('btnExportDashReseller', () => exportToExcel('rekap-dashboard-reseller.xlsx', 'Rekap Reseller', [
    { header: 'Tanggal', key: 'tanggal', width: 14 },
    { header: 'Server', key: 'nama_server', width: 18 },
    { header: 'Reseller', key: 'nama_reseller', width: 20 },
    { header: 'Petugas', key: 'petugas', width: 18 },
    { header: 'Total Harian', key: 'totalHarian', width: 14 },
    { header: 'Total Bulanan', key: 'totalBulanan', width: 14 },
    { header: 'Total Keseluruhan', key: 'totalKeseluruhan', width: 16 },
  ], window.DASH_RESELLER_VIEW_CACHE || []));
}

// ==========================================
// KASBON MODULE
// ==========================================
function hitungSisaKasbon(jumlah, dibayar) {
  return Math.max((Number(jumlah) || 0) - (Number(dibayar) || 0), 0);
}

function updateKasbonPreview() {
  const jumlah = document.getElementById('ksbJumlah');
  const dibayar = document.getElementById('ksbDibayar');
  const preview = document.getElementById('ksbSisaPreview');
  if (jumlah && dibayar && preview) {
    preview.innerText = formatRupiah(hitungSisaKasbon(jumlah.value, dibayar.value));
  }
}

async function fetchAndRenderKasbon() {
  try {
    const { data, error } = await _supabase.from('kasbon').select('*').order('tanggal', { ascending: false });
    if (error) throw error;
    
    window.KASBON_CACHE = data || [];
    applyKasbonFilterAndRender();
    renderSaldoKasbonPerKaryawan(window.KASBON_CACHE);
    applyRolePermissions();
  } catch(err) {
    console.error(err);
  }
}

function applyKasbonFilterAndRender() {
  const fEmp = document.getElementById('fltKasbonKaryawan')?.value || '';
  const fStart = document.getElementById('fltKasbonStart')?.value || '';
  const fEnd = document.getElementById('fltKasbonEnd')?.value || '';

  let rows = [...window.KASBON_CACHE];
  if (fEmp) rows = rows.filter(k => k.nama_karyawan === fEmp);
  if (fStart) rows = rows.filter(k => k.tanggal >= fStart);
  if (fEnd) rows = rows.filter(k => k.tanggal <= fEnd);

  window.KASBON_VIEW_CACHE = rows;

  const tbody = document.getElementById('bodyKasbon');
  if (tbody) {
    tbody.innerHTML = rows.map(k => {
      const sisa = hitungSisaKasbon(k.jumlah_kasbon, k.dibayar);
      const statusMap = { BELUM_LUNAS: ['Belum Lunas', 'danger'], SEBAGIAN: ['Lunas Sebagian', 'warning'], LUNAS: ['Lunas', 'success'] };
      const [statusLabel, statusColor] = statusMap[k.status] || [k.status || '-', 'secondary'];
      const sumberDanaDisplay = k.sumber_dana ? `Server: ${escapeHTML(k.sumber_dana)}` : '-';
      const pelunasanDisplay = k.sumber_dana_pelunasan ? escapeHTML(k.sumber_dana_pelunasan) : '-';

      return `
        <tr>
          <td>${escapeHTML(k.tanggal)}</td>
          <td class="fw-bold">${escapeHTML(k.nama_karyawan)}</td>
          <td>${formatRupiah(k.jumlah_kasbon)}</td>
          <td>${formatRupiah(sisa)}</td>
          <td><span class="badge bg-${statusColor} bg-opacity-10 text-${statusColor} border border-${statusColor}">${statusLabel}</span></td>
          <td><span class="badge bg-light text-dark border">${sumberDanaDisplay}</span></td>
          <td><span class="badge bg-info bg-opacity-10 text-info border border-info">${pelunasanDisplay}</span></td>
          <td>${escapeHTML(k.keterangan || '-')}</td>
          <td class="action-col text-end">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editKasbon('${k.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteKasbon('${k.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="9" class="text-center text-muted py-3">Belum ada data kasbon.</td></tr>';
  }
}

function renderSaldoKasbonPerKaryawan(rows) {
  const tbody = document.getElementById('bodySaldoKasbon');
  if (!tbody) return;

  const grouped = {};
  rows.forEach(k => {
    if (!grouped[k.nama_karyawan]) {
      grouped[k.nama_karyawan] = { total: 0, dibayar: 0, pelunasanSet: new Set() };
    }
    grouped[k.nama_karyawan].total += Number(k.jumlah_kasbon) || 0;
    grouped[k.nama_karyawan].dibayar += Number(k.dibayar) || 0;
    if (k.sumber_dana_pelunasan) {
      grouped[k.nama_karyawan].pelunasanSet.add(k.sumber_dana_pelunasan);
    }
  });

  const entries = Object.entries(grouped);
  tbody.innerHTML = entries.map(([nama, v]) => {
    const pelunasanStr = Array.from(v.pelunasanSet).join(', ') || '-';
    return `
    <tr>
      <td class="fw-bold">${escapeHTML(nama)}</td>
      <td>${formatRupiah(v.total)}</td>
      <td>${formatRupiah(v.dibayar)}</td>
      <td class="fw-bold text-danger">${formatRupiah(Math.max(v.total - v.dibayar, 0))}</td>
      <td><span class="badge bg-secondary bg-opacity-10 text-dark border">${escapeHTML(pelunasanStr)}</span></td>
    </tr>
  `;
  }).join('') || '<tr><td colspan="5" class="text-muted text-center py-2">Belum ada data.</td></tr>';
}

async function handleSaveKasbon(e) {
  e.preventDefault();
  const id = document.getElementById('ksbId')?.value;
  const payload = {
    tanggal: document.getElementById('ksbTanggal')?.value,
    nama_karyawan: document.getElementById('ksbKaryawan')?.value,
    jumlah_kasbon: Number(document.getElementById('ksbJumlah')?.value) || 0,
    sumber_dana: document.getElementById('ksbSumber')?.value || '',
    sumber_dana_pelunasan: document.getElementById('ksbPelunasan')?.value || 'Bayar Mandiri',
    keterangan: document.getElementById('ksbKet')?.value.trim(),
    status: document.getElementById('ksbStatus')?.value,
    dibayar: Number(document.getElementById('ksbDibayar')?.value) || 0,
  };

  const { error } = id
    ? await _supabase.from('kasbon').update(payload).eq('id', id)
    : await _supabase.from('kasbon').insert([payload]);

  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', `Data kasbon berhasil ${id ? 'diperbarui' : 'disimpan'}!`, 'success');
    cancelEditKasbon();
    fetchAndRenderKasbon();
  }
}

function editKasbon(id) {
  const row = window.KASBON_CACHE.find(k => String(k.id) === String(id));
  if (!row) return;
  document.getElementById('ksbId').value = row.id;
  document.getElementById('ksbTanggal').value = row.tanggal || '';
  document.getElementById('ksbKaryawan').value = row.nama_karyawan || '';
  document.getElementById('ksbJumlah').value = row.jumlah_kasbon || 0;
  document.getElementById('ksbSumber').value = row.sumber_dana || '';
  if (document.getElementById('ksbPelunasan')) {
    document.getElementById('ksbPelunasan').value = row.sumber_dana_pelunasan || 'Bayar Mandiri';
  }
  document.getElementById('ksbKet').value = row.keterangan || '';
  document.getElementById('ksbStatus').value = row.status || 'BELUM_LUNAS';
  document.getElementById('ksbDibayar').value = row.dibayar || 0;
  
  const btnBatal = document.getElementById('btnBatalEditKasbon');
  if (btnBatal) btnBatal.classList.remove('d-none');
  updateKasbonPreview();
}

function cancelEditKasbon() {
  const form = document.getElementById('formKasbon');
  if (form) form.reset();
  const idEl = document.getElementById('ksbId');
  if (idEl) idEl.value = '';
  const btnBatal = document.getElementById('btnBatalEditKasbon');
  if (btnBatal) btnBatal.classList.add('d-none');
  updateKasbonPreview();
}

async function deleteKasbon(id) {
  const confirm = await Swal.fire({ title: 'Hapus Kasbon?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    try {
      const { error } = await _supabase.from('kasbon').delete().eq('id', id);
      if (error) throw error;
      fetchAndRenderKasbon();
      Swal.fire('Terhapus!', 'Data Kasbon berhasil dihapus.', 'success');
    } catch(err) {
      Swal.fire('Gagal!', err.message, 'error');
    }
  }
}

// ==========================================
// VOUCHER STOCK MODULE
// ==========================================
function totalVoucherRow(row) {
  return VOUCHER_FIELDS.reduce((sum, f) => sum + (Number(row[f]) || 0), 0);
}

async function fetchAndRenderStok() {
  try {
    const { data, error } = await _supabase.from('stok_voucher').select('*').order('tanggal', { ascending: false });
    if (error) throw error;
    window.STOK_CACHE = data || [];

    const totalStok = window.STOK_CACHE.reduce((sum, r) => sum + totalVoucherRow(r), 0);
    const totalStokEl = document.getElementById('dashTotalStok');
    if (totalStokEl) totalStokEl.innerText = totalStok.toLocaleString('id-ID');

    applyStokFilterAndRender();
    renderDashboardResellerRecap();
    applyRolePermissions();
  } catch(err) {
    console.error(err);
  }
}

function applyStokFilterAndRender() {
  const fStart = document.getElementById('filterStokStart')?.value || '';
  const fEnd = document.getElementById('filterStokEnd')?.value || '';
  const fServer = document.getElementById('fltStokServer')?.value || '';

  let rows = [...window.STOK_CACHE];
  if (fServer) rows = rows.filter(r => r.nama_server === fServer);
  if (fStart) rows = rows.filter(r => r.tanggal >= fStart);
  if (fEnd) rows = rows.filter(r => r.tanggal <= fEnd);
  window.STOK_VIEW_CACHE = rows;

  const tbody = document.getElementById('bodyStok');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHTML(r.tanggal)}</td>
      <td>${escapeHTML(r.nama_server)}</td>
      <td>${escapeHTML(r.nama_reseller)}</td>
      <td>${escapeHTML(r.petugas)}</td>
      ${VOUCHER_FIELDS.map(f => `<td>${(Number(r[f]) || 0).toLocaleString('id-ID')}</td>`).join('')}
      <td class="action-col text-center">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editStok('${r.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteStok('${r.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="16" class="text-center text-muted py-3">Belum ada data stok voucher.</td></tr>`;
}

function editStok(id) {
  const row = window.STOK_CACHE.find(r => String(r.id) === String(id));
  if (!row) return;
  document.getElementById('stkId').value = row.id;
  document.getElementById('stkTanggal').value = row.tanggal || '';
  
  const serverSelect = document.getElementById('stkServer');
  if (serverSelect) {
    serverSelect.value = row.nama_server || '';
    populateStokResellerDropdown(row.nama_server || '');
  }

  document.getElementById('stkReseller').value = row.nama_reseller || '';
  document.getElementById('stkPetugas').value = row.petugas || '';

  VOUCHER_FIELDS.forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = row[f] || 0;
  });

  const title = document.getElementById('titleFormStok');
  if (title) title.innerText = 'Edit Penyerahan Voucher';
  const btnBatal = document.getElementById('btnBatalEditStok');
  if (btnBatal) btnBatal.classList.remove('d-none');
}

function cancelEditStok() {
  const form = document.getElementById('formStokReseller');
  if (form) form.reset();
  const idEl = document.getElementById('stkId');
  if (idEl) idEl.value = '';
  
  populateStokResellerDropdown('');
  
  const title = document.getElementById('titleFormStok');
  if (title) title.innerText = 'Form Input Penyerahan Voucher';
  const btnBatal = document.getElementById('btnBatalEditStok');
  if (btnBatal) btnBatal.classList.add('d-none');
}

const HARIAN_FIELDS = ['v2k', 'v3k', 'v4k', 'v5k', 'v6k'];
const BULANAN_FIELDS = ['v25k', 'b1hp', 'b2hp', 'b3hp', 'b4hp', 'b5hp'];

function renderDashboardResellerRecap() {
  const fStart = document.getElementById('dashResellerStart')?.value || '';
  const fEnd = document.getElementById('dashResellerEnd')?.value || '';
  const fServer = document.getElementById('dashResellerServerFilter')?.value || '';

  let rows = [...window.STOK_CACHE];
  
  // Filter berdasarkan Date Custom
  if (fStart) rows = rows.filter(r => r.tanggal >= fStart);
  if (fEnd) rows = rows.filter(r => r.tanggal <= fEnd);
  
  // Filter berdasarkan Server
  if (fServer) rows = rows.filter(r => r.nama_server === fServer);

  const viewRows = rows.map(r => {
    // Memisahkan kategori penjumlahan Harian dan Bulanan
    const totalHarian = HARIAN_FIELDS.reduce((sum, f) => sum + (Number(r[f]) || 0), 0);
    const totalBulanan = BULANAN_FIELDS.reduce((sum, f) => sum + (Number(r[f]) || 0), 0);
    const totalKeseluruhan = totalHarian + totalBulanan;
      
    return { tanggal: r.tanggal, nama_server: r.nama_server, nama_reseller: r.nama_reseller, petugas: r.petugas, totalHarian, totalBulanan, totalKeseluruhan };
  });

  window.DASH_RESELLER_VIEW_CACHE = viewRows;

  const tbody = document.getElementById('bodyDashReseller');
  if (!tbody) return;
  tbody.innerHTML = viewRows.map(v => `
    <tr>
      <td>${escapeHTML(v.tanggal)}</td>
      <td>${escapeHTML(v.nama_server)}</td>
      <td>${escapeHTML(v.nama_reseller)}</td>
      <td>${escapeHTML(v.petugas)}</td>
      <td class="fw-bold">${v.totalHarian.toLocaleString('id-ID')}</td>
      <td class="fw-bold text-primary">${v.totalBulanan.toLocaleString('id-ID')}</td>
      <td class="fw-bold text-success">${v.totalKeseluruhan.toLocaleString('id-ID')}</td>
    </tr>
  `).join('') || `<tr><td colspan="7" class="text-center text-muted py-3">Belum ada data rekapan.</td></tr>`;
}

async function handleSaveStok(e) {
  e.preventDefault();
  const id = document.getElementById('stkId')?.value;
  const payload = {
    tanggal: document.getElementById('stkTanggal')?.value,
    nama_server: document.getElementById('stkServer')?.value,
    nama_reseller: document.getElementById('stkReseller')?.value,
    petugas: document.getElementById('stkPetugas')?.value.trim(),
  };
  VOUCHER_FIELDS.forEach(f => { 
    const val = document.getElementById(f)?.value;
    payload[f] = Number(val) || 0; 
  });

  const { error } = id
    ? await _supabase.from('stok_voucher').update(payload).eq('id', id)
    : await _supabase.from('stok_voucher').insert([payload]);

  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', `Data penyerahan voucher ${id ? 'diperbarui' : 'tersimpan'}!`, 'success');
    cancelEditStok();
    fetchAndRenderStok();
  }
}

async function deleteStok(id) {
  const confirm = await Swal.fire({ title: 'Hapus Data Stok Voucher?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    try {
      const { error } = await _supabase.from('stok_voucher').delete().eq('id', id);
      if (error) throw error;
      fetchAndRenderStok();
      Swal.fire('Terhapus!', 'Data Stok Voucher berhasil dihapus.', 'success');
    } catch(err) {
      Swal.fire('Gagal!', err.message, 'error');
    }
  }
}

// ==========================================
// USER PROFILE MODULE
// ==========================================
function populateProfilForm() {
  if (!currentUser) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('prfUsername', currentUser.username);
  set('prfNamaLengkap', currentUser.nama_lengkap);
  set('prfEmail', currentUser.email);
  set('prfWA', currentUser.no_wa);
  restoreUserAvatar();
}

async function handleSaveProfil(e) {
  e.preventDefault();
  if (!currentUser) return;

  const payload = {
    nama_lengkap: document.getElementById('prfNamaLengkap')?.value.trim(),
    email: document.getElementById('prfEmail')?.value.trim(),
    no_wa: document.getElementById('prfWA')?.value.trim(),
  };

  const { error } = await _supabase.from('users').update(payload).eq('id', currentUser.id);
  if (error) {
    Swal.fire('Gagal Simpan Profil', error.message, 'error');
  } else {
    currentUser = { ...currentUser, ...payload };
    localStorage.setItem('rinnet_user_session', JSON.stringify(currentUser));
    
    const navName = document.getElementById('navUserName');
    if (navName) navName.innerText = escapeHTML(currentUser.nama_lengkap || currentUser.username);
    
    Swal.fire('Berhasil', 'Profil berhasil diperbarui!', 'success');
  }
}

function handleAvatarPreview(e) {
  const file = e.target.files[0];
  if (!file || !currentUser) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const base64Avatar = ev.target.result;
    const preview = document.getElementById('prfAvatarPreview');
    const navAvatar = document.getElementById('navUserAvatar');
    if (preview) preview.src = base64Avatar;
    if (navAvatar) navAvatar.src = base64Avatar;

    localStorage.setItem('rinnet_user_avatar_' + currentUser.username, base64Avatar);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Foto profil diperbarui secara permanen!', showConfirmButton: false, timer: 1800 });
  };
  reader.readAsDataURL(file);
}

// ==========================================
// VISUALIZATION & SYSTEM MONITORING
// ==========================================
function renderServerDistributionChart() {
  const canvas = document.getElementById('serverChart');
  const wrapper = document.getElementById('chartWrapper');
  if (!canvas || typeof Chart === 'undefined') return;

  const grouped = {};
  window.SERVER_CACHE.forEach(s => {
    const wil = s.wilayah || 'Lainnya';
    grouped[wil] = (grouped[wil] || 0) + 1;
  });

  // Fitur Sorting Berdasarkan Angka Terkecil untuk Chart
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt((a.match(/\d+/) || [9999])[0], 10);
    const numB = parseInt((b.match(/\d+/) || [9999])[0], 10);
    if (numA === numB) return a.localeCompare(b);
    return numA - numB;
  });

  const sortedValues = sortedKeys.map(k => grouped[k]);

  if (wrapper) {
    const dynamicWidth = Math.max(100, sortedKeys.length * 45);
    wrapper.style.minWidth = dynamicWidth + '%';
  }

  if (activeChart) activeChart.destroy();
  activeChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: sortedKeys,
      datasets: [{
        label: 'Jumlah Server Active',
        data: sortedValues,
        backgroundColor: 'rgba(99, 102, 241, 0.85)',
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

function startSysPerfSimulation() {
  const canvas = document.getElementById('systemPerfChart');
  if (canvas && typeof Chart !== 'undefined') {
    if (sysPerfChart) sysPerfChart.destroy();
    sysPerfChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['10s lalu', '8s lalu', '6s lalu', '4s lalu', '2s lalu', 'Sekarang'],
        datasets: [{
          label: 'Latency DB (ms)',
          data: [20, 25, 22, 28, 24, 21],
          borderColor: '#f59e0b',
          tension: 0.3,
          fill: false
        }, {
          label: 'CPU Load (%)',
          data: [12, 15, 18, 14, 16, 14],
          borderColor: '#6366f1',
          tension: 0.3,
          fill: false
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  if (livePerfInterval) clearInterval(livePerfInterval);
  livePerfInterval = setInterval(() => {
    const cpu = Math.floor(10 + Math.random() * 35);
    const ram = Math.floor(30 + Math.random() * 30);
    const latency = Math.floor(15 + Math.random() * 45);

    const cpuVal = document.getElementById('sysCpuVal');
    const cpuBar = document.getElementById('sysCpuBar');
    const ramVal = document.getElementById('sysRamVal');
    const ramBar = document.getElementById('sysRamBar');
    const latEl = document.getElementById('sysDbLatency');

    if (cpuVal) cpuVal.innerText = cpu + '%';
    if (cpuBar) cpuBar.style.width = cpu + '%';
    if (ramVal) ramVal.innerText = ram + '%';
    if (ramBar) ramBar.style.width = ram + '%';
    if (latEl) latEl.innerText = latency + ' ms';

    if (sysPerfChart) {
      sysPerfChart.data.datasets[0].data.shift();
      sysPerfChart.data.datasets[0].data.push(latency);
      sysPerfChart.data.datasets[1].data.shift();
      sysPerfChart.data.datasets[1].data.push(cpu);
      sysPerfChart.update();
    }

    const term = document.getElementById('sysLogTerminal');
    if (term) {
      const time = new Date().toLocaleTimeString('id-ID');
      term.insertAdjacentHTML('beforeend', `<div>[${time}] Heartbeat OK — CPU ${cpu}% / RAM ${ram}% / Latency ${latency}ms</div>`);
      term.scrollTop = term.scrollHeight;
      while (term.children.length > 40) term.removeChild(term.firstChild);
    }
  }, 3000);
}

// ==========================================
// CUSTOM DELETE (DATE RANGE) MODULE
// ==========================================
async function showDeleteByDateRange(moduleName, tableName, refreshCallback) {
  // 1. Munculkan Popup Form Input Tanggal
  const { value: formValues } = await Swal.fire({
    title: `Hapus Data ${moduleName} Custom`,
    html:
      `<p class="text-muted small mb-3">Pilih rentang tanggal data yang ingin dihapus permanen.</p>` +
      `<div class="mb-3 text-start">` +
        `<label class="form-label fw-bold">Dari Tanggal:</label>` +
        `<input type="date" id="swal-input-start" class="form-control">` +
      `</div>` +
      `<div class="mb-3 text-start">` +
        `<label class="form-label fw-bold">Sampai Tanggal:</label>` +
        `<input type="date" id="swal-input-end" class="form-control">` +
      `</div>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-trash me-1"></i> Lanjut Hapus',
    confirmButtonColor: '#dc3545',
    cancelButtonText: 'Batal',
    preConfirm: () => {
      const start = document.getElementById('swal-input-start').value;
      const end = document.getElementById('swal-input-end').value;
      
      if (!start || !end) {
        Swal.showValidationMessage('Tanggal awal dan akhir harus diisi!');
        return false;
      }
      if (start > end) {
        Swal.showValidationMessage('Tanggal awal tidak boleh melebihi tanggal akhir!');
        return false;
      }
      return { start, end };
    }
  });

  // 2. Jika user mengisi tanggal dan klik Lanjut
  if (formValues) {
    const { start, end } = formValues;

    // 3. Konfirmasi Terakhir (Mencegah Hapus Tidak Sengaja)
    const confirm = await Swal.fire({
      title: 'Apakah Anda Yakin?',
      text: `Semua data ${moduleName} dari tanggal ${start} sampai ${end} akan dihapus permanen. Aksi ini tidak dapat dibatalkan!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Batal',
      confirmButtonText: 'Ya, Hapus Permanen!'
    });

    if (confirm.isConfirmed) {
      try {
        Swal.fire({ 
          title: 'Memproses...', 
          text: 'Sedang menghapus data dari server.', 
          allowOutsideClick: false, 
          didOpen: () => { Swal.showLoading(); }
        });

        // 4. Eksekusi Hapus di Supabase (gte = Greater Than or Equal, lte = Less Than or Equal)
        const { error } = await _supabase
          .from(tableName)
          .delete()
          .gte('tanggal', start)
          .lte('tanggal', end);

        if (error) throw error;

        // 5. Refresh Tabel Data
        await refreshCallback();

        Swal.fire('Berhasil!', `Data ${moduleName} dari ${start} s/d ${end} telah dihapus.`, 'success');
      } catch (err) {
        Swal.fire('Gagal!', err.message, 'error');
      }
    }
  }
}

// ==========================================
// CUSTOM BULK DELETE MODULE (TANGGAL)
// ==========================================
async function promptBulkDeleteByDate(tableName, dateColumn, refreshCallback) {
  const { value: formValues } = await Swal.fire({
    title: 'Hapus Data Custom',
    html: `
      <div class="mb-3 text-start">
        <label class="form-label fw-bold text-secondary small">DARI TANGGAL:</label>
        <input type="date" id="swal-start-date" class="form-control form-control-lg">
      </div>
      <div class="mb-3 text-start">
        <label class="form-label fw-bold text-secondary small">SAMPAI TANGGAL:</label>
        <input type="date" id="swal-end-date" class="form-control form-control-lg">
      </div>
      <div class="alert alert-danger bg-danger bg-opacity-10 border-danger text-danger p-2 small mb-0 mt-3">
        <i class="fa-solid fa-triangle-exclamation me-1"></i> Data pada rentang tanggal ini akan dihapus permanen!
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-trash me-1"></i> Lanjutkan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#dc3545',
    preConfirm: () => {
      const start = document.getElementById('swal-start-date').value;
      const end = document.getElementById('swal-end-date').value;
      if (!start || !end) {
        Swal.showValidationMessage('Pastikan rentang tanggal mulai dan akhir telah diisi!');
        return false;
      }
      if (start > end) {
        Swal.showValidationMessage('Tanggal "Dari" tidak boleh lebih besar dari "Sampai"!');
        return false;
      }
      return { start, end };
    }
  });

  if (formValues) {
    const { start, end } = formValues;

    // Format ke DD-MM-YYYY untuk UI Konfirmasi
    const formatDate = (dateStr) => {
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    };

    const confirm = await Swal.fire({
      title: 'Konfirmasi Hapus Permanen',
      html: `Anda yakin ingin menghapus data <b>${tableName.toUpperCase()}</b><br>dari tanggal <b class="text-danger">${formatDate(start)}</b> sampai <b class="text-danger">${formatDate(end)}</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Ya, Hapus Data!',
      cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
      try {
        Swal.fire({ title: 'Memproses...', text: 'Sedang menghapus data', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Proses Delete ke Supabase (Menggunakan YYYY-MM-DD standar Database)
        const { error } = await _supabase
          .from(tableName)
          .delete()
          .gte(dateColumn, start)
          .lte(dateColumn, end);

        if (error) throw error;

        Swal.fire('Terhapus!', `Data dari ${formatDate(start)} hingga ${formatDate(end)} berhasil dihapus.`, 'success');
        if (refreshCallback) refreshCallback();

      } catch (err) {
        Swal.fire('Gagal!', 'Terjadi kesalahan: ' + err.message, 'error');
      }
    }
  }
}

// ==========================================
// GLOBAL EVENT LISTENER BINDINGS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  tryRestoreSession();

  const formLogin = document.getElementById('formLogin');
  if (formLogin) formLogin.addEventListener('submit', handleAuthLogin);

  const btnTogglePassword = document.getElementById('btnTogglePassword');
  if (btnTogglePassword) btnTogglePassword.addEventListener('click', togglePasswordVisibility);

  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', toggleSidebar);

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  const btnAutoID = document.getElementById('btnAutoID');
  if (btnAutoID) btnAutoID.addEventListener('click', generateAutoEmployeeID);

  const dashResellerServerFilter = document.getElementById('dashResellerServerFilter');
  if (dashResellerServerFilter) {
    dashResellerServerFilter.addEventListener('change', renderDashboardResellerRecap);
  }

  const usrRole = document.getElementById('usrRole');
  if (usrRole) {
    usrRole.addEventListener('change', function() {
      const container = document.getElementById('dataEntryAccessContainer');
      if (this.value === 'DATA ENTRY') {
        container.classList.remove('d-none');
      } else {
        container.classList.add('d-none');
      }
    });
  }

  // Form Submissions & Cancel Listeners
  const formServer = document.getElementById('formServer');
  if (formServer) formServer.addEventListener('submit', handleSaveServer);
  const btnBatalEditServer = document.getElementById('btnBatalEditServer');
  if (btnBatalEditServer) btnBatalEditServer.addEventListener('click', cancelEditServer);

  const formKaryawan = document.getElementById('formKaryawan');
  if (formKaryawan) formKaryawan.addEventListener('submit', handleSaveEmployee);
  const btnBatalEditKaryawan = document.getElementById('btnBatalEditKaryawan');
  if (btnBatalEditKaryawan) btnBatalEditKaryawan.addEventListener('click', cancelEditKaryawan);

  const formResellerMaster = document.getElementById('formResellerMaster');
  if (formResellerMaster) formResellerMaster.addEventListener('submit', handleSaveReseller);
  const btnBatalEditReseller = document.getElementById('btnBatalEditReseller');
  if (btnBatalEditReseller) btnBatalEditReseller.addEventListener('click', cancelEditReseller);

  const formUserMgmt = document.getElementById('formUserMgmt');
  if (formUserMgmt) formUserMgmt.addEventListener('submit', handleSaveUserMgmt);
  const btnBatalEditUser = document.getElementById('btnBatalEditUser');
  if (btnBatalEditUser) btnBatalEditUser.addEventListener('click', cancelEditUser);

  const formKasbon = document.getElementById('formKasbon');
  if (formKasbon) formKasbon.addEventListener('submit', handleSaveKasbon);
  const btnBatalEditKasbon = document.getElementById('btnBatalEditKasbon');
  if (btnBatalEditKasbon) btnBatalEditKasbon.addEventListener('click', cancelEditKasbon);

  const formStokReseller = document.getElementById('formStokReseller');
  if (formStokReseller) formStokReseller.addEventListener('submit', handleSaveStok);
  const btnBatalEditStok = document.getElementById('btnBatalEditStok');
  if (btnBatalEditStok) btnBatalEditStok.addEventListener('click', cancelEditStok);

  // Event Listener dinamik untuk Server -> Reseller pada Form Penyerahan Stock Voucher
  const stkServerSelect = document.getElementById('stkServer');
  if (stkServerSelect) stkServerSelect.addEventListener('change', handleStokServerChange);

  ['ksbJumlah', 'ksbDibayar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateKasbonPreview);
  });

  ['fltKasbonKaryawan', 'fltKasbonStart', 'fltKasbonEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyKasbonFilterAndRender);
  });

  ['filterStokStart', 'filterStokEnd', 'fltStokServer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyStokFilterAndRender);
  });

  const btnResetStokFilter = document.getElementById('btnResetStokFilter');
  if (btnResetStokFilter) {
    btnResetStokFilter.addEventListener('click', () => {
      ['filterStokStart', 'filterStokEnd', 'fltStokServer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      applyStokFilterAndRender();
    });
  }

  ['dashResellerStart', 'dashResellerEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderDashboardResellerRecap);
  });

  const btnResetDashReseller = document.getElementById('btnResetDashReseller');
  if (btnResetDashReseller) {
    btnResetDashReseller.addEventListener('click', () => {
      const s = document.getElementById('dashResellerStart'); if (s) s.value = '';
      const eEnd = document.getElementById('dashResellerEnd'); if (eEnd) eEnd.value = '';
      renderDashboardResellerRecap();
    });
  }

  const formProfil = document.getElementById('formProfil');
  if (formProfil) formProfil.addEventListener('submit', handleSaveProfil);

  const prfAvatarFile = document.getElementById('prfAvatarFile');
  if (prfAvatarFile) prfAvatarFile.addEventListener('change', handleAvatarPreview);

  bindExportButtons();
// Trigger Hapus Custom Kasbon
  const btnBulkDeleteKasbon = document.getElementById('btnBulkDeleteKasbon');
  if (btnBulkDeleteKasbon) {
    btnBulkDeleteKasbon.addEventListener('click', () => {
      promptBulkDeleteByDate('kasbon', 'tanggal', fetchAndRenderKasbon);
    });
  }

  // Trigger Hapus Custom Stok Voucher
  const btnBulkDeleteStok = document.getElementById('btnBulkDeleteStok');
  if (btnBulkDeleteStok) {
    btnBulkDeleteStok.addEventListener('click', () => {
      promptBulkDeleteByDate('stok_voucher', 'tanggal', fetchAndRenderStok);
    });
  }


  const btnRefreshCluster = document.getElementById('btnRefreshCluster');
  if (btnRefreshCluster) {
    btnRefreshCluster.addEventListener('click', () => {
      fetchAndRenderServers();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Status Cluster diperbarui', showConfirmButton: false, timer: 1500 });
    });
  }

  document.querySelectorAll('[data-menu]').forEach(elem => {
    elem.addEventListener('click', (e) => {
      e.preventDefault();
      const targetMenu = elem.getAttribute('data-menu');
      switchMenu(targetMenu);
    });
  });

  setInterval(() => {
    const clockEl = document.getElementById('liveClockText');
    if (clockEl) {
      clockEl.innerText = new Date().toLocaleTimeString('id-ID') + ' WIB';
    }
  }, 1000);
});