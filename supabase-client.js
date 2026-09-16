/* ==========================================================================
   RINNET+ ENTERPRISE INFRASTRUCTURE SUPABASE INITIALIZATION ENGINE
   ========================================================================== */

const SUPABASE_URL = "https://dofrxfurfnectkqfslya.supabase.co"; // Ganti dengan URL Supabase milik Anda
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZnJ4ZnVyZm5lY3RrcWZzbHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDI1NjEsImV4cCI6MjEwNTExODU2MX0.gEot1rHfDozrjRS_Z8wX_u7dqOR7ZRm3h3wbVvUq-CE"; // Ganti dengan Anon Key Supabase milik Anda

if (typeof supabase === 'undefined') {
  console.error("Supabase SDK belum dimuat! Pastikan script CDN Supabase terpasang dengan benar.");
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;