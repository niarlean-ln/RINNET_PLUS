// ==========================================
// 1. FUNGSI LOGIN (Bisa diakses dari HP & Laptop)
// ==========================================
async function handleLogin(event) {
  event.preventDefault();
  
  const usernameInput = document.getElementById('loginUsername').value.trim().toLowerCase();
  const passwordInput = document.getElementById('loginPassword').value;
  const btnSubmit = document.getElementById('btnSubmit');

  btnSubmit.innerText = 'Memproses...';
  btnSubmit.disabled = true;

  try {
    // Cari user di Cloud Supabase
    const { data: user, error } = await _supabase
      .from('users')
      .select('*')
      .eq('username', usernameInput)
      .single();

    if (error || !user) {
      alert('Username atau password tidak ditemukan!');
      return;
    }

    // Verifikasi Password
    if (user.password_hash === passwordInput) {
      // Simpan sesi login & izin ke memori lokal HP/Laptop
      const currentSession = {
        username: user.username,
        role: user.role,
        permissions: {
          canExport: user.can_export,
          canInput: user.can_input,
          canDelete: user.can_delete
        }
      };
      
      localStorage.setItem('rinnet_session', JSON.stringify(currentSession));
      alert('Login Berhasil! Role: ' + user.role);
      
      // Arahkan ke dashboard utama
      window.location.href = 'dashboard.html'; 
    } else {
      alert('Password salah!');
    }
  } catch (err) {
    alert('Terjadi kesalahan koneksi server.');
  } finally {
    btnSubmit.innerText = 'Masuk Sistem';
    btnSubmit.disabled = false;
  }
}

// ==========================================
// 2. FUNGSI TAMBAH / UPDATE AKUN USER
// ==========================================
async function simpanUserAkun(event) {
  event.preventDefault();

  const username = document.getElementById('inputUsername').value.trim().toLowerCase();
  const password = document.getElementById('inputPassword').value;
  const whatsapp = document.getElementById('inputWA').value.trim();
  const role = document.getElementById('selectRole').value;

  const canExport = document.getElementById('chkExport').checked;
  const canInput = document.getElementById('chkInput').checked;
  const canDelete = document.getElementById('chkDelete').checked;

  // Simpan data langsung ke Supabase Cloud
  const { data, error } = await _supabase
    .from('users')
    .upsert([
      {
        username: username,
        password_hash: password,
        whatsapp: whatsapp,
        role: role,
        can_export: canExport,
        can_input: canInput,
        can_delete: canDelete
      }
    ], { onConflict: 'username' });

  if (error) {
    alert('Gagal menyimpan: ' + error.message);
  } else {
    alert('Akun user ' + username + ' berhasil tersimpan di Cloud!');
    document.getElementById('userForm').reset();
    loadDaftarUser(); // Update tabel
  }
}

// ==========================================
// 3. FUNGSI LOAD DAFTAR USER DARI CLOUD
// ==========================================
async function loadDaftarUser() {
  const tbody = document.getElementById('tabelUserBody');
  if (!tbody) return; // Jika tidak di halaman manajemen user, lewati

  const { data: users, error } = await _supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Gagal mengambil data user:', error);
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><b>${u.username}</b></td>
      <td>${u.whatsapp || '-'}</td>
      <td>${u.role}</td>
      <td>
        ${u.can_input ? '[Input]' : ''}
        ${u.can_export ? '[Export]' : ''}
        ${u.can_delete ? '[Delete]' : ''}
      </td>
    </tr>
  `).join('');
}

// Otomatis muat daftar user jika berada di halaman manajemen user
document.addEventListener('DOMContentLoaded', () => {
  loadDaftarUser();
});