// 前提チェック。アプリと emulator が操作可能な状態かを確認するだけで、起動は行わない。
/** biome-ignore-all lint/style/useNodejsImportProtocol: 既存 scripts の記法に合わせる */

const fs = require('fs');
const path = require('path');

const {
  START_APP_ACTIONS,
  clientDir,
  preconditionError,
  probeHttp,
  probeTcpPort,
  resolveAgentPort,
} = require('../runtime.cjs');
const { classifyEnv, connect, listPages, readEnvMarker } = require('../connect.cjs');

// ポート定義は apps/backend/firebase.json を正とし、CLI 側に二重定義しない。
const readEmulatorPorts = () => {
  const firebaseJsonPath = path.resolve(
    clientDir,
    '../backend/firebase.json',
  );
  try {
    const config = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
    const emulators = config.emulators ?? {};
    return Object.entries(emulators)
      .filter(([, value]) => value && typeof value.port === 'number')
      .map(([name, value]) => ({ name, port: value.port }));
  } catch (error) {
    return { error: `firebase.json を読めませんでした: ${error.message}` };
  }
};

const run = async () => {
  const report = {
    agentPort: null,
    cdp: { endpoint: null, reachable: false },
    emulators: [],
    app: { env: 'unknown', projectId: null, windows: [] },
  };

  let port;
  try {
    port = resolveAgentPort();
    report.agentPort = port;
  } catch (error) {
    error.partial = report;
    throw error;
  }

  const endpoint = `http://127.0.0.1:${port}`;
  report.cdp.endpoint = endpoint;
  report.cdp.reachable = await probeHttp(`${endpoint}/json/version`);

  const emulatorPorts = readEmulatorPorts();
  if (Array.isArray(emulatorPorts)) {
    report.emulators = await Promise.all(
      emulatorPorts.map(async ({ name, port: emulatorPort }) => ({
        name,
        port: emulatorPort,
        reachable: await probeTcpPort(emulatorPort),
      })),
    );
  } else {
    report.emulators = emulatorPorts;
  }

  if (!report.cdp.reachable) {
    const error = preconditionError(
      `CDP エンドポイントが応答しません (${endpoint})。アプリが起動していないか、demo_UI_AGENT_PORT が反映されていません。`,
      START_APP_ACTIONS,
    );
    error.partial = report;
    throw error;
  }

  const { browser } = await connect();
  try {
    const entries = listPages(browser);
    report.app.windows = entries.map(({ kind, url }) => ({ kind, url }));

    const primary =
      entries.find((entry) => entry.kind === 'main') ?? entries[0] ?? null;
    if (primary) {
      const marker = await readEnvMarker(primary.page);
      report.app.env = classifyEnv(marker);
      report.app.projectId = marker?.projectId ?? null;
    }
  } finally {
    await browser.close();
  }

  // emulator 接続を宣言しているのに emulator が落ちている状態は前提未達として扱う。
  const downEmulators = Array.isArray(report.emulators)
    ? report.emulators.filter((entry) => !entry.reachable).map((e) => e.name)
    : [];
  if (report.app.env === 'emulator' && downEmulators.length > 0) {
    const error = preconditionError(
      `アプリは emulator に接続する設定ですが、応答しない emulator があります: ${downEmulators.join(', ')}`,
      START_APP_ACTIONS,
    );
    error.partial = report;
    throw error;
  }

  return report;
};

module.exports = { run };
