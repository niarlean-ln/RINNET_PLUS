/* ==========================================================================
   RINNET+ ENTERPRISE INFRASTRUCTURE SUPABASE INITIALIZATION ENGINE
   ========================================================================== */

const SUPABASE_URL = "https://dofrxfurfnectkqfslya.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZnJ4ZnVyZm5lY3RrcWZzbHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDI1NjEsImV4cCI6MjEwNTExODU2MX0.gEot1rHfDozrjRS_Z8wX_u7dqOR7ZRm3h3wbVvUq-CE"; 

// 1. Buat Kunci Rahasia Khusus Aplikasi Anda
const APP_SECRET = "Rinnet_Secure_Key_2026_XYZ";

// 2. Sisipkan rahasia ini ke dalam header global Supabase
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      'x-app-secret': APP_SECRET
    }
  }
});
window._supabase = _supabase;