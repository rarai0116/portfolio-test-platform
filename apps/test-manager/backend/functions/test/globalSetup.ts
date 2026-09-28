import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import dotenv from 'dotenv';
const firebaseCli = require.resolve('firebase-tools/lib/bin/firebase.js');

dotenv.config({ path: `${__dirname}/../.env` });

let emulatorProcess: ReturnType<typeof spawn> | null = null;
let projectIdForTeardown = '';
let tearingDown = false; // 二重 teardown 防止
const PORTS = [8080, 9099, 9199, 4000, 4400];

function runFirebaseCli(args: string[], timeoutMs = 12000) {
  return new Promise<void>((resolve) => {
    const p = spawn(process.execPath, [firebaseCli, ...args], { stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} resolve(); }, timeoutMs);
    p.on('exit', () => { clearTimeout(t); resolve(); });
    p.on('error', () => { clearTimeout(t); resolve(); });
  });
}

async function waitForClose(child: ReturnType<typeof spawn>, timeoutMs = 12000) {
  try {
    await Promise.race([once(child, 'close'), new Promise((_, reject) => setTimeout(() => reject(new Error('close timeout')), timeoutMs))]);
    return true;
  } catch { return false; }
}

function isPortBusy(port: number, host = '127.0.0.1') {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { resolve(false); });
  });
}

async function waitForPortsToFree(ports: number[], timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const busyList = await Promise.all(ports.map((p) => isPortBusy(p)));
    if (busyList.every((busy) => !busy)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// 8080 を掴んでいる PID を特定して kill（Windows 専用の最終手段）
async function killListenersOnPortsWindows(ports: number[]) {
  if (process.platform !== 'win32') return;
  await new Promise<void>((resolve) => {
    const ns = spawn('netstat', ['-ano', '-p', 'tcp'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    ns.stdout.on('data', (d) => { buf += d.toString(); });
    ns.on('exit', async () => {
      const pids = new Set<number>();
      const lines = buf.split(/\r?\n/);
      for (const line of lines) {
        // 例:  TCP    127.0.0.1:8080   0.0.0.0:0   LISTENING   12345
        if (!/LISTENING/i.test(line)) continue;
        for (const port of ports) {
          if (new RegExp(`:(?:${port})\\s`, 'i').test(line)) {
            const m = line.trim().split(/\s+/);
            const pidStr = m[m.length - 1];
            const pid = Number(pidStr);
            if (!Number.isNaN(pid)) pids.add(pid);
          }
        }
      }
      for (const pid of pids) {
        await new Promise<void>((res) => {
          const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
          killer.on('exit', () => res());
          killer.on('error', () => res());
        });
      }
      resolve();
    });
  });
}

async function killProcessTree(pid: number) {
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    });
  } else {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
}

export const setup = async () => {
  console.log('Starting Firebase Emulator...');

  // FUNCTIONS_SECRETS が無い場合は demo-test-manager でフォールバック
  let projectId = '';
  let storageBucket = '';

  if (process.env.FUNCTIONS_SECRETS) {
    const secrets = JSON.parse(process.env.FUNCTIONS_SECRETS);
    projectId = String(secrets.projectId || '');
    storageBucket = String(secrets.storageBucket || '');
  }

  // env > フォールバックの順で決定
  projectId =
    projectId ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    'demo-test-manager';

  storageBucket = storageBucket || `${projectId}.appspot.com`;

  projectIdForTeardown = projectId;

  // IPv4 に固定
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';

  // 正しいキーで FIREBASE_CONFIG を設定（Admin SDK が参照）
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId, storageBucket });
  console.log('Using FIREBASE_CONFIG:', process.env.FIREBASE_CONFIG);

  emulatorProcess = spawn(process.execPath, [
    firebaseCli, 'emulators:start',
    '--only', 'auth,firestore,storage',
    '--project', projectId,
  ], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
  // 親プロセス終了時に後始末を保証（多重実行防止付き）
  const onExit = async () => { if (!tearingDown) { try { await teardown(); } catch {} } };
  process.once('SIGINT', onExit);
  process.once('SIGTERM', onExit);
  process.once('exit', onExit);

  await new Promise<void>((resolve, reject) => {
    if (!emulatorProcess || !emulatorProcess.stdout || !emulatorProcess.stderr) {
      return reject(new Error('Failed to spawn emulator process'));
    }
    emulatorProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('All emulators ready')) {
        console.log('Firebase Emulator is ready.');
        resolve();
      }
    });
    emulatorProcess.stderr.on('data', (data: Buffer) => { console.error(data.toString()); });
    emulatorProcess.on('error', (error: Error) => { console.error('Failed to start Firebase Emulator:', error); reject(error); });
  });
};

export const teardown = async () => {
  if (tearingDown) return;
  tearingDown = true;
  console.log('Stopping Firebase Emulator...');
  try {
    // 1) SIGINT で優雅に
    if (emulatorProcess && !emulatorProcess.killed) {
      emulatorProcess.kill('SIGINT');
      await waitForClose(emulatorProcess, 12000);
    }

    // 2) まずは待機してポートが空くか確認
    let freed = await waitForPortsToFree(PORTS, 15000);

    // 3) まだ埋まっていれば hub 経由で stop
    if (!freed && projectIdForTeardown) {
      console.log('Trying firebase emulators:stop ...');
      await runFirebaseCli(['emulators:stop', '--project', projectIdForTeardown], 12000);
      freed = await waitForPortsToFree(PORTS, 8000);
    }

    // 4) まだ埋まっていればプロセスツリーを強制 kill
    if (!freed && emulatorProcess?.pid) {
      console.log('Force killing emulator process tree...');
      await killProcessTree(emulatorProcess.pid);
      freed = await waitForPortsToFree(PORTS, 8000);
    }

    // 5) 最終手段: ポートを掴んでいる PID を検索して kill（Windows）
    if (!freed && process.platform === 'win32') {
      console.log('Killing listeners on ports (Windows)...');
      await killListenersOnPortsWindows(PORTS);
      await waitForPortsToFree(PORTS, 5000);
    }
  } finally {
    console.log('Firebase Emulator stopped.');
    emulatorProcess = null;
    projectIdForTeardown = '';
    tearingDown = false;
  }
};