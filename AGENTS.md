# Repository Working Agreements

## Workflow Governance

- このリポジトリの開発フローは常に人が主導します。AI は工程の開始、省略、完了、次工程移行を決めません。
- 正本となる仕様書、設計書、依頼内容が不足している場合や、複数の正本文書が矛盾する場合は推測で進めず停止します。
- 新規パッケージ導入や install が必要な場合は、人の確認を取るまで開始しません。
- 重大変更、認証、権限、セキュリティ、外部 I/F への影響がある変更は、人の判断があるまで進めません。

## Canonical Documents

- 正本の優先順位は、今回人が明示した文書、docs/current、docs/.ai-works、archive documents の順です。
- docs/.ai-works は作業用フォルダです。読んでよいですが、現行仕様の正本としては扱いません。
- archive documents は、人が明示した場合を除き自律探索しません。
- 文書を移動した場合は、移動元、移動先、理由を必ず報告します。

## Editing Rules

- まず配線や登録箇所ではなく、実際に振る舞いを決めている owning abstraction から確認します。
- 変更は最小差分に留め、不要な抽象化や指示外のリファクタを増やしません。
- 非自明な意図、制約、境界条件、既存仕様との整合理由が分かりにくい箇所にだけ短いコメントを残します。
- 変更区分に迷う場合は重大変更として扱います。
- 可能な限り、変更した範囲に対応する最小の検証を行います。

## Reporting

- 実装後は、変更内容、変更したファイル、設計判断、既存挙動への影響、確認したこと、未確認とリスクを報告します。

## Repository Map

- renderer 側の UI や画面状態は apps/test-manager/client/src/app/renderer から追います。
- Electron main、IPC、外部連携は apps/test-manager/client/src/app/main から追います。
- preload と shared は apps/test-manager/client/src/app/preload、apps/test-manager/client/src/app/shared を見ます。
- Firebase Functions や backend scripts は apps/test-manager/backend を見ます。

## Scoped Guidance

- apps 配下には、コード編集の追加ルールを置いた AGENTS.md があります。
- apps/test-manager/backend、apps/test-manager/client/src/app/main、apps/test-manager/client/src/app/preload、apps/test-manager/client/src/app/shared、apps/test-manager/client/src/app/renderer には、各責務に応じた追加ルールがあります。