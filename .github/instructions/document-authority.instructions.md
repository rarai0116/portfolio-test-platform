---
description: "Use when reading, creating, updating, or moving documents under docs/current, docs/.ai-works, or docs/archive. Covers canonical document priority, working drafts, procedure docs, and move rules."
name: "Document Authority"
---
# Document Authority

- 正本の優先順位は次の通りです。
- 人が今回の作業で正本として明示した文書
- docs/current
- docs/.ai-works
- docs/archive
- docs/current は現行の仕様書・設計書を置く場所です。ここにある文書を現行の正本として扱います。
- docs/.ai-works は作業用フォルダです。草案、手順書、レビュー文書、未昇格の設計メモを置いて構いませんが、現行仕様の正本としては扱いません。
- docs/archive は過去資料です。人が明示した場合を除き、自律探索の対象にしません。
- 仕様書・設計書は、完成後に docs/current へ移動します。人が移動するのが原則ですが、前工程の移動漏れが明らかな場合のみAIが移動して構いません。
- 手順書は docs/.ai-works で作成し、実装完了時に docs/archive へ移動します。
- AIが文書を移動した場合は、移動元・移動先・理由を必ず報告します。
- 文書の削除や docs/decisions への移動判断は人が行います。AIは勝手に判断しません。