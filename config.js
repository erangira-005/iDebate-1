// Supabase connection details (Supabase dashboard > Settings > API Keys).
//
//   supabaseUrl      the Project URL
//   supabaseAnonKey  the "publishable" key (older projects call it the "anon" key)
//
// These two values are meant to be public: they ship to every visitor's browser, and
// the database rules in schema.sql decide who can actually read or write anything.
// Never paste the "service_role" or "secret" key here.
window.APP_CONFIG = {
  supabaseUrl: 'https://ieaejvzobkgqjcuzaoch.supabase.co',
  supabaseAnonKey: 'sb_publishable_rV7PkxvFLfdh8PbEXVtiLg_clB9jhgV',

  // Shows a "Continue with Google" button. Leave this false until Google sign-in is switched on in
  // Supabase (see "Google sign-in" in the README); with it off, nothing changes for anyone.
  googleSignIn: false
};
