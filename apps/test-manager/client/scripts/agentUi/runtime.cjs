// agentUi CLI の共通ランタイム。終了コード、エラー種別、.env からのポート解決、JSON 出力を担う。
/** biome-ignore-all lint/style/useNodejsImportProtocol: 既存 scripts の記法に合わせる */

const fs = require('fs');
const net = require('net');
const path = require('path');

const clientDir = path.resolve(__dirname, '../..');
const defaultOutDir = path.join(clientDir, '_tmp', 'agent-ui');

// 非 emulator への書き込みを解除する環境変数は「人がその都度シェルで指定する」ことが要件。
// .env を読み込む前の値だけを採用し、.env に書かれた値が効かないようにする。
const shellAllowEnv = process.env.demo_UI_AGENT_ALLOW_ENV ?? null;

const EXIT = {
  OK: 0,
  UNEXPECTED: 1,
  PRECONDITION: 2,
  POLICY: 3,
  TARGET: 4,
};

class AgentUiError extends Error {
  constructor(kind, exitCode, message, actions) {
    super(message);
    this.name = 'AgentUiError';
    this.kind = kind;
    this.exitCode = exitCode;
    this.actions = actions ?? [];
  }
}

// 人が起動しないと解消しない失敗。エージェントは自力で解決してはならない。
const preconditionError = (message, actions) =>
  new AgentUiError('precondition', EXIT.PRECONDITION, message, actions);

// 接続先環境に対して許可されていない操作。フラグを足して再試行してはならない。
const policyError = (message, actions) =>
  new AgentUiError('policy', EXIT.POLICY, message, actions);

const targetError = (message, actions) =>
  new AgentUiError('target', EXIT.TARGET, message, actions);

const START_APP_ACTIONS = [
  'クライアント起動を人に依頼する: pnpm --filter client dev',
  'バックエンド起動を人に依頼する: pnpm --filter backend emulators:start',
  '永続化する場合: pnpm --filter backend emulators:start:persist',
];

// .env はこの CLI のプロセス内でのみ読み込む。値は出力に含めない。
let envLoaded = false;
const loadClientEnv = () => {
  if (envLoaded) return;
  envLoaded = true;
  try {
    // quiet: 標準出力を単一の JSON オブジェクトに保つため、dotenv のバナーを抑止する。
    require('dotenv').config({
      path: path.join(clientDir, '.env'),
      quiet: true,
    });
  } catch (error) {
    throw preconditionError(
      `.env を読み込めませんでした: ${error.message}`,
      ['apps/client で依存関係が利用できる状態か確認する'],
    );
  }
};

// ポート番号はコードに既定値を持たない。未設定なら機能ごと無効とする。
const resolveAgentPort = () => {
  loadClientEnv();
  const port = process.env.demo_UI_AGENT_PORT;
  if (!port) {
    throw preconditionError(
      'demo_UI_AGENT_PORT が設定されていません。CDP ポートは無効です。',
      ['apps/client/.env に demo_UI_AGENT_PORT を設定するよう人に依頼する'],
    );
  }
  return port;
};

const resolveEndpoint = () => `http://127.0.0.1:${resolveAgentPort()}`;

const probeTcpPort = (port, timeoutMs = 1500) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (reachable) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });

const probeHttp = async (url, timeoutMs = 2000) => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const ensureOutDir = (outDir) => {
  const resolved = outDir ? path.resolve(clientDir, outDir) : defaultOutDir;
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
};

const emitSuccess = (command, result) => {
  process.stdout.write(
    `${JSON.stringify({ ok: true, command, exitCode: EXIT.OK, result }, null, 2)}\n`,
  );
  return EXIT.OK;
};

const emitFailure = (command, error, result) => {
  const exitCode =
    error instanceof AgentUiError ? error.exitCode : EXIT.UNEXPECTED;
  const kind = error instanceof AgentUiError ? error.kind : 'unexpected';
  const actions = error instanceof AgentUiError ? error.actions : [];
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: false,
        command,
        exitCode,
        error: { kind, message: error.message, actions },
        result: result ?? null,
      },
      null,
      2,
    )}\n`,
  );
  return exitCode;
};

module.exports = {
  AgentUiError,
  EXIT,
  START_APP_ACTIONS,
  clientDir,
  emitFailure,
  emitSuccess,
  ensureOutDir,
  policyError,
  preconditionError,
  probeHttp,
  probeTcpPort,
  resolveAgentPort,
  resolveEndpoint,
  shellAllowEnv,
  targetError,
};
