using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MemoryLabPortable
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            string log = Path.Combine(Path.GetDirectoryName(Application.ExecutablePath) ?? ".", "portable.log");
            try
            {
                File.AppendAllText(log, "[" + DateTime.Now.ToString("HH:mm:ss") + "] Main enter" + Environment.NewLine);
                Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs e)
                {
                    try { File.AppendAllText(log, "ThreadException: " + e.Exception + Environment.NewLine); } catch { }
                };
                AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
                {
                    try { File.AppendAllText(log, "Unhandled: " + e.ExceptionObject + Environment.NewLine); } catch { }
                };
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new PortableForm());
                File.AppendAllText(log, "[" + DateTime.Now.ToString("HH:mm:ss") + "] Main exit" + Environment.NewLine);
            }
            catch (Exception ex)
            {
                try { File.AppendAllText(log, "Main catch: " + ex + Environment.NewLine); } catch { }
            }
        }
    }

    internal sealed class PortableForm : Form
    {
        private const string Url = "http://127.0.0.1:18080/";
        private const string BackendHealth = "http://127.0.0.1:18081/api/v1/settings";
        private const string DocsHealth = "http://127.0.0.1:15000/api/health";

        private readonly string baseDir;
        private readonly Label status;
        private readonly Label detail;
        private readonly Button open;
        private readonly Button stop;
        private readonly ProgressBar progress;
        private readonly bool noUi;

        private Process backend;
        private Process docs;
        private Process nginx;
        private bool ownBackend;
        private bool ownDocs;
        private bool ownNginx;
        private bool closing;

        public PortableForm()
        {
            baseDir = Path.GetDirectoryName(Application.ExecutablePath) ?? ".";
            noUi = Array.IndexOf(Environment.GetCommandLineArgs(), "--no-ui") >= 0;
            Text = "Memory Lab";
            ClientSize = new Size(540, 250);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(12, 12, 12);
            ForeColor = Color.White;
            Font = new Font("Microsoft YaHei UI", 9f);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            Label title = new Label();
            title.Text = "MEMORY LAB";
            title.Font = new Font("Arial Black", 22f, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(230, 0, 18);
            title.AutoSize = true;
            title.Location = new Point(28, 22);
            Controls.Add(title);

            Label sub = new Label();
            sub.Text = "PORTABLE 便携版";
            sub.Font = new Font("Microsoft YaHei UI", 9f, FontStyle.Bold);
            sub.ForeColor = Color.FromArgb(247, 244, 238);
            sub.AutoSize = true;
            sub.Location = new Point(32, 64);
            Controls.Add(sub);

            status = new Label();
            status.Text = "正在启动本地服务…";
            status.ForeColor = Color.FromArgb(210, 210, 210);
            status.AutoSize = false;
            status.Location = new Point(32, 104);
            status.Size = new Size(475, 24);
            Controls.Add(status);

            detail = new Label();
            detail.Text = "首次启动会创建本地数据库";
            detail.ForeColor = Color.FromArgb(130, 130, 130);
            detail.AutoSize = false;
            detail.Location = new Point(32, 130);
            detail.Size = new Size(475, 22);
            Controls.Add(detail);

            progress = new ProgressBar();
            progress.Style = ProgressBarStyle.Marquee;
            progress.MarqueeAnimationSpeed = 30;
            progress.Location = new Point(32, 158);
            progress.Size = new Size(475, 4);
            Controls.Add(progress);

            open = new Button();
            open.Text = "OPEN 打开";
            open.Location = new Point(32, 186);
            open.Size = new Size(150, 38);
            open.FlatStyle = FlatStyle.Flat;
            open.FlatAppearance.BorderColor = Color.FromArgb(230, 0, 18);
            open.BackColor = Color.FromArgb(230, 0, 18);
            open.ForeColor = Color.White;
            open.Font = new Font("Microsoft YaHei UI", 9f, FontStyle.Bold);
            open.Click += delegate { OpenApp(); };
            open.Enabled = false;
            Controls.Add(open);

            stop = new Button();
            stop.Text = "STOP 停止并退出";
            stop.Location = new Point(196, 186);
            stop.Size = new Size(180, 38);
            stop.FlatStyle = FlatStyle.Flat;
            stop.FlatAppearance.BorderColor = Color.FromArgb(80, 80, 80);
            stop.BackColor = Color.FromArgb(30, 30, 30);
            stop.ForeColor = Color.FromArgb(220, 220, 220);
            stop.Click += delegate { Close(); };
            Controls.Add(stop);

            Label hint = new Label();
            hint.Text = "关闭此窗口会停止本地服务";
            hint.ForeColor = Color.FromArgb(110, 110, 110);
            hint.AutoSize = true;
            hint.Location = new Point(394, 198);
            Controls.Add(hint);

            Shown += async delegate { await StartAllAsync(); };
            FormClosing += OnFormClosing;
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            Log("closing");
            if (closing) return;
            closing = true;
            StopAll();
        }

        private void Log(string message)
        {
            try { File.AppendAllText(Path.Combine(baseDir, "portable.log"), "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + message + Environment.NewLine); } catch { }
        }

        private void SetStatus(string text, string sub)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action<string, string>(SetStatus), text, sub);
                return;
            }
            status.Text = text;
            if (sub != null) detail.Text = sub;
        }

        private async Task StartAllAsync()
        {
            try
            {
                Log("StartAllAsync base=" + baseDir + " noUi=" + noUi);
                string missing = MissingFiles();
                if (missing != null)
                {
                    Log("missing " + missing);
                    SetStatus("便携版文件不完整", missing);
                    return;
                }

                Directory.CreateDirectory(Path.Combine(baseDir, "data"));
                Directory.CreateDirectory(Path.Combine(baseDir, "data", "db"));
                Directory.CreateDirectory(Path.Combine(baseDir, "data", "tmp"));
                Directory.CreateDirectory(Path.Combine(baseDir, "data", "docs"));
                Directory.CreateDirectory(Path.Combine(baseDir, "data", "docs", "uploads"));

                await Task.Run(new Action(StartAll));

                Log("all services up");
                SetStatus("服务已就绪", "本地数据库已连接");
                progress.Style = ProgressBarStyle.Continuous;
                progress.Value = 100;
                open.Enabled = true;
                if (!noUi)
                {
                    OpenApp();
                    WindowState = FormWindowState.Minimized;
                }
            }
            catch (Exception ex)
            {
                Log("start failed: " + ex);
                StopAll();
                SetStatus("启动失败", ex.Message);
                progress.Style = ProgressBarStyle.Continuous;
                progress.Value = 0;
            }
        }

        private string MissingFiles()
        {
            string[] files =
            {
                Path.Combine(baseDir, "runtime", "bin", "java.exe"),
                Path.Combine(baseDir, "backend", "memory-app.jar"),
                Path.Combine(baseDir, "docs", "MemoryLabDocs.exe"),
                Path.Combine(baseDir, "nginx", "nginx.exe"),
                Path.Combine(baseDir, "app", "index.html")
            };
            foreach (string f in files)
            {
                if (!File.Exists(f)) return "缺少 " + f;
            }
            return null;
        }

        private void StartAll()
        {
            Log("StartAll begin");
            SetStatus("并行启动本地服务…", "后端 / 文档 / 网页同时启动");

            bool needBackend = !Up(BackendHealth);
            bool needDocs = !Up(DocsHealth);
            bool needNginx = !Up(Url);

            if (needBackend)
            {
                backend = StartProcess(Path.Combine(baseDir, "runtime", "bin", "java.exe"),
                    "-Xms128m -Xmx512m -XX:TieredStopAtLevel=1 -XX:+UseSerialGC -Djava.io.tmpdir=\"" + Path.Combine(baseDir, "data", "tmp") +
                    "\" -jar \"" + Path.Combine(baseDir, "backend", "memory-app.jar") +
                    "\" --spring.profiles.active=portable --server.port=18081",
                    baseDir,
                    new string[,] { { "MEMORYLAB_DATA", Path.Combine(baseDir, "data", "db") } });
                ownBackend = true;
            }

            if (needDocs)
            {
                docs = StartProcess(Path.Combine(baseDir, "docs", "MemoryLabDocs.exe"),
                    "",
                    Path.Combine(baseDir, "docs"),
                    new string[,]
                    {
                        { "DOCS_DATA_DIR", Path.Combine(baseDir, "data", "docs") },
                        { "DOCS_UPLOAD_FOLDER", Path.Combine(baseDir, "data", "docs", "uploads") },
                        { "MEMORY_API_URL", "http://127.0.0.1:18081/api/v1" },
                        { "DOCS_PORT", "15000" }
                    });
                ownDocs = true;
            }

            if (needNginx)
            {
                string nginxDir = Path.Combine(baseDir, "nginx");
                nginx = StartProcess(Path.Combine(nginxDir, "nginx.exe"),
                    "-p . -c conf/nginx.conf",
                    nginxDir,
                    null);
                ownNginx = true;
            }

            if (needBackend && !WaitFor(BackendHealth, 120000)) throw new Exception("后端没有在 120 秒内启动，请查看 data\\db 读写权限。");
            if (needDocs && !WaitFor(DocsHealth, 90000)) throw new Exception("文档服务没有在 90 秒内启动。");
            if (needNginx && !WaitFor(Url, 30000)) throw new Exception("网页服务没有在 30 秒内启动。");
        }

        private Process StartProcess(string file, string args, string workDir, string[,] env)
        {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = file;
            info.Arguments = args;
            info.WorkingDirectory = workDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            if (env != null)
            {
                for (int i = 0; i < env.GetLength(0); i++)
                {
                    info.EnvironmentVariables[env[i, 0]] = env[i, 1];
                }
            }
            Process p = Process.Start(info);
            if (p == null) throw new Exception("无法启动 " + file);
            return p;
        }

        private static bool WaitFor(string url, int timeoutMs)
        {
            Stopwatch sw = Stopwatch.StartNew();
            while (sw.ElapsedMilliseconds < timeoutMs)
            {
                if (Up(url)) return true;
                Thread.Sleep(700);
            }
            return false;
        }

        private static bool Up(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 1800;
                req.ReadWriteTimeout = 1800;
                req.Method = "GET";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return (int)res.StatusCode >= 200 && (int)res.StatusCode < 500;
                }
            }
            catch
            {
                return false;
            }
        }

        private void OpenApp()
        {
            try
            {
                string edge = FindEdge();
                if (edge != null)
                {
                    ProcessStartInfo info = new ProcessStartInfo(edge,
                        "--app=" + Url + " --window-size=1440,1000");
                    info.UseShellExecute = false;
                    Process.Start(info);
                }
                else
                {
                    Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true });
                }
            }
            catch
            {
                try { Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true }); } catch { }
            }
        }

        private static string FindEdge()
        {
            string[] paths =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe")
            };
            foreach (string p in paths) if (File.Exists(p)) return p;
            return null;
        }

        private void StopAll()
        {
            try
            {
                if (ownNginx)
                {
                    string nginxDir = Path.Combine(baseDir, "nginx");
                    try
                    {
                        ProcessStartInfo info = new ProcessStartInfo(Path.Combine(nginxDir, "nginx.exe"),
                            "-p . -s stop");
                        info.WorkingDirectory = nginxDir;
                        info.UseShellExecute = false;
                        info.CreateNoWindow = true;
                        using (Process p = Process.Start(info))
                        {
                            if (p != null) p.WaitForExit(3000);
                        }
                    }
                    catch { }
                    Kill(nginx);
                }
            }
            catch { }
            if (ownDocs) Kill(docs);
            if (ownBackend) Kill(backend);
            ownNginx = ownDocs = ownBackend = false;
        }

        private static void Kill(Process p)
        {
            try
            {
                if (p != null && !p.HasExited)
                {
                    p.Kill();
                    p.WaitForExit(3000);
                }
            }
            catch { }
        }
    }
}
