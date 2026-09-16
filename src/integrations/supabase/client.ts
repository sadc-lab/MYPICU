import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Repli sur le projet Supabase Cloud actuel si les variables d'environnement ne
// sont pas définies (déploiements existants, dev local sans .env). Le jour du
// transfert vers l'instance auto-hébergée du CHUSJ, définir VITE_SUPABASE_URL et
// VITE_SUPABASE_ANON_KEY sur le déploiement suffit — aucun autre changement de
// code n'est nécessaire.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://wzfdfrruaxqldhsfuxpe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6ZmRmcnJ1YXhxbGRoc2Z1eHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzc0MjUsImV4cCI6MjA3NzcxMzQyNX0.iSj8slOnlfj0dXRLinX6rIG2Mx9H0Q2YetYsWI2iyEA";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});