const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const { execFile, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')

const APP_URL = 'http://127.0.0.1:8080'
const HEALTH_URL = 'http://127.0.0.1:8080/api/v1/settings'
const DEFAULT_PROJECT = 'D:\\learn\\memory-app'

const DOCKER_CANDIDATES = [
  process.env.DOCKER_PATH,
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  'docker'
].filter(Boolean)

const DOCKER_DESKTOP_CANDIDATES = [
  process.env.DOCKER_DESKTOP_PATH,
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'Docker Desktop.exe'),
  'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe'
].filter(Boolean)

let win = null
let starting = false
let lastError = null
let dockerPath = null
let projectRoot = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function logFile() {
  return path.join(app.getPath('userData'), 'launcher.log')
}

function log(message) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${message}\n`, 'utf8')
  } catch {
    // 日志写不进去也不阻塞启动
  }
}

function sendStatus(message) {
  log(message)
  if (win && !win.isDestroyed()) {
    win.webContents.send('status', message)
  }
}

function exists(file) {
  try {
    return fs.existsSync(file)
  } catch {
    return false
  }
}

function run(command, args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      windowsHide: true,
      timeout,
      maxBuffer: 16 * 1024 * 1024
    }, (error, stdout, stderr) => {
      const output = `${stdout || ''}${stderr || ''}`.trim()
      if (error) {
        error.output = output
        reject(error)
      } else {
        resolve(output)
      }
    })
  })
}

function findDocker() {
  for (const candidate of DOCKER_CANDIDATES) {
    if (candidate !== 'docker' && exists(candidate)) {
      return candidate
    }
  }
  return 'docker'
}

async function dockerReady(docker) {
  try {
    await run(docker, ['info', '--format', '{{.ServerVersion}}'], 8000)
    return true
  } catch {
    return false
  }
}

async function startDockerDesktop() {
  const desktop = DOCKER_DESKTOP_CANDIDATES.find((candidate) => exists(candidate))
  if (!desktop) {
    throw new Error('未找到 Docker Desktop。请先安装并启动 Docker Desktop。')
  }
  log(`启动 Docker Desktop: ${desktop}`)
  const child = spawn(desktop, [], { detached: true, stdio: 'ignore', windowsHide: false })
  child.unref()
}

async function waitForDocker(docker) {
  for (let i = 0; i < 90; i++) {
    if (await dockerReady(docker)) {
      return
    }
    if (i % 3 === 0) {
      sendStatus(`等待 Docker 引擎启动… ${i * 2}s`)
    }
    await sleep(2000)
  }
  throw new Error('Docker 引擎 180 秒内未就绪。请手动打开 Docker Desktop 后重试。')
}

function configFile() {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), 'utf8'))
  } catch {
    return {}
  }
}

function saveConfig(config) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(configFile(), JSON.stringify(config, null, 2), 'utf8')
  } catch {
    // 忽略配置写入失败
  }
}

async function resolveProject() {
  const configured = readConfig().projectRoot
  const candidates = [
    process.env.MEMORY_APP_HOME,
    configured,
    DEFAULT_PROJECT
  ].filter(Boolean)

  for (const root of candidates) {
    if (exists(path.join(root, 'docker-compose.yml'))) {
      projectRoot = root
      saveConfig({ projectRoot: root })
      return root
    }
  }

  const result = await dialog.showOpenDialog(win, {
    title: '选择 memory-app 项目目录（包含 docker-compose.yml）',
    properties: ['openDirectory']
  })
  if (!result.canceled && result.filePaths[0]) {
    const root = result.filePaths[0]
    if (exists(path.join(root, 'docker-compose.yml'))) {
      projectRoot = root
      saveConfig({ projectRoot: root })
      return root
    }
  }
  throw new Error('没有找到 docker-compose.yml。请选择 memory-app 项目根目录。')
}

async function composeUp(docker, root) {
  sendStatus('启动 MySQL、后端和前端…')
  const compose = path.join(root, 'docker-compose.yml')
  try {
    const output = await run(docker, ['compose', '-f', compose, 'up', '-d'], 600000)
    if (output) {
      log(output.slice(-2000))
    }
  } catch (error) {
    const detail = (error.output || error.message || '').slice(-1500)
    throw new Error(`docker compose up 失败：${detail}`)
  }
}

function probe() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, { timeout: 1500 }, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

async function waitForApp() {
  for (let i = 0; i < 180; i++) {
    if (await probe()) {
      return
    }
    if (i % 5 === 0) {
      sendStatus(`等待应用响应… ${i}s`)
    }
    await sleep(1000)
  }
  throw new Error('应用 180 秒内未就绪。请打开日志查看 Docker 容器状态。')
}

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 340,
    resizable: false,
    maximizable: false,
    show: false,
    backgroundColor: '#1c1c1c',
    title: '记忆实验室',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    win = null
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith('file://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
  win.webContents.on('did-finish-load', () => {
    if (lastError) {
      win.webContents.send('startup-error', lastError)
    }
  })
  win.loadFile(path.join(__dirname, 'splash.html'))
}

async function loadApp() {
  lastError = null
  win.setResizable(true)
  win.setMaximizable(true)
  win.setMinimumSize(1080, 700)
  win.setSize(1440, 960)
  win.center()
  await win.loadURL(APP_URL)
  win.setTitle('记忆实验室')
}

function showError(error) {
  lastError = {
    message: error && error.message ? error.message : String(error),
    log: tailLog()
  }
  log(`启动失败：${lastError.message}`)
  if (!win || win.isDestroyed()) {
    return
  }
  win.setResizable(false)
  win.setMaximizable(false)
  win.setSize(620, 520)
  win.center()
  win.loadFile(path.join(__dirname, 'error.html'))
}

function tailLog() {
  try {
    const text = fs.readFileSync(logFile(), 'utf8')
    return text.slice(-4000)
  } catch {
    return ''
  }
}

async function startup() {
  if (starting) {
    return
  }
  starting = true
  try {
    sendStatus('检查 Docker…')
    dockerPath = findDocker()

    if (!(await dockerReady(dockerPath))) {
      sendStatus('Docker 没在运行，正在启动 Docker Desktop…')
      await startDockerDesktop()
      await waitForDocker(dockerPath)
    }

    const root = await resolveProject()
    await composeUp(dockerPath, root)
    sendStatus('服务已启动，正在等待应用就绪…')
    await waitForApp()
    sendStatus('打开应用…')
    await loadApp()
  } catch (error) {
    showError(error)
  } finally {
    starting = false
  }
}

async function stopStack() {
  if (!dockerPath || !projectRoot) {
    return
  }
  const answer = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['停止', '取消'],
    defaultId: 1,
    cancelId: 1,
    title: '停止本地服务',
    message: '停止 MySQL、后端和前端容器？',
    detail: '数据保存在 Docker 卷里，不会删除。下次打开应用会自动启动。'
  })
  if (answer.response !== 0) {
    return
  }
  try {
    await run(dockerPath, ['compose', '-f', path.join(projectRoot, 'docker-compose.yml'), 'stop'], 120000)
    dialog.showMessageBox(win, { type: 'info', message: '本地服务已停止。' })
  } catch (error) {
    dialog.showErrorBox('停止失败', (error.output || error.message || '').slice(-1000))
  }
}

function openDocker() {
  const desktop = DOCKER_DESKTOP_CANDIDATES.find((candidate) => exists(candidate))
  if (desktop) {
    spawn(desktop, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref()
  } else {
    shell.openExternal('https://www.docker.com/products/docker-desktop/')
  }
}

function buildMenu() {
  const template = [
    {
      label: '应用',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        { label: '在浏览器中打开', click: () => shell.openExternal(APP_URL) },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '服务',
      submenu: [
        { label: '打开 Docker Desktop', click: openDocker },
        { label: '停止本地服务', click: stopStack },
        { label: '打开日志目录', click: () => shell.openPath(app.getPath('userData')) }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    buildMenu()
    createWindow()
    startup()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  ipcMain.on('retry', () => {
    lastError = null
    if (win && !win.isDestroyed()) {
      win.loadFile(path.join(__dirname, 'splash.html'))
    }
    startup()
  })
  ipcMain.on('open-docker', openDocker)
  ipcMain.on('quit', () => app.quit())
}
