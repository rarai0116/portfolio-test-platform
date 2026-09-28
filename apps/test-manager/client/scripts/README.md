# Client Scripts（apps/client/scripts）

このフォルダには、手動実行用の検証スクリプトを置きます。`pnpm build` / `electron-vite` のビルド対象には含まれません。

## agentUi/

起動済み Electron に CDP でアタッチして画面を観測・操作する CLI です。コマンド仕様の正本は
[agentUi/README.md](agentUi/README.md) を参照してください。

## verifyPdfPageMargin.cjs

PDF出力の「コンテンツが縮小されて出力される」不具合（実テンプレートの `@page` ルールに `margin` 指定が
無いと、Chromiumが内部的に確保するUAデフォルトの印刷マージン分だけ shrink-to-fit が発生する問題）の
回帰確認用スクリプトです。

経緯・原因の詳細は `docs/.ai-works/PDF出力_余白縮小バグ_設計ドラフト.md` を参照してください。

### 何を確認するか

実際の `viewer.html`（B5） / `viewer-exam.html`（A4）を直接読み込み、`ensurePdf.ts` の `'patch'`
モードと同内容のCSSを注入し、`createPdfExport.ts` と同じ `printToPDF` オプションで出力したPDFを
解析します。

- MediaBox（ページ寸法）が想定どおりか（±0.5mm許容）
- 50mm四方のキャリブレーションマークが、出力PDF上でも実際に50mm四方で描画されているか（±0.5mm許容、
  縮小されていないこと）
- 単一ページ／複数ページ（3ページ）／`pageRanges` 指定時のいずれでも上記が成立するか

`createPdfExport.test.ts` などの既存ユニットテストは `printToPDF` をモックしているため、この種の
Chromium側のレイアウト起因の縮小は検出できません。本スクリプトはその穴を埋める実機確認用です。

### 実行方法

プロジェクトルートまたは `apps/client` のどちらからでも実行できます（`apps/client` 配下で実行する例）。

```bash
pnpm verify:pdf-page-margin
```

直接 electron バイナリを指定して実行する場合:

```bash
pnpm electron ./scripts/verifyPdfPageMargin.cjs
```

### 出力の見方

- 各ケースごとに `[PASS]` / `[FAIL]` で結果を表示します。
- 生成したPDF・HTML・実行結果サマリ（`summary.txt`）はOS一時ディレクトリ（`os.tmpdir()`配下、
  `demo-pdf-page-margin-verify-*`）に書き出されます。リポジトリには含まれません。
- 1件でも `FAIL` があった場合、プロセスは終了コード `1` で終了します。

### 注意

- このスクリプトは Electron の `app` / `BrowserWindow` API を使用するため、**plain Node では実行できません**。
  `electron` バイナリ経由で実行してください（`pnpm verify:pdf-page-margin` はそのように構成済みです）。
- `ELECTRON_RUN_AS_NODE` 環境変数が設定された端末では、Electronがplain nodeとして起動し失敗します。
  その場合は環境変数を外してから実行してください。
- `createPdfExport.ts` の `printToPDF` 呼び出しオプションや `ensurePdf.ts` の `'patch'` モードCSSを
  変更した場合、本スクリプト内の `PRINT_OPTIONS` / `PATCH_STYLE` も追従して更新してください
  （スクリプト先頭にコメントで明記しています）。

## verifyAssetProtocolCache.cjs

画像アセットのカスタムプロトコル配信（`demo-asset://`）で、Chromium の HTTP cache と
protocol handler への到達がどう振る舞うかを確認する事前スパイクです。

設計上の根拠は
`docs/.ai-works/画像アセット_カスタムプロトコル配信移行_実装設計書_整理版.html`
の 3.4 / 3.5 / 11.1 / 14.4 を参照してください。

### 何を確認するか

一時 `userData` と非表示ウィンドウだけで完結し、製品profile・Firebase・ログインには依存しません。

- `?v=` 付きURLの初回読み込みで handler へ到達するか
- 同一ウィンドウ／別ウィンドウから同一URLを再読込したときの handler 再到達（cache hit有無だけでは合否にしない）
- 別ウィンドウからの `fetch()` の可否
- `r`（recoveryToken）を変えたURLで handler へ到達するか … **必須条件**
- ローカルファイル削除 + `session.defaultSession.clearCache()` 後の handler 到達を、
  同一document / `reload()` 後 / `reloadIgnoringCache()` 後 / 新規ウィンドウに分けて観測
- Electron / Chrome / Node のバージョン

### 実行方法

```bash
pnpm verify:asset-protocol-cache
```

### 出力の見方

- 必須条件は `[PASS]` / `[FAIL]`、参考観測は `[YES]` / `[NO]` で表示します。
- `handler到達=N` は、その手順で protocol handler が呼ばれた回数です。`0` は cache から返ったことを意味します。
- サマリ（`summary.txt`）と全観測のJSON（`result.json`）をOS一時ディレクトリ
  （`demo-asset-protocol-verify-*`）へ書き出します。リポジトリには含まれません。
- 必須条件に `FAIL` があった場合、終了コード `1` で終了します。

### 実測結果と判断（2026-07-30 / Electron 41.7.1 / Chrome 146.0.7680.216 / win32 x64）

`session.defaultSession.clearCache()` では、**既に同一URLを読み込んだ renderer プロセス内の
リソースcacheが残るため handler へ再到達しません**。`reload()` でも `reloadIgnoringCache()` でも
消えず、再到達するのは renderer プロセスが新しくなった場合（新規ウィンドウ・アプリ再起動）と
URLが変わった場合（`r` / `v` の変化）です。

URLは `v`（md5 / `updated_at_ms`）でキー付けされるため、残留cacheから返るのは常に同一versionの
バイト列であり、誤った内容が表示される経路はありません。`r` 方式は clearCache 直後でも確実に
handler へ到達します。このため「clearCache 後、既に開いているウィンドウが同一versionの画像を
表示し続ける（ローカルファイルは削除済み）」ことを残余リスクとして受容する判断のもとで、
本体実装を継続しました。

したがって本スクリプトの必須条件は「`r` 変更後の到達」と「新しい renderer プロセスでの
clearCache 後の到達」で判定し、同一document内の残留は既知挙動として記録するだけにしています。

参考として、`v`・`r` なしURL（`Cache-Control: no-cache`）も同一renderer内では2回目に handler へ
到達しません。`fetch()` は `file://` オリジンからのクロススキーム要求として CORS 拒否されます
（設計の privileges に `corsEnabled` を含めていないため。製品は画像を `img` でのみ読むため影響なし）。

### 注意

- Electron の `app` / `BrowserWindow` API を使うため **plain Node では実行できません**。
  `ELECTRON_RUN_AS_NODE` が設定された端末では起動に失敗するので、環境変数を外してから実行してください。
- 設計の privileges（`secure` / `stream` / `supportFetchAPI`）を主schemeとして検証します。
  主schemeで初回読み込みができなかった場合にだけ、原因切り分け用に `standard` を加えた
  比較scheme（`demo-asset-std`）で同じ手順を実行します。比較schemeは観測専用で、製品実装の候補ではありません。

## verifyAssetDbMigration.cjs

AssetDB の `deleted` 列 migration（設計6.1〜6.3 / 13.4）を**実SQLite**で検証する手動確認スクリプトです。

### なぜ vitest ではなくこのスクリプトなのか

`better-sqlite3` は `postinstall`（`electron-builder install-app-deps`）で Electron の ABI 向けに
ビルドされるため、plain Node で動く vitest からは実DBを開けません（`NODE_MODULE_VERSION` 不一致）。
そのため migration の実挙動確認はこのスクリプトが担当し、vitest 側には migration テストを置いていません。

`src/app/main/ipc/assetStorage/db.ts` を TypeScript API で commonjs へ transpile して読み込みます
（`db.ts` は内部importを持たないため単体で変換できます）。生成物は `_tmp/asset-db-migration` へ
一時的に置き、実行後に削除します。

### 何を確認するか

- 新規DBで activeメタが `deleted=0` になり、`deleted` 未指定の upsert が既存値を維持すること
- `markDeleted` がメタ情報を保持し、`local_file_path` / `status` / `last_error` だけを NULL にすること
- 行が無い `markDeleted` でも `deleted=1` の行を作ること、`markActive` が `0` へ戻すこと
- `clearAllLocal` / `clearLocalCacheEntry` が `deleted` を変更しないこと
- 旧schema（`deleted`列なし）のDBを開いたときに、既存行のメタ・ローカルパス・statusを保持したまま
  `deleted` が NULL（未確認）になること、再実行しても壊れないこと
- migration が失敗する状況では例外を投げて起動させないこと

### 実行方法

```bash
pnpm verify:asset-db-migration
```

`ELECTRON_RUN_AS_NODE` が設定された端末では Electron が plain node として起動して失敗するため、
環境変数を外してから実行してください。1件でも `FAIL` があれば終了コード `1` になります。

## diagnoseCreatePdfPreviewWindow.cjs

PDF作成 PreviewWindow の実表示を Chrome DevTools Protocol（CDP）経由で検査する手動診断スクリプトです。
既に開いている Electron の PreviewWindow に接続し、`.print-page` / `.print-firstpage` のページ境界から
`img` や `[data-item-id]` 要素がはみ出していないかを DOM の `getBoundingClientRect()` で確認します。

### 何を確認するか

- PreviewWindow が開いており、描画完了状態になっているか
- 描画済みページ数
- 指定ページ内の画像や問題要素がページ外へはみ出していないか
- `--no` 指定時は、表示上の `No．xx` から近い `data-item-id` を推定し、その問題に絞った候補
- 任意で PreviewWindow 全体のスクリーンショットと JSON レポート

### 前提

Electron を remote debugging port 付きで起動しておく必要があります。

```bash
pnpm run dev:debug-preview
```

ステージング相当の `dev:prod` と同じ条件で確認する場合:

```bash
pnpm run dev:prod:debug-preview
```

どちらも通常の `dev` / `dev:prod` は変更せず、診断時だけ `--remote-debugging-port=9222` と
`--remote-debugging-address=127.0.0.1` を付けて Electron を起動します。

### 実行方法

別ターミナルで `apps/client` 配下から実行します。

```bash
node ./scripts/diagnoseCreatePdfPreviewWindow.cjs --port 9222
```

p38（実ページ数 p42）付近の問題 No.68 を確認する例:

```bash
node ./scripts/diagnoseCreatePdfPreviewWindow.cjs --port 9222 --page 42 --no 68 --screenshot
```

表示上のページ番号で指定したい場合:

```bash
node ./scripts/diagnoseCreatePdfPreviewWindow.cjs --port 9222 --display-page 38 --no 68 --screenshot
```

出力先を明示する場合:

```bash
node ./scripts/diagnoseCreatePdfPreviewWindow.cjs --port 9222 --page 42 --no 68 --screenshot --out ./_tmp/preview-diagnose
```

### 出力の見方

- `result: PASS` の場合、指定範囲ではページ境界からのはみ出し候補は検出されていません。
- `result: FAIL` の場合、はみ出し候補のページ、要素、`itemId`、画像キー、上下左右のはみ出し量を表示します。
- `--screenshot` または `--out` を指定した場合、JSON レポートを出力します。
- `--screenshot` を指定した場合、PreviewWindow の full page スクリーンショットも保存します。

### 注意

- このスクリプトは既存の PreviewWindow を読み取るだけで、プレビュー更新や PDF 出力は実行しません。
- `--page` は表紙や目次を含む実ページ番号です。表示上のページ番号で指定したい場合は
  `--display-page` を使ってください。
- 実ページ番号から内部の描画ページ番号へは既定で `2` ページ差し引きます。PDF構成が変わった場合は
  `--actual-page-offset` で調整してください。
- CDP ポートはローカル検証用途に限定してください。外部からアクセスできる環境では開放しないでください。
