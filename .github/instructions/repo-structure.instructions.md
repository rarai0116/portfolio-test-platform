---
description: "Use when locating code ownership, deciding where to search first in this monorepo, or understanding folder responsibilities across client, backend, and docs."
name: "Repository Structure Guide"
---
# Repository Structure Guide

- このリポジトリは apps/test-manager/client、apps/test-manager/backend、apps/workbook-app/client、apps/workbook-app/backend を持つモノレポです。
- 仕様や設計の確認が必要な場合は、まず docs/current を見ます。docs/.ai-works は作業中の草案や手順書であり、正本ではありません。
- まず配線や登録箇所ではなく、実際に振る舞いを決めている owning abstraction を探してください。

## 探索の起点

- UI や画面状態を追うときは apps/test-manager/client/src/app/renderer から始めます。
- Electron 本体の制御、IPC ハンドラ、外部連携を追うときは apps/test-manager/client/src/app/main から始めます。
- renderer と main の橋渡しや公開 API を追うときは apps/test-manager/client/src/app/preload と apps/test-manager/client/src/app/shared を見ます。
- Firebase Functions やエミュレータ前提のバックエンド処理を追うときは apps/test-manager/backend/functions を見ます。
- スマートフォンアプリ側の実装を追うときは apps/workbook-app/client、そのバックエンドは apps/workbook-app/backend を見ます。

## client 構造の目安

- renderer 配下は views、hooks、stores、components などの UI 実装を持ちます。
- main 配下は ipc、services、utils などのデスクトップ側責務を持ちます。
- preload は renderer に公開する API の橋渡しです。
- shared は main と renderer の共有契約や型の置き場です。

## backend 構造の目安

- apps/test-manager/backend/functions は Firebase Functions の実装です。
- apps/test-manager/backend/scripts は補助スクリプトです。
- apps/test-manager/backend 配下には emulator export や rules もありますが、実装確認ではまずコードと設定を優先します。

## 探索時の注意

- docs/archive は人が明示した場合のみ参照します。
- wiring 層しか見ていない場合は、1 hop 先の実処理まで進みます。
- モノレポ横断探索は必要最小限に留め、対象責務がある領域から先に確認します。