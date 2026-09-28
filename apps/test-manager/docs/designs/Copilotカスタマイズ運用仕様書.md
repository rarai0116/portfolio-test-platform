---
mainfont: "Yu Gothic"
monofont: "MS Gothic"
CJKmainfont: "Yu Gothic"
mainlang: ja
geometry: margin=20mm
fontsize: 11pt
header-includes:
  - \usepackage{booktabs}
  - \usepackage{longtable}
  - \usepackage{tabularx}
  - \usepackage[table]{xcolor}
  - \definecolor{RowGray}{HTML}{F5F5F5}
  - \AtBeginEnvironment{longtable}{\rowcolors{2}{RowGray}{white}}
  - \usepackage{setspace}
  - \setstretch{1.27}
  - \setlength{\parskip}{6pt}
  - \renewcommand{\arraystretch}{1.3}
  - \usepackage{array}
  - \usepackage{enumitem}
  - \setlist[itemize]{label=\textbullet, leftmargin=14pt, itemsep=3pt, topsep=5pt}
  - \newcommand{\rowcolorson}{\rowcolors{2}{RowGray}{white}}
  - \newcolumntype{Y}{>{\centering\arraybackslash}X}
  - \usepackage{graphicx}
  - \setkeys{Gin}{width=\linewidth,totalheight=\textheight,keepaspectratio}
  - \usepackage{fvextra}
  - \DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,breakanywhere}
  - \usepackage{etoolbox}
  - \usepackage{needspace}
  - |
    \AtBeginDocument{
    \pretocmd{\section}{\clearpage}{}{}
    \pretocmd{\subsection}{\needspace{12\baselineskip}}{}{}
    }
---
# Copilotカスタマイズ運用仕様書

## 1. 目的

本書は、本リポジトリで使用する GitHub Copilot のカスタマイズ運用について、役割、責務、禁止事項、文書権限、工程ごとの使い分けを定義するための仕様書である。

本書の目的は次の通りである。

- 人が進行を主導する開発フローを明文化する
- AI に委ねる範囲と委ねない範囲を明確にする
- instructions、hooks、agents、skills の責務分担を定義する
- 文書の正本と作業文書の扱いを明確にする
- 実装とレビューの判断基準を統一する

## 2. 適用範囲

本書は、当リポジトリ配下で GitHub Copilot を用いて行う次の作業に適用する。

- 要件整理
- 仕様策定
- タスク策定
- タスクごとの設計策定
- タスクごとの実装手順整理
- 実装
- 実装レビュー
- 関連文書の作成、更新、移動

## 3. 基本原則

### 3.1 人主導

- 開発フローは常に人が主導する
- AI に工程の開始、工程の省略、工程の完了、次工程移行を決める権限はない
- AI は判断材料、草案、差分、指摘を提示するが、最終判断は人が行う

### 3.2 停止条件

次の条件に該当する場合、AI は推測で進めず停止し、人へ確認を求める。

- 正本となる仕様書、設計書、依頼内容が不足している場合
- 複数の正本文書が矛盾している場合
- 新規パッケージ導入や install が必要な場合
- 重大変更が必要な場合
- 認証、権限、セキュリティ、外部 I/F への影響があるが前提が不足している場合

### 3.3 出力責務

AI が実装作業を行った場合、少なくとも次を人へ報告する。

- 変更内容
- 変更したファイル
- 設計判断
- 既存挙動への影響
- 確認したこと
- 未確認・リスク

## 4. 用語定義

| 用語 | 定義 |
| --- | --- |
| 正本 | 今回の作業で判断基準として優先して扱う文書または依頼内容 |
| 作業文書 | 検討中の草案、手順書、レビュー記録などの作業途中文書 |
| 軽微変更 | 既存仕様の範囲内で成立する局所的な変更 |
| 重大変更 | 既存仕様や外部契約、保存形式、セキュリティに影響する変更 |
| instructions | 常時ルールまたは条件付きルールを定義する設定 |
| hooks | ツール利用時に機械的に制御する設定 |
| agents | 役割ごとに責務と使用ツールを分離した設定 |
| skills | 工程ごとの定型ワークフローを定義する設定 |

## 5. 文書権限と優先順位

### 5.1 正本の優先順位

正本の優先順位は次の通りとする。

1. 人が今回の作業で正本として明示した文書
2. docs/current
3. docs/.ai-works
4. docs/archive

### 5.2 フォルダごとの役割

| パス | 役割 | AI の扱い |
| --- | --- | --- |
| docs/current | 現行の仕様書・設計書の正本 | 正本として扱う |
| docs/.ai-works | 草案、手順書、レビュー文書、未昇格の設計メモ | 読んでよいが現行仕様の正本として扱わない |
| docs/archive | 過去資料 | 人が明示した場合を除き自律探索しない |

### 5.3 文書移動ルール

- 手順書は docs/.ai-works で作成し、実装完了時に docs/archive へ移動する
- 仕様書と設計書は完成後に docs/current へ移動する
- 仕様書と設計書の current への移動は人が行うことを原則とする
- 前工程の移動漏れが明らかな場合のみ、AI が current へ移動してよい
- AI が文書を移動した場合は、移動元、移動先、理由を必ず報告する
- 文書の削除、docs/decisions への移動判断は人が行う

## 6. 添付と入力条件の考え方

- VS Code 上の UI 操作としてファイルやフォルダが添付されたかどうかを、AI が常に厳密判定できる前提は置かない
- そのため、各工程では「人が今回の正本として示した文書が何か」を入力条件として扱う
- UI 関連作業では、仕様書や設計書に加えて デザイン文書（非公開） などのデザイン文書が今回の正本に含まれるかも確認する
- AI は、正本が不明な場合に「添付漏れの可能性」または「正本不明」である旨を伝え、作業を止める

## 7. カスタマイズ全体構成

| 区分 | 主な役割 | 対象ファイル |
| --- | --- | --- |
| root instructions | 常時有効な共通原則 | .github/copilot-instructions.md |
| file instructions | 条件付きで有効な運用ルール、領域ルール | .github/instructions/*.instructions.md |
| hooks | 機械的な許可・拒否・確認 | .github/hooks/*.json, .github/hooks/scripts/* |
| agents | 役割別の責務分離 | .github/agents/*.agent.md |
| skills | 工程ごとの定型ワークフロー | .github/skills/*/SKILL.md |

## 8. 責務分担

### 8.1 instructions

instructions には、常時ルールまたは条件付きルールを置く。

含める内容は次の通りとする。

- 人主導の原則
- 文書権限と文書移動ルール
- リポジトリ構造と探索起点
- 軽微変更と重大変更の定義
- レビュー観点
- コード編集時の最小差分、コメント方針、局所検証方針
- 領域別のコーディングルール
- UI 関連では、デザインシステム定義書への導線と日常的に守るデザイントークン・共通UI部品の規約

含めない内容は次の通りとする。

- 工程ごとの詳細な実行手順
- ロール別のツール権限
- 自動的な許可・拒否処理

### 8.2 hooks

hooks には、機械的に強制したいルールを置く。

初期実装の対象は次の通りとする。

- セッション開始時の人主導フロー注意喚起
- 破壊的コマンドの拒否
- install 系コマンドの確認要求
- .env 系ファイル操作の拒否
- docs/archive へのアクセス時の確認または拒否

### 8.3 agents

agents には、役割別の責務と利用ツールを置く。

- アーキテクト: 要件整理、仕様ドラフト、タスク整理
- 実装エンジニア: 実装、局所検証、実装後報告
- レビュアー: 差分と仕様書に基づくレビュー

### 8.4 skills

skills には、工程ごとの定型ワークフローを置く。

skill 名はシステム制約上、英字の内部名で管理する。説明文と本文は日本語で整備する。

初期実装の対象は次の通りとする。

- requirements-to-spec
- spec-to-task-list
- task-design
- task-procedure
- implementation-report
- spec-diff-review

## 9. Agents 仕様

### 9.1 アーキテクト

| 項目 | 内容 |
| --- | --- |
| 目的 | 要件整理、仕様書ドラフト、タスク分解、論点整理 |
| 主な入力 | 人の要求、既存仕様書、関連コード、必要に応じてデザイン文書 |
| 主な出力 | 仕様ドラフト、タスク一覧案、不足情報、懸念点 |
| 禁止事項 | 実装、工程の省略判断、完了判断 |
| 文書運用 | 草案は docs/.ai-works を基本とし、移動漏れが明らかな場合のみ docs/current へ移動 |

### 9.2 実装エンジニア

| 項目 | 内容 |
| --- | --- |
| 目的 | 正本に基づく実装、局所検証、事後報告 |
| 主な入力 | 仕様書、必要に応じて設計書と手順書、対象タスク、UI関連ではデザイン文書 |
| 主な出力 | 実装差分、局所検証結果、実装後報告 |
| 禁止事項 | install の無断実行、重大変更を伴う継続実装、工程完了判断 |
| コメント方針 | 非自明な意図、制約、境界条件、既存仕様との整合理由に短いコメントを残す |

### 9.3 レビュアー

| 項目 | 内容 |
| --- | --- |
| 目的 | 差分コードと仕様書の整合性確認 |
| 主な入力 | 仕様書、差分、必要に応じた周辺コード、UI関連ではデザイン文書 |
| 主な出力 | findings first の指摘、残余リスク、未確認点 |
| 禁止事項 | 勝手な修正、承認判断、工程完了判断 |
| 必須観点 | バグ、仕様不一致、回帰、テスト不足、過剰実装、UI方針逸脱 |

## 10. 軽微変更と重大変更

### 10.1 軽微変更

- 命名の微修正
- 既存責務内での関数分割
- UI 文言、表示順の微調整
- 型補助、null チェック追加
- 既存仕様を満たすための局所的な実装変更

### 10.2 重大変更

- データ保存形式の変更
- DB、API、IPC、外部 I/F の変更
- 認証、権限、セキュリティへの影響
- 画面遷移や業務フローの変更
- 既存仕様書と矛盾する変更
- 新規パッケージ導入

### 10.3 運用ルール

- 変更区分に迷う場合は重大変更として扱う
- 軽微変更は実装してよいが、事後報告で明示する
- 重大変更が必要な場合は実装を止め、人の判断を待つ

## 11. レビュー基準

### 11.1 主判定基準

- 差分コード
- 仕様書

設計書と手順書は参考物として扱う。

### 11.2 過剰実装チェック

- 指示外のリファクタがないか
- 仕様外の機能追加がないか
- 不要な抽象化がないか
- 既存の設計方針から外れていないか
- diff がタスク目的に対して大きすぎないか

### 11.3 設計方針チェック

- 責務分離が曖昧になっておらず、SOLID 原則から大きく外れていないか
- renderer 側に不必要なキャッシュを増やしていないか
- 画面遷移時に遷移先へ渡すパラメータが過剰になっていないか
- main 側、renderer 側で大きい一時データや共有データの置き場が不適切になっていないか
- 不必要な Context や、無秩序なグローバル状態を増やしていないか
- 異なる View 間の不必要な依存を増やしていないか
- 重い反復利用コンポーネントで、既存方針に反する不適切な再描画コストが増えていないか

## 12. skills 一覧

| skill 名 | 用途 |
| --- | --- |
| requirements-to-spec | 要件から仕様書ドラフトを作る |
| spec-to-task-list | 仕様書からタスク一覧を作る |
| task-design | タスクごとの機能設計書を作る |
| task-procedure | タスクごとの実装手順書を作る |
| implementation-report | 実装後報告を整える |
| spec-diff-review | 差分コードを仕様書と照合してレビューする |

## 13. 現在のファイル配置

```text
.github/
  copilot-instructions.md
  instructions/
    workflow-governance.instructions.md
    document-authority.instructions.md
    repo-structure.instructions.md
    change-classification.instructions.md
    review-focus.instructions.md
    code-editing.instructions.md
    client-renderer.instructions.md
    client-main.instructions.md
    backend.instructions.md
  hooks/
    workflow-policy.json
    scripts/
      sessionStart.cjs
      pretoolUsePolicy.cjs
  agents/
    architect.agent.md
    implementer.agent.md
    reviewer.agent.md
  skills/
    requirements-to-spec/
      SKILL.md
    spec-to-task-list/
      SKILL.md
    task-design/
      SKILL.md
    task-procedure/
      SKILL.md
    implementation-report/
      SKILL.md
    spec-diff-review/
      SKILL.md
```

## 14. 既知の限界

- UI 上での添付有無を AI が常に厳密判定できる前提は置いていない
- docs/archive の扱いは hooks で一定程度制御しているが、人が明示した場合の例外を完全自動判定しているわけではない
- skills は工程支援用であり、工程進行の決定権を持たない

## 15. 保守方針

- 新しい工程を追加する場合は、まず instructions、hooks、agents、skills のどこに置くべきかを決める
- 常時ルールを増やしすぎず、具体的手順は skills や個別 instructions に逃がす
- root instructions は常時有効な最小限の原則に保つ
- カスタマイズの変更時は、本書と標準開発フローの両方への影響を確認する