# Portable Windows build

The portable distribution runs without Docker, Java, Python, Node.js, or WebView2.
It needs Windows 10/11 x64 and Microsoft Edge.

## Layout

```
MemoryLab/
├── MemoryLab.exe          WinForms launcher (starts/stops everything)
├── runtime/               jlink OpenJDK 17 runtime
├── backend/
│   └── memory-app.jar     Spring Boot, profile "portable", H2 file DB
├── docs/
│   ├── MemoryLabDocs.exe  PyInstaller onedir build
│   └── _internal/
├── nginx/
│   ├── nginx.exe
│   ├── conf/nginx.conf
│   ├── conf/mime.types
│   ├── logs/
│   └── temp/
├── app/                   p5/index.html + assets + vendor
├── data/
│   ├── db/                H2 memory.mv.db
│   ├── docs/              SQLite tutor.db + uploads
│   └── tmp/               JVM temp
├── stop.cmd
└── 使用说明.txt
```

Ports:

| Service | Port |
|---|---|
| Nginx / UI | 18080 |
| Spring Boot | 18081 |
| Flask docs | 15000 |

All bind to `127.0.0.1`.

## Build

Prerequisites: Windows, JDK 17, Maven, Python 3.12, PowerShell 7, curl.

```powershell
# Backend
cd backend
mvn -DskipTests package
cd ..

# Docs
cd docs-service
python -m pip install -r requirements.txt pyinstaller
pyinstaller --noconfirm --clean --onedir --name MemoryLabDocs `
  --distpath ..\desktop\portable\docs `
  --workpath $env:TEMP\memorylab-docs `
  --specpath $env:TEMP\memorylab-docs `
  --exclude-module torch --exclude-module pandas --exclude-module scipy `
  --exclude-module sklearn --exclude-module matplotlib `
  portable_entry.py
cd ..

# JRE
jlink --add-modules ALL-MODULE-PATH --strip-debug --no-header-files `
  --no-man-pages --compress=2 --output desktop\portable\runtime

# Nginx
curl.exe -L -o $env:TEMP\nginx.zip https://nginx.org/download/nginx-1.27.5.zip
Expand-Archive $env:TEMP\nginx.zip $env:TEMP\nginx -Force
Copy-Item $env:TEMP\nginx\nginx-1.27.5\* desktop\portable\nginx -Recurse

# App
Copy-Item p5\* desktop\portable\app -Recurse

# Launcher
csc /target:winexe /platform:x64 `
  /out:desktop\portable\MemoryLab.exe `
  /win32icon:desktop\build\icon.ico `
  desktop\win\PortableLauncher.cs
```

Then copy the runtime directories into a staging folder, add `使用说明.txt`
and `stop.cmd`, and zip. See `desktop/portable` after a build.

## Notes

- Launcher starts backend first, waits for `/api/v1/settings`, then docs
  (`/api/health`), then nginx (`/`).
- Closing the launcher calls `nginx -s stop` and terminates its own child
  processes.
- `-Djava.io.tmpdir` points inside `data/tmp` so Tomcat does not depend on a
  writable `%TEMP%`.
- The launcher opens Edge in `--app` mode. Edge is present on supported
  Windows versions; if it is missing, the default browser is used.
- The exe is unsigned. For public distribution, sign it with a trusted code
  signing certificate and timestamp it.
- `docs-service` uses PyMuPDF, which is AGPL-3.0. Keep the full source
  available and review AGPL obligations before commercial distribution.
