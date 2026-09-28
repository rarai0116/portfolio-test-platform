# HTMLサニタイズ実装設計書

## 1. 目的

本書は、問題データに含まれる HTML を保存時・編集時・プレビュー時に安全側へ正規化するための設計仕様を定義する。

今回の目的は以下とする。

- Firestore 保存データ由来の HTML を、そのまま DOM や Quill に流し込まない構成へ寄せる
- 既存の compact 化済み数式保存方式と両立する
- 既存データの表示互換を可能な限り維持する
- 危険なタグ・属性・style を許可制で除去する
- sanitize により除去した要素の理由を、ユーザーへダイアログ通知せず Google Analytics へ送信できるようにする
- allow list の不足を後から観測・調整できるようにする

---

## 2. 対象範囲

### 2.1 対象データ

- TestData の HTML フィールド
  - text
  - ch1 から ch5
  - answerText
  - answerText1 から answerText5

### 2.2 対象経路

- Firestore 読込後の renderer 内取り込み
- Quill へ貼り込む前の HTML 変換
- 保存直前の HTML 正規化
- PreviewPanel 表示前の HTML 正規化
- 画像 src の後段注入

### 2.3 対象外

- 一般的な自由入力 HTML エディタとしての完全互換
- 既存の全 HTML を無条件に保持すること
- sanitizer が弾いた要素をその場でユーザーへ通知する UI 実装
- backend 側での二重サニタイズ実装
  - 今回は renderer 保存経路に集約する
  - 将来的には backend 側再検証を追加可能な設計とする

---

## 3. 前提

### 3.1 現在の実装状態

- 数式は ql-formula + data-value の最小表現へ compact 化済み
- Preview 用の全件レンダリング検証は完了済み
- PreviewPanel 経路での KaTeX 描画確認は通過済み
- QuillEditor 側は manual harness に課題があるが、実機確認ベースで先へ進める方針

### 3.2 現在の課題

- HTML sink が複数箇所に分散している
- innerHTML / template.innerHTML / dangerouslyPasteHTML が存在する
- 画像は src を保存していないが、alt をキーとして後段で src を注入している
- Preview 側で HTML を文字列加工してから innerHTML へ入れる箇所がある

### 3.3 方針

今回のサニタイズは、"描画済み DOM をそのまま保存する" 設計をやめ、"保存用 canonical HTML を固定し、用途別に再構成する" 方式を採用する。

---

## 4. 基本方針

### 4.1 保存形式を canonical HTML に固定する

Firestore に保存してよい HTML は、次の条件を満たす canonical HTML に限定する。

- 数式は span.ql-formula[data-value] の最小表現のみ保存する
- img は src を保存しない
- img は識別子と表示に必要な最小属性のみ保存する
- Quill や KaTeX の描画済み DOM 全体は保存しない
- script / iframe / svg / math / style などの実行性・拡張性の高いタグは保存しない

### 4.2 sanitize は 1 モジュール 3 プロファイルで管理する

HTML サニタイズは 1 つのモジュールに集約し、以下の 3 プロファイルを持つ。

- sanitizePersistedHtml
  - 保存用 canonical HTML へ正規化する
- sanitizeForQuillImport
  - canonical HTML を Quill 表示用へ変換する
- sanitizeForPreviewRender
  - canonical HTML を Preview 表示用へ変換する

### 4.3 telemetry による拒否理由観測を標準機能にする

sanitize によりタグ・属性・style が除去された場合、ユーザー通知は行わない。
代わりに、拒否理由を構造化して renderer から main の telemetry service へ送信し、Google Analytics 4 へ記録する。

---

## 5. canonical HTML 仕様

### 5.1 保存を許可するタグ

- p
- br
- strong
- em
- u
- s
- sub
- sup
- span
- img
- ol
- ul
- li
- h1 から h6

### 5.2 保存を許可しないタグ

- script
- style
- iframe
- frame
- object
- embed
- svg
- math
- link
- meta
- form
- input
- button
- textarea
- select
- option
- video
- audio
- canvas
- template

### 5.3 許可する属性

共通:

- class

formula 用:

- data-value

img 用:

- alt
- title
- data-asset-key
- data-key
- width
- height
- style

### 5.4 許可する class

- ql-formula
- ql-align-center
- ql-align-right
- ql-align-justify
- ql-indent-1 から ql-indent-8

注記:

- KaTeX 描画済み DOM は保存しないため、katex 系 class は allow list に含めない
- Quill の内部編集補助 class は保存対象としない

### 5.5 許可する style

style 属性は img 要素にのみ許可し、以下の CSS property に限定する。

- width
- height
- max-width
- max-height
- display
- float
- margin

以下を含む style 値は全て除去する。

- url(
- expression(
- javascript:
- vbscript:
- data:

### 5.6 禁止属性

- src
- srcset
- href
- xlink:href
- on で始まる属性全て
- formaction
- action
- target
- rel
- id
- name
- aria-* のうち表示上不要なもの

注記:

- href は現行要件上不要のため全面禁止とする
- img の src は asset 解決後に runtime でのみ注入する

---

## 6. 数式と画像の扱い

### 6.1 数式

保存時:

- ql-formula[data-value] の最小表現へ compact する
- annotation や katex DOM は保存しない

Quill 表示時:

- sanitizePersistedHtml 実行後に formula を inflate する
- KaTeX は renderer 側で再描画する

Preview 表示時:

- sanitizePersistedHtml 実行後に formula を inflate する
- Preview 用 DOM へ入れる時点では既に安全化済みであることを前提にする

### 6.2 画像

保存時:

- img から src を除去する
- 識別子は alt を当面維持し、将来的に data-asset-key へ寄せる
- width / height / style は allow list に従って保存する

Preview 表示時:

- sanitizeForPreviewRender 後の DOM に対し、trusted な ImageAssetMap を使って src を setAttribute する
- 文字列置換で src を差し込まない

---

## 7. sanitize プロファイル仕様

### 7.1 sanitizePersistedHtml

責務:

1. legacy ql-formula / katex DOM を compact 可能な形へ寄せる
2. DOMPurify 相当の allow list でタグ・属性・style を絞る
3. 不要な class を除去する
4. img の src を除去する
5. 空 HTML を既存運用に合わせて空文字へ正規化する

戻り値:

- sanitizedHtml
- rejectionReport[]

### 7.2 sanitizeForQuillImport

責務:

1. sanitizePersistedHtml を先に通す
2. formula を Quill 表示用へ inflate する
3. 連続半角スペース / 全角スペースの既存正規化を適用する

### 7.3 sanitizeForPreviewRender

責務:

1. sanitizePersistedHtml を先に通す
2. formula を preview 表示用へ inflate する
3. src 未注入の安全な HTML を返す
4. 後段の realizeDomImages でのみ src を注入する

---

## 8. 導入境界

### 8.1 Firestore 読込直後

対象:

- renderer が TestData を store へ入れる前

目的:

- アプリ状態に危険な HTML を保持しない

### 8.2 Quill 取込直前

対象:

- prepareHtmlForQuillPaste
- dangerouslyPasteHtmlPreservingSpaces の入口

目的:

- dangerouslyPasteHTML に渡る文字列を常に sanitize 済みにする

### 8.3 保存直前

対象:

- applyCommonRulesToHtml
- save 実行直前の patch

目的:

- renderer 内の別経路混入があっても DB へ入る直前に canonical 化する

### 8.4 Preview 描画前

対象:

- exportHtmlForPreview
- PreviewPanel の HTML 差し替え helper

目的:

- Preview 側の innerHTML sink に未サニタイズ文字列を渡さない

---

## 9. 拒否理由レポート仕様

### 9.1 目的

sanitize で弾いた要素が、本当に不要な危険要素なのか、業務上必要な要素なのかを後から判断できるようにする。

また、旧エディタ由来で保存価値が低い既知ノイズについては、HTML は正規化しつつ fail 判定対象から外し、notification として継続観測できるようにする。

### 9.2 レポート単位

1 回の sanitize 呼び出しで発生した拒否内容を rejectionReport[] として返す。

### 9.3 レポート項目

- profile
  - persisted
  - quill-import
  - preview-render
- boundary
  - load
  - save
  - quill-paste
  - preview
- ruleCode
  - blocked-tag
  - blocked-attribute
  - blocked-class
  - blocked-style-property
  - blocked-style-value
  - stripped-src
  - formula-recovery-failed

  注記:

  - blocked-class / blocked-attribute / blocked-style-property のうち、旧エディタ由来の既知ノイズは notification 扱いに分類する
  - 例: class=active, class=ql-cursor, img style の zoom / white-space / color / background-color, span 系 style, width=null
- tagName
- attributeName
- className
- styleProperty
- reasonText
- itemId
  - 問題 ID。取得可能な場合のみ
- fieldName
  - text / ch1 など。取得可能な場合のみ
- route
  - renderer route
- sampleText
  - 最大 120 文字程度の短い抜粋
- sampleHash
  - 同一事象集約用
- occurredAt

### 9.4 sampleText の制約

- 問題文全文や個人情報らしき内容を送らない
- 最大 120 文字程度に切り詰める
- 可能ならタグ周辺の断片のみ抽出する
- 本文が長い場合は sampleHash を主とし、sampleText は短く保つ

---

## 10. telemetry 連携仕様

### 10.1 基本方針

- ユーザーへダイアログ通知はしない
- production では Google Analytics 4 へ送信する
- development では local log と console に記録する
- 同一拒否を大量送信しないため、rate limit と dedupe を行う

### 10.2 送信経路

renderer sanitize module
→ preload telemetry bridge
→ main telemetry service
→ TelemetrySender
→ Google Analytics 4 Measurement Protocol

### 10.3 event 設計

既存の app_crash と分離し、専用 event を追加する。

推奨:

- TelemetryEventName に html_sanitizer_rejection を追加
- TelemetryReason に sanitizer-rejected を追加

理由:

- クラッシュ系イベントと分析を分離できる
- allow list 調整用イベントを個別集計できる
- 将来、脆弱入力の傾向分析をしやすい

### 10.4 送信パラメータ

- process_type
- window_type
- route
- sanitize_profile
- sanitize_boundary
- rule_code
- tag_name
- attribute_name
- class_name
- style_property
- field_name
- item_id_hash
- sample_hash
- sample_text
- rejection_count
- occurred_at

注記:

- itemId はそのまま送らず、必要に応じて hash 化する
- sampleText は短く制限し、原文全文は送らない

### 10.5 送信頻度制御

同一 session 内で以下のキーが一致する rejection は集約対象とする。

- profile
- boundary
- ruleCode
- tagName
- attributeName
- className
- styleProperty
- sampleHash

送信ルール:

- 初回発生時に送信
- 以後は同一キーの件数を session memory で加算
- flush タイミングでまとめて送るか、一定件数ごとに送る

### 10.6 renderer からの報告 API

既存 telemetry bridge に、renderer error とは別の専用報告 API を追加する。

例:

- reportSanitizerRejection(payload)

payload は rejectionReport を 1 件または集約済み配列で受け付ける。

---

## 11. 実装責務分割

### 11.1 新規モジュール

候補:

- renderer/api/htmlSanitizer.ts

責務:

- allow list 定義
- sanitizePersistedHtml
- sanitizeForQuillImport
- sanitizeForPreviewRender
- rejectionReport 生成
- telemetry 送信用 payload 生成補助

### 11.2 既存モジュールの改修対象

- quillUtils.ts
  - prepareHtmlForQuillPaste
  - restoreHtmlFromQuill
  - exportHtmlForPreview
- testDataUtils.ts
  - applyCommonRulesToHtml
- imageRealizer.ts
  - Preview 用 DOM への src 注入を DOM ベースへ統一
- previewPanel.tsx
  - innerHTML 更新を共通 helper 経由に寄せる
- shared/types/telemetry.ts
  - eventName / reason / payload 型拡張
- main/services/telemetry
  - sanitizer rejection の受信・送信追加

### 11.3 sink 制御

innerHTML や dangerouslyPasteHTML を完全禁止にはしない。
ただし、以下の原則を課す。

- 未サニタイズ文字列を sink へ直接渡さない
- sink 直前の helper は SanitizedHtml 相当の型または明確な命名で区別する
- 文字列置換による src 注入は避け、DOM 操作で trusted data のみ注入する

---

## 12. 導入フェーズ

### Phase 1

- sanitizer モジュール新設
- persisted profile 実装
- save 直前への適用
- telemetry rejection 送信基盤追加

### Phase 2

- quill-import profile 実装
- dangerouslyPasteHTML の前段統一

### Phase 3

- preview-render profile 実装
- PreviewPanel と imageRealizer を DOM ベースへ統一

### Phase 4

- Firestore 読込直後の sanitize 適用
- legacy データの警告観測

---

## 13. テスト方針

### 13.1 sanitizer 単体テスト

正常系:

- ql-formula[data-value] を保持する
- img の alt / width / height / style を保持する
- ql-align-* / ql-indent-* を保持する
- p / br / strong / em / u / sub / sup / ol / ul / li を保持する

異常系:

- script を除去する
- iframe を除去する
- svg を除去する
- onerror / onclick を除去する
- style の url(...) を除去する
- img src を除去する
- href / javascript: を除去する

### 13.2 telemetry テスト

- blocked-tag が発生したら rejection event が組み立てられる
- 同一 rejection が dedupe される
- sampleText が上限長を超えない
- production 以外で GA 送信しない

### 13.3 統合確認

- 保存後の再読込で表示崩れがない
- Preview 全件レンダリング検証が通る
- 実機で数件の Quill 編集保存再読込が成立する
- sanitizer により拒否が発生した場合、ユーザー UI は止まらず telemetry のみ送られる

---

## 14. 受入基準

1. Firestore に保存される HTML が canonical HTML に統一される
2. Quill 取込前に sanitize 済み HTML のみが流れる
3. Preview 表示前に sanitize 済み HTML のみが流れる
4. img src は保存されず、trusted asset map からのみ復元される
5. sanitizer により除去した要素は rejectionReport に残る
6. production では rejection reason が Google Analytics へ送信される
7. 同一 rejection の大量送信が抑制される
8. Preview の全件表示確認が通る
9. 実機での数件の Quill 編集保存再読込が成立する

---

## 15. 未決事項

### 15.1 img 識別子

- alt 維持を続けるか
- data-asset-key へ移行するか

### 15.2 itemId の telemetry 扱い

- 生の問題 ID を送らず hash 化するか
- route / fieldName だけで十分か

### 15.3 backend 再サニタイズ

- renderer 保存経路だけで十分とするか
- backend / Functions 側でも persisted profile を再適用するか

### 15.4 Preview 側の文字列加工残存箇所

- innerHTML を使った番号付けや段落ラップ処理をどこまで DOM 操作へ寄せるか

---

## 16. 推奨実装順

1. htmlSanitizer.ts を新設する
2. persisted profile と rejectionReport を実装する
3. telemetry の sanitizer rejection event を追加する
4. applyCommonRulesToHtml へ sanitizePersistedHtml を導入する
5. quillUtils.ts の Quill / Preview 経路へ profile を適用する
6. imageRealizer.ts を DOM ベースへ統一する
7. Preview 全件検証を再実行する
8. 実機で数件の編集保存再読込を確認する
9. 観測された rejection をもとに allow list を必要最小限で調整する
