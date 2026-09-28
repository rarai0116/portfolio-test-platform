/** biome-ignore-all lint/style/useNodejsImportProtocol: スクリプト運用のため */

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const clientDir = path.resolve(backendDir, '../client');
const importDir = path.join(backendDir, '_data_next');

const log = (...args) => console.log('[manual-preview-sanitize-audit]', ...args);

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      shell: process.platform === 'win32',
      env: { ...process.env, ...(options.env || {}) },
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        resolve({ code: 128, signal });
        return;
      }
      resolve({ code: code || 0 });
    });
    child.on('error', reject);
  });
}

function startBackground(cmd, args, options = {}) {
  return spawn(cmd, args, {
    stdio: 'inherit',
    cwd: options.cwd || process.cwd(),
    shell: process.platform === 'win32',
    env: { ...process.env, ...(options.env || {}) },
  });
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const tryConnect = () => {
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`port ${port} did not open within ${timeoutMs}ms`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
      socket.connect(port, host);
    };

    tryConnect();
  });
}

function ensurePortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => {
      reject(new Error(`port ${port} is already in use on ${host}`));
    });
    server.listen(port, host, () => {
      server.close(() => resolve());
    });
  });
}

async function stopBackground(child) {
  if (!child || child.killed) return;

  if (process.platform === 'win32') {
    await run('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      cwd: backendDir,
    }).catch(() => undefined);
    return;
  }

  child.kill('SIGINT');
}

async function main() {
  if (!fs.existsSync(importDir)) {
    console.error(
      '[manual-preview-sanitize-audit] _data_next が見つかりません。先に工程2を完了してください:',
      importDir,
    );
    process.exit(1);
  }

  log('step: build functions');
  {
    const { code } = await run('pnpm', ['run', 'build:functions'], {
      cwd: backendDir,
    });
    if (code !== 0) process.exit(code);
  }

  log('step: run client preview sanitize audit on emulators');
  await Promise.all([
    ensurePortAvailable(9099),
    ensurePortAvailable(8080),
    ensurePortAvailable(5001),
  ]);

  const emulatorProcess = startBackground(
    'pnpm',
    [
      'exec',
      'firebase',
      '--config',
      'firebase.json',
      'emulators:start',
      '--project',
      'demo-test-manager',
      '--import',
      './_data_next',
      '--only',
      'auth,firestore,functions',
    ],
    {
      cwd: backendDir,
      env: {
        USE_FIREBASE_EMULATOR: 'true',
        VITE_FIREBASE_PROJECT_ID: 'demo-test-manager',
      },
    },
  );

  try {
    await Promise.all([waitForPort(9099), waitForPort(8080), waitForPort(5001)]);
    const { code } = await run(
      'pnpm',
      ['run', 'test:manual:preview-sanitize-audit'],
      {
        cwd: clientDir,
        env: {
          USE_FIREBASE_EMULATOR: 'true',
          VITE_FIREBASE_PROJECT_ID: 'demo-test-manager',
        },
      },
    );

    process.exit(code || 0);
  } finally {
    await stopBackground(emulatorProcess);
  }
}

main().catch((error) => {
  console.error('[manual-preview-sanitize-audit] fatal:', error);
  process.exit(1);
});