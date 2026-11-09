"""Exercise migrations and atomic account rewards only in the named disposable DB."""
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
NAME='logicade-school-db-verification'
def sql(data):
    result=subprocess.run(['docker','exec','-i',NAME,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-1'],input=data.encode('utf-8'),capture_output=True)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout.decode('utf-8','replace')
def main():
    if '--registration-only' not in sys.argv:
        sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF; END $$;")
        for p in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            sql(p.read_text(encoding='utf-8-sig'));print('PASS',p.name,flush=True)
    # This participant exists only inside the disposable container, never the study DB.
    result=sql("""
      SELECT public.register_app_account_atomic('P-ABCDEF0123456789ABCDEF01','Installer_Test','INSTALLER-TEST','pbkdf2_sha256$310000$test_salt$test_hash','00000000-0000-4000-8000-000000000001');
      DO $$ BEGIN
        IF (SELECT sum(amount) FROM public.coin_transactions WHERE student_id='P-ABCDEF0123456789ABCDEF01') <> 20 THEN RAISE EXCEPTION 'Starting wallet is not 20'; END IF;
      END $$;
      SELECT count(*) AS test_accounts FROM public.app_accounts WHERE student_number='INSTALLER-TEST';
    """)
    print(result.strip(),flush=True)
    print('All checks used the explicitly named disposable database.',flush=True)
if __name__=='__main__':main()
