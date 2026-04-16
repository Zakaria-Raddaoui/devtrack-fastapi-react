const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const API_PORT = 8000;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const isDev = !app.isPackaged;
const APP_ICON = isDev
  ? path.resolve(__dirname, "assets", "favicon.png")
  : path.resolve(__dirname, "..", "frontend", "build", "favicon.png");

let backendProcess = null;

function choosePythonCommand() {
  return process.platform === "win32" ? "python" : "python3";
}

function createDesktopStorage() {
  const baseDir = path.join(app.getPath("userData"), "devtrack");
  const uploadsDir = path.join(baseDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return {
    baseDir,
    uploadsDir,
    dbPath: path.join(baseDir, "devtrack.db"),
  };
}

function waitForApi(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
          clearInterval(timer);
          resolve();
        }
      } catch (_) {
        // Keep polling.
      }

      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Backend startup timed out."));
      }
    }, 600);
  });
}

function startBackend() {
  const storage = createDesktopStorage();
  const backendCwd = path.resolve(__dirname, "..", "backend");
  const pythonCmd = choosePythonCommand();
  const env = {
    ...process.env,
    DATABASE_URL: `sqlite:///${storage.dbPath.replace(/\\/g, "/")}`,
    CORS_ALLOW_ORIGINS: "null,http://localhost:3000,http://127.0.0.1:3000",
    UPLOADS_DIR: storage.uploadsDir,
  };

  const args = [
    "-m",
    "uvicorn",
    "main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(API_PORT),
  ];

  if (isDev) {
    args.push("--reload");
  }

  backendProcess = spawn(pythonCmd, args, {
    cwd: backendCwd,
    env,
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  backendProcess.on("error", (err) => {
    dialog.showErrorBox("DevTrack backend failed", `${err.message}`);
  });

  backendProcess.stderr.on("data", (buf) => {
    const output = String(buf);
    if (output.trim()) {
      console.error("[devtrack-backend]", output);
    }
  });

  backendProcess.stdout.on("data", (buf) => {
    const output = String(buf);
    if (output.trim()) {
      console.log("[devtrack-backend]", output);
    }
  });
}

async function createMainWindow() {
  const isWindows = process.platform === "win32";
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    icon: APP_ICON,
    titleBarStyle: isWindows ? "hidden" : undefined,
    titleBarOverlay: isWindows
      ? {
          color: "#00000000",
          symbolColor: "#cbd5e1",
          height: 34,
        }
      : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    await window.loadURL("http://localhost:3000");
    return;
  }

  const buildIndexPath = path.resolve(
    __dirname,
    "..",
    "frontend",
    "build",
    "index.html",
  );
  await window.loadFile(buildIndexPath);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.whenReady().then(async () => {
  try {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.devtrack.desktop");
    }
    startBackend();
    await waitForApi();
    await createMainWindow();
  } catch (err) {
    dialog.showErrorBox(
      "DevTrack startup failed",
      `Could not start local backend.\n\n${err.message}\n\nEnsure Python 3.11+ is installed and dependencies are available.`,
    );
    app.quit();
  }
});
