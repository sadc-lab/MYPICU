import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wzfdfrruaxqldhsfuxpe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6ZmRmcnJ1YXhxbGRoc2Z1eHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzc0MjUsImV4cCI6MjA3NzcxMzQyNX0.iSj8slOnlfj0dXRLinX6rIG2Mx9H0Q2YetYsWI2iyEA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
