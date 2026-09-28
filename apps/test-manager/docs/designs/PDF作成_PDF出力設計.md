# PDF作成 PreviewWindow起点PDF出力 設計書

## 1. 文書の位置づけ

- 工程: 要件整理・仕様策定
- 対象: PDF作成機能の PDF 出力方式見直し
- 主対象タスク:
  - T28 出力先フォルダ制御と PDF 出力
  - T38 模擬試験 PDF 出力の分割・命名規則・表紙構成
  - T48 模擬試験 PDF 品質調整
  - T49 問題集 PDF 品質調整
- 正本:
  - モード固定化仕様書（業務情報を含むため非公開）
  - PDF作成モードv2 タスク一覧（非公開）
  - PDF作成 T23・T45・T46 設計書（非公開）
- 本書は docs/current 上の設計書であり、現行仕様の正本として扱う

## 2. 今回の要求整理

今回の要求は次の通り。

- hidden BrowserWindow を PDF 出力専用に新設して再描画する方式は採らない
- 既に表示されている createPdf 用 PreviewWindow を PDF 出力元にする
- createPdf 用 PreviewWindow は iframe を使わない preview-only host とし、viewer document へ直接 fullRender する
- 今回の設計では、PreviewWindow は既に開いているものとして扱う
- PreviewWindow 未起動時の open 処理は別タスクで扱う
- T27 の JSON 読込 / 復元、および PDF 出力時の JSON 保存は今回スコープに含めない
- 最終的には preview 準備完了前は main panel 側で PDF 出力できない状態にしたい
- ただし現段階では、まず PDF 生成自体を成立させることを優先する
- preview issues の整理と「preview 準備完了を main panel が読む仕組み」は後続で扱う
- 既存の `fullRenderPreview` への変更は最小限に抑え、必要な差分は PreviewWindow host / bridge / export 層へ寄せる

### 2.1 今回の確認事項と決定

1. PreviewWindow は今回、開いているものとして扱う
2. createPdf 専用 PreviewWindow route / IPC は既存 preview と完全分離で進める
3. 画像未解決に関する warning 文言追加は今回のスコープに含めない
4. temp route でも正式 route と同じファイル命名規則で FIX する
5. 今回は PDF 出力に特化し、JSON 保存は別タスクで扱う
6. createPdf PreviewWindow は iframe を使わない fullRender host を前提にする
7. 既存の `fullRenderPreview` への変更は最小限に抑える

## 3. 既存実装との関係

### 3.1 既存の PreviewWindow

- 現在の `/previewWindow` route は testDataEditor 用であり、`@views/testDataEditor/templates/previewPanel` を表示する
- 既存 `preview:openWindow` IPC もこの route を開く前提で組まれている
- createPdf の preview は Dockview 内 panel として実装されており、Electron の別 window としてはまだ独立していない

### 3.2 createPdf 側で既に成立しているもの

- preview snapshot の local cache 保存と `creationType / slotKey / revision` 管理
- createPdf preview panel の full render 経路
- `renderExamPreview` は exam 出力後 DOM に `data-preview-group-id` / `data-preview-group-kind` を付与する
- exam のグループ分け
  - 問題用紙: 学科グループ単位
  - 解説用紙: 学科単位
- exam render 時の DOM には `data-preview-group-id` と `data-preview-group-kind` が付与される

### 3.3 現状不足しているもの

- createPdf 専用 PreviewWindow の route / IPC
- createPdf 専用 PreviewWindow の iframe なし preview-only host
- PreviewWindow から main へ返す export manifest
- PDF 出力 command 本体
- main panel から PreviewWindow の準備状態を読む仕組み

## 4. 方針

### 4.1 採用方針

PDF 出力の source of truth は createPdf 専用 PreviewWindow とする。

- PDF は PreviewWindow の `webContents.printToPDF()` で生成する
- 出力対象の HTML は「ユーザーに表示されている preview」と同一とする
- hidden BrowserWindow による再描画は行わない
- PreviewWindow 内では iframe を使わず、viewer document に対して直接 fullRender する
- 今回のスコープでは、PreviewWindow は既に open 済みであることを前提にする
- 対象 revision の render 完了を待ってから出力する
- 既存の `fullRenderPreview` への変更は最小限に抑え、viewer DOM 契約は host 側で合わせる
- 段階導入の第1段階では unit の `pagesRange` 指定を必須にせず、tempWorkbook の単一 PDF を `pagesRange` なし unit の印刷で成立させる
- その後に `pagesRange` 指定付き unit を導入し、tempExam の複数 PDF 出力へ拡張する

### 4.2 採らない方針

- export 専用 hidden BrowserWindow を別に持つ構成
- main window 内 Dockview panel の一部分だけを直接 `printToPDF()` する構成
- 初期段階から `pagesRange` 必須の manifest を強制する構成
- preview cache に pageRanges や export manifest を永続保存する構成

## 5. この方針を採る理由

- PreviewWindow の見た目と出力 PDF の見た目を一致させやすい
- export 専用 window の再描画・再同期・二重管理が不要になる
- T48 / T49 の紙面品質確認と出力元が一致する
- 現在の createPdf preview は renderer 側で完結した render 経路を持っているため、その成果物をそのまま印刷元に使う方が責務が素直
- tempWorkbook の単一 PDF は、`pagesRange` なし unit をそのまま印刷するだけで早期に成立させやすい
- exam の複数 PDF は後段で `pageRanges` を追加すればよく、初期段階から core render に export 専用責務を混ぜずに済む

## 6. スコープ

### 6.1 今回の設計スコープ

- createPdf 専用 PreviewWindow の新設方針
- createPdf 専用 PreviewWindow の iframe なし host 方針
- PDF 出力 command の責務分割
- workbook の単一 PDF 出力方式
- exam の 1view 分割出力方式（後段で `pagesRange` 指定を導入）
- tempExam / tempWorkbook からの出力導線

### 6.2 今回の設計では後続扱いにするもの

- preview issues の最終整理
- `loading-image` / `failed-image` を完全解決まで block する挙動
- main panel が preview 準備完了状態を見て PDF 出力ボタンを厳密制御する挙動
- PreviewWindow 未起動時の open / 再試行 / タイムアウト制御
- PDF 出力時の JSON 保存と JSON 読込 / 復元
- 紙面の納品品質調整全般

## 7. ユースケース

### 7.1 tempWorkbook から問題集 PDF を出力する

1. ユーザーが tempWorkbook で PDF 出力を押す
2. renderer は open 済み PreviewWindow が対象 `creationType=workbook`、`slotKey`、`revision` を描画完了するまで待つ
3. PreviewWindow が共通 export manifest を生成する（workbook unit は `pagesRange` を持たない）
4. main がその unit に `pagesRange` がないことを確認し、`printToPDF()` を 1 回だけ実行する
5. main が PDF を保存する

### 7.2 tempExam から模擬試験 PDF を出力する

1. ユーザーが tempExam で PDF 出力を押す
2. renderer は open 済み PreviewWindow が対象 `creationType=exam`、`slotKey`、`revision` を描画完了するまで待つ
3. PreviewWindow が exam 用に `pagesRange` 付き unit を含む export manifest を生成する
4. main が manifest の unit ごとに `pagesRange` から `pageRanges` を組み立てて `printToPDF()` を実行する
5. main が指定フォルダ配下に複数 PDF を保存する

## 8. 設計方針詳細

### 8.1 createPdf 専用 PreviewWindow を別 route / 別 IPC にする

既存の `/previewWindow` は testDataEditor 用であり、同一 route を流用すると責務が衝突する。

そのため、createPdf 専用に以下を追加する前提で進める。これは今回の決定事項として固定する。

- route
  - 例: `/createPdfPreviewWindow`
- renderer view
  - createPdf 用 PreviewWindowView
- main IPC
  - 例: `createPdfPreviewWindow:open`
  - 例: `createPdfPreviewWindow:close`
  - 例: `createPdfPreviewWindow:getStatus`

既存の `preview:openWindow` 系は testDataEditor 用として維持し、createPdf とは混在させない。

### 8.2 PreviewWindow は iframe を使わない preview-only host にする

今回追加する createPdf PreviewWindow は、Dockview 内 panel の iframe をそのまま流用しない。

- PreviewWindow 内では iframe を使わず、window.document 自体を preview 描画先として扱う
- host document は `viewer.html` / `viewer-exam.html` と同等の DOM 契約を満たし、その `Document` を `fullRenderPreview` に渡す
- CSS 分離は「PreviewWindow を preview-only の印刷面にする」ことで担保し、Dockview や通常画面の CSS を印刷面へ持ち込まない
- `fullRenderPreview` は既存 DOM 契約を前提とした再利用を優先し、既存の `fullRenderPreview` への変更は最小限に抑える
- 追加の export 用情報が必要な場合でも、まず PreviewWindow host / bridge / DOM 走査で吸収し、`fullRenderPreview` 本体へ責務を寄せない

補足:

- 単に既存 renderer の hash route を分けるだけでは、共有の global CSS 影響を完全には排除できない可能性がある
- iframe を使わず CSS 影響排除も求める場合、実装では preview-only entry または同等の document 初期化手段を採る前提で考える

### 8.3 PreviewWindow を export source of truth にする

main は preview cache から snapshot を直接印刷しない。

main が信頼するのは次の 2 点だけとする。

- PreviewWindow が現在表示している `creationType / slotKey / revision`
- PreviewWindow が render 完了後に返す export manifest

これにより、main が renderer の layout 実装詳細を持ち込まずに済む。

### 8.4 export manifest は共通型のまま段階導入にする

初期段階では tempWorkbook の単一 PDF を最優先とし、manifest に `pagesRange` を必須化しない。

- Step1 の manifest は共通型の unit だけを返し、workbook unit では `pagesRange` を省略する
- Step1 では main は `pagesRange` のない unit を通常の `printToPDF()` 呼び出しとして扱う
- Step2 以降で exam 向けに `pagesRange` 付き unit を返す
- main は `unit.pagesRange` がある場合のみ `pageRanges` を組み立てて `printToPDF()` へ渡す
- manifest の型は初期段階から 1 つに保ち、後続で互換性を壊さないようにする

### 8.5 export manifest は render 後 DOM から都度生成する

exam は item 単位 page map だけでは分割範囲を決められない。

理由:

- 共通表紙
- 白紙
- 中表紙

は item に紐づかず、`PageMapEntry` のみからは開始 / 終了ページを復元できないため。

そのため、manifest は persist せず、PreviewWindow の render 完了後 DOM から都度生成する。

## 9. 責務分割

### 9.1 renderer main panel 側

- 出力要求の起点だけを持つ
- 出力前警告を出す
- open 済み PreviewWindow を前提に export request を送る
- export request を main へ送る
- PDF 作成可否の最終制御は後続では preview 準備状態を参照するが、今回は必須条件にしない

### 9.2 createPdf PreviewWindow 側

- 対象 preview を表示する
- iframe を使わない preview-only host document を構築する
- `creationType / slotKey / revision` の一致を保証する
- render 完了を main へ通知する
- DOM から export manifest を生成する
- main からの export 要求に応じて manifest を返す

### 9.3 main 側

- PreviewWindow の open / close / status 管理
- 出力先フォルダ作成
- unit ごとに `pagesRange` の有無を見て `printToPDF()` または `printToPDF({ pageRanges })` を実行
- PDF 保存
- エラー整形と renderer への返却

## 10. 入出力仕様ドラフト

### 10.1 renderer -> main の export request

```ts
type CreatePdfExportRequest = {
  creationType: 'exam' | 'workbook';
  slotKey: string;
  expectedRevision: number;
  outputDirectory: string;
  includeCover: boolean;
};
```

### 10.2 PreviewWindow -> main の export manifest

```ts
type CreatePdfExportUnit = {
  unitId: string;
  kind: 'workbook' | 'exam-question' | 'exam-answer';
  groupId: string;
  fileName: string;
  pagesRange?: {
    start: number;
    end: number;
  };
};

type CreatePdfExportManifest = {
  creationType: 'exam' | 'workbook';
  slotKey: string;
  revision: number;
  units: CreatePdfExportUnit[];
};
```

- Step1 では workbook の 1 unit のみを返し、その unit は `pagesRange` を持たない
- Step2 以降では tempExam 用に複数 unit を返し、必要な unit にだけ `pagesRange` を設定する
- main は `unit.pagesRange` がある場合のみ `pageRanges: "${start}-${end}"` を組み立てて `printToPDF()` に渡す
- main は `unit.pagesRange` がない場合、同じ共通処理の中で `printToPDF()` を引数なしで呼ぶ

### 10.3 main -> renderer の export result

```ts
type CreatePdfExportResult =
  | {
      ok: true;
      outputFolderPath: string;
      files: string[];
    }
  | {
      ok: false;
      error: string;
    };
```

## 11. PreviewWindow 状態管理仕様ドラフト

### 11.1 今回必要な最小状態

PreviewWindow は少なくとも次を返せる必要がある。

```ts
type CreatePdfPreviewWindowStatus = {
  isOpen: boolean;
  isReady: boolean;
  creationType: 'exam' | 'workbook' | null;
  slotKey: string | null;
  revision: number | null;
  isRendering: boolean;
};
```

### 11.2 今回の待機条件

main または renderer は次の条件を満たすまで export を開始しない。

- window が open 済みであることを前提とする
- 対象 `creationType` が一致
- 対象 `slotKey` が一致
- 対象 `revision` が一致
- `isRendering === false`

PreviewWindow 未起動時の open / timeout / retry は今回のスコープ外とする。

## 12. exam の分割出力仕様

この章は後続段階の仕様であり、tempWorkbook の単一 PDF 出力成立後に導入する。

### 12.1 分割単位

正本どおり次を出力する。

- 問題用紙
  - 1級: 学科Ⅰ・Ⅱ / 学科Ⅲ / 学科Ⅳ・Ⅴ
  - 2級: 学科Ⅰ・Ⅱ / 学科Ⅲ・Ⅳ
- 解説用紙
  - 学科ごとに 1 ファイル

### 12.2 fileName

- 問題用紙: `問題用紙_{学科グループ}.pdf`
- 解説用紙: `解説用紙_{学科}（{学科名}）.pdf`

### 12.3 pagesRange の組み立て

PreviewWindow が render 済み DOM を走査し、同一 `data-preview-group-id` に属する section 群の先頭・末尾ページを数えて `pagesRange.start` / `pagesRange.end` を作る。

前提:

- question 側 cover / blank / middle cover / 本文 section すべてに `data-preview-group-id` が付く
- answer 側 cover / 本文 section に `data-preview-group-id` が付く

main は `pagesRange.start` / `pagesRange.end` から `pageRanges` 文字列を組み立てて `printToPDF()` に渡す。

### 12.4 注意点

- `pagesRange.start` / `pagesRange.end` は page 番号の飛びを含まない連続範囲であることを前提にする
- もし将来的に同一 group が非連続になる構造へ変わる場合は、この前提が崩れるため再設計が必要

## 13. workbook の出力仕様

### 13.1 分割単位

- 1回の出力で 1 PDF

### 13.2 fileName

- `問題集_{級}_{モード}_{タイトル}.pdf`

### 13.3 pagesRange

- Step1 では workbook の unit に `pagesRange` を持たせない
- PreviewWindow は workbook 1 unit と `fileName` を返し、main はその unit を `pagesRange` なしの印刷として扱う

## 14. 今回スコープ外の JSON 保存

- `出題条件.json` 保存は今回スコープに含めない
- T27 の JSON 読込 / 復元も今回スコープに含めない
- PDF 出力 command は JSON serializer / deserializer に依存しない構成で進める
- 後続で JSON 保存を再接続する場合は、T26 / T39 側の既存設計と整合を取る

## 15. 出力前の警告仕様

正本どおり次を維持する。

- `isDirtyConditions === true` のとき警告
- preview 健全性状態の `issues` が残っているとき警告

今回は次の扱いとする。

- PDF 生成成立を優先し、画像未解決専用の warning 文言追加は今回行わない
- preview issues 全体の扱い整理と、issue に応じた warning / block 制御は後続タスクで実装する
- 将来は `loading-image` など一部 issue を block 条件へ昇格する

## 16. tempExam / tempWorkbook からの導線

### 16.1 今回の方針

- tempExam / tempWorkbook からも同一 export command を呼ぶ
- temp route 専用の export 実装は持たない
- routeMode から `creationType / slotKey` の解決だけを切り替える

### 16.2 後続との整合

- 正式な exam / workbook panel へ移行しても export hook は再利用する
- temp route 削除時は UI 導線だけ整理すればよい構成を目指す

## 17. 実装単位案

### Step 1: 出力基盤をまとめて作る（旧 Step A + B + D + C）

- createPdf 専用 PreviewWindow の route / IPC / status 取得を追加する
- PreviewWindow を iframe なしの preview-only host として成立させる
- 対象 revision の render 完了通知を追加する
- 共通 export manifest を追加する
- main 側に単発 `printToPDF()` の出力 command を追加する
- この段階では manifest に `pagesRange` を要求しない
- この段階でも、既存の `fullRenderPreview` への変更は最小限に抑える

### Step 2: tempWorkbook で単一 PDF を end-to-end で成立させる

- tempWorkbook から export command を呼べるようにする
- warning dialog と result 表示を接続する
- `pagesRange` なしの workbook unit を 1 ファイル出力できるようにする

### Step 3: pagesRange 指定を導入し、tempExam の複数 PDF 出力に入る

- exam 用に `pagesRange` 付き unit を返せるようにする
- PreviewWindow の DOM 走査で group ごとの `pagesRange.start / pagesRange.end` を求める
- main が unit ごとに `pagesRange` から `pageRanges` を組み立てて `printToPDF()` を実行できるようにする
- tempExam から複数 PDF を出力できるようにする

### Step 4: 後続

- preview issues 整理
- block 条件の厳密化
- T48 / T49 の品質調整

## 18. 主要な懸念点

### 18.1 重大変更該当

以下は重大変更に該当し得る。

- main / preload / shared の新規 IPC 追加
- PreviewWindow 制御フローの追加

今回の PDF 専用スコープでは、JSON 保存まわりの I/F 追加は含めない。

設計段階では許容できるが、実装開始時は影響範囲を明示する必要がある。

### 18.2 PreviewWindow 依存の運用リスク

- window が閉じられた直後の export
- stale revision のまま印刷開始
- render 中の印刷開始
- オーバーレイや UI 部品が印刷対象に混ざる可能性
- open 済み前提のため、未起動時フォールバックがない
- visible window を印刷元にするため、出力中にユーザー操作や自動更新が割り込むと revision 不整合が起きる可能性がある

### 18.3 iframe を使わない前提での実装上の注意

- createPdf 専用 PreviewWindow を単なる既存 route の追加だけで済ませると、共有 global CSS の影響を完全には切れない可能性がある
- そのため、iframe を使わず CSS 影響も避けたいなら、preview-only entry または同等の document 初期化手段が必要になる
- これは route 追加だけより一段重い変更であり、main / preload / shared に加えて renderer 起動構成にも影響し得る
- ただし、この対応は host 層で吸収する方針とし、`fullRenderPreview` 本体にはできるだけ変更を入れない

### 18.4 段階導入による注意

- Step1 の `pagesRange` なし unit の印刷は tempWorkbook の単一 PDF には適するが、tempExam の複数 PDF にはそのまま使えない
- したがって、tempExam を扱う段階では `pagesRange` を持つ unit の導入が必須になる
- `pagesRange.start / end` は連続範囲しか表せないため、将来 1 unit 内に非連続ページを許す要件が出た場合は再設計が必要になる
- ただし現行の exam グループは連続範囲前提で扱えるため、現段階では optional な `pagesRange` だけで十分とする

### 18.5 画像未解決の暫定許容

今回は PDF 生成成立を優先して画像未解決 warning の追加を見送るが、画像未取得のまま印刷するとダミー画像が焼き込まれる可能性がある。

この点は後続で block 条件へ昇格する前提を仕様へ残す。

## 19. 今回の設計上の結論

- PDF 出力元は createPdf 専用 PreviewWindow とする
- PreviewWindow は必須とし、今回のスコープでは open 済み前提で扱う
- createPdf 専用 PreviewWindow route / IPC は既存 preview と完全分離で進める
- PreviewWindow は iframe を使わない preview-only host とし、viewer document へ直接 fullRender する
- 既存の `fullRenderPreview` への変更は最小限に抑える
- 初期段階の export manifest は unit の `pagesRange` を必須にせず、tempWorkbook の単一 PDF を `pagesRange` なし unit の印刷で成立させる
- 後続で `pagesRange` 付き unit を返せるようにし、tempExam の複数 PDF 出力へ拡張する
- temp route でも正式 route と同じファイル命名規則で FIX する
- 今回は PDF 出力に特化し、JSON 保存は含めない
- preview issues の厳密運用は後続で改善するが、まずは PDF 生成成立を優先する

## 20. 今回確定した事項

1. 今回、PreviewWindow は開いているものとして扱う。未起動時処理は別タスクで扱う
2. createPdf 専用 PreviewWindow route / IPC は既存 preview と完全分離で進める
3. 画像未解決の warning 文言追加は今回のスコープに含めない
4. temp route でも正式 route と同じファイル命名規則で FIX する
5. 今回は T28 を対象とし、T27 と JSON 保存は扱わない
6. createPdf PreviewWindow は iframe を使わない preview-only host とする
7. 既存の `fullRenderPreview` への変更は最小限に抑える
8. Step1 は `pagesRange` なし unit の印刷で tempWorkbook の単一 PDF を先に成立させる
9. `pagesRange` 指定による tempExam の複数 PDF 出力は後続段階で導入する