"""Apply bundled migrations transactionally to this deployment's new database."""
import hashlib
import os
from pathlib import Path
import psycopg

def migrate():
    root=Path(__file__).resolve().parents[2]
    with psycopg.connect(os.environ['DATABASE_URL'],autocommit=True) as conn:
        conn.execute('select pg_advisory_lock(73590183)')
        conn.execute('create schema if not exists logicade_deployment')
        conn.execute('create table if not exists logicade_deployment.migrations (name text primary key, sha256 text not null, applied_at timestamptz default now())')
        # The Realtime process is not required, but its publication is referenced by migration 005.
        if not conn.execute("select 1 from pg_publication where pubname='supabase_realtime'").fetchone():
            conn.execute('create publication supabase_realtime')
        for file in sorted((root/'supabase/migrations').glob('*.sql')):
            data=file.read_bytes();digest=hashlib.sha256(data).hexdigest()
            old=conn.execute('select sha256 from logicade_deployment.migrations where name=%s',(file.name,)).fetchone()
            if old:
                if old[0]!=digest:raise RuntimeError(f'Applied migration changed: {file.name}; review required')
                continue
            with conn.transaction():
                conn.execute(data.decode('utf-8-sig'),prepare=False)
                conn.execute('insert into logicade_deployment.migrations(name,sha256) values (%s,%s)',(file.name,digest))
            print('Applied',file.name,flush=True)
        # This app uses its own signed accounts and server-side service-role writes.
        # No anon/authenticated direct writes are required by the learner interface.
        with conn.transaction():
            conn.execute('revoke all on all tables in schema public from anon, authenticated')
            conn.execute('revoke all on all sequences in schema public from anon, authenticated')
            conn.execute('revoke execute on all functions in schema public from public, anon, authenticated')
            conn.execute('grant usage on schema public to service_role')
            conn.execute('grant all on all tables in schema public to service_role')
            conn.execute('grant all on all sequences in schema public to service_role')
            conn.execute('grant execute on all functions in schema public to service_role')
        conn.execute("notify pgrst, 'reload schema'")
        print('Schema ready; fresh installation contains no imported participants.',flush=True)

if __name__=='__main__':migrate()
