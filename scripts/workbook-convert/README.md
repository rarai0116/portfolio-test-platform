# workbook-convert

TestManager（問題データ管理アプリ）に入力した問題を、WorkbookApp（問題集スマホアプリ）が
読める形式へ変換する。

2 つのアプリは Firebase プロジェクトもデータモデルも別で、
**Firestore のドキュメント**を**Realtime Database のノード**と**Storage の画像バンドル**へ
組み替える必要がある。その変換をまとめたのがこのツール。

## 何をするか

| | TestManager（読む） | WorkbookApp（書く） |
| --- | --- | --- |
| 問題データ | Firestore `firstGrade` / `secondGrade` | RTDB `test/<grade>` |
| 画像 | Storage `original/<grade>/<key>.png` | Storage `assets/<grade>/b64/<key>.b64` |
| 画像バンドル | — | Storage `assets/<grade>/bzip/_.zip` |
| 画像メタデータ | — | RTDB `assets/<grade>/b64`、`assets/<grade>/bzip` |
| 出題画面 | — | Storage / RTDB `assets/common/html` |
| 起動に必要な状態 | — | Firestore `metadata/*`・`app/status` |
| 模擬アカウント | — | Auth（`mockAccounts.ts` が正本） |

変換の中身は 4 つ。

1. **フィールドの射影** … 持ち越すもの、派生させるもの、捨てるものを仕分ける
2. **数式の事前描画** … `ql-formula` の LaTeX を KaTeX の HTML へ展開する
3. **画像の縮小** … 8bit グレースケール + 縦横 1/2 へ落とす
4. **バンドルの生成** … 全画像を 1 つの zip にまとめる

## 前提

**両方のプロジェクトの emulator を同時に起動しておくこと。** ポートは重複しない。

| | TestManager | WorkbookApp |
| --- | --- | --- |
| Firestore | 8080 | 8581 |
| Storage | 9199 | 9699 |
| Realtime Database | （無し） | 9500 |

host が一つでも欠けていれば起動を拒否する。firebase-admin と同じく、
host 未設定のまま動くと本番へ向かう事故が起きうるため。

### 落とし穴: Storage emulator の一時ディレクトリは固定パス

firebase-tools の Storage emulator は blob 置き場を次の固定パスで持つ。
インスタンスごとにユニークにならない。

```js
return `${os.tmpdir()}/firebase/storage/blobs`;
```

2 つの emulator を同時に動かすと共有され、**先に終了したほうが後から export する
ほうの blob まで消す**（実際に export が ENOENT で落ちた）。
それぞれに別の `TMPDIR` を与えること。

```bash
TMPDIR=/path/to/tmp-target  firebase emulators:exec --project <workbook> ... "
  TMPDIR=/path/to/tmp-source firebase emulators:exec --project <test-manager> ... '<変換コマンド>'
"
```

### webview の入手元

`--webview-dir` に渡す `questionWebview.html` / `answerWebview.html` は
リポジトリ内の `apps/workbook-app/client/web/html/` にある。
ファイル自体に実プロジェクト名は含まれていない（メタデータ側にだけ含まれるが、
それは本ツールが生成し直す）。

### 変換結果の書き出し

変換は起動中の emulator へ書き込むだけなので、`--export-to` を渡さないと
ディスク上の export は作られない。Emulator Hub の `/_admin/export` へ依頼する。

## セットアップ

このディレクトリは**単体で完結している**。依存は `katex` だけで、リポジトリ内の他の
ファイルを `require` しない。読み書き先はすべて引数か環境変数で受け取る。

```bash
corepack pnpm -C scripts/workbook-convert install
```

**`katex` の版は TestManager 側と揃えること。**ずれると同じ LaTeX から別の HTML が
生成され、TestManager の画面と WorkbookApp の表示が食い違う。`package.json` では
完全一致で固定してある（`^` を付けない）。JSON はコメントを持てないため、この制約は
ここに書いている。

リポジトリのルートからは次でも叩ける。

```bash
corepack pnpm workbook-convert --dry-run ...   # 変換
corepack pnpm test:workbook-convert            # テスト（20 本）
```

## 使い方

まず `--dry-run` で移行可否を確認する。書き込みは行わない。

```bash
node scripts/workbook-convert/index.cjs --dry-run \
  --source-project <TestManager の projectId> \
  --target-project <WorkbookApp の projectId> \
  --source-firestore 127.0.0.1:8080 \
  --source-storage   127.0.0.1:9199 \
  --target-database  127.0.0.1:9500 \
  --target-storage   127.0.0.1:9699
```

問題が無ければ `--dry-run` を外して実行する。

### 引数

環境変数でも指定できる。引数が優先。

| 引数 | 環境変数 | 意味 |
| --- | --- | --- |
| `--source-project` | `CONVERT_SOURCE_PROJECT` | TestManager の projectId |
| `--target-project` | `CONVERT_TARGET_PROJECT` | WorkbookApp の projectId |
| `--source-firestore` | `CONVERT_SOURCE_FIRESTORE_HOST` | TestManager の Firestore host |
| `--source-storage` | `CONVERT_SOURCE_STORAGE_HOST` | TestManager の Storage host |
| `--target-database` | `CONVERT_TARGET_DATABASE_HOST` | WorkbookApp の RTDB host |
| `--target-storage` | `CONVERT_TARGET_STORAGE_HOST` | WorkbookApp の Storage host |
| `--grades` | — | 既定 `firstGrade,secondGrade` |
| `--webview-dir` | `CONVERT_WEBVIEW_DIR` | `questionWebview.html` / `answerWebview.html` のあるディレクトリ |
| `--target-firestore` | `CONVERT_TARGET_FIRESTORE_HOST` | WorkbookApp の Firestore host（seed に必要） |
| `--target-auth` | `CONVERT_TARGET_AUTH_HOST` | WorkbookApp の Auth host（seed に必要） |
| `--mock-accounts` | `CONVERT_MOCK_ACCOUNTS` | `mockAccounts.ts` へのパス（模擬アカウントの正本） |
| `--export-to` | `CONVERT_EXPORT_TO` | 変換後に emulator の内容を書き出す先 |
| `--target-hub` | `CONVERT_TARGET_HUB_HOST` | Emulator Hub host（`--export-to` に必要） |
| `--report-out` | — | レポートを JSON で書き出す |
| `--dry-run` | — | 書き込まず判定だけ行う |

**プロジェクト ID も bucket 名もこのツールは持たない。**すべて引数で受ける。

### 終了コード

| | 意味 |
| --- | --- |
| 0 | 変換できた |
| 1 | 実行できなかった（host 不足、接続失敗など） |
| 2 | 変換は走ったが、skip した問題か描画失敗がある |

2 はデータ側の不備を示す。レポートの `skipped` と `errors` を読むこと。

## レポートの読み方

```jsonc
{
  "grades": { "firstGrade": { "source": 60, "converted": 60, "images": 6 } },
  "formulasRendered": 92,
  "images": { "converted": 44, "bytesIn": 41487986, "bytesOut": 4600000, "missing": [] },
  "skipped": ["secondGrade/15: 本文が空, publicationYear が無い"],
  "errors":  ["firstGrade/3.text: KaTeX の描画に失敗: \\badcmd (…)"]
}
```

- `skipped` … 移行前チェックで落ちた問題。理由が併記される
- `errors` … 数式の描画に失敗した式。**HTML は書き換えずに残す**ので、黙って壊れることはない
- `images.missing` … `<img alt>` に対応する画像が Storage に無かったもの

## 移行前チェック

次のいずれかに当たる問題は skip する。

- 本文が空
- 選択肢の数が grade と合わない（firstGrade は 4、secondGrade は 5）
- `publicationYear` または `publicationNo` が無い（`parentbNo` を作れない）
- `subject` が無い
- 数式の描画に失敗した

## 変換の詳細

### フィールドの射影

| 区分 | フィールド |
| --- | --- |
| そのまま持ち越す | `active` `answerNumber` `answerText` `bigCategoryTag` `difficult` `grade` `isConvertibleQaa` `isNegativeAnswer` `nengo` `no` `parentNo` `smallCategoryTag` `subject` `testNo` `text` `themeTag` `year` と `ch1..N` / `answerText1..N` |
| 派生させる | `answer`（`answerNumber` の文字列）／ `parentHonbun`／`parentAnswerHonbun`／`parentbNo` |
| 固定する | `status` → `正常` |
| 捨てる | `id` `uuid` `autoCheck` `calibrationCheck` `isOriginal` `publicationYear` `publicationNo` `questionMetaFileName` `answerMetaFileName` `otherTags` `updatedAt` `isShuffleable` `createdAt` `deleted` `key` |

`parentbNo` は `<publicationYear>_<subject>_<publicationNo を 3 桁ゼロ埋め>`。

### 数式は「事前に描画する」

TestManager は数式を **中身が空の span** として保存する。

```html
<span class="ql-formula" data-value="\sigma_{\max}=\dfrac{N}{BH-bh}"></span>
```

WorkbookApp の webview は KaTeX の **CSS しか持たず、JS レンダラを含まない**。
つまりクライアント側では LaTeX が描画されない。ここで HTML を埋め込まないと
**数式が無表示になる**。

```html
<span class="ql-formula" data-value="..."><span contenteditable="false"><span class="katex">…
```

### 画像は 1/2 のグレースケールへ落とす

モバイル表示にはオリジナル解像度が要らない。8bit グレースケール化と縦横 1/2 の縮小で、
実測 **39.6MB → 4.4MB（11.1%）**になった。

縮小は単純間引きではなく **2×2 の平均**。線画の細線が消えるのを防ぐため。

`<img alt>` の 33 文字 key は **変換しない**。TestManager の key と WorkbookApp の
asset ノード key は同じ形式で、実データでも一致していた。

### Storage のパスはメタデータから組み立てられる

クライアントは `path` フィールドを URL としては使わない（参照箇所はコメントアウト済み）。
メタデータから組み立てる。

```js
const uri = `assets/${data.grade}/${data.folder}/${name}`;
```

`name` の決まり方が folder で違う。

| folder | `name` |
| --- | --- |
| `b64` | `${metadata.name}.b64` … **拡張子が要る** |
| `html` | `metadata.path` の最後のセグメント。`metadata.name` が `_lib_` で始まるなら `lib/` を前置 |

**ここがずれても変換は成功したように見え、実行時に 404 になるだけ**である。
実際に `.b64` を落として 36 枚すべてが取得できない状態を作った。
`convert.test.cjs` にクライアントの導出を再現した検査がある。

### 問題データだけでは起動しない

RTDB へ問題を入れても、クライアントは Firestore の値が無いと**例外もログも出さずに止まる**。

| 読む場所 | 無いとどうなるか |
| --- | --- |
| `metadata/appVersion` | `isVersionChecked` が立たず、ローディング画面から進まない |
| `metadata/<grade>LastUpdate` | `assets` / `html` / `test` が揃わないと state を設定しない |
| `app/status` | メンテナンス判定 |

何を入れるかは移植元の実データを読んで決めた。`metadata/mode` は**本番にも存在しない**ため
入れない。`appVersion` は既定で `"0"`（アプリ側の `CURRENT_VERSION` と文字列比較され、
大きいと更新モーダルが出て先へ進めない）。

模擬アカウントは `--mock-accounts` に渡す `mockAccounts.ts` を正本として読む。
移植元の `auth-seed` はコメントで「一致させること」と書いているだけで実際は二重管理
だった。読めなければ黙って既定値へ落ちずに止める。

### 出題画面の webview

`assets/common/html/{questionWebview,answerWebview}` を配置する。
**これが無いと出題画面そのものが表示されない。**
`--webview-dir` を渡さない場合はレポートの `errors` に記録する。

なお KaTeX のフォントは配信しない。webview は `./KaTeX_AMS-Regular.woff2` のように
相対パスで参照するが、移植元の実データでも `assets/<grade>/html` の該当エントリは
すべて削除済み（tombstone）で、フォントは配信されていない。本ツールも実データに揃える。
数式は代替フォントで描画される。

### 画像配信はバンドル経由

WorkbookApp は個別の画像を 1 枚ずつ取得しない。
`assets/<grade>/bzip/_.zip` を取得してローカルへ展開する。
**このバンドルを作らないと画像が一枚も表示されない。**

中身は既に圧縮済みの PNG を base64 にしたテキストなので、再圧縮しても縮まらない。
zip は stored（無圧縮）方式で作る。生成が単純になり、同じ入力から同じ書庫が得られる。

### `test/<grade>` は配列

Realtime Database は 0 始まりの連番キーを **JSON 配列**として扱う。
1 始まりのオブジェクトにすると型が変わり、配列を前提にしたコードが壊れうる。
0 始まりで詰め直す。`no` フィールドは元の値のまま残す（表示上の問題番号は変えない）。

## 対応する画像形式

`bitDepth=8` / `colorType=2(RGB)` または `6(RGBA)` / 非インターレース の PNG のみ。
これ以外は例外を投げて止まる（黙って壊れた画像を出さない）。

パレット PNG やインターレース PNG を扱う必要が出たら `pngToMobile.cjs` を拡張する。

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `index.cjs` | CLI |
| `convertTestData.cjs` | 変換本体（射影・検証・組み立て） |
| `renderFormulas.cjs` | 数式の事前描画 |
| `pngToMobile.cjs` | PNG のグレースケール化と縮小 |
| `zipBundle.cjs` | 画像バンドルの生成 |
| `emulatorIo.cjs` | Firebase Emulator 相手の読み書き |

`convertTestData.cjs` は I/O を引数で受け取る。emulator 以外を相手にする場合は
`emulatorIo.cjs` と同じ 4 つのメソッドを持つオブジェクトを渡せばよい。

## 依存

`katex` のみ。画像と zip の処理は Node 標準の `node:zlib` だけで書いてある。
