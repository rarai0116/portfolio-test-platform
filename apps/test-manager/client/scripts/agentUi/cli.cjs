// エージェントが起動済み Electron を観測・操作するための入口。
// 使い方は apps/client/scripts/agentUi/README.md を参照。

const { EXIT, emitFailure, emitSuccess } = require('./runtime.cjs');

const COMMANDS = {
  doctor: require('./commands/doctor.cjs'),
  state: require('./commands/state.cjs'),
  snapshot: require('./commands/snapshot.cjs'),
  screenshot: require('./commands/screenshot.cjs'),
  click: require('./commands/click.cjs'),
  fill: require('./commands/fill.cjs'),
  press: require('./commands/press.cjs'),
  select: require('./commands/select.cjs'),
};

const VALUE_OPTIONS = new Set([
  '--target',
  '--role',
  '--name',
  '--testid',
  '--selector',
  '--text',
  '--value',
  '--key',
  '--out',
  '--timeout-ms',
  '--max-chars',
  '--allow-env',
]);

const BOOLEAN_OPTIONS = new Set(['--full-page']);

function parseArgs(argv) {
  const args = { target: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (BOOLEAN_OPTIONS.has(arg)) {
      args[arg.slice(2)] = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    // --value は空文字を許す（入力欄のクリア）ため、値の有無だけを見る。
    const value = argv[i + 1];
    if (value === undefined || (value.startsWith('--') && value !== '--')) {
      throw new Error(`${arg} requires a value.`);
    }
    i += 1;
    args[arg.slice(2)] = value;
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/agentUi/cli.cjs <command> [options]

Commands (読み取り):
  doctor      前提チェック（ポート設定、CDP 応答、emulator 応答、接続先環境）
  state       対象ウィンドウの URL・ルート・接続先環境・ログイン有無
  snapshot    アクセシビリティツリー要約（操作対象の role / name を確認する）
  screenshot  画面キャプチャを保存

Commands (書き込み。emulator 以外は人の明示許可が必要):
  click       要素をクリック
  fill        入力欄へ値を設定（--value）
  press       キー入力（--key）
  select      ネイティブ <select> の選択（--value）

Options:
  --target <main|preview|auth|url:...>   操作対象。既定は main
  --role <role> [--name <name>]          要素指定（推奨）
  --testid <id> | --selector <css> | --text <text>
                                         要素指定（いずれか 1 つ）
  --value <value>                        fill / select の値
  --key <key>                            press のキー
  --out <dir>                            screenshot の出力先
  --full-page                            screenshot をページ全体で撮る
  --timeout-ms <ms>                      操作のタイムアウト
  --max-chars <n>                        snapshot の最大文字数（既定 20000）
  --allow-env non-emulator               非 emulator への書き込み許可要求

Exit codes:
  0 成功 / 1 想定外 / 2 前提未達 / 3 ポリシー拒否 / 4 対象未特定

詳細は apps/client/scripts/agentUi/README.md を参照。
アプリと emulator の起動・停止はエージェントが行わず、人に依頼すること。
`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return EXIT.OK;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    return emitFailure(
      command,
      new Error(
        `Unknown command: ${command}. 使用可能: ${Object.keys(COMMANDS).join(', ')}`,
      ),
    );
  }

  let args;
  try {
    args = parseArgs(rest);
  } catch (error) {
    return emitFailure(command, error);
  }
  if (args.help) {
    printHelp();
    return EXIT.OK;
  }

  try {
    return emitSuccess(command, await handler.run(args));
  } catch (error) {
    return emitFailure(command, error, error.partial);
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.exitCode = emitFailure('cli', error);
  });
