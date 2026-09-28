---
description: "Use when implementing code changes, evaluating whether a design deviation is 軽微変更 or 重大変更, deciding whether to continue implementation, or deciding whether package installation needs user approval."
name: "Change Classification"
---
# Change Classification

- 変更区分に迷う場合は、重大変更として扱って停止します。

## 軽微変更

- 命名の微修正
- 既存責務内での関数分割
- UI文言・表示順の微調整
- 型補助・nullチェック追加
- 既存仕様を満たすための局所的な実装変更

## 重大変更

- データ保存形式の変更
- DB/API/IPC/外部I/Fの変更
- 認証・権限・セキュリティへの影響
- 画面遷移や業務フローの変更
- 既存仕様書と矛盾する変更
- 新規パッケージ導入

## 運用ルール

- 軽微変更は実装して構いませんが、実装後の報告で必ず「軽微な設計変更を含むか」を明示します。
- 重大変更が必要になった場合は実装を止め、変更理由と影響範囲を説明して人の判断を待ちます。
- リファクタリングは、指示対象の実装を成立させるために必要な最小範囲に限定します。