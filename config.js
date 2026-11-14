// Paste your own Supabase details here (Supabase dashboard > Project Settings > API).
//
//   supabaseUrl      the Project URL, for example https://abcdefgh.supabase.co
//   supabaseAnonKey  the "anon" key, or the "publishable" key on newer projects
//
// These two values are meant to be public: they ship to every visitor's browser, and
// the database rules in schema.sql decide who can actually read or write anything.
// Never paste the "service_role" or "secret" key here.
window.APP_CONFIG = {
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
