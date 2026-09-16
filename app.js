/* ==========================================================================
   RINNET+ ENTERPRISE INFRASTRUCTURE core business logic & app engine
   ========================================================================== */

let activeChart = null;
let perfChart = null;
let currentUser = null;
let base64AvatarImage = "";
let livePerfInterval = null;
let heartbeatInterval = null;
let failedLoginAttempts = 0;
let idleTimer = null;
let sessionsPollInterval = null;

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

const QUOTES_DATABASE = [
  { text: "Hasil luar biasa tidak pernah datang dari zona nyaman. Tetap semangat!", author: "Motivasi Kerja" },
  { text: "Kerja keras dan integritas hari ini adalah investasi kesuksesan esok hari.", author: "Pengingat Diri" },
  { text: "Satu langkah kecil hari ini adalah awal dari pencapaian besar di masa depan.", author: "Inspirasi Harian" },
  { text: "Kerja tim yang solid membuat pekerjaan berat terasa ringan dan menyenangkan.", author: "Budaya Kerja" },
  { text: "Setiap masalah yang terselesaikan adalah bukti kenaikan level kemampuanmu.", author: "Mental Juara" },
  { text: "Jangan lupa tersenyum dan rehat sejenak, kesehatanmu adalah aset terbaik.", author: "Penghibur Diri" }
];

// E2E Security Module
const E2EEngine = {
  async getKey() {
    const secret = "RINNET_ENTERPRISE_E2E_KEY_2026_MASTER";
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: enc.encode("RINNET_SALT_SECURE"), iterations: 100000, hash: "SHA-256" },
      keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  },
  async encrypt(plainText) {
    if (!plainText) return plainText;
    try {
      const key = await this.getKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plainText));
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return btoa(String.fromCharCode(...combined));
    } catch(e) {
      return plainText;
    }
  }
};

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

function getDeviceSessionId() {
  let sid = sessionStorage.getItem('rinnet_device_session_id');
  if (!sid) {
    sid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('sess-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    sessionStorage.setItem('rinnet_device_session_id', sid);
  }
  return sid;
}

function getDeviceDetailedInfo() {
  const ua = navigator.userAgent;
  let deviceType = "Desktop Laptop";
  if (/mobile/i.test(ua)) deviceType = "HP Mobile";
  if (/ipad|tablet/i.test(ua)) deviceType = "Tablet";
  
  let os = "Unknown OS";
  if (ua.indexOf("Win") !== -1) os = "Windows";
  if (ua.indexOf("Mac") !== -1) os = "MacOS";
  if (ua.indexOf("Linux") !== -1) os = "Linux";
  if (ua.indexOf("Android") !== -1) os = "Android";
  if (ua.indexOf("like Mac") !== -1) os = "iOS";

  return `${deviceType} (${os})`;
}

function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve("Geolocation Tidak Didukung");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
      () => resolve("Akses Lokasi Ditolak"),
      { timeout: 4000 }
    );
  });
}

async function logActivity(tipe, detail, isSuccess = true, errorMsg = '') {
  if (!currentUser) return;
  const loc = await getUserLocation();
  const deviceDetailed = getDeviceDetailedInfo();
  const fullDetail = isSuccess ? `${detail}` : `${detail} - (Error: ${errorMsg})`;

  const payload = {
    waktu: new Date().toISOString(),
    username: currentUser.username,
    role: currentUser.role || 'USER',
    tipe: tipe,
    detail: fullDetail,
    status: isSuccess ? 'BERHASIL' : 'GAGAL',
    device: deviceDetailed,
    koordinat: loc
  };

  try {
    await _supabase.from('activity_logs').insert([payload]);
  } catch (err) {
    console.warn("Gagal simpan log ke Supabase.", err);
  }
}

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

function exportFormattedExcel(elementId, filename = 'Export_Data') {
  try {
    const targetElement = document.getElementById(elementId);
    if (!targetElement) {
      Swal.fire('Perhatian', 'Elemen tabel data tidak ditemukan!', 'warning');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Export');
    const tables = targetElement.tagName === 'TABLE' ? [targetElement] : targetElement.querySelectorAll('table');

    if (tables.length === 0) {
      Swal.fire('Perhatian', 'Tidak ada tabel untuk diekspor!', 'warning');
      return;
    }

    tables.forEach((table) => {
      const headerRowValues = [];
      const headerCells = table.querySelectorAll('thead tr th');
      headerCells.forEach(th => {
        if (!th.classList.contains('action-col')) {
          headerRowValues.push(th.innerText.trim());
        }
      });
      const addedHeader = worksheet.addRow(headerRowValues);
      addedHeader.font = { bold: true, color: { argb: 'FFFFFF' } };
      addedHeader.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const bodyRows = table.querySelectorAll('tbody tr');
      bodyRows.forEach(tr => {
        const rowValues = [];
        const cells = tr.querySelectorAll('td');
        cells.forEach((td, idx) => {
          if (!headerCells[idx]?.classList.contains('action-col')) {
            rowValues.push(td.innerText.trim());
          }
        });
        if (rowValues.length > 0) {
          worksheet.addRow(rowValues);
        }
      });

      worksheet.addRow([]);
    });

    workbook.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    });

  } catch (err) {
    Swal.fire('Error', 'Gagal mengekspor Excel: ' + err.message, 'error');
  }
}

// Authentication Controller (Disesuaikan dengan Database Supabase)
async function handleAuthLogin(e) {
  e.preventDefault();
  if (failedLoginAttempts >= 5) {
    Swal.fire('Akses Diblokir', 'Terlalu banyak percobaaan gagal.', 'error');
    return;
  }

  const userVal = document.getElementById('loginUsername').value.trim();
  const passVal = document.getElementById('loginPassword').value.trim();

  document.getElementById('btnLoginText').classList.add('d-none');
  document.getElementById('btnLoginSpinner').classList.remove('d-none');

  try {
    // Kueri berdasarkan kolom 'username'
    const { data: users, error } = await _supabase.from('users').select('*').eq('username', userVal);
    
    // Pengecekan disesuaikan ke kolom 'password_hash'
    if (error || !users || users.length === 0 || users[0].password_hash !== passVal) {
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
    const userRole = currentUser.role || 'SUPERADMIN'; // Default ke SUPERADMIN jika role null di database

    document.getElementById('navUserName').innerText = displayName;
    document.getElementById('userRoleBadge').innerText = `Role: ${userRole}`;

    // Tampilkan menu khusus Superadmin jika role SUPERADMIN
    if (userRole === 'SUPERADMIN') {
      document.querySelectorAll('.superadmin-only').forEach(el => el.classList.remove('d-none'));
    } else {
      document.querySelectorAll('.superadmin-only').forEach(el => el.classList.add('d-none'));
    }

    triggerSuccessCelebration();
    await loadAllMasterDropdowns();
    switchMenu('dashboard');
    logActivity('LOGIN', `Pengguna ${currentUser.username} berhasil masuk ke sistem.`);

  } catch(err) {
    Swal.fire('System Error', 'Gagal terhubung ke Supabase.', 'error');
  } finally {
    document.getElementById('btnLoginText').classList.remove('d-none');
    document.getElementById('btnLoginSpinner').classList.add('d-none');
  }
}

function handleLogout() {
  if (currentUser) {
    logActivity('LOGOUT', `Pengguna ${currentUser.username} keluar dari sistem.`);
  }
  currentUser = null;
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
}

// Global Event Listeners & Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('formLogin').addEventListener('submit', handleAuthLogin);
  document.getElementById('btnTogglePassword').addEventListener('click', togglePasswordVisibility);
  document.getElementById('btnToggleSidebar').addEventListener('click', toggleSidebar);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

  // Dynamic Navigation Listener
  document.querySelectorAll('[data-menu]').forEach(elem => {
    elem.addEventListener('click', (e) => {
      e.preventDefault();
      const targetMenu = elem.getAttribute('data-menu');
      switchMenu(targetMenu);
    });
  });

  // Export Button Dynamic Listeners
  const exportMap = {
    'btnExportServer': ['tblServer', 'Data_Server'],
    'btnExportServerWilayah': ['containerServerWilayah', 'Data_Server_Wilayah'],
    'btnExportMasterReseller': ['tblMasterReseller', 'Data_Reseller'],
    'btnExportKaryawan': ['tblKaryawan', 'Data_Karyawan'],
    'btnExportStok': ['tblStok', 'Rekap_Stok_Voucher'],
    'btnExportKasbon': ['tblKasbon', 'Rekap_Kasbon'],
    'btnExportUsers': ['tblUsers', 'Data_User_Sistem'],
    'btnExportDashReseller': ['tblDashReseller', 'Stok_Reseller_Dashboard']
  };

  Object.entries(exportMap).forEach(([btnId, [tblId, fileName]]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', () => exportFormattedExcel(tblId, fileName));
  });

  // Live Clock Controller
  setInterval(() => {
    const clockEl = document.getElementById('liveClockText');
    if (clockEl) {
      clockEl.innerText = new Date().toLocaleTimeString('id-ID') + ' WIB';
    }
  }, 1000);
});