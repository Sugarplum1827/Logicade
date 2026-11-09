-- Supabase's postgres image provides its base roles and auth schema.
-- Password comes from the new host's environment, never the source laptop.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'pgpass';
