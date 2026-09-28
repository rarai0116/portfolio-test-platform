// 接続先環境に対する操作許可の判定（安全弁）。
//
// 疎通確認で、emulator 接続時も projectId が本番と同じ値を返すことが分かっている。
// projectId では staging と production を区別できないため、emulator 以外はすべて
// non-emulator として同一に扱い、常に人の明示許可を要求する。区別できないものを
// 推測で緩めない、という方針である。

const { policyError, shellAllowEnv } = require('./runtime.cjs');

// アプリ状態を変化させ得るコマンド。読み取り系はここに含めない。
const WRITE_COMMANDS = new Set(['click', 'fill', 'press', 'select']);

const ALLOW_ENV_VALUE = 'non-emulator';

const isWriteCommand = (command) => WRITE_COMMANDS.has(command);

// 書き込み操作の可否を判定する。許可されない場合は終了コード 3 で停止させる。
const assertWriteAllowed = ({ command, env, allowEnv }) => {
  if (!isWriteCommand(command)) return;

  if (env === 'emulator') return;

  if (env === 'unknown') {
    throw policyError(
      '接続先環境を判定できないため、書き込み操作を拒否しました。',
      [
        '環境マーカーが公開されているか doctor で確認する',
        'アプリが .env の demo_UI_AGENT_PORT を反映した状態で起動しているか人に確認する',
      ],
    );
  }

  // 以降は non-emulator（staging / production）。二重条件が揃ったときのみ許可する。
  const flagOk = allowEnv === ALLOW_ENV_VALUE;
  const envOk = shellAllowEnv === ALLOW_ENV_VALUE;

  if (!flagOk || !envOk) {
    throw policyError(
      `接続先が emulator ではないため、書き込み操作 (${command}) を拒否しました。`,
      [
        'エージェントは自力でこの条件を満たしてはならない。人に明示許可を求めて停止する',
        `人が許可する場合のみ: demo_UI_AGENT_ALLOW_ENV=${ALLOW_ENV_VALUE} を指定し、かつ --allow-env ${ALLOW_ENV_VALUE} を付けて実行する`,
        `現在: --allow-env=${allowEnv ?? '(なし)'} / demo_UI_AGENT_ALLOW_ENV=${shellAllowEnv ?? '(なし)'}`,
      ],
    );
  }
};

module.exports = { ALLOW_ENV_VALUE, assertWriteAllowed, isWriteCommand };
