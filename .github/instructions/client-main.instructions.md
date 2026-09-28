---
description: "Use when editing Electron main, preload, or shared client code in apps/test-manager/client/src/app. Covers process boundaries, IPC contracts, shared types, and desktop-side data handling."
name: "Client Main Rules"
applyTo: "apps/test-manager/client/src/app/main/**/*.{ts,tsx,js,jsx},apps/test-manager/client/src/app/preload/**/*.{ts,tsx,js,jsx},apps/test-manager/client/src/app/shared/**/*.{ts,tsx,js,jsx}"
---
# Client Main Rules

- main 側は IPC、アプリ制御、外部連携などのデスクトップ責務に集中させます。
- preload は renderer への公開境界です。不要な権限や広すぎる API を増やしません。
- shared には main と renderer の共有契約や型を置き、責務が renderer 専用または main 専用のものは混ぜません。
- DB、API、IPC、外部 I/F の変更は重大変更に該当し得るため、影響範囲を意識して扱います。
- main 側、renderer 側ともに大きい一時データや共有データはローカルキャッシュ活用を検討します。
- renderer と main の責務をまたぐ都合のよい実装を増やさず、境界を保ちます。