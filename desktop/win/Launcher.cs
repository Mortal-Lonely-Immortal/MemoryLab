using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MemoryLab
{
    internal static class Program
    {
        private const string CoreResource = "MemoryLab.WebView2.Core.dll";
        private const string WinFormsResource = "MemoryLab.WebView2.WinForms.dll";
        private const string LoaderResource = "MemoryLab.WebView2Loader.dll";

        [DllImport("kernel32.dll")]
        private static extern IntPtr GetConsoleWindow();

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool SetDllDirectory(string path);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr LoadLibrary(string path);

        [STAThread]
        private static void Main()
        {
            AppDomain.CurrentDomain.AssemblyResolve += ResolveWebView2;
            PrepareWebView2();

            IntPtr console = GetConsoleWindow();
            if (console != IntPtr.Zero)
            {
                ShowWindow(console, 0);
            }
            string fatalDir = Path.Combine(Path.GetDirectoryName(Application.ExecutablePath) ?? ".", "data");
            try { Directory.CreateDirectory(fatalDir); } catch { fatalDir = Path.GetTempPath(); }
            string fatal = Path.Combine(fatalDir, "fatal.log");
            try
            {
                File.AppendAllText(fatal, "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] Main start" + Environment.NewLine);
                Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs e)
                {
                    File.AppendAllText(fatal, e.Exception.ToString() + Environment.NewLine);
                };
                AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
                {
                    File.AppendAllText(fatal, Convert.ToString(e.ExceptionObject) + Environment.NewLine);
                };
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new LauncherForm());
            }
            catch (Exception ex)
            {
                try { File.AppendAllText(fatal, ex.ToString() + Environment.NewLine); } catch { }
            }
        }

        private static Assembly ResolveWebView2(object sender, ResolveEventArgs args)
        {
            try
            {
                string name = new AssemblyName(args.Name).Name;
                string resource = null;
                if (name == "Microsoft.Web.WebView2.Core") resource = CoreResource;
                else if (name == "Microsoft.Web.WebView2.WinForms") resource = WinFormsResource;
                if (resource == null) return null;
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
                {
                    if (stream == null) return null;
                    byte[] data = new byte[stream.Length];
                    int read = 0;
                    while (read < data.Length)
                    {
                        int n = stream.Read(data, read, data.Length - read);
                        if (n <= 0) break;
                        read += n;
                    }
                    return Assembly.Load(data);
                }
            }
            catch
            {
                return null;
            }
        }

        private static void PrepareWebView2()
        {
            try
            {
                string[] candidates = new string[]
                {
                    Path.Combine(Path.GetDirectoryName(Application.ExecutablePath) ?? ".", "data", "webview2"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MemoryLab", "webview2"),
                    Path.Combine(Path.GetTempPath(), "MemoryLab", "webview2")
                };
                string dir = null;
                foreach (string candidate in candidates)
                {
                    try
                    {
                        Directory.CreateDirectory(candidate);
                        dir = candidate;
                        break;
                    }
                    catch { }
                }
                if (dir == null) return;
                string loader = Path.Combine(dir, "WebView2Loader.dll");
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(LoaderResource))
                {
                    if (stream == null) return;
                    using (FileStream file = File.Create(loader))
                    {
                        stream.CopyTo(file);
                    }
                }
                SetDllDirectory(dir);
                LoadLibrary(loader);
            }
            catch
            {
                // External WebView2Loader.dll beside the exe remains a valid fallback.
            }
        }

    }

    public class LauncherForm : Form
    {
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        private const string AppUrl = "http://127.0.0.1:8080";
        private const string HealthUrl = "http://127.0.0.1:8080/api/v1/settings";
        private const string AppVersion = "2026.11.17.1";
        private const string AppResource = "MemoryLab.app.zip";

        private readonly Label logo;
        private readonly Label title;
        private readonly Label status;
        private readonly ProgressBar progress;
        private readonly Button retry;
        private readonly LinkLabel logLink;
        private WebView2 webView;
        private bool busy;
        private bool dockerDenied;
        private readonly bool demoMode = Array.IndexOf(Environment.GetCommandLineArgs(), "--demo") >= 0;
        private readonly bool extractOnly = Array.IndexOf(Environment.GetCommandLineArgs(), "--extract-only") >= 0;

        private string dockerPath;
        private string projectRoot;

        private static string dataDir;

        private static string DataDir
        {
            get
            {
                if (!string.IsNullOrEmpty(dataDir)) return dataDir;
                string[] candidates = new string[]
                {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MemoryLab"),
                    Path.Combine(Path.GetDirectoryName(Application.ExecutablePath) ?? ".", "data"),
                    Path.Combine(Path.GetTempPath(), "MemoryLab")
                };
                foreach (string candidate in candidates)
                {
                    try
                    {
                        Directory.CreateDirectory(candidate);
                        dataDir = candidate;
                        return candidate;
                    }
                    catch { }
                }
                dataDir = Path.GetTempPath();
                return dataDir;
            }
        }

        private static string LogPath
        {
            get { return Path.Combine(DataDir, "launcher.log"); }
        }

        private static string ProjectFile
        {
            get { return Path.Combine(DataDir, "projectRoot.txt"); }
        }

        public LauncherForm()
        {
            Text = "记忆实验室";
            ClientSize = new Size(460, 340);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(28, 28, 28);
            ForeColor = Color.White;
            Font = new Font("Microsoft YaHei", 9f);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            logo = new Label();
            logo.Text = "记";
            logo.Font = new Font("Microsoft YaHei", 30f, FontStyle.Bold);
            logo.BackColor = Color.White;
            logo.ForeColor = Color.FromArgb(28, 28, 28);
            logo.TextAlign = ContentAlignment.MiddleCenter;
            logo.SetBounds(198, 46, 64, 64);
            Controls.Add(logo);

            title = new Label();
            title.Text = "记忆实验室";
            title.Font = new Font("Microsoft YaHei", 15f, FontStyle.Bold);
            title.ForeColor = Color.White;
            title.TextAlign = ContentAlignment.MiddleCenter;
            title.SetBounds(30, 126, 400, 30);
            Controls.Add(title);

            status = new Label();
            status.Text = "正在准备本地服务…";
            status.Font = new Font("Microsoft YaHei", 9f);
            status.ForeColor = Color.FromArgb(184, 184, 184);
            status.TextAlign = ContentAlignment.MiddleCenter;
            status.SetBounds(30, 168, 400, 54);
            Controls.Add(status);

            progress = new ProgressBar();
            progress.Style = ProgressBarStyle.Marquee;
            progress.MarqueeAnimationSpeed = 30;
            progress.SetBounds(140, 232, 180, 4);
            Controls.Add(progress);

            retry = new Button();
            retry.Text = "重试";
            retry.Visible = false;
            retry.FlatStyle = FlatStyle.Flat;
            retry.FlatAppearance.BorderSize = 0;
            retry.BackColor = Color.FromArgb(31, 56, 100);
            retry.ForeColor = Color.White;
            retry.SetBounds(180, 250, 100, 32);
            retry.Click += async delegate { await StartAsync(); };
            Controls.Add(retry);

            logLink = new LinkLabel();
            logLink.Text = "打开日志";
            logLink.Visible = false;
            logLink.LinkColor = Color.FromArgb(160, 160, 160);
            logLink.ActiveLinkColor = Color.White;
            logLink.TextAlign = ContentAlignment.MiddleCenter;
            logLink.SetBounds(180, 290, 100, 20);
            logLink.LinkClicked += delegate { try { Process.Start("notepad.exe", LogPath); } catch { } };
            Controls.Add(logLink);

            Shown += async delegate { await StartAsync(); };
        }

        private void SetStatus(string message)
        {
            Log(message);
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(SetStatus), message);
                return;
            }
            status.Text = message;
        }

        private void SetError(string message)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string>(SetError), message);
                return;
            }
            status.ForeColor = Color.FromArgb(255, 180, 160);
            status.Text = message;
            retry.Visible = true;
            logLink.Visible = true;
        }

        private static void Log(string message)
        {
            try
            {
                Directory.CreateDirectory(DataDir);
                File.AppendAllText(LogPath, "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + message + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }

        private async Task StartAsync()
        {
            if (busy) return;
            busy = true;
            retry.Visible = false;
            logLink.Visible = false;
            status.ForeColor = Color.FromArgb(184, 184, 184);
            progress.Visible = true;

            try
            {
                if (demoMode)
                {
                    SetStatus("加载界面…");
                    await LoadWebView();
                    return;
                }

                if (extractOnly)
                {
                    SetStatus("解压内置应用…");
                    projectRoot = ResolveProject();
                    SetStatus("内置应用已就绪：" + projectRoot);
                    Log("extract-only 完成：" + projectRoot);
                    Close();
                    return;
                }

                SetStatus("检查本地服务…");
                if (Probe())
                {
                    SetStatus("本地服务已在运行，打开应用…");
                    await LoadWebView();
                    return;
                }

                SetStatus("检查 Docker…");
                dockerPath = FindDocker();
                if (!await DockerReady())
                {
                    if (dockerDenied)
                    {
                        throw new Exception("Docker 拒绝访问：请确认 Docker Desktop 已启动，并用当前登录用户直接双击本程序；不要用管理员或服务方式启动。");
                    }
                    SetStatus("Docker 没在运行，正在启动 Docker Desktop…");
                    StartDockerDesktop();
                    await WaitForDocker();
                }

                projectRoot = ResolveProject();
                SetStatus("启动 MySQL、后端和前端（首次会构建镜像）…");
                await ComposeUp();

                SetStatus("等待应用响应…");
                await WaitForApp();

                SetStatus("加载界面…");
                await LoadWebView();
            }
            catch (Exception ex)
            {
                Log("启动失败：" + ex);
                SetError("启动失败：" + ex.Message);
            }
            finally
            {
                busy = false;
            }
        }

        private string FindDocker()
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string[] candidates = new string[]
            {
                Environment.GetEnvironmentVariable("DOCKER_PATH"),
                Path.Combine(local, "Programs", "DockerDesktop", "resources", "bin", "docker.exe"),
                Path.Combine(programFiles, "Docker", "Docker", "resources", "bin", "docker.exe"),
                "docker"
            };
            foreach (string candidate in candidates)
            {
                if (!string.IsNullOrEmpty(candidate) && (candidate == "docker" || File.Exists(candidate)))
                {
                    return candidate;
                }
            }
            return "docker";
        }

        private void StartDockerDesktop()
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string[] candidates = new string[]
            {
                Environment.GetEnvironmentVariable("DOCKER_DESKTOP_PATH"),
                Path.Combine(local, "Programs", "DockerDesktop", "Docker Desktop.exe"),
                Path.Combine(programFiles, "Docker", "Docker", "Docker Desktop.exe")
            };
            foreach (string candidate in candidates)
            {
                if (!string.IsNullOrEmpty(candidate) && File.Exists(candidate))
                {
                    Log("启动 Docker Desktop: " + candidate);
                    Process.Start(new ProcessStartInfo(candidate) { UseShellExecute = true });
                    return;
                }
            }
            throw new Exception("未找到 Docker Desktop，请先安装并启动它。");
        }

        private async Task<bool> DockerReady()
        {
            try
            {
                Log("Docker CLI=" + dockerPath + " cwd=" + Directory.GetCurrentDirectory()
                    + " DOCKER_HOST=" + (Environment.GetEnvironmentVariable("DOCKER_HOST") ?? "")
                    + " DOCKER_CONTEXT=" + (Environment.GetEnvironmentVariable("DOCKER_CONTEXT") ?? ""));
                string output = await RunProcess(dockerPath, "info", 8000);
                Log("Docker info ok: " + (output.Length > 200 ? output.Substring(0, 200) : output));
                return true;
            }
            catch (Exception ex)
            {
                if (ex.Message.IndexOf("permission denied", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    dockerDenied = true;
                }
                Log("Docker 检查失败：" + ex.Message);
                return false;
            }
        }

        private async Task WaitForDocker()
        {
            for (int i = 0; i < 90; i++)
            {
                if (await DockerReady()) return;
                if (i % 3 == 0) SetStatus("等待 Docker 引擎启动… " + (i * 2) + "s");
                await Task.Delay(2000);
            }
            throw new Exception("Docker 引擎 180 秒内未就绪，请手动打开 Docker Desktop 后重试。");
        }

        private string EnsureEmbeddedApp()
        {
            string dir = Path.Combine(DataDir, "app");
            string marker = Path.Combine(dir, "app.version");
            try
            {
                if (File.Exists(Path.Combine(dir, "docker-compose.yml")) && File.Exists(marker)
                    && File.ReadAllText(marker).Trim() == AppVersion)
                {
                    Log("使用内置应用目录：" + dir);
                    return dir;
                }
            }
            catch { }

            try
            {
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(AppResource))
                {
                    if (stream == null) return null;
                    SetStatus("解压内置应用到本机…");
                    string tmp = dir + ".tmp";
                    if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
                    Directory.CreateDirectory(tmp);
                    using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
                    {
                        string tmpFull = Path.GetFullPath(tmp) + Path.DirectorySeparatorChar;
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            string target = Path.GetFullPath(Path.Combine(tmp, entry.FullName));
                            if (!target.StartsWith(tmpFull, StringComparison.OrdinalIgnoreCase)) continue;
                            if (string.IsNullOrEmpty(entry.Name))
                            {
                                Directory.CreateDirectory(target);
                                continue;
                            }
                            Directory.CreateDirectory(Path.GetDirectoryName(target));
                            using (Stream input = entry.Open())
                            using (FileStream output = File.Create(target))
                            {
                                input.CopyTo(output);
                            }
                        }
                    }
                    File.WriteAllText(Path.Combine(tmp, "app.version"), AppVersion, Encoding.UTF8);
                    if (Directory.Exists(dir)) Directory.Delete(dir, true);
                    Directory.Move(tmp, dir);
                    Log("内置应用解压完成：" + dir);
                    return dir;
                }
            }
            catch (Exception ex)
            {
                Log("内置应用解压失败：" + ex.Message);
                return null;
            }
        }

        private string ResolveProject()
        {
            string embedded = EnsureEmbeddedApp();
            string saved = "";
            try { if (File.Exists(ProjectFile)) saved = File.ReadAllText(ProjectFile).Trim(); } catch { }
            string[] candidates = new string[]
            {
                Environment.GetEnvironmentVariable("MEMORY_APP_HOME"),
                embedded,
                saved,
                @"D:\learn\memory-app"
            };
            foreach (string root in candidates)
            {
                if (!string.IsNullOrEmpty(root) && File.Exists(Path.Combine(root, "docker-compose.yml")))
                {
                    SaveProject(root);
                    return root;
                }
            }

            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择 memory-app 项目目录（包含 docker-compose.yml）";
                dialog.ShowNewFolderButton = false;
                if (dialog.ShowDialog(this) == DialogResult.OK)
                {
                    string root = dialog.SelectedPath;
                    if (File.Exists(Path.Combine(root, "docker-compose.yml")))
                    {
                        SaveProject(root);
                        return root;
                    }
                }
            }
            throw new Exception("没有找到 docker-compose.yml，请选择 memory-app 项目根目录。");
        }

        private void SaveProject(string root)
        {
            try
            {
                Directory.CreateDirectory(DataDir);
                File.WriteAllText(ProjectFile, root, Encoding.UTF8);
            }
            catch { }
        }

        private async Task ComposeUp()
        {
            string compose = Path.Combine(projectRoot, "docker-compose.yml");
            try
            {
                string output = await RunProcess(dockerPath, "compose -f \"" + compose + "\" up -d --build", 900000);
                if (!string.IsNullOrEmpty(output)) Log(output.Length > 3000 ? output.Substring(output.Length - 3000) : output);
            }
            catch (Exception ex)
            {
                throw new Exception("docker compose up 失败：" + ex.Message);
            }
        }

        private async Task WaitForApp()
        {
            for (int i = 0; i < 180; i++)
            {
                if (Probe()) return;
                if (i % 5 == 0) SetStatus("等待应用响应… " + i + "s");
                await Task.Delay(1000);
            }
            throw new Exception("应用 180 秒内未就绪，请打开日志查看 Docker 容器状态。");
        }

        private static bool Probe()
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(HealthUrl);
                request.Timeout = 1500;
                request.ReadWriteTimeout = 1500;
                request.KeepAlive = false;
                request.Proxy = null;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return (int)response.StatusCode == 200;
                }
            }
            catch
            {
                return false;
            }
        }

        private async Task LoadWebView()
        {
            if (webView == null)
            {
                webView = new WebView2();
                webView.Dock = DockStyle.Fill;
                webView.Visible = false;
                Controls.Add(webView);
            }

            string userData = Path.Combine(DataDir, "WebView2");
            Directory.CreateDirectory(userData);

            string debugPort = Environment.GetEnvironmentVariable("MEMORYLAB_DEBUG_PORT");
            CoreWebView2EnvironmentOptions options = null;
            if (!string.IsNullOrEmpty(debugPort))
            {
                options = new CoreWebView2EnvironmentOptions("--remote-debugging-port=" + debugPort);
            }
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, userData, options);
            await webView.EnsureCoreWebView2Async(environment);

            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e)
            {
                e.Handled = true;
                try { Process.Start(e.Uri); } catch { }
            };
            webView.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs e)
            {
                if (e.IsSuccess)
                {
                    ShowWebView();
                }
                else
                {
                    SetError("页面加载失败，请检查本地服务后重试。");
                }
            };

            webView.Source = new Uri(AppUrl);
        }

        private void ShowWebView()
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(ShowWebView));
                return;
            }
            logo.Visible = false;
            title.Visible = false;
            status.Visible = false;
            progress.Visible = false;
            retry.Visible = false;
            logLink.Visible = false;

            FormBorderStyle = FormBorderStyle.Sizable;
            MaximizeBox = true;
            MinimumSize = new Size(1100, 700);
            Rectangle area = Screen.FromControl(this).WorkingArea;
            Bounds = area;
            ShowWindow(Handle, 9);
            SetForegroundWindow(Handle);
            WindowState = FormWindowState.Normal;
            Activate();
            webView.Visible = true;
            webView.BringToFront();
            Text = "记忆实验室";
            Log("应用界面已加载");
        }

        private static Task<string> RunProcess(string file, string arguments, int timeout)
        {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = file;
            info.Arguments = arguments;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = false;
            info.RedirectStandardError = false;
            string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            if (!string.IsNullOrEmpty(profile))
            {
                info.WorkingDirectory = profile;
                info.EnvironmentVariables["DOCKER_CONFIG"] = Path.Combine(profile, ".docker");
            }

            using (Process process = new Process())
            {
                process.StartInfo = info;
                process.Start();
                if (!process.WaitForExit(timeout))
                {
                    try { process.Kill(); } catch { }
                    throw new Exception("命令超时：" + file + " " + arguments);
                }
                if (process.ExitCode != 0)
                {
                    throw new Exception("命令失败，退出码 " + process.ExitCode + "：" + file + " " + arguments);
                }
                return Task.FromResult("");
            }
        }
    }
}
