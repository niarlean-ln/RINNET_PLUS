/* ==========================================================================
   RINNET+ ENTERPRISE INFRASTRUCTURE core business logic & app engine
   ========================================================================== */

let activeChart = null;
let perfChart = null;
let currentUser = null;
let livePerfInterval = null;
let failedLoginAttempts = 0;
let realtimeChannel = null;

// Global Cache untuk Performa Super Cepat
window.SERVER_CACHE = [];
window.EMPLOYEE_CACHE = [];
window.RESELLER_CACHE = [];

const JABATAN_RANK = {
  'Owner': 1,
  'Manajer': 2,
  'Officer': 3,
  'Teknisi': 4,
  'OB': 5,
  'Magang': 6
};

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

async function loadAllMasterDropdowns() {
  try {
    const { data: srvs, error: errSrv } = await _supabase.from('servers').select('*').order('nama_server', { ascending: true });
    if (errSrv) console.error("Error loading servers:", errSrv);
    if (srvs) window.SERVER_CACHE = srvs;

    const { data: emps, error: errEmp } = await _supabase.from('employees').select('*').order('nama_karyawan', { ascending: true });
    if (errEmp) console.error("Error loading employees:", errEmp);
    if (emps) window.EMPLOYEE_CACHE = emps;

    const { data: rsls, error: errRsl } = await _supabase.from('reseller_master').select('*').order('nama_reseller', { ascending: true });
    if (errRsl) console.error("Error loading resellers:", errRsl);
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
  if (!stkSelect && !ksbSumberSelect) return;

  const optionsHtml = '<option value="">-- Pilih Server --</option>' + 
    window.SERVER_CACHE.map(s => `<option value="${escapeHTML(s.nama_server)}">${escapeHTML(s.nama_server)} (${escapeHTML(s.wilayah || 'Umum')})</option>`).join('');

  if (stkSelect) stkSelect.innerHTML = optionsHtml;
  if (ksbSumberSelect) ksbSumberSelect.innerHTML = optionsHtml;
}

function populateResellerServerDropdown() {
  const rslSelect = document.getElementById('rslServer');
  if (!rslSelect) return;
  rslSelect.innerHTML = '<option value="">-- Pilih Server --</option>' + 
    window.SERVER_CACHE.map(s => `<option value="${escapeHTML(s.nama_server)}">${escapeHTML(s.nama_server)}</option>`).join('');
}

function populateKasbonKaryawanDropdown() {
  const ksbEmpSelect = document.getElementById('ksbKaryawan');
  const fltEmpSelect = document.getElementById('fltKasbonKaryawan');
  if (!ksbEmpSelect) return;

  const optionsHtml = window.EMPLOYEE_CACHE.map(e => `<option value="${escapeHTML(e.nama_karyawan)}">${escapeHTML(e.nama_karyawan)} (${escapeHTML(e.jabatan || '-')})</option>`).join('');

  ksbEmpSelect.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + optionsHtml;
  if (fltEmpSelect) fltEmpSelect.innerHTML = '<option value="">-- Semua Karyawan --</option>' + optionsHtml;
}

function populateStokResellerDropdown() {
  const stkResellerSelect = document.getElementById('stkReseller');
  if (!stkResellerSelect) return;
  stkResellerSelect.innerHTML = '<option value="">-- Pilih Reseller --</option>' +
    window.RESELLER_CACHE.map(r => `<option value="${escapeHTML(r.nama_reseller)}">${escapeHTML(r.nama_reseller)} (${escapeHTML(r.nama_server || 'Umum')})</option>`).join('');
}

// Global CRUD Data Operations with Fix for Auto-Redirects
async function fetchAndRenderServers() {
  const { data, error } = await _supabase.from('servers').select('*').order('nama_server', { ascending: true });
  if (error) { console.error(error); return; }
  
  const tbody = document.getElementById('bodyServer');
  if (!tbody) return;

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

  const uniqueWilayahCount = Object.keys(grouped).length;
  const dashWilEl = document.getElementById('dashTotalWilayah');
  if (dashWilEl) dashWilEl.innerText = uniqueWilayahCount;

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
  e.preventDefault(); // Prevents page reload/redirect to login
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
  const confirm = await Swal.fire({ title: 'Hapus Server?', text: "Data di Supabase akan terhapus permanent", icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus' });
  if (confirm.isConfirmed) {
    await _supabase.from('servers').delete().eq('id', id);
    fetchAndRenderServers();
    loadAllMasterDropdowns();
  }
}

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
  e.preventDefault(); // Prevents page reload/redirect
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

// User Management Actions
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

  const password_hash = rawPass ? await hashSHA256(rawPass) : 'default123';

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

// Authentication Controller Fixed
async function handleAuthLogin(e) {
  e.preventDefault();
  const userVal = document.getElementById('loginUsername').value.trim();
  const passVal = document.getElementById('loginPassword').value.trim();

  document.getElementById('btnLoginText').classList.add('d-none');
  document.getElementById('btnLoginSpinner').classList.remove('d-none');

  try {
    const { data: users, error } = await _supabase.from('users').select('*').eq('username', userVal);
    const passHash = await hashSHA256(passVal);
    
    // Check matched plain password or hashed password
    const isPasswordValid = users && users.length > 0 && (users[0].password_hash === passVal || users[0].password_hash === passHash);

    if (error || !users || users.length === 0 || !isPasswordValid) {
      failedLoginAttempts++;
      if (failedLoginAttempts >= 5) {
        document.getElementById('loginLockoutAlert').classList.remove('d-none');
      }
      Swal.fire('Gagal Masuk', 'Username atau password salah!', 'error');
      return;
    }

    currentUser = users[0];
    failedLoginAttempts = 0;
    
    document.getElementById('pageLogin').classList.add('d-none');
    document.getElementById('pageApp').classList.remove('d-none');
    
    const displayName = currentUser.nama_lengkap || currentUser.username;
    const userRole = currentUser.role || 'SUPERADMIN';

    document.getElementById('navUserName').innerText = displayName;
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

    switchMenu('dashboard');

  } catch(err) {
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

  if (window.innerWidth < 992) {
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar) sidebar.classList.remove('show');
  }
}

// Global Event Listeners Registration
document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('formLogin');
  if (formLogin) formLogin.addEventListener('submit', handleAuthLogin);

  const btnTogglePassword = document.getElementById('btnTogglePassword');
  if (btnTogglePassword) btnTogglePassword.addEventListener('click', togglePasswordVisibility);

  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', toggleSidebar);

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  // Forms submit bindings with event prevention
  const formServer = document.getElementById('formServer');
  if (formServer) formServer.addEventListener('submit', handleSaveServer);

  const formKaryawan = document.getElementById('formKaryawan');
  if (formKaryawan) formKaryawan.addEventListener('submit', handleSaveEmployee);

  const formResellerMaster = document.getElementById('formResellerMaster');
  if (formResellerMaster) formResellerMaster.addEventListener('submit', handleSaveReseller);

  const formUserMgmt = document.getElementById('formUserMgmt');
  if (formUserMgmt) formUserMgmt.addEventListener('submit', handleSaveUserMgmt);

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