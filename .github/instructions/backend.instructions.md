---
description: "Use when editing backend-side code in apps/test-manager/backend, including Firebase Functions, scripts, and backend TypeScript or JavaScript files. Covers data contracts, security-sensitive changes, and emulator-oriented backend rules."
name: "Backend Rules"
applyTo: "apps/test-manager/backend/**/*.{ts,tsx,js,jsx}"
---
# Backend Rules

- backend 側の変更では、データ保存形式、DB 契約、API 契約、外部 I/F 変更が重大変更になり得ることを常に意識します。
- 認証、権限、セキュリティに関わる変更は、局所修正であっても影響範囲を確認します。
- Firebase emulator 前提のローカル検証ができる場合は、その前提を崩さないようにします。
- scripts と functions の責務を分け、補助スクリプトの都合で本番契約を曖昧にしません。
- 既存仕様を満たすための最小変更を優先し、不要なデータモデル変更を避けます。