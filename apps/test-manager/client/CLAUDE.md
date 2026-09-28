このファイルは `apps/test-manager/client` 配下で作業する際に自動的に適用されます。全体方針はルートの [AGENTS.md](../../../AGENTS.md) を参照してください。

# Renderer (`apps/client/src/app/renderer`)

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
- useRef と useEffect は最終手段として扱い、state・props・導出計算で表現できるものを優先します。
- useRef は DOM 参照、再レンダー不要の可変値、または state/memo では表現できない場合に限って使用します。UI や分岐に反映する値は state で持ちます。
- useEffect は props/state の変化に応じて React 外部と同期する副作用に限って使用し、導出状態の計算やイベント起点で直ちに実行できる処理には使いません。
- 外部ストアや購読型リスナーとの連携は useSyncExternalStore を優先し、effect 内での subscribe/unsubscribe の乱用を避けます。

# Main / Preload / Shared (`apps/client/src/app/{main,preload,shared}`)

- main 側は IPC、アプリ制御、外部連携などのデスクトップ責務に集中させます。
- preload は renderer への公開境界です。不要な権限や広すぎる API を増やしません。
- shared には main と renderer の共有契約や型を置き、責務が renderer 専用または main 専用のものは混ぜません。
- DB、API、IPC、外部 I/F の変更は重大変更に該当し得るため、影響範囲を意識して扱います。
- main 側、renderer 側ともに大きい一時データや共有データはローカルキャッシュ活用を検討します。
- renderer と main の責務をまたぐ都合のよい実装を増やさず、境界を保ちます。

# Design System (`apps/client/src/app/renderer` の UI・スタイル)

- UI実装では、人が今回の作業で正本として示したデザイン文書を優先します。特に `docs/current/design/DESIGN.md` が正本に含まれる場合は、そのトークン、タイポグラフィ、シャドウ、コンポーネント方針を前提にします。
- 詳細なトークン定義、例外、使用例は `docs/current/design/DESIGN.md` を参照します。このファイルには日常的に守る判断基準だけを置き、トークン表や個別例外の再掲は避けます。
- 色は、対応するセマンティックトークンがある場合にそれを最優先で使います。プリミティブトークンの直接利用は、対応するセマンティックトークンがない場合だけにします。
- カラーコードのハードコードは避けます。JSのinline styleでも、直接の色コードではなくCSS変数を使います。
- className では既存のTailwindユーティリティとdesign tokenを優先し、独自classの追加は既存パターンで表現できない場合に限定します。
- shadcn/ui コンポーネントには、variant、既存のutility class、design token を優先して適用し、プリミティブ色の直接指定は避けます。
- フォントは既存のグローバルCSS方針を尊重し、コンポーネント単位で font-family を増やしません。既存例外が明示されている領域だけ例外を認めます。
- shadow、border、背景色は既存トークンと既存UI部品に合わせ、新しい見た目の方言を増やしません。
- 状態や意味を色だけで伝えないようにし、必要に応じてテキスト、アイコン、フォーカス表示を併用します。
- 基本的なUIは既存の共通 ui、organism、parts 配下のコンポーネントを優先して使います。画面専用のUIはその画面配下に閉じて置きます。
- 色、shadow、font-family、トークン追加や変更に触れるUI変更では、実装前に `docs/current/design/DESIGN.md` の該当方針を確認します。
- デザイントークンの追加、変更、削除が必要な場合は、実装だけを先行させず、正本のデザイン文書との整合を確認します。既存仕様と衝突する場合は人に確認して停止します。
