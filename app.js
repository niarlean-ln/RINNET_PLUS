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

// Koleksi Kata Sambutan & Motivasi Dashboard yang Bervariatif & Menarik
const DASHBOARD_QUOTES = [
  { text: "Hasil luar biasa tidak pernah datang dari zona nyaman. Tetap tingkatkan performa!", author: "Motivasi Operasional" },
  { text: "Kerja keras dan integritas hari ini adalah pondasi sukses esok hari.", author: "Prinsip Perusahaan" },
  { text: "Satu langkah presisi hari ini mencegah seribu potensi error esok hari.", author: "Infrastruktur Mindset" },
  { text: "Kerja tim yang solid membuat pekerjaan berat terasa ringan dan menyenangkan.", author: "Budaya Kerja" },
  { text: "Setiap masalah server & voucher yang terselesaikan adalah bukti kompetensi tim.", author: "Mental Juara" },
  { text: "Kualitas layanan terbaik lahir dari ketelitian dalam setiap baris data.", author: "Standar Layanan" },
  { text: "Jangan lupa rehat sejenak, kesehatan dan fokusmu adalah aset terbaik sistem.", author: "Penghibur Diri" },
  { text: "Inovasi adalah pembeda utama antara pemimpin dan pengikut.", author: "Visi Perusahaan" },
  { text: "Optimasi hari ini untuk performa tanpa batas di esok hari.", author: "Core Excellence" },
  { text: "Kepercayaan reseller dibangun atas konsistensi dan integritas kerja.", author: "Relasi Bisnis" }
];

// Helper Cryptographic Hash (SHA-256) untuk Validasi Keamanan Password
async function hashSHA256(str) {
  const utf8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Anti-XSS Helper
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
  document.getElementById('mainSidebar').classList.toggle('show');
}

function togglePasswordVisibility() {
  const passInput = document.getElementById('loginPassword');
  const eyeIcon = document.getElementById('eyeIcon');
  if (passInput.type === 'password') {
    passInput.type = 'text';
    eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    passInput.type = 'password';
    eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

function triggerSuccessCelebration() {
  if (typeof confetti === 'function') {
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
  }
}

function appendTerminalLog(msg) {
  const terminal = document.getElementById('sysLogTerminal');
  if (terminal) {
    const timeStr = new Date().toLocaleTimeString('id-ID');
    const div = document.createElement('div');
    div.innerText = `[${timeStr}] ${msg}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
  }
}

// Menampilkan Ucapan Dashboard Bervariasi
function updateDashboardQuote() {
  const qObj = DASHBOARD_QUOTES[Math.floor(Math.random() * DASHBOARD_QUOTES.length)];
  const qTextEl = document.getElementById('quoteText');
  const qAuthEl = document.getElementById('quoteAuthor');
  if (qTextEl && qAuthEl) {
    qTextEl.innerText = `"${qObj.text}"`;
    qAuthEl.innerText = `— ${qObj.author}`;
  }
}

// Supabase Realtime Engine Setup
function initSupabaseRealtimeSubscriptions() {
  if (realtimeChannel || typeof _supabase === 'undefined') return;

  try {
    realtimeChannel = _supabase.channel('public:realtime_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, payload => {
        loadAllMasterDropdowns();
        appendTerminalLog(`[REALTIME] Update tabel 'servers' (${payload.eventType})`);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stok_voucher' }, payload => {
        appendTerminalLog(`[REALTIME] Update stok voucher terdeteksi`);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          appendTerminalLog('[REALTIME] Supabase Live Connection ACTIVE');
        }
      });
  } catch(err) {
    console.warn("Realtime error:", err);
  }
}

// Memuat data master dengan error handling dan fallback
async function loadAllMasterDropdowns() {
  if (typeof _supabase === 'undefined') return;
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
    console.warn("Gagal memuat master dropdown.", err);
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

function populateStokResellerDropdown() {
  const stkRslSelect = document.getElementById('stkReseller');
  if (!stkRslSelect) return;
  stkRslSelect.innerHTML = '<option value="">-- Pilih Reseller --</option>' + 
    window.RESELLER_CACHE.map(r => `<option value="${escapeHTML(r.nama_reseller)}">${escapeHTML(r.nama_reseller)}</option>`).join('');
}

function populateKasbonKaryawanDropdown() {
  const ksbEmpSelect = document.getElementById('ksbKaryawan');
  const fltEmpSelect = document.getElementById('fltKasbonKaryawan');
  if (!ksbEmpSelect) return;

  const optionsHtml = window.EMPLOYEE_CACHE.map(e => `<option value="${escapeHTML(e.nama_karyawan)}">${escapeHTML(e.nama_karyawan)} (${escapeHTML(e.jabatan || '-')})</option>`).join('');

  ksbEmpSelect.innerHTML = '<option value="">-- Pilih Karyawan --</option>' + optionsHtml;
  if (fltEmpSelect) fltEmpSelect.innerHTML = '<option value="">-- Semua Karyawan --</option>' + optionsHtml;
}

// Authentication Controller
async function handleAuthLogin(e) {
  if (e) e.preventDefault();

  if (failedLoginAttempts >= 5) {
    Swal.fire('Akses Diblokir', 'Terlalu banyak percobaan gagal.', 'error');
    return;
  }

  const userVal = document.getElementById('loginUsername').value.trim();
  const passVal = document.getElementById('loginPassword').value.trim();

  if (!userVal || !passVal) {
    Swal.fire('Perhatian', 'Isi username dan password.', 'warning');
    return;
  }

  document.getElementById('btnLoginText').classList.add('d-none');
  document.getElementById('btnLoginSpinner').classList.remove('d-none');

  try {
    const { data: users, error } = await _supabase.from('users').select('*').eq('username', userVal);
    
    const passHash = await hashSHA256(passVal);
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
    
    // Simpan Sesi Pengguna agar Tidak Terpental Saat Refresh
    localStorage.setItem('rinnet_session_user', JSON.stringify(currentUser));

    renderAuthenticatedView();
    triggerSuccessCelebration();
    logActivity('LOGIN', `Pengguna ${currentUser.username} berhasil masuk.`);

  } catch(err) {
    Swal.fire('System Error', 'Gagal terhubung ke database Supabase.', 'error');
  } finally {
    document.getElementById('btnLoginText').classList.remove('d-none');
    document.getElementById('btnLoginSpinner').classList.add('d-none');
  }
}

function renderAuthenticatedView() {
  if (!currentUser) return;
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

  loadAllMasterDropdowns();
  initSupabaseRealtimeSubscriptions();
  updateDashboardQuote();
  switchMenu('dashboard');
}

function checkStoredSession() {
  const stored = localStorage.getItem('rinnet_session_user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      renderAuthenticatedView();
    } catch(e) {
      localStorage.removeItem('rinnet_session_user');
    }
  }
}

function handleLogout(e) {
  if (e) e.preventDefault();
  if (currentUser) {
    logActivity('LOGOUT', `Pengguna ${currentUser.username} keluar.`);
  }
  currentUser = null;
  localStorage.removeItem('rinnet_session_user');
  
  if (realtimeChannel && typeof _supabase !== 'undefined') {
    _supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (livePerfInterval) {
    clearInterval(livePerfInterval);
    livePerfInterval = null;
  }

  document.getElementById('pageApp').classList.add('d-none');
  document.getElementById('pageLogin').classList.remove('d-none');
}

function switchMenu(menuKey) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('d-none'));
  document.querySelectorAll('.sidebar .nav-link').forEach(lnk => lnk.classList.remove('active'));

  const activeSec = document.getElementById(`menu-${menuKey}`);
  if (activeSec) activeSec.classList.remove('d-none');

  const activeLink = document.querySelector(`.sidebar .nav-link[data-menu="${menuKey}"]`);
  if (activeLink) activeLink.classList.add('active');

  if (window.innerWidth < 992) {
    document.getElementById('mainSidebar').classList.remove('show');
  }

  if (menuKey === 'sysPerf') {
    initMonitoringChart();
  }
}

// Logika Monitoring System Modern
function initMonitoringChart() {
  const canvas = document.getElementById('systemPerfChart');
  if (!canvas) return;

  if (perfChart) {
    perfChart.destroy();
  }

  const ctx = canvas.getContext('2d');
  const labels = Array.from({length: 10}, (_, i) => `${(9-i)*2}s ago`).reverse();
  const cpuData = [12, 18, 15, 22, 14, 25, 19, 15, 20, 14];
  const latencyData = [25, 30, 28, 45, 29, 31, 27, 28, 35, 28];

  perfChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'CPU Usage (%)',
          data: cpuData,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'DB Latency (ms)',
          data: latencyData,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  if (!livePerfInterval) {
    livePerfInterval = setInterval(async () => {
      const newCpu = Math.floor(Math.random() * 25) + 10;
      const sysCpuVal = document.getElementById('sysCpuVal');
      const sysCpuBar = document.getElementById('sysCpuBar');
      if (sysCpuVal && sysCpuBar) {
        sysCpuVal.innerText = `${newCpu}%`;
        sysCpuBar.style.width = `${newCpu}%`;
      }

      // Ukur DB Latency Nyata Supabase
      const startT = performance.now();
      let latency = Math.floor(Math.random() * 15) + 20;
      if (typeof _supabase !== 'undefined') {
        try {
          await _supabase.from('servers').select('id').limit(1);
          latency = Math.round(performance.now() - startT);
        } catch(e) {}
      }
      
      const sysLatencyVal = document.getElementById('sysDbLatency');
      if (sysLatencyVal) {
        sysLatencyVal.innerText = `${latency} ms`;
      }

      if (perfChart) {
        perfChart.data.datasets[0].data.shift();
        perfChart.data.datasets[0].data.push(newCpu);
        perfChart.data.datasets[1].data.shift();
        perfChart.data.datasets[1].data.push(latency);
        perfChart.update('none');
      }
    }, 3000);
  }
}

// Logika Input User Baru Safe Insert (Mencegah Terpental ke Login)
async function handleUserMgmtSubmit(e) {
  if (e) e.preventDefault();
  
  const username = document.getElementById('usrName').value.trim();
  const nama_lengkap = document.getElementById('usrFullName').value.trim();
  const email = document.getElementById('usrEmail').value.trim();
  const password = document.getElementById('usrPass').value.trim();
  const wa = document.getElementById('usrWA').value.trim();
  const role = document.getElementById('usrRole').value;

  if (!username || !password || !nama_lengkap) {
    Swal.fire('Perhatian', 'Username, Nama Lengkap, dan Password wajib diisi.', 'warning');
    return;
  }

  try {
    const password_hash = await hashSHA256(password);
    const payload = { username, nama_lengkap, email, password_hash, no_wa: wa, role };

    const { data, error } = await _supabase.from('users').insert([payload]).select();

    if (error) {
      Swal.fire('Gagal Menyimpan', error.message, 'error');
      return;
    }

    Swal.fire('Berhasil', 'User baru berhasil didaftarkan!', 'success');
    document.getElementById('formUserMgmt').reset();
    logActivity('ADD_USER', `Menambahkan user baru: ${username}`);
  } catch(err) {
    Swal.fire('Error', 'Terjadi kesalahan sistem saat menyimpan ke Supabase.', 'error');
  }
}

async function logActivity(tipe, detail) {
  if (!currentUser || typeof _supabase === 'undefined') return;
  try {
    const payload = {
      waktu: new Date().toISOString(),
      username: currentUser.username,
      role: currentUser.role || 'USER',
      tipe: tipe,
      detail: detail
    };
    await _supabase.from('activity_logs').insert([payload]);
    appendTerminalLog(`[AUDITLOG] ${tipe}: ${detail}`);
  } catch (err) {
    console.warn("Gagal simpan audit log.", err);
  }
}

// Global Event Listeners & Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  // Bind form submissions secara langsung agar tidak memicu reload
  const formLogin = document.getElementById('formLogin');
  if (formLogin) formLogin.addEventListener('submit', handleAuthLogin);

  const formUserMgmt = document.getElementById('formUserMgmt');
  if (formUserMgmt) formUserMgmt.addEventListener('submit', handleUserMgmtSubmit);

  // Mencegah default submit di semua form lainnya
  document.querySelectorAll('form').forEach(form => {
    if (form.id !== 'formLogin' && form.id !== 'formUserMgmt') {
      form.addEventListener('submit', (e) => e.preventDefault());
    }
  });

  document.getElementById('btnTogglePassword').addEventListener('click', togglePasswordVisibility);
  document.getElementById('btnToggleSidebar').addEventListener('click', toggleSidebar);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

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

  // Periksa sesi tersimpan saat aplikasi pertama kali dimuat
  checkStoredSession();
});