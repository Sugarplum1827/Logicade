# School-server verification — 8 November 2026

The transfer uses a fresh database and a temporary Cloudflare Quick Tunnel. It does not migrate laptop accounts, research records, existing credentials, ML datasets or model binaries.

Verified locally:

- Production React build, native Windows manager compilation and Windows PowerShell 5 script parsing.
- Installer payload checksum, ZIP integrity, complete canonical set of 2,700 fallback records and 2,700 native definitions, required migrations and absence of private source folders/credentials.
- Linux application image with Python 3.11, Node 22 and an exact dependency lock.
- All 17 migrations on a new isolated Supabase PostgreSQL database, then an unchanged second migration run.
- Registration/login, rejection of duplicate usernames/student numbers and the atomic 20-coin starting ledger.
- Authenticated stage selection, Canvas ZIP preparation and successful HTTP loading of the extracted launcher and shared runtime through the public gateway.
- Browser landing page, login and subject selection using a disposable local test account.
- Public denial of admin pages/API, schema documentation and private runtime data paths; database, REST and Ollama have no published host ports.
- New-host secret generation, service-role JWT signature and preservation of special characters in the administrator password inside a real Compose container.
- The manager's PowerShell 5 binary database backup/restore functions: application-owned schemas restored into a separate empty recovery database; 17 migration records and the disposable account preserved.
- Content/state archive integrity and exclusion of extracted game cache files.

These checks used explicitly named disposable containers, not the existing study database. No public tunnel was opened for the rehearsal.

Still target-dependent: a clean school PC's administrator/WSL/BIOS permissions, Windows restart and Docker first-run steps, campus network access, actual Ollama model download/GPU compatibility, off-campus link access and upload capacity. The EXE is unsigned. Run the guide's off-campus supervised session and backup recovery check on the actual school machine before collecting study records.
