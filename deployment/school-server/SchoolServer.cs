using System;
using System.IO;
using System.IO.Compression;
using System.Drawing;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Runtime.InteropServices;

internal static class SchoolServer {
    internal static string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "LogiCadeSchoolServer");
    [STAThread] private static int Main(string[] args) {
        if(args.Length>0 && args[0]=="--verify") {
            try { Payload.Read(true); return 0; } catch { return 1; }
        }
        bool first;
        using(var mutex=new Mutex(true,@"Global\LogiCadeSchoolServerManager",out first)) {
            if(!first) { MessageBox.Show("LogiCade Server Manager is already running. Check its window or tray icon."); return 0; }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ServerWindow(args.Length>0 && args[0]=="--start"));
        }
        return 0;
    }
}
internal static class Payload {
    internal static byte[] Read(bool checkEntries) {
        using(var fs=File.OpenRead(Application.ExecutablePath)) {
            if(fs.Length<48) throw new InvalidDataException("Setup payload missing.");
            fs.Position=fs.Length-48; var expected=new byte[32];ReadAll(fs,expected);
            var lengthBytes=new byte[8];ReadAll(fs,lengthBytes);long length=BitConverter.ToInt64(lengthBytes,0);
            var magic=new byte[8];ReadAll(fs,magic);
            if(Encoding.ASCII.GetString(magic)!="LGCADE01" || length<1 || length>1073741824 || length>fs.Length-48) throw new InvalidDataException("Invalid setup payload.");
            fs.Position=fs.Length-48-length;var data=new byte[(int)length];ReadAll(fs,data);
            using(var hash=SHA256.Create()) {
                var actual=hash.ComputeHash(data);int diff=0;for(int i=0;i<32;i++) diff|=actual[i]^expected[i];
                if(diff!=0) throw new InvalidDataException("The setup file is damaged. Copy the complete file again.");
            }
            if(checkEntries) using(var zip=new ZipArchive(new MemoryStream(data),ZipArchiveMode.Read)) {
                foreach(var entry in zip.Entries) {
                    SafePath(entry.FullName);
                    if(entry.Name==".env" || entry.FullName.Contains("/.state/")) throw new InvalidDataException("Private source data is not permitted in the installer.");
                    using(var stream=entry.Open()) { var buffer=new byte[65536];while(stream.Read(buffer,0,buffer.Length)>0) {} }
                }
            }
            return data;
        }
    }
    private static void ReadAll(Stream s,byte[] value) {
        int offset=0;while(offset<value.Length) {int n=s.Read(value,offset,value.Length-offset);if(n==0) throw new EndOfStreamException();offset+=n;}
    }
    internal static string SafePath(string relative) {
        if(Path.IsPathRooted(relative) || relative.Contains(":")) throw new InvalidDataException("Unsafe setup path.");
        string root=Path.GetFullPath(SchoolServer.Root).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
        string full=Path.GetFullPath(Path.Combine(root,relative.Replace('/',Path.DirectorySeparatorChar)));
        if(!full.StartsWith(root,StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Unsafe setup path.");return full;
    }
    internal static void Extract(Action<string> log) {
        Directory.CreateDirectory(SchoolServer.Root);
        var acl=new DirectorySecurity();acl.SetAccessRuleProtection(true,false);
        foreach(var sid in new string[]{"S-1-5-18","S-1-5-32-544",WindowsIdentity.GetCurrent().User.Value}) {
            acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid),FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
        }
        new DirectoryInfo(SchoolServer.Root).SetAccessControl(acl);
        log("Verifying and extracting the bundled application, games and assets...");
        byte[] data=Read(true);
        using(var zip=new ZipArchive(new MemoryStream(data),ZipArchiveMode.Read)) {
            foreach(var entry in zip.Entries) {
                string file=SafePath(entry.FullName);
                if(entry.FullName.EndsWith("/")) {Directory.CreateDirectory(file);continue;}
                Directory.CreateDirectory(Path.GetDirectoryName(file));
                using(var input=entry.Open()) using(var output=new FileStream(file,FileMode.Create,FileAccess.Write,FileShare.None)) input.CopyTo(output);
            }
        }
        string manager=Path.Combine(SchoolServer.Root,"LogiCadeServer.exe");
        if(!String.Equals(Path.GetFullPath(Application.ExecutablePath),manager,StringComparison.OrdinalIgnoreCase)) File.Copy(Application.ExecutablePath,manager,true);
        log("Application extracted. Existing database volumes and host secrets are preserved.");
    }
}
internal sealed class ServerWindow : Form {
    private TextBox email=new TextBox(),password=new TextBox {UseSystemPasswordChar=true};
    private TextBox link=new TextBox {ReadOnly=true,Dock=DockStyle.Fill};
    private RichTextBox output=new RichTextBox {ReadOnly=true,Dock=DockStyle.Fill,Font=new Font("Consolas",9)};
    private Label status=new Label {Text="Ready to prepare this PC.",AutoSize=true};
    private CheckBox gpu=new CheckBox {Text="Use NVIDIA GPU (requires a compatible installed driver)",AutoSize=true};
    private CheckBox auto=new CheckBox {Text="Start the server when this Windows account signs in",Checked=true,AutoSize=true};
    private Button install=new Button {Text="Install and set up",AutoSize=true},start=new Button {Text="Start server",AutoSize=true},stop=new Button {Text="Stop server",AutoSize=true};
    private NotifyIcon tray;
    private bool busy,running,allowClose;
    [DllImport("kernel32.dll")] private static extern uint SetThreadExecutionState(uint flags);
    internal ServerWindow(bool autoStart) {
        Text="LogiCade School Server";ClientSize=new Size(880,650);MinimumSize=new Size(800,600);StartPosition=FormStartPosition.CenterScreen;
        var top=new TableLayoutPanel {Dock=DockStyle.Top,AutoSize=true,Padding=new Padding(14),ColumnCount=2};
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,165));top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        AddRow(top,"Administrator email",email);AddRow(top,"Administrator password",password);
        top.Controls.Add(new Label {Text="New installations need a password with at least 12 characters. Existing servers keep their configured credentials.",AutoSize=true},0,2);top.SetColumnSpan(top.GetControlFromPosition(0,2),2);
        top.Controls.Add(gpu,0,3);top.SetColumnSpan(gpu,2);top.Controls.Add(auto,0,4);top.SetColumnSpan(auto,2);
        top.Controls.Add(new Label {Text="Internet is required for Docker images and the AI model. A Windows restart or campus IT approval may be needed. No existing laptop accounts are included.",AutoSize=true,MaximumSize=new Size(820,0)},0,5);top.SetColumnSpan(top.GetControlFromPosition(0,5),2);
        var commands=new FlowLayoutPanel {AutoSize=true,Dock=DockStyle.Top,Padding=new Padding(10)};
        var backup=new Button {Text="Create backup",AutoSize=true};var verify=new Button {Text="Test backup recovery",AutoSize=true};var local=new Button {Text="Open local game",AutoSize=true};var admin=new Button {Text="Open private admin",AutoSize=true};var logs=new Button {Text="Open server folder",AutoSize=true};
        commands.Controls.AddRange(new Control[]{install,start,stop,backup,verify,local,admin,logs});
        var publicRow=new TableLayoutPanel {Dock=DockStyle.Top,AutoSize=true,Padding=new Padding(14),ColumnCount=2};publicRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));publicRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        var copy=new Button {Text="Copy demo link",AutoSize=true};publicRow.Controls.Add(link);publicRow.Controls.Add(copy);
        var bottom=new FlowLayoutPanel {Dock=DockStyle.Bottom,AutoSize=true,Padding=new Padding(10)};bottom.Controls.Add(status);
        Controls.Add(output);Controls.Add(publicRow);Controls.Add(commands);Controls.Add(top);Controls.Add(bottom);
        tray=new NotifyIcon {Text="LogiCade School Server",Icon=SystemIcons.Application,Visible=true};
        var menu=new ContextMenuStrip();menu.Items.Add("Open Server Manager",null,(s,e)=>ShowManager());menu.Items.Add("Stop and exit",null,async(s,e)=>{if(busy)return;if(running) await Run("Stop");allowClose=true;Close();});tray.ContextMenuStrip=menu;tray.DoubleClick+=(s,e)=>ShowManager();
        install.Click+=async(s,e)=>await Run("Install");start.Click+=async(s,e)=>await Run("Start");stop.Click+=async(s,e)=>await Run("Stop");backup.Click+=async(s,e)=>await Run("Backup");
        verify.Click+=async(s,e)=>{using(var dialog=new OpenFileDialog {Filter="Database backups|*.dump",InitialDirectory=Path.Combine(SchoolServer.Root,"backups")})if(dialog.ShowDialog()==DialogResult.OK)await Run("VerifyBackup",dialog.FileName);};
        local.Click+=(s,e)=>Open("http://127.0.0.1:18000/app/");admin.Click+=(s,e)=>Open("http://127.0.0.1:18000/admin/");logs.Click+=(s,e)=>{if(Directory.Exists(SchoolServer.Root))Open(SchoolServer.Root);};
        copy.Click+=(s,e)=>{if(link.Text.StartsWith("https://")) Clipboard.SetText(link.Text);};
        FormClosing+=(s,e)=>{if(!allowClose && (running||busy)) {e.Cancel=true;Hide();tray.ShowBalloonTip(3000,"LogiCade server is running","The manager is in the tray. Use Stop and exit to stop it.",ToolTipIcon.Info);}};
        FormClosed+=(s,e)=>{SetThreadExecutionState(0x80000000);tray.Dispose();};
        var timer=new System.Windows.Forms.Timer {Interval=30000};timer.Tick+=async(s,e)=>{ReadLink();if(running&&!busy)await Run("Status");};timer.Start();
        Shown+=async(s,e)=>{if(File.Exists(Path.Combine(SchoolServer.Root,".env"))) {email.Enabled=password.Enabled=gpu.Enabled=false;status.Text="Existing server found. Use Start server.";}if(autoStart)await Run("Start");};
    }
    private void AddRow(TableLayoutPanel p,string title,Control c) {int row=p.RowCount++;p.Controls.Add(new Label {Text=title,AutoSize=true,Padding=new Padding(0,6,0,6)},0,row);c.Dock=DockStyle.Fill;p.Controls.Add(c,1,row);}
    private void ShowManager(){Show();WindowState=FormWindowState.Normal;Activate();}
    private void Open(string target){try{Process.Start(new ProcessStartInfo(target){UseShellExecute=true});}catch(Exception ex){Log(ex.Message);}}
    private void Log(string text) {
        if(IsDisposed)return;if(InvokeRequired){BeginInvoke(new Action<string>(Log),text);return;}
        output.AppendText(text+Environment.NewLine);output.SelectionStart=output.TextLength;output.ScrollToCaret();
        if(text.StartsWith("PUBLIC LINK: ")) link.Text=text.Substring(13).Trim();
        try {File.AppendAllText(Path.Combine(SchoolServer.Root,"setup.log"),DateTime.Now.ToString("s")+" "+text+Environment.NewLine);}catch{}
    }
    private void ReadLink(){try{string p=Path.Combine(SchoolServer.Root,"public-url.txt");if(File.Exists(p))link.Text=File.ReadAllText(p).Trim();}catch{}}
    private async Task Run(string action,string backupFile="") {
        if(busy)return;
        if(action=="Install" && !File.Exists(Path.Combine(SchoolServer.Root,".env")) && (email.Text.Trim().Length<3 || password.Text.Length<12)) {MessageBox.Show("Enter an administrator email and a password with at least 12 characters.");return;}
        busy=true;install.Enabled=start.Enabled=stop.Enabled=false;if(action!="Status")status.Text=action+" in progress...";SetThreadExecutionState(0x80000001);
        string input=Path.Combine(SchoolServer.Root,"setup-input.json");
        try {
            if(action=="Install") {
                await Task.Run(()=>Payload.Extract(Log));
                File.WriteAllText(input,new JavaScriptSerializer().Serialize(new {email=email.Text.Trim(),password=password.Text,gpu=gpu.Checked,startup=auto.Checked}),new UTF8Encoding(false));
            }
            if(!File.Exists(Path.Combine(SchoolServer.Root,"Manage-Server.ps1"))) throw new InvalidOperationException("Choose Install and set up first.");
            int code=await Task.Run(()=>Execute(action,input,backupFile));
            if(code==3010) {status.Text="Restart Windows, then open this setup again.";MessageBox.Show("Restart Windows to finish enabling WSL 2, then run this setup again. BIOS virtualization may need campus IT.","Restart required");}
            else if(code!=0) {status.Text="Setup needs attention. See the error in the log.";}
            else {
                if(action=="Install" || action=="Start") {running=true;ReadLink();status.Text="Server ready. Keep this PC online and signed in. Closing this window minimizes it to the tray.";if(action=="Install") {CreateShortcuts();email.Enabled=password.Enabled=gpu.Enabled=false;password.Clear();}}
                else if(action=="Stop") {running=false;link.Clear();status.Text="Server stopped. Study records are retained.";SetThreadExecutionState(0x80000000);}
                else if(action=="Status")status.Text="Server running. Keep this PC online and signed in.";
                else status.Text="Operation completed. See the log for details.";
            }
        } catch(Exception ex) {Log("ERROR: "+ex.Message);status.Text="Operation failed. See the log.";}
        finally {try{if(File.Exists(input))File.Delete(input);}catch{}busy=false;install.Enabled=start.Enabled=stop.Enabled=true;if(!running)SetThreadExecutionState(0x80000000);}
    }
    private int Execute(string action,string input,string backup) {
        string script=Path.Combine(SchoolServer.Root,"Manage-Server.ps1");
        string arguments="-NoProfile -ExecutionPolicy Bypass -File "+Quote(script)+" -Action "+action;
        if(action=="Install") arguments+=" -InputFile "+Quote(input);
        if(backup.Length>0)arguments+=" -BackupFile "+Quote(backup);
        var psi=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"),arguments){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=SchoolServer.Root};
        using(var p=new Process {StartInfo=psi}) {p.OutputDataReceived+=(s,e)=>{if(e.Data!=null)Log(e.Data);};p.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)Log(e.Data);};p.Start();p.BeginOutputReadLine();p.BeginErrorReadLine();p.WaitForExit();return p.ExitCode;}
    }
    private string Quote(string s){if(s.Contains("\"")||s.Contains("\r")||s.Contains("\n"))throw new ArgumentException("Invalid path");return "\""+s+"\"";}
    private void CreateShortcuts() {
        string desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        File.WriteAllText(Path.Combine(desktop,"LogiCade Local Game.url"),"[InternetShortcut]\r\nURL=http://127.0.0.1:18000/app/\r\n");
    }
}
