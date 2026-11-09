# LogiCade school server

Copy only **LogiCade School Server Setup.exe** to a supported 64-bit Windows school PC. This installer contains the app source, canonical game definitions, shared game assets, and migrations. It intentionally excludes this laptop's `.env`, accounts, study records, model files, queues, caches, backups and ML datasets.

## First installation

1. Use a Windows account approved by campus IT to install software. Connect to reliable internet and mains power. Allow at least 40 GB free SSD space; 80 GB is recommended. Use at least 8 GB RAM, preferably 16 GB. WSL 2 needs virtualization enabled in BIOS/UEFI.
2. Run the EXE and approve its Windows administrator prompt. Enter a new administrator email and a password of at least 12 characters. Keep these credentials separately.
3. Select NVIDIA GPU only if the PC already has an NVIDIA GPU and a compatible WSL driver. CPU mode is the safe default; existing games work while AI generation is unavailable or slow.
4. Choose **Install and set up**. The manager enables Windows WSL components, updates WSL, downloads the official signed Docker Desktop installer if missing, and starts Docker. A restart or a Docker first-run/license screen may require campus IT or your attention. After restarting, run the same EXE again.
5. Docker installs Python requirements and the Node verifier inside the app image. The installer already includes the production React build; the school PC does not need a separate Python, Node, npm or Vite installation. Supabase PostgreSQL and PostgREST run privately, schema migrations are applied once with checksums, Ollama downloads qwen2.5:3b, and a Cloudflare Quick Tunnel publishes the learner app.
6. Copy the **demo link** from the manager. Open it on another network/device and complete registration, login and a stage before inviting participants. The public gateway blocks administrator routes; use **Open private admin** on the host PC.

The initial database is empty. Use the new administrator credentials at `http://127.0.0.1:18000/admin/`. The local game is `http://127.0.0.1:18000/app/`. Only this loopback app port is published on Windows. PostgreSQL, PostgREST, and Ollama have no host-published ports. This deployment includes the Supabase services the current custom account API uses; it does not install Studio, Auth email delivery, Realtime, Storage, or Edge Functions, which the learner flow does not require.

## Daily operation

Before collecting study data, configure and approve the study instruments on this new installation. Private assessment banks from the laptop are intentionally not bundled; the midterm remains unavailable until an instructor supplies an approved bank through the private administrator API. The package does not activate or transfer an experimental trained difficulty model. Review the app's active difficulty rule and study settings with the instructor before the supervised pilot.

Open **LogiCade Server Manager** and choose **Start server**. Closing its window minimizes it to the system tray. The manager requests that Windows stay awake while the server is running; it does not override campus sleep policies or BIOS settings. Keep the PC powered, signed in and connected. Automatic startup, if selected, runs after this Windows account signs in, not before the Windows login screen.

Use **Stop server** or **Stop and exit** from the tray to stop containers without deleting data. Do not use `docker compose down -v` or Docker factory reset on a study machine. The manager refreshes the temporary URL after tunnel restarts.

## Temporary versus stable links

A Quick Tunnel needs no domain or Cloudflare account. Its `trycloudflare.com` address changes after restart, has no uptime guarantee, is limited to 200 simultaneous in-flight HTTP requests, and does not support SSE. This is the temporary demo mode you selected, not a stable institutional study address. Student browsers store offline records by origin, so a changed hostname also means a different local browser store. Confirm all uploads before changing the link. A stable named tunnel with a school-controlled domain is required before relying on a permanent study URL.

The Quick Tunnel uses outbound HTTPS/HTTP2; no inbound router forwarding is needed. A school firewall or network policy can still block Docker image downloads, model downloads, or Cloudflare Tunnel. Campus IT must approve any required outbound access. The installer does not change antivirus, firewall, privacy settings, or authentication policies.

## Backups and recovery rehearsal

Choose **Create backup** when no learners are actively playing. It briefly pauses the application, writes a binary PostgreSQL custom-format dump of the application public and migration-ledger schemas (excluding unused Supabase internal services and Vault tables), archives the persistent game/content/state volumes, and restarts the app. Copy the `.dump`, `.content.tar.gz`, and matching manifest from `C:\ProgramData\LogiCadeSchoolServer\backups` to protected storage on another machine. These files contain research records; they are restricted locally but are not encrypted by the export itself.

Choose **Test backup recovery** and select a `.dump` file. It restores into a uniquely named temporary database, checks participant and migration tables, and removes only that temporary database. It does not replace the live study database. A full migration to a replacement host must restore both database and content/state, regenerate host secrets as appropriate, and be checked before collecting data. The manager intentionally does not overwrite a live study database with a backup.

Test the actual campus connection from an off-campus device. Download a representative game asset and record bytes divided by transfer time; do not mistake a same-PC request for an independent upload-speed test. Run a small supervised session and verify registration, progression, hints, first-clear rewards, offline retry, and exported counts. Retain the successful backup-recovery log before the study.

## Persistence and support

Configuration and logs are under `C:\ProgramData\LogiCadeSchoolServer`. Host secrets are unique to this installation. Docker named volumes retain the database, game definitions, generated content, selection history and models. Setup reruns preserve those volumes and reject changed applied migration files; they do not reset the database. Only one FastAPI worker is used, matching the application's publication and difficulty locking design.

The bootstrap EXE is not code signed. Schools may block unsigned executables, Docker, WSL, or public tunnels; campus IT must approve them. The software can automate installation steps, but cannot supply administrator authorization, enable BIOS virtualization, guarantee campus-network access, create a domain, or guarantee unattended operation before Windows sign-in.

## Primary setup references

- Docker Windows requirements and installer: https://docs.docker.com/desktop/setup/install/windows-install/
- Supabase self-hosted Docker architecture: https://supabase.com/docs/guides/self-hosting/docker
- Supabase upstream image reference: self-hosted/v0.8.4 docker/docker-compose.yml
- Cloudflare Quick Tunnel limits: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- Ollama Docker deployment: https://docs.ollama.com/docker
