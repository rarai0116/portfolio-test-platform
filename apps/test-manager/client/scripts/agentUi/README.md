# agentUi CLI

起動済みの Electron に CDP でアタッチし、画面を観測・操作するための CLI です。
**このファイルがコマンド仕様の正本**です。Claude / Codex の Skill からはここを参照し、仕様を複製しません。

設計の正本は `docs/current/エージェントUI操作基盤_設計書.md` です。

## 現在の実装範囲

読み取り系（`doctor` / `state` / `snapshot` / `screenshot`）と書き込み系（`click` / `fill` / `press` / `select`）を実装済みです。

## 前提

### 1. `.env` の設定（人が行う）

`apps/client/.env` に次を追加します。**このファイルはエージェントが編集できません。**

```
demo_UI_AGENT_PORT=9222
```

- 未設定なら CDP ポートは開かず、CLI も動作しません（fail-closed）。
- ポート番号はコードに既定値を持ちません。変更する場合はこの値だけを変えます。
- 配布ビルド（`app.isPackaged`）では設定しても無効です。
- ネットワークに公開される環境では設定しないでください。

### 2. アプリと emulator の起動（人が行う）

**エージェントは起動・停止を行いません。** 未起動を検出したら人に依頼して停止します。

```bash
# クライアント
pnpm --filter client dev

# バックエンド（emulator）
pnpm --filter backend emulators:start
# 永続化する場合
pnpm --filter backend emulators:start:persist
```

`emulators:start:persist` は Ctrl+C によるクリーン終了が前提です。エージェントがプロセスを扱うとデータ破損の恐れがあるため、起動と停止は人に限定します。

### 3. ログイン

ログイン済みの状態を人が用意します。エージェントは認証操作を自動化しません。

## 実行方法

`apps/client` を作業ディレクトリとして実行します。

```bash
node ./scripts/agentUi/cli.cjs doctor
node ./scripts/agentUi/cli.cjs state
node ./scripts/agentUi/cli.cjs snapshot
node ./scripts/agentUi/cli.cjs click --role button --name "保存"
```

## コマンド

| コマンド | 種別 | 内容 |
|---|---|---|
| `doctor` | 読み取り | `demo_UI_AGENT_PORT` の有無、CDP 応答、emulator 各ポート応答、接続先環境、検出ウィンドウ一覧 |
| `state` | 読み取り | 対象ウィンドウの URL・ルート・タイトル、接続先環境、ログイン有無、検出ウィンドウ一覧 |
| `snapshot` | 読み取り | アクセシビリティツリー要約。操作対象の role と name を確認する主手段 |
| `screenshot` | 読み取り | 画面キャプチャを保存 |
| `click` | 書き込み | 要素をクリック |
| `fill` | 書き込み | 入力欄へ値を設定（`--value` 必須） |
| `press` | 書き込み | キー入力（`--key` 必須）。要素指定は任意 |
| `select` | 書き込み | ネイティブ `<select>` の選択（`--value` 必須） |

観測は `snapshot` を既定とし、`screenshot` は見た目の確認が必要なときだけ使います。

## オプション

| オプション | 内容 |
|---|---|
| `--target <main\|preview\|auth\|url:...>` | 操作対象。既定は `main` |
| `--role <role> [--name <name>]` | 要素指定（推奨） |
| `--testid <id>` | 要素指定 |
| `--selector <css>` | 要素指定 |
| `--text <text>` | 要素指定 |
| `--value <value>` | `fill` / `select` の値 |
| `--key <key>` | `press` のキー（例: `Enter`, `Escape`, `Control+S`） |
| `--out <dir>` | `screenshot` の出力先。既定は `_tmp/agent-ui/` |
| `--full-page` | `screenshot` をページ全体で撮る |
| `--max-chars <n>` | `snapshot` の最大文字数。既定 20000 |
| `--timeout-ms <ms>` | 操作のタイムアウト |
| `--allow-env non-emulator` | 非 emulator への書き込み許可要求（後述） |

要素指定は `--role` / `--testid` / `--selector` / `--text` の**いずれか 1 つだけ**を指定します。
複数指定、0 件一致、複数件一致はいずれも終了コード 4 になります。

### snapshot が大きい場合

画面によっては数 MB になります（開発用画面で 1.5MB を確認済み）。既定で 20000 文字に切り詰め、
`truncated: true` と `totalChars` を出力します。**`truncated: true` のときは全体を見たと判断しないでください。**
`--selector` で範囲を絞るのが基本です。

### Radix Select / react-select

`select` コマンドはネイティブ `<select>` 専用です。本アプリが多用する Radix Select や react-select は
`<select>` ではないため操作できません。`click` でトリガーを開き、`click` で選択肢を選んでください。

ウィンドウ種別の判定基準:

| 種別 | 判定 |
|---|---|
| `preview` | URL に `createPdfPreviewWindow` を含む |
| `auth` | URL に `#/auth` を含む |
| `main` | 上記以外の `http` / `file://` ページ |

## 出力

標準出力は常に単一の JSON オブジェクトです。人間向けの整形は行いません。

```json
{
  "ok": true,
  "command": "doctor",
  "exitCode": 0,
  "result": { }
}
```

失敗時は `error.kind`、`error.message`、`error.actions`（人に依頼すべき操作）を含みます。

## 終了コード

| コード | 意味 | エージェントの行動 |
|---|---|---|
| 0 | 成功 | — |
| 1 | 想定外エラー | 内容を報告する |
| 2 | 前提未達（ポート未設定、アプリ・emulator 未起動） | **自力で解決しない。** 人に起動を依頼して停止する |
| 3 | ポリシー拒否 | **フラグや環境変数を足して再試行しない。** 人に明示許可を求めて停止する |
| 4 | 対象ウィンドウ・要素が特定できない | 対象を開いた状態か確認する。憶測でセレクタを変えて連打しない |

## 接続先環境

`doctor` / `state` の `env` フィールドが返す値です。

| 値 | 意味 |
|---|---|
| `emulator` | Firebase emulator に接続している |
| `non-emulator` | emulator 以外（staging / production）に接続している |
| `unknown` | 環境マーカーを取得できない |

環境マーカーは preload が公開する読み取り専用の値で、CDP ポートが有効なときだけ存在します。

**staging と production は区別しません。** emulator 接続時も `projectId` が本番と同じ値を返すことを実測で確認しており、
projectId では区別できないためです。区別できないものを推測で緩めず、emulator 以外はすべて同じ扱いにします。

### 書き込みの許可方針

| 接続先 | 読み取り | 書き込み |
|---|---|---|
| `emulator` | 可 | 可 |
| `non-emulator` | 可 | **二重条件を満たしたときのみ**（原則使わない） |
| `unknown` | 可 | 不可 |

二重条件とは次の両方が揃うことです。片方だけでは拒否されます（終了コード 3）。

1. `--allow-env non-emulator` を指定する
2. 環境変数 `demo_UI_AGENT_ALLOW_ENV=non-emulator` を指定する

環境変数は **`.env` に書いても無効**です。CLI は `.env` 読み込み前の値だけを採用します。
人がその都度シェルで指定する運用を強制するためです。

**エージェントはこの二重条件を自分で満たしてはいけません。** hooks 側でも、`--allow-env` および
`demo_UI_AGENT_ALLOW_ENV` を含むコマンドは Claude では承認必須、Codex では拒否になります。
必要な場合は人が直接実行します。

## 関連

- `apps/client/scripts/diagnoseCreatePdfPreviewWindow.cjs`
  PDF プレビューのはみ出し検査に特化した既存の診断スクリプト。用途が異なるため統合していません。
