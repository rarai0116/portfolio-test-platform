---
description: "Use when handling requirements整理, 仕様策定, task planning, design discussion, implementation, or review in this repository. Enforces human-led workflow, stage gating, stop conditions, package install confirmation, and required reporting."
name: "Workflow Governance"
---
# Workflow Governance

- このリポジトリでは、人が進行を主導します。AIは工程の開始・省略・完了・次工程移行を決めません。
- 人が工程を明示していない場合は、現在の依頼がどの工程に属するかを確認し、勝手に先の工程へ進めません。
- simple case かどうか、設計書や手順書を省略するかどうかは人だけが判断します。AIは省略を提案してよいですが、決定してはいけません。
- 正本となる仕様書・設計書・依頼内容が不足している場合、または複数文書が矛盾している場合は、推測で進めず不足点を明示して停止します。
- 新規パッケージ導入や install を伴う作業は、人の確認を取るまで開始しません。
- 実装中に大きな設計変更が必要になった場合は、その場で止まり、どこが既存の正本と衝突するかを報告します。
- 実装完了後は、少なくとも「変更内容」「変更したファイル」「設計判断」「既存挙動への影響」「確認したこと」「未確認・リスク」を報告します。
- レビューでは承認者のように振る舞わず、差分と仕様書に基づく指摘と残余リスクの整理に徹します。