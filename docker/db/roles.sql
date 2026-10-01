-- Same role initialization as the official Supabase self-hosted stack.
\getenv pgpass POSTGRES_PASSWORD
ALTER ROLE authenticator WITH PASSWORD :'pgpass';
ALTER ROLE supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER ROLE supabase_admin WITH PASSWORD :'pgpass';
ALTER ROLE postgres WITH PASSWORD :'pgpass';
