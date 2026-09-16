/* ==========================================================================
   RINNET+ SUPABASE ENGINE CLIENT (REALTIME ENABLED)
   ========================================================================== */

const SUPABASE_URL = 'https://dofrxfurfnectkqfslya.supabase.co';
const SUPABASE_KEY = 'sb_publishable_J0el_hrvg8wPeYAtLOIxAA_CX7DqObs';

// Inisialisasi Supabase Client dengan opsi Realtime & Auto-Refresh Session
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});