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
    populateStokResellerDropdown();
  } catch(err) {
    console.warn("Gagal memuat master dropdown dari Supabase.", err);
  }
}

function populateServerDropdown() {
  const stkSelect = document.getElementById('stkServer');
  const ksbSumberSelect = document.getElementById('ksbSumber');
  const optionsHtml = '<option value="">-- Pilih Server --</option>' + 
    window.SERVER_CACHE.map(s => `<option value="${escapeHTML(s.nama_server)}">${escapeHTML(s.nama_server)} (${escapeHTML(s.wilayah || 'Umum')})</option>`).join('');

  if (stkSelect) stkSelect.innerHTML = optionsHtml;
  if (ksbSumberSelect) ksbSumberSelect.innerHTML = optionsHtml;
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

function populateStokResellerDropdown() {
  const stkResellerSelect = document.getElementById('stkReseller');
  if (stkResellerSelect) {
    stkResellerSelect.innerHTML = '<option value="">-- Pilih Reseller --</option>' +
      window.RESELLER_CACHE.map(r => `<option value="${escapeHTML(r.nama_reseller)}">${escapeHTML(r.nama_reseller)} (${escapeHTML(r.nama_server || 'Umum')})</option>`).join('');
  }
}

// Server Data & Cluster
async function fetchAndRenderServers() {
  const { data, error } = await _supabase.from('servers').select('*').order('nama_server', { ascending: true });
  if (error) return;
  
  const tbody = document.getElementById('bodyServer');
  if (tbody) {
    tbody.innerHTML = (data || []).map(s => `
      <tr>
        <td class="fw-bold">${escapeHTML(s.nama_server)}</td>
        <td>${escapeHTML(s.pengelola)}</td>
        <td>${escapeHTML(s.no_wa)}</td>
        <td><span class="badge bg-info bg-opacity-10 text-info border border-info">${escapeHTML(s.wilayah)}</span></td>
        <td class="action-col text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteServer('${s.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  const totalSrvEl = document.getElementById('dashTotalServer');
  if (totalSrvEl) totalSrvEl.innerText = (data || []).length;
  renderServerWilayahCluster(data || []);
  renderClusterMonitoringTable(data || []);
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

  let html = '';
  for (const [wil, list] of Object.entries(grouped)) {
    html += `
      <div class="card card-custom p-4 mb-4">
        <h5 class="fw-bold text-primary mb-3"><i class="fa-solid fa-map-pin me-2"></i>Wilayah / Cluster: ${escapeHTML(wil)}</h5>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr><th>Nama Server</th><th>Pengelola</th><th>WhatsApp</th></tr></thead>
            <tbody>
              ${list.map(s => `<tr><td class="fw-bold">${escapeHTML(s.nama_server)}</td><td>${escapeHTML(s.pengelola)}</td><td>${escapeHTML(s.no_wa)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  container.innerHTML = html || '<div class="alert alert-light text-center">Belum ada data server wilayah.</div>';
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
  const nama = document.getElementById('srvNama').value.trim();
  const pengelola = document.getElementById('srvPengelola').value.trim();
  const no_wa = document.getElementById('srvWA').value.trim();
  const wilayah = document.getElementById('srvWilayah').value.trim();

  const { error } = await _supabase.from('servers').insert([{ nama_server: nama, pengelola, no_wa, wilayah }]);
  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', 'Data Server tersimpan di Supabase!', 'success');
    document.getElementById('formServer').reset();
    await fetchAndRenderServers();
    await loadAllMasterDropdowns();
  }
}

async function deleteServer(id) {
  const confirm = await Swal.fire({ title: 'Hapus Server?', text: "Data di Supabase akan terhapus permanen", icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus' });
  if (confirm.isConfirmed) {
    await _supabase.from('servers').delete().eq('id', id);
    fetchAndRenderServers();
    loadAllMasterDropdowns();
  }
}

// Employee Management
async function fetchAndRenderEmployees() {
  const { data, error } = await _supabase.from('employees').select('*');
  if (error) return;

  const sortedData = (data || []).sort((a, b) => (JABATAN_RANK[a.jabatan] || 99) - (JABATAN_RANK[b.jabatan] || 99));
  const tbody = document.getElementById('bodyKaryawan');
  if (tbody) {
    tbody.innerHTML = sortedData.map(e => `
      <tr>
        <td class="fw-bold text-primary">${escapeHTML(e.emp_id)}</td>
        <td class="fw-bold">${escapeHTML(e.nama_karyawan)}</td>
        <td><span class="badge bg-indigo bg-opacity-10 text-indigo border">${escapeHTML(e.jabatan)}</span></td>
        <td>${escapeHTML(e.no_wa || '-')}</td>
        <td class="action-col text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteEmployee('${e.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  const dashEmpEl = document.getElementById('dashTotalKaryawan');
  if (dashEmpEl) dashEmpEl.innerText = sortedData.length;
}

async function handleSaveEmployee(e) {
  e.preventDefault();
  const emp_id = document.getElementById('empID').value.trim();
  const nama_karyawan = document.getElementById('empNama').value.trim();
  const jabatan = document.getElementById('empJabatan').value;
  const no_wa = document.getElementById('empWA').value.trim();

  const { error } = await _supabase.from('employees').insert([{ emp_id, nama_karyawan, jabatan, no_wa }]);
  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', 'Data Karyawan tersimpan di Supabase!', 'success');
    document.getElementById('formKaryawan').reset();
    fetchAndRenderEmployees();
    loadAllMasterDropdowns();
  }
}

async function deleteEmployee(id) {
  const confirm = await Swal.fire({ title: 'Hapus Karyawan?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    await _supabase.from('employees').delete().eq('id', id);
    fetchAndRenderEmployees();
    loadAllMasterDropdowns();
  }
}

// Reseller Management
async function fetchAndRenderResellers() {
  const { data, error } = await _supabase.from('reseller_master').select('*').order('nama_reseller', { ascending: true });
  if (error) return;

  const tbody = document.getElementById('bodyMasterReseller');
  if (tbody) {
    tbody.innerHTML = (data || []).map(r => `
      <tr>
        <td><span class="badge bg-secondary bg-opacity-10 text-dark border">${escapeHTML(r.nama_server)}</span></td>
        <td class="fw-bold">${escapeHTML(r.nama_reseller)}</td>
        <td>${escapeHTML(r.no_wa)}</td>
        <td class="action-col text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteReseller('${r.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }

  const dashRslEl = document.getElementById('dashTotalReseller');
  if (dashRslEl) dashRslEl.innerText = (data || []).length;
}

async function handleSaveReseller(e) {
  e.preventDefault();
  const nama_reseller = document.getElementById('rslNama').value.trim();
  const no_wa = document.getElementById('rslWA').value.trim();
  const nama_server = document.getElementById('rslServer').value;

  const { error } = await _supabase.from('reseller_master').insert([{ nama_reseller, no_wa, nama_server }]);
  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', 'Data Reseller tersimpan di Supabase!', 'success');
    document.getElementById('formResellerMaster').reset();
    fetchAndRenderResellers();
    loadAllMasterDropdowns();
  }
}

async function deleteReseller(id) {
  const confirm = await Swal.fire({ title: 'Hapus Reseller?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    await _supabase.from('reseller_master').delete().eq('id', id);
    fetchAndRenderResellers();
    loadAllMasterDropdowns();
  }
}

// User Management
async function fetchAndRenderUsers() {
  const { data, error } = await _supabase.from('users').select('*');
  if (error) return;

  const tbody = document.getElementById('bodyUsers');
  if (tbody) {
    tbody.innerHTML = (data || []).map(u => `
      <tr>
        <td class="fw-bold text-dark">${escapeHTML(u.username)}</td>
        <td>${escapeHTML(u.email || '-')}</td>
        <td><span class="badge bg-primary rounded-pill px-3">${escapeHTML(u.role || 'ADMIN')}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  }
}

async function handleSaveUserMgmt(e) {
  e.preventDefault();
  const username = document.getElementById('usrName').value.trim();
  const nama_lengkap = document.getElementById('usrFullName').value.trim();
  const email = document.getElementById('usrEmail').value.trim();
  const rawPass = document.getElementById('usrPass').value.trim();
  const no_wa = document.getElementById('usrWA').value.trim();
  const role = document.getElementById('usrRole').value;

  if (!rawPass || rawPass.length < 6) {
    Swal.fire('Password Tidak Valid', 'Password wajib diisi minimal 6 karakter.', 'warning');
    return;
  }

  const password_hash = await hashSHA256(rawPass);

  const { error } = await _supabase.from('users').insert([{ username, nama_lengkap, email, password_hash, no_wa, role }]);
  if (error) {
    Swal.fire('Gagal Simpan User', error.message, 'error');
  } else {
    Swal.fire('Berhasil', 'User baru berhasil didaftarkan!', 'success');
    document.getElementById('formUserMgmt').reset();
    fetchAndRenderUsers();
  }
}

async function deleteUser(id) {
  const confirm = await Swal.fire({ title: 'Hapus Akun User?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    await _supabase.from('users').delete().eq('id', id);
    fetchAndRenderUsers();
  }
}

// Auth Controller
const LOCKOUT_DURATION_MS = 60000;
const MAX_FAILED_ATTEMPTS = 5;

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

async function handleAuthLogin(e) {
  e.preventDefault();

  if (getLockoutRemainingMs() > 0) {
    startLockoutCountdown();
    return;
  }

  const userVal = document.getElementById('loginUsername').value.trim();
  const passVal = document.getElementById('loginPassword').value.trim();

  document.getElementById('btnLoginText').classList.add('d-none');
  document.getElementById('btnLoginSpinner').classList.remove('d-none');

  try {
    const { data: users, error } = await _supabase.from('users').select('*').eq('username', userVal);
    const passHash = await hashSHA256(passVal);

    const matchedUser = users && users.length > 0 ? users[0] : null;
    const isHashValid = matchedUser && matchedUser.password_hash === passHash;

    if (error || !matchedUser || !isHashValid) {
      registerFailedAttempt();
      const remaining = MAX_FAILED_ATTEMPTS - failedLoginAttempts;
      Swal.fire('Gagal Masuk', remaining > 0 ? `Username atau password salah! Sisa percobaan: ${remaining}.` : 'Akun dikunci sementara!', 'error');
      return;
    }

    currentUser = matchedUser;
    clearFailedAttempts();

    document.getElementById('pageLogin').classList.add('d-none');
    document.getElementById('pageApp').classList.remove('d-none');

    const displayName = currentUser.nama_lengkap || currentUser.username;
    const userRole = currentUser.role || 'ADMIN';

    document.getElementById('navUserName').innerText = escapeHTML(displayName);
    document.getElementById('userRoleBadge').innerText = `Role: ${userRole}`;

    if (userRole === 'SUPERADMIN') {
      document.querySelectorAll('.superadmin-only').forEach(el => el.classList.remove('d-none'));
    } else {
      document.querySelectorAll('.superadmin-only').forEach(el => el.classList.add('d-none'));
    }

    triggerSuccessCelebration();
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

  } catch(err) {
    console.error(err);
    Swal.fire('System Error', 'Gagal terhubung ke Supabase.', 'error');
  } finally {
    document.getElementById('btnLoginText').classList.remove('d-none');
    document.getElementById('btnLoginSpinner').classList.add('d-none');
  }
}

function handleLogout() {
  currentUser = null;
  document.getElementById('pageApp').classList.add('d-none');
  document.getElementById('pageLogin').classList.remove('d-none');
  document.getElementById('formLogin').reset();
}

function switchMenu(menuKey) {
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
}

// Export Excel Functionality
async function exportToExcel(filename, sheetName, columns, rows) {
  try {
    if (!rows || rows.length === 0) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Tidak ada data untuk diexport', showConfirmButton: false, timer: 1800 });
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns;
    rows.forEach(r => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
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
    { header: 'Sumber Dana', key: 'sumber_dana', width: 18 },
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

// Kasbon Module
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
  const { data, error } = await _supabase.from('kasbon').select('*').order('tanggal', { ascending: false });
  if (error) return;
  window.KASBON_CACHE = data || [];
  applyKasbonFilterAndRender();
  renderSaldoKasbonPerKaryawan(window.KASBON_CACHE);
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
      return `
        <tr>
          <td>${escapeHTML(k.tanggal)}</td>
          <td class="fw-bold">${escapeHTML(k.nama_karyawan)}</td>
          <td>${formatRupiah(k.jumlah_kasbon)}</td>
          <td>${formatRupiah(sisa)}</td>
          <td><span class="badge bg-${statusColor} bg-opacity-10 text-${statusColor} border border-${statusColor}">${statusLabel}</span></td>
          <td>${escapeHTML(k.sumber_dana || '-')}</td>
          <td>${escapeHTML(k.keterangan || '-')}</td>
          <td class="action-col text-end">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editKasbon('${k.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteKasbon('${k.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" class="text-center text-muted py-3">Belum ada data kasbon.</td></tr>';
  }
}

function renderSaldoKasbonPerKaryawan(rows) {
  const tbody = document.getElementById('bodySaldoKasbon');
  if (!tbody) return;

  const grouped = {};
  rows.forEach(k => {
    if (!grouped[k.nama_karyawan]) grouped[k.nama_karyawan] = { total: 0, dibayar: 0 };
    grouped[k.nama_karyawan].total += Number(k.jumlah_kasbon) || 0;
    grouped[k.nama_karyawan].dibayar += Number(k.dibayar) || 0;
  });

  const entries = Object.entries(grouped);
  tbody.innerHTML = entries.map(([nama, v]) => `
    <tr>
      <td class="fw-bold">${escapeHTML(nama)}</td>
      <td>${formatRupiah(v.total)}</td>
      <td>${formatRupiah(v.dibayar)}</td>
      <td class="fw-bold text-danger">${formatRupiah(Math.max(v.total - v.dibayar, 0))}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="text-muted text-center py-2">Belum ada data.</td></tr>';
}

async function handleSaveKasbon(e) {
  e.preventDefault();
  const id = document.getElementById('ksbId').value;
  const payload = {
    tanggal: document.getElementById('ksbTanggal').value,
    nama_karyawan: document.getElementById('ksbKaryawan').value,
    jumlah_kasbon: Number(document.getElementById('ksbJumlah').value) || 0,
    sumber_dana: document.getElementById('ksbSumber').value,
    keterangan: document.getElementById('ksbKet').value.trim(),
    status: document.getElementById('ksbStatus').value,
    dibayar: Number(document.getElementById('ksbDibayar').value) || 0,
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
  document.getElementById('ksbKet').value = row.keterangan || '';
  document.getElementById('ksbStatus').value = row.status || 'BELUM_LUNAS';
  document.getElementById('ksbDibayar').value = row.dibayar || 0;
  document.getElementById('btnBatalEditKasbon').classList.remove('d-none');
  updateKasbonPreview();
}

function cancelEditKasbon() {
  document.getElementById('formKasbon').reset();
  document.getElementById('ksbId').value = '';
  document.getElementById('btnBatalEditKasbon').classList.add('d-none');
  updateKasbonPreview();
}

async function deleteKasbon(id) {
  const confirm = await Swal.fire({ title: 'Hapus Kasbon?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    await _supabase.from('kasbon').delete().eq('id', id);
    fetchAndRenderKasbon();
  }
}

// Stok Voucher Module
function totalVoucherRow(row) {
  return VOUCHER_FIELDS.reduce((sum, f) => sum + (Number(row[f]) || 0), 0);
}

async function fetchAndRenderStok() {
  const { data, error } = await _supabase.from('stok_voucher').select('*').order('tanggal', { ascending: false });
  if (error) return;
  window.STOK_CACHE = data || [];

  const totalStokEl = document.getElementById('dashTotalStok');
  if (totalStokEl) totalStokEl.innerText = window.STOK_CACHE.reduce((sum, r) => sum + totalVoucherRow(r), 0);

  applyStokFilterAndRender();
  renderDashboardResellerRecap();
}

function applyStokFilterAndRender() {
  const fStart = document.getElementById('filterStokStart')?.value || '';
  const fEnd = document.getElementById('filterStokEnd')?.value || '';

  let rows = [...window.STOK_CACHE];
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
      ${VOUCHER_FIELDS.map(f => `<td>${Number(r[f]) || 0}</td>`).join('')}
      <td class="action-col"><button class="btn btn-sm btn-outline-danger" onclick="deleteStok('${r.id}')"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('') || `<tr><td colspan="16" class="text-center text-muted py-3">Belum ada data stok voucher.</td></tr>`;
}

function renderDashboardResellerRecap() {
  const fStart = document.getElementById('dashResellerStart')?.value || '';
  const fEnd = document.getElementById('dashResellerEnd')?.value || '';

  let rows = [...window.STOK_CACHE];
  if (fStart) rows = rows.filter(r => r.tanggal >= fStart);
  if (fEnd) rows = rows.filter(r => r.tanggal <= fEnd);

  const viewRows = rows.map(r => {
    const totalHarian = totalVoucherRow(r);
    const rDate = new Date(r.tanggal);
    const totalBulanan = window.STOK_CACHE
      .filter(x => x.nama_reseller === r.nama_reseller && new Date(x.tanggal).getMonth() === rDate.getMonth() && new Date(x.tanggal).getFullYear() === rDate.getFullYear())
      .reduce((sum, x) => sum + totalVoucherRow(x), 0);
    const totalKeseluruhan = window.STOK_CACHE
      .filter(x => x.nama_reseller === r.nama_reseller)
      .reduce((sum, x) => sum + totalVoucherRow(x), 0);
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
      <td>${v.totalHarian}</td>
      <td>${v.totalBulanan}</td>
      <td>${v.totalKeseluruhan}</td>
    </tr>
  `).join('') || `<tr><td colspan="7" class="text-center text-muted py-3">Belum ada data.</td></tr>`;
}

async function handleSaveStok(e) {
  e.preventDefault();
  const payload = {
    tanggal: document.getElementById('stkTanggal').value,
    nama_server: document.getElementById('stkServer').value,
    nama_reseller: document.getElementById('stkReseller').value,
    petugas: document.getElementById('stkPetugas').value.trim(),
  };
  VOUCHER_FIELDS.forEach(f => { payload[f] = Number(document.getElementById(f).value) || 0; });

  const { error } = await _supabase.from('stok_voucher').insert([payload]);
  if (error) {
    Swal.fire('Gagal Simpan', error.message, 'error');
  } else {
    Swal.fire('Berhasil', 'Data penyerahan voucher tersimpan!', 'success');
    document.getElementById('formStokReseller').reset();
    fetchAndRenderStok();
  }
}

async function deleteStok(id) {
  const confirm = await Swal.fire({ title: 'Hapus Data Stok Voucher?', icon: 'warning', showCancelButton: true });
  if (confirm.isConfirmed) {
    await _supabase.from('stok_voucher').delete().eq('id', id);
    fetchAndRenderStok();
  }
}

// User Profile Module
function populateProfilForm() {
  if (!currentUser) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('prfUsername', currentUser.username);
  set('prfNamaLengkap', currentUser.nama_lengkap);
  set('prfEmail', currentUser.email);
  set('prfWA', currentUser.no_wa);
}

async function handleSaveProfil(e) {
  e.preventDefault();
  if (!currentUser) return;

  const payload = {
    nama_lengkap: document.getElementById('prfNamaLengkap').value.trim(),
    email: document.getElementById('prfEmail').value.trim(),
    no_wa: document.getElementById('prfWA').value.trim(),
  };

  const { error } = await _supabase.from('users').update(payload).eq('id', currentUser.id);
  if (error) {
    Swal.fire('Gagal Simpan Profil', error.message, 'error');
  } else {
    currentUser = { ...currentUser, ...payload };
    document.getElementById('navUserName').innerText = escapeHTML(currentUser.nama_lengkap || currentUser.username);
    Swal.fire('Berhasil', 'Profil berhasil diperbarui!', 'success');
  }
}

function handleAvatarPreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById('prfAvatarPreview');
    const navAvatar = document.getElementById('navUserAvatar');
    if (preview) preview.src = ev.target.result;
    if (navAvatar) navAvatar.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Visualizations & Charts
function renderServerDistributionChart() {
  const canvas = document.getElementById('serverChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const grouped = {};
  window.SERVER_CACHE.forEach(s => {
    const wil = s.wilayah || 'Lainnya';
    grouped[wil] = (grouped[wil] || 0) + 1;
  });

  if (activeChart) activeChart.destroy();
  activeChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: Object.keys(grouped),
      datasets: [{
        label: 'Jumlah Server',
        data: Object.values(grouped),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderRadius: 6,
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
    const cpu = Math.floor(10 + Math.random() * 40);
    const ram = Math.floor(30 + Math.random() * 35);
    const latency = Math.floor(15 + Math.random() * 60);

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

// Global Event Registration
document.addEventListener('DOMContentLoaded', () => {
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

  // Form Submissions
  const formServer = document.getElementById('formServer');
  if (formServer) formServer.addEventListener('submit', handleSaveServer);

  const formKaryawan = document.getElementById('formKaryawan');
  if (formKaryawan) formKaryawan.addEventListener('submit', handleSaveEmployee);

  const formResellerMaster = document.getElementById('formResellerMaster');
  if (formResellerMaster) formResellerMaster.addEventListener('submit', handleSaveReseller);

  const formUserMgmt = document.getElementById('formUserMgmt');
  if (formUserMgmt) formUserMgmt.addEventListener('submit', handleSaveUserMgmt);

  const formKasbon = document.getElementById('formKasbon');
  if (formKasbon) formKasbon.addEventListener('submit', handleSaveKasbon);

  const btnBatalEditKasbon = document.getElementById('btnBatalEditKasbon');
  if (btnBatalEditKasbon) btnBatalEditKasbon.addEventListener('click', cancelEditKasbon);

  ['ksbJumlah', 'ksbDibayar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateKasbonPreview);
  });

  ['fltKasbonKaryawan', 'fltKasbonStart', 'fltKasbonEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyKasbonFilterAndRender);
  });

  const formStokReseller = document.getElementById('formStokReseller');
  if (formStokReseller) formStokReseller.addEventListener('submit', handleSaveStok);

  ['filterStokStart', 'filterStokEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyStokFilterAndRender);
  });

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