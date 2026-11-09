using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class StartLogicade
{
    [STAThread]
    private static int Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        if (args.Length == 1 && args[0] == "--check")
        {
            try { new StackLauncher(root).Preflight(); return 0; }
            catch (Exception ex) { StackLauncher.Log(root, "preflight", ex.Message); return 1; }
        }

        bool first;
        using (var instance = new Mutex(true, @"Local\LogiCadeProjectLauncher", out first))
        {
            if (!first)
            {
                MessageBox.Show("LogiCade's launcher is already open. Use its window to open the game.",
                    "LogiCade", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherWindow(root));
        }
        return 0;
    }
}

internal sealed class LauncherWindow : Form
{
    private readonly Label status = new Label { Dock = DockStyle.Fill, Padding = new Padding(14), Text = "Checking the project…" };
    private readonly Button open = new Button { Text = "Open LogiCade", AutoSize = true, Enabled = false };
    private readonly Button retry = new Button { Text = "Retry", AutoSize = true, Enabled = false };
    private readonly StackLauncher stack;
    private CancellationTokenSource run;

    internal LauncherWindow(string root)
    {
        stack = new StackLauncher(root);
        Text = "Start LogiCade";
        ClientSize = new Size(495, 170);
        MinimumSize = new Size(470, 195);
        StartPosition = FormStartPosition.CenterScreen;
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, AutoSize = true, Padding = new Padding(10), WrapContents = false };
        var logs = new Button { Text = "Open logs", AutoSize = true };
        buttons.Controls.AddRange(new Control[] { open, retry, logs });
        Controls.Add(status);
        Controls.Add(buttons);

        open.Click += (s, e) => Open(StackLauncher.LearnerUrl);
        retry.Click += (s, e) => StartStack();
        logs.Click += (s, e) =>
        {
            try { Directory.CreateDirectory(stack.LogDirectory); Open(stack.LogDirectory); }
            catch (Exception ex) { status.Text = "Could not open the logs. " + ex.Message; }
        };
        Shown += (s, e) => StartStack();
        FormClosed += (s, e) =>
        {
            if (run != null) run.Cancel();
            stack.StopOwned();
        };
    }

    private async void StartStack()
    {
        if (run != null) run.Dispose();
        run = new CancellationTokenSource();
        var token = run.Token;
        open.Enabled = retry.Enabled = false;
        var progress = new Progress<string>(message => { if (!IsDisposed) status.Text = message; });
        try
        {
            bool modelReady = await Task.Run(() => stack.Start(progress, token));
            if (IsDisposed) return;
            status.Text = modelReady
                ? "LogiCade is ready. Keep this window open while you use it."
                : "LogiCade is ready. Ollama did not respond, so AI generation may be unavailable. Keep this window open.";
            open.Enabled = true;
            Open(StackLauncher.LearnerUrl);
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            stack.StopOwned();
            StackLauncher.Log(stack.Root, "launcher", ex.Message);
            if (!IsDisposed)
            {
                status.Text = ex.Message;
                retry.Enabled = true;
            }
        }
    }

    private void Open(string target)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch (Exception ex) { status.Text = "Could not open " + target + ". " + ex.Message; }
    }
}

internal sealed class StackLauncher
{
    internal const string LearnerUrl = "http://localhost:5173/";
    private const string ApiUrl = "http://127.0.0.1:8000/";
    private readonly object gate = new object();
    private readonly List<Process> owned = new List<Process>();
    private ProcessJob job;
    private string docker, supabase, npm, python, frontend;

    internal string Root { get; private set; }
    internal string LogDirectory { get { return Path.Combine(Root, ".state", "launcher"); } }

    internal StackLauncher(string root) { Root = root; }

    internal void Preflight()
    {
        frontend = Path.Combine(Root, "client-react");
        python = Path.Combine(Root, ".venv", "Scripts", "python.exe");
        if (!File.Exists(Path.Combine(Root, "server", "main.py")) || !File.Exists(Path.Combine(Root, "supabase", "config.toml")))
            throw new InvalidOperationException("Put Start LogiCade.exe in the LogiCade project folder.");
        if (!File.Exists(python)) throw new InvalidOperationException("The project's Python environment is missing. Set up the .venv folder first.");
        if (!File.Exists(Path.Combine(frontend, "node_modules", "vite", "bin", "vite.js")))
            throw new InvalidOperationException("The React dependencies are missing. Install the project's frontend dependencies first.");

        docker = Find("docker.exe");
        supabase = Find("supabase.exe");
        npm = Find("npm.cmd");
        if (docker == null) throw new InvalidOperationException("Docker is missing from PATH. Install Docker Desktop first.");
        if (supabase == null) throw new InvalidOperationException("Supabase CLI is missing from PATH. Install it first.");
        if (npm == null) throw new InvalidOperationException("npm is missing from PATH. Install Node.js first.");
        Log(Root, "launcher", "Project and required executables found.");
    }

    internal bool Start(IProgress<string> progress, CancellationToken token)
    {
        Preflight();
        progress.Report("Waiting for Docker Desktop…");
        if (!DockerReady(token))
        {
            string desktop = DockerDesktop();
            if (desktop == null) throw new InvalidOperationException("Docker Desktop could not be located. Open it from the Start menu and select Retry.");
            if (Process.GetProcessesByName("Docker Desktop").Length == 0)
                Process.Start(new ProcessStartInfo(desktop) { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
            WaitFor("Docker Desktop's engine", () => DockerReady(token), null, 240, token);
        }

        progress.Report("Starting the local Supabase database…");
        if (RunCommand(supabase, "start", 900, token) != 0)
            throw new InvalidOperationException("Supabase could not start. Check Docker Desktop and whether another Supabase project is using ports 54321–54324.");

        progress.Report("Checking Ollama…");
        bool modelReady = StartOllama(token);

        progress.Report("Starting the FastAPI server…");
        if (!ReuseOrFree("127.0.0.1", 8000, "FastAPI", ApiReady, token))
        {
            var backend = Launch(python, "-m uvicorn server.main:app --reload --host 127.0.0.1 --port 8000", Root, "fastapi", token);
            WaitFor("FastAPI", ApiReady, backend, 180, token);
        }

        progress.Report("Starting React and checking its API connection…");
        if (!ReuseOrFree("localhost", 5173, "Vite", FrontendReady, token))
        {
            string command = "/d /s /c \"\"" + npm + "\" run dev -- --host localhost --port 5173 --strictPort\"";
            var web = Launch(Path.Combine(Environment.SystemDirectory, "cmd.exe"), command, frontend, "vite", token);
            WaitFor("Vite and its FastAPI connection", FrontendReady, web, 90, token);
        }
        Log(Root, "launcher", "LogiCade ready at " + LearnerUrl);
        return modelReady;
    }

    private bool StartOllama(CancellationToken token)
    {
        string configured = Environment.GetEnvironmentVariable("OLLAMA_HOST");
        string envFile = Path.Combine(Root, ".env");
        if (String.IsNullOrWhiteSpace(configured) && File.Exists(envFile))
        {
            foreach (string line in File.ReadLines(envFile))
            {
                string entry = line.Trim();
                if (!entry.StartsWith("OLLAMA_HOST=", StringComparison.Ordinal)) continue;
                configured = entry.Substring("OLLAMA_HOST=".Length).Trim().Trim('"', '\'');
                break;
            }
        }
        if (String.IsNullOrWhiteSpace(configured)) configured = "http://localhost:11434";
        Uri address;
        if (!Uri.TryCreate(configured, UriKind.Absolute, out address) || !address.IsLoopback)
            return true; // A configured remote Ollama is managed outside this launcher.
        // Windows can resolve localhost to IPv6 first while Ollama listens only on IPv4.
        if (address.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
            address = new UriBuilder(address) { Host = "127.0.0.1" }.Uri;
        string url = new Uri(address, "/api/tags").AbsoluteUri;
        if (Get(url).Contains("\"models\"")) return true;
        string exe = Find("ollama.exe");
        if (exe == null) return false;
        try
        {
            var service = Launch(exe, "serve", Root, "ollama", token, address.GetLeftPart(UriPartial.Authority));
            WaitFor("Ollama", () => Get(url).Contains("\"models\""), service, 35, token);
            return true;
        }
        catch (InvalidOperationException ex) { Log(Root, "launcher", ex.Message); return false; }
        catch (System.ComponentModel.Win32Exception ex) { Log(Root, "launcher", ex.Message); return false; }
    }

    private bool DockerReady(CancellationToken token)
    {
        return RunCommand(docker, "info --format \"{{.ServerVersion}}\"", 10, token) == 0;
    }

    private static bool ApiReady()
    {
        return Get(ApiUrl + "api/config").Contains("\"syncPath\":\"/api/sync/batch\"")
            && Get(ApiUrl + "health").Contains("\"manifest_loaded\":true");
    }

    private static bool FrontendReady()
    {
        string html = Get(LearnerUrl);
        return html.Contains("<title>LogiCade</title>") && html.Contains("/@vite/client")
            && Get(LearnerUrl + "api/config").Contains("\"syncPath\":\"/api/sync/batch\"");
    }

    private static string Get(string url)
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Proxy = null;
            request.AllowAutoRedirect = false;
            request.KeepAlive = false;
            request.Timeout = 1500;
            request.ReadWriteTimeout = 1500;
            using (var response = (HttpWebResponse)request.GetResponse())
            {
                if (response.StatusCode != HttpStatusCode.OK) return "";
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    var buffer = new char[8192];
                    return new string(buffer, 0, reader.ReadBlock(buffer, 0, buffer.Length));
                }
            }
        }
        catch (WebException) { return ""; }
        catch (IOException) { return ""; }
    }

    private static bool ReuseOrFree(string host, int port, string service, Func<bool> ready, CancellationToken token)
    {
        for (int retry = 0; retry < 6; retry++)
        {
            token.ThrowIfCancellationRequested();
            if (ready()) return true;
            if (!PortOccupied(host, port)) return false;
            token.WaitHandle.WaitOne(1000);
        }
        throw new InvalidOperationException("Port " + port + " is occupied by a service that is not ready for LogiCade. Close it or let it finish starting, then select Retry to start " + service + ".");
    }

    private static bool PortOccupied(string host, int port)
    {
        using (var tcp = new TcpClient())
        {
            try
            {
                var connect = tcp.BeginConnect(host, port, null, null);
                using (var handle = connect.AsyncWaitHandle)
                {
                    if (!handle.WaitOne(900)) return false;
                    tcp.EndConnect(connect);
                }
            }
            catch (SocketException) { return false; }
        }
        return true;
    }

    private static void WaitFor(string service, Func<bool> ready, Process process, int seconds, CancellationToken token)
    {
        var timer = Stopwatch.StartNew();
        do
        {
            token.ThrowIfCancellationRequested();
            if (ready()) return;
            if (process != null && process.HasExited) throw new InvalidOperationException(service + " exited before it was ready. Open logs for details.");
            token.WaitHandle.WaitOne(1200);
        }
        while (timer.Elapsed.TotalSeconds < seconds);
        throw new InvalidOperationException(service + " did not become ready in time. Open logs and select Retry.");
    }

    private int RunCommand(string exe, string args, int seconds, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        // Drain and discard CLI output because Supabase can print credentials.
        using (var command = StartProcess(exe, args, Root, null, null))
        {
            var timer = Stopwatch.StartNew();
            while (!command.WaitForExit(250))
            {
                if (!token.IsCancellationRequested && timer.Elapsed.TotalSeconds < seconds) continue;
                try { command.Kill(); } catch (InvalidOperationException) { }
                token.ThrowIfCancellationRequested();
                return -1;
            }
            return command.ExitCode;
        }
    }

    private Process Launch(string exe, string args, string directory, string log, CancellationToken token, string ollamaHost = null)
    {
        lock (gate)
        {
            token.ThrowIfCancellationRequested();
            if (job == null) job = new ProcessJob();
            var process = StartProcess(exe, args, directory, log, ollamaHost);
            owned.Add(process);
            job.Add(process);
            return process;
        }
    }

    private Process StartProcess(string exe, string args, string directory, string log, string ollamaHost)
    {
        var info = new ProcessStartInfo(exe, args)
        {
            WorkingDirectory = directory, UseShellExecute = false, CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true
        };
        if (ollamaHost != null) info.EnvironmentVariables["OLLAMA_HOST"] = ollamaHost;
        var process = new Process { StartInfo = info };
        process.OutputDataReceived += (s, e) => { if (log != null && e.Data != null) Log(Root, log, e.Data); };
        process.ErrorDataReceived += (s, e) => { if (log != null && e.Data != null) Log(Root, log, e.Data); };
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    internal void StopOwned()
    {
        lock (gate)
        {
            if (job != null) job.Dispose();
            job = null;
            foreach (var process in owned)
            {
                try
                {
                    if (!process.HasExited)
                    {
                        using (var kill = Process.Start(new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "taskkill.exe"),
                            "/PID " + process.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden }))
                            kill.WaitForExit(2000);
                    }
                }
                catch (InvalidOperationException) { }
                catch (System.ComponentModel.Win32Exception) { }
                finally { process.Dispose(); }
            }
            owned.Clear();
        }
    }

    private string DockerDesktop()
    {
        string install = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(docker), "..", ".."));
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string program = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        foreach (string folder in new[] { install, Path.Combine(local, "Programs", "DockerDesktop"), Path.Combine(program, "Docker", "Docker") })
        {
            string candidate = Path.Combine(folder, "Docker Desktop.exe");
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static string Find(string file)
    {
        foreach (string dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
        {
            if (String.IsNullOrWhiteSpace(dir)) continue;
            string candidate = Path.Combine(dir.Trim().Trim('"'), file);
            if (Path.IsPathRooted(candidate) && File.Exists(candidate)) return candidate;
        }
        return null;
    }

    internal static void Log(string root, string name, string message)
    {
        try
        {
            string dir = Path.Combine(root, ".state", "launcher");
            Directory.CreateDirectory(dir);
            lock (typeof(StackLauncher))
                File.AppendAllText(Path.Combine(dir, name + ".log"), DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + Environment.NewLine);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}

internal sealed class ProcessJob : IDisposable
{
    private IntPtr handle;

    internal ProcessJob()
    {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle == IntPtr.Zero) return;
        // JOBOBJECT_EXTENDED_LIMIT_INFORMATION is 144 bytes for this x64 launcher.
        var limits = new byte[144];
        Buffer.BlockCopy(BitConverter.GetBytes(0x00002000), 0, limits, 16, 4);
        if (!SetInformationJobObject(handle, 9, limits, (uint)limits.Length)) Dispose();
    }

    internal void Add(Process process)
    {
        if (handle == IntPtr.Zero) return;
        try { AssignProcessToJobObject(handle, process.Handle); }
        catch (InvalidOperationException) { }
        catch (System.ComponentModel.Win32Exception) { }
    }

    public void Dispose()
    {
        if (handle == IntPtr.Zero) return;
        CloseHandle(handle);
        handle = IntPtr.Zero;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(IntPtr job, int infoClass, byte[] info, uint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);
}
