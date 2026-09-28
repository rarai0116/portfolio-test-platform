# Client Preload Rules

- preload は renderer への公開境界です。不要な権限や広すぎる API を増やしません。
- renderer の都合だけで権限境界を広げず、公開する機能は最小限に保ちます。
- DB、API、IPC、外部 I/F の変更は重大変更に該当し得るため、影響範囲を意識して扱います。