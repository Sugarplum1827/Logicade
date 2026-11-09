param(
    [ValidateSet('Install','Start','Stop','Status','Backup','VerifyBackup')][string]$Action='Status',
    [string]$InputFile='', [string]$BackupFile=''
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$root=$PSScriptRoot
Set-Location -LiteralPath $root
$env:COMPOSE_PROJECT_NAME='logicade-school'
$utf8=New-Object System.Text.UTF8Encoding($false)
function Say([string]$Message) { Write-Output $Message }
function DockerPath {
    foreach($p in @("$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe", "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe")) { if(Test-Path -LiteralPath $p) { return $p } }
    $c=Get-Command docker.exe -ErrorAction SilentlyContinue
    if($c) {return $c.Source}
    return $null
}
function Compose([string[]]$Arguments, [switch]$Soft) {
    $composeArgs=@('compose','--project-name','logicade-school','--env-file',(Join-Path $root '.env'),'-f',(Join-Path $root 'compose.yaml'))
    if(Test-Path -LiteralPath (Join-Path $root 'gpu.enabled')) {$composeArgs+=@('-f',(Join-Path $root 'compose.gpu.yaml'))}
    $previousPreference=$ErrorActionPreference;$ErrorActionPreference='Continue'
    try {& $script:docker @composeArgs @Arguments 2>&1 | ForEach-Object {Say ([string]$_)};$resultCode=$LASTEXITCODE}
    finally {$ErrorActionPreference=$previousPreference}
    if($resultCode -ne 0 -and !$Soft) {throw "Container command failed (exit $resultCode). See the setup log."}
}
function PrivateFile([string]$Path) {
    $acl=Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true,$false)
    foreach($sid in @('S-1-5-18','S-1-5-32-544',[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value)) {
        $identity=New-Object System.Security.Principal.SecurityIdentifier($sid)
        $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($identity,'FullControl','Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function RandomHex([int]$Length=32) {
    $bytes=New-Object byte[] $Length
    $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {$rng.GetBytes($bytes)} finally {$rng.Dispose()}
    return -join ($bytes | ForEach-Object {$_.ToString('x2')})
}
function B64([byte[]]$Bytes) {return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_')}
function Jwt([string]$Role,[string]$Secret) {
    $head=B64 $utf8.GetBytes('{"alg":"HS256","typ":"JWT"}')
    $exp=[long]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()+315360000)
    $body=B64 $utf8.GetBytes((@{role=$Role;iss='supabase';iat=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds();exp=$exp}|ConvertTo-Json -Compress))
    $hmac=New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key=$utf8.GetBytes($Secret)
    try {$sig=B64 ($hmac.ComputeHash($utf8.GetBytes("$head.$body")))} finally {$hmac.Dispose()}
    return "$head.$body.$sig"
}
function Config {
    $configPath=Join-Path $root '.env'
    if(Test-Path -LiteralPath $configPath) {Say 'Keeping the existing server configuration and database.'; return}
    if(!(Test-Path -LiteralPath $InputFile)) {throw 'Enter the administrator details in the setup window.'}
    $inputData=Get-Content -LiteralPath $InputFile -Raw | ConvertFrom-Json
    if($inputData.email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$' -or $inputData.password.Length -lt 12) {throw 'Use a valid administrator email and a password with at least 12 characters.'}
    if($inputData.password -match '[\r\n\x00]') {throw 'The administrator password cannot contain line breaks.'}
    $secret=RandomHex
    $values=[ordered]@{POSTGRES_PASSWORD=(RandomHex);JWT_SECRET=$secret;SERVICE_ROLE_KEY=(Jwt 'service_role' $secret);LOGICADE_ADMIN_EMAIL=$inputData.email;LOGICADE_ADMIN_KEY=$inputData.password;LOGICADE_SESSION_SECRET=(RandomHex)}
    $lines=@('# Generated on this host. Never publish or transfer this file with the installer.')
    foreach($entry in $values.GetEnumerator()) {$v=([string]$entry.Value).Replace("'","\'");$lines+="$($entry.Key)='$v'"}
    [IO.File]::WriteAllLines($configPath,$lines,$utf8);PrivateFile $configPath
    if($inputData.gpu -eq $true) {[IO.File]::WriteAllText((Join-Path $root 'gpu.enabled'),'NVIDIA GPU explicitly selected',$utf8)}
    Say 'Created new host-specific secrets. No laptop account or participant data was imported.'
}
function InstallPrerequisites {
    if(![Environment]::Is64BitOperatingSystem) {throw 'This installer requires 64-bit Windows.'}
    $build=[int](Get-ItemPropertyValue 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' CurrentBuildNumber)
    if($build -lt 19045) {throw 'Update Windows to a supported Windows 10 22H2 or Windows 11 release before installing Docker Desktop.'}
    $reboot=$false
    foreach($feature in @('Microsoft-Windows-Subsystem-Linux','VirtualMachinePlatform')) {
        $current=Get-WindowsOptionalFeature -Online -FeatureName $feature
        if($current.State -ne 'Enabled') {
            Say "Enabling $feature. A restart may be needed."
            $result=Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart
            $reboot=$true
        }
    }
    if($reboot) {Say 'RESTART REQUIRED: Restart Windows, then run the same LogiCade setup again. No database has been erased.';exit 3010}
    Say 'Updating the WSL kernel. School policy may require an IT administrator.'
    $oldPreference=$ErrorActionPreference;$ErrorActionPreference='Continue'
    try {& "$env:SystemRoot\System32\wsl.exe" --update --web-download 2>&1 | ForEach-Object {Say ([string]$_)};$wslCode=$LASTEXITCODE} finally {$ErrorActionPreference=$oldPreference}
    if($wslCode -ne 0) {throw 'WSL could not update. Ask campus IT to enable virtualization and install the current WSL 2 kernel, then retry.'}
    if(!(DockerPath)) {
        Say 'Downloading Docker Desktop from Docker. This can take several minutes.'
        $download=Join-Path $root 'DockerDesktopInstaller.exe'
        [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile $download
        $sig=Get-AuthenticodeSignature -LiteralPath $download
        if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Docker') {throw 'Docker installer signature verification failed. Installation was stopped.'}
        Say 'Installing Docker Desktop with the WSL 2 backend. Its first-run screen may need your attention.'
        $process=Start-Process -FilePath $download -ArgumentList @('install','--quiet','--accept-license','--backend=wsl-2') -Wait -PassThru -WindowStyle Hidden
        if($process.ExitCode -in @(3010,1641)) {Say 'RESTART REQUIRED: Restart Windows and run LogiCade setup again.';exit 3010}
        if($process.ExitCode -ne 0) {throw "Docker installation failed ($($process.ExitCode)). Open its installer or ask campus IT."}
    }
}
function WaitDocker {
    $script:docker=DockerPath
    if(!$script:docker) {throw 'Docker Desktop is not installed. Choose Install and set up first.'}
    $ready=$false
    for($i=0;$i -lt 120;$i++) {
        $priorPreference=$ErrorActionPreference;$ErrorActionPreference='Continue'
        try {$answer=& $script:docker info --format '{{.OSType}}' 2>$null;$dockerCode=$LASTEXITCODE} finally {$ErrorActionPreference=$priorPreference}
        if($dockerCode -eq 0 -and $answer -eq 'linux') {$ready=$true;break}
        if($i -eq 0) {
            Say 'Waiting for Docker Desktop. Complete any Docker first-run screen on this PC.'
            foreach($desktop in @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe","$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe")) {
                if(Test-Path -LiteralPath $desktop) {Start-Process -FilePath $desktop -WindowStyle Hidden;break}
            }
        }
        Start-Sleep -Seconds 3
    }
    if(!$ready) {throw 'Docker did not become ready. Open Docker Desktop, enable its Linux/WSL 2 engine, and retry. Virtualization or a restart may be required.'}
}
function UpdateLink {
    $urlFile=Join-Path $root 'public-url.txt'
    $cid=([string](& $script:docker compose --env-file .env -f compose.yaml ps -q tunnel)).Trim()
    if(!$cid) {[IO.File]::WriteAllText($urlFile,'',$utf8);return}
    $started=([string](& $script:docker inspect --format '{{.State.StartedAt}}' $cid)).Trim()
    $lines=Compose @('logs','--no-color','--since',$started,'tunnel') -Soft
    $matches=[regex]::Matches(($lines -join "`n"),'https://[a-z0-9-]+\.trycloudflare\.com')
    if($matches.Count -gt 0) {[IO.File]::WriteAllText($urlFile,$matches[$matches.Count-1].Value,$utf8)}
    else {[IO.File]::WriteAllText($urlFile,'',$utf8)}
    if(Test-Path -LiteralPath $urlFile) {Say ('PUBLIC LINK: '+[IO.File]::ReadAllText($urlFile))}
}
function StartServer([switch]$Build) {
    WaitDocker
    if(!(Test-Path -LiteralPath (Join-Path $root '.env'))) {throw 'Choose Install and set up to configure this new server.'}
    if($Build) {
        Say 'Downloading database, API, AI runtime and tunnel images.'
        Compose @('pull','db','rest','supabase-api','ollama','gateway','tunnel')
        Say 'Installing Python requirements and the bundled production app in its private container.'
        Compose @('build','migrate')
    }
    Say 'Starting the private database and applying the bundled schema.'
    Compose @('up','-d','--wait','--wait-timeout','600','db','rest','supabase-api','ollama','app','gateway','tunnel')
    if($Build) {
        Say 'Downloading qwen2.5:3b into the private Ollama volume. Existing games remain playable if this download fails.'
        Compose @('exec','-T','ollama','ollama','pull','qwen2.5:3b') -Soft
    }
    for($i=0;$i -lt 20;$i++) {
        UpdateLink
        if((Test-Path -LiteralPath (Join-Path $root 'public-url.txt')) -and [IO.File]::ReadAllText((Join-Path $root 'public-url.txt')).StartsWith('https://')) {break}
        Start-Sleep -Seconds 3
    }
    Say 'READY: Local game http://127.0.0.1:18000/app/ | Private admin http://127.0.0.1:18000/admin/'
    Say 'The temporary demo address changes after tunnel restarts. Share the current link shown in the manager.'
}
function BinaryDocker([string[]]$Arguments,[string]$OutputFile,[string]$ReadFile) {
    # PowerShell 5 redirection corrupts binary pg_dump output, so copy the streams directly.
    $psi=New-Object Diagnostics.ProcessStartInfo
    $psi.FileName=$script:docker;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
    $psi.Arguments=($Arguments | ForEach-Object {'"'+$_.Replace('"','\"')+'"'}) -join ' '
    $psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true;$psi.RedirectStandardInput=[bool]$ReadFile
    $p=New-Object Diagnostics.Process;$p.StartInfo=$psi;[void]$p.Start()
    $err=$p.StandardError.ReadToEndAsync()
    if($ReadFile) {$inputStream=[IO.File]::OpenRead($ReadFile);try {$inputStream.CopyTo($p.StandardInput.BaseStream)} finally {$inputStream.Dispose();$p.StandardInput.Close()}}
    if($OutputFile) {$outputStream=[IO.File]::Create($OutputFile);try {$p.StandardOutput.BaseStream.CopyTo($outputStream)} finally {$outputStream.Dispose()}}
    else {$text=$p.StandardOutput.ReadToEnd();if($text) {Say $text}}
    $p.WaitForExit();$errorText=$err.Result
    if($p.ExitCode -ne 0) {throw "Backup/recovery operation failed: $errorText"}
}
try {
    if($Action -eq 'Install') {
        InstallPrerequisites;Config;StartServer -Build
        $manager=Join-Path $root 'LogiCadeServer.exe'
        if(Test-Path -LiteralPath $manager) {
            $shell=New-Object -ComObject WScript.Shell
            $shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'LogiCade Server Manager.lnk'))
            $shortcut.TargetPath=$manager;$shortcut.WorkingDirectory=$root;$shortcut.Save()
            $inputData=Get-Content -LiteralPath $InputFile -Raw | ConvertFrom-Json
            if($inputData.startup) {
                $taskAction=New-ScheduledTaskAction -Execute $manager -Argument '--start'
                $who=[Security.Principal.WindowsIdentity]::GetCurrent().Name
                $taskTrigger=New-ScheduledTaskTrigger -AtLogOn -User $who
                $principal=New-ScheduledTaskPrincipal -UserId $who -LogonType Interactive -RunLevel Highest
                Register-ScheduledTask -TaskName LogiCadeSchoolServer -Action $taskAction -Trigger $taskTrigger -Principal $principal -Force | Out-Null
                Say 'Automatic startup registered for this Windows account after sign-in.'
            }
        }
    }
    elseif($Action -eq 'Start') {StartServer}
    elseif($Action -eq 'Stop') {WaitDocker;Compose @('stop');[IO.File]::WriteAllText((Join-Path $root 'public-url.txt'),'',$utf8);Say 'Stopped. Database, model and game volumes are retained.'}
    elseif($Action -eq 'Status') {
        WaitDocker
        $appId=([string](& $script:docker compose --env-file .env -f compose.yaml ps -q app)).Trim()
        if(!$appId) {throw 'The game server is stopped. Choose Start server.'}
        $health=([string](& $script:docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' $appId)).Trim()
        if($health -ne 'healthy') {throw 'The game server is not ready. Choose Start server and review the startup log if this continues.'}
        UpdateLink
    }
    elseif($Action -eq 'Backup') {
        WaitDocker
        $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupDir=Join-Path $root 'backups';[void][IO.Directory]::CreateDirectory($backupDir)
        Say 'Pausing the application while taking a matching database and content backup.'
        Compose @('stop','app')
        try {
            $container=(& $script:docker compose --env-file .env -f compose.yaml ps -q db).Trim()
            if(!$container) {throw 'The study database is not running.'}
            $dump=Join-Path $backupDir "$stamp.database.dump"
            BinaryDocker @('exec',$container,'pg_dump','-U','postgres','-d','postgres','-Fc','--schema=public','--schema=logicade_deployment') $dump ''
            Compose @('run','--rm','--no-deps','--entrypoint','python','app','deployment/school-server/backup_state.py',"/backups/$stamp.content.tar.gz")
            $hash=(Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash
            [IO.File]::WriteAllText((Join-Path $backupDir "$stamp.manifest.json"),(@{database=[IO.Path]::GetFileName($dump);sha256=$hash;created=(Get-Date).ToUniversalTime().ToString('o');content="$stamp.content.tar.gz"}|ConvertTo-Json),$utf8)
            Say "BACKUP: $backupDir | Copy the dump, content archive and manifest to protected storage on another machine."
        } finally {Compose @('start','app')}
    }
    elseif($Action -eq 'VerifyBackup') {
        WaitDocker
        $resolved=[IO.Path]::GetFullPath($BackupFile)
        if(!(Test-Path -LiteralPath $resolved) -or [IO.Path]::GetExtension($resolved) -ne '.dump') {throw 'Select a database .dump backup.'}
        $container=(& $script:docker compose --env-file .env -f compose.yaml ps -q db).Trim()
        if(!$container) {throw 'Start the server before testing recovery.'}
        $testName='logicade_recovery_'+(RandomHex 6)
        try {
            & $script:docker exec $container createdb -U postgres -T template0 $testName
            if($LASTEXITCODE -ne 0) {throw 'Could not create an isolated recovery database.'}
            # Copy the base compatibility function used by the legacy students default.
            $authFunction=& $script:docker exec $container psql -U postgres -d postgres -tAc "select pg_get_functiondef('auth.uid()'::regprocedure)"
            if($LASTEXITCODE -ne 0) {throw 'Could not read the base database compatibility function.'}
            ("DROP SCHEMA public; CREATE SCHEMA auth;`n"+($authFunction -join "`n")) | & $script:docker exec -i $container psql -U postgres -d $testName -v ON_ERROR_STOP=1
            if($LASTEXITCODE -ne 0) {throw 'Could not prepare the isolated recovery database.'}
            BinaryDocker @('exec','-i',$container,'pg_restore','-U','postgres','-d',$testName,'--no-owner','--no-privileges','--exit-on-error') '' $resolved
            & $script:docker exec $container psql -U postgres -d $testName -v ON_ERROR_STOP=1 -tAc 'SELECT count(*) AS participants FROM public.students; SELECT count(*) AS migrations FROM logicade_deployment.migrations;'
            if($LASTEXITCODE -ne 0) {throw 'Recovered data or migration checks failed.'}
            Say 'RECOVERY CHECK PASSED: The backup restored into a separate temporary database. The live study database was not replaced.'
        } finally {
            if($testName -match '^logicade_recovery_[a-f0-9]{12}$') {& $script:docker exec $container dropdb -U postgres --if-exists $testName}
        }
    }
    exit 0
} catch {Write-Output ('ERROR: '+$_.Exception.Message);exit 1}
