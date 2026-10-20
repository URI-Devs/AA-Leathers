/* ============================================================
   AA LEATHERS — SUPABASE CONNECTION
   Both values are in: Supabase Dashboard → Project Settings → API Keys

   SUPABASE_KEY must be the **publishable** key (starts with sb_publishable_...)
   — or the older "anon public" key. It is SAFE to be in browser code because
   the database rules (Row Level Security) decide what it can do.

   ⚠ NEVER put the "secret" / "service_role" key here. That one bypasses all
     security and must never be in any file that goes on the website.
   ============================================================ */

const SUPABASE_URL = 'https://zqyjqhbzzhwwcynhaygv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vmrvwLVlWc0aeHu2E3Md5g_iMfIajke';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
