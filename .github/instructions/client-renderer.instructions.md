---
description: "Use when editing renderer-side client code in apps/test-manager/client/src/app/renderer. Covers UI state ownership, view boundaries, data passing, caching, and component-level rules."
name: "Client Renderer Rules"
applyTo: "apps/test-manager/client/src/app/renderer/**/*.{ts,tsx,js,jsx}"
---
# Client Renderer Rules

- renderer 側で不必要なデータをキャッシュしないようにします。
- 画面遷移の際に遷移先へ渡すパラメータは最小限にします。
- View ごとの状態とアプリ全体の共有状態を混同しないようにします。
- View ごとの stores はその View の中で閉じ、全体共有が必要なものだけルート側の stores に置きます。
- 異なる View の間でデータ依存を起こさないようにします。
- 不必要な Context はできるだけ置きません。
- 無秩序なzustandの乱用は避けて、スコープを意識した状態管理を行います。
- 何度も反復して使用する重いコンポーネントは、既存方針に合わせて memo 化を検討します。
- 大きい一時データや共有データはローカルキャッシュの利用を検討します。
- UI の局所修正のために過剰な抽象化や共有化を増やしません。