import { createClient } from '@supabase/supabase-js';

// Use the project URL env variable name present in the repo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: ensure VITE_SUPABASE_PROJECT_URL and VITE_SUPABASE_ANON_KEY are set');
}

export const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string);

// Admin credentials - you'll need to create this user in Supabase Auth
// Go to Authentication > Users > Add User
// Email: admin@library.com
// Password: your-secure-password (set this in .env)