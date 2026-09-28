# WorkbookAppコンポーネント作成の手引き

 本ページは、当時の「コンポーネント作成の手引き」を一部改変して掲載しています。

この資料は、workbookAppの開発当初のチームとしての設計思想や方向性、雰囲気をお伝えするために掲載しました。

Reactに不慣れな時の資料のため、基本設計やルールに今では採用していない、または間違いと言えるような判断や理解がありますが**あえて残して**掲載しています。
ただし、一部誤解を生むような語句や不要な表現などは、文意を変えない範囲で編集・削除しています。

※ [最終的な設計やコンポーネント分類に関してはこちら](../contributors/arai.md#独自のコンポーネント分類の策定)

---
執筆者:arai


## 開発着手前に事前に読んでほしい資料  

1.React/React Hooks実践入門の書籍のChapter5までを全てざっくり読む
2.useCallbackはFunctionを他のパラメータにわたすときはとりあえず使え  
[https://blog.uhy.ooo/entry/2021-02-23/usecallback-custom-hooks/](https://blog.uhy.ooo/entry/2021-02-23/usecallback-custom-hooks/)  
3.tailwindCSSの使い方  
[https://reffect.co.jp/html/tailwindcss-for-beginners](https://reffect.co.jp/html/tailwindcss-for-beginners)  
4.storybookの使い方  
[https://reffect.co.jp/html/storybook](https://reffect.co.jp/html/storybook)

最低限これらの知識はざっくり知っておいてほしい

## 直接gotoは使わないが読んで欲しい資料  
React Navigationの使い方（View遷移）  
[https://reffect.co.jp/react/react-navigation](https://reffect.co.jp/react/react-navigation)

## 作成ルール  
- 基本的にpropsは、他のコンポーネントから指定すること(例:色の指定、初期値の指定など)を渡す  
- ステート(例:ボタンの状態やステートが変わった際の副作用(js的に言うとリスナーの発火))は、自身が管理する値として持つ  
- svg/png画像は、assetsフォルダのsvg/pngフォルダ以下に配置して importして使用する  
- 基本的な担当領域は、araiがPage/Views、gotoがParts/Organisms  
ただし絶対ではなく、必要があれば担当領域外のコンポーネントを作る場合もあり  
- 重いロジックはFunctionalsにAPIとして作成して極力コンポーネントはシンプルな構造にまとめる  
- グローバルステートはPageで管理する。基本的にaraiが実装するので、ほしいグローバルステートがあればgotoからaraiに依頼する(という形に今のところはする)  
- 基本的に他のコンポーネントに渡す関数はuseCallbackでメモ化する(読んでほしい)  

## レイヤー  
**Identity**  
基本ロジックとステート管理を担当するコンポーネント。  
最小粒度のUIコンポーネント。GlobalContextにのみ依存関係を持つ。  
Partsの基本的な振る舞いやステート、共通構造のみを定義する。  
リスナーやCSS、パラメーターの受け皿を定義する。  
プロパティやロジックの提供のみで、一切定数を持たないが単体でも表示可能なように初期値の設定はできる(Partsから数値を渡されたら上書きされる)。  
GlobalContext(Organismsが提供するContext)とはステートの読み書きを行える。  
Functionals以外の他のコンポーネントやIdentityと依存関係を持たない。  
Partsコンポーネントにのみ呼び出される。ViewsやOrganismsに配置はできない。  
最大限のロジックと最小限のデザイン構造を持つ。

**Parts**  
コンポーネントの基本デザインを担当するコンポーネント。  
OrganismsやViewsに配置される最小単位。  
Identityにのみ依存する。ステートやロジックを一切持たない場合(静止ロゴなど)に限り、Identityを持たない場合がある(逆に言えばIdentityはステートやロジックをもつ場合は必ず持っている)。  
UIデザイン的には、AtomicDesignでいうところのAtomsやMoleculeと同じ。  
GlobalContextの読み込みは可能。直接書き込みは原則非推奨(Identityを介して間接的に書き込みをする)。  
スタイル定義やIdentityに追加する形のDOM構造を持つ。  
独自にステートを持たない。拡張的にロジックをもつ場合がある。  
別のPartsでラップする(import)ことができる。

例:)ボタンや画像、入力フォームなど

**Functionals**  
データの処理や外部APIとの通信などのUIを持たない目に見えない機能(バックエンド)をもつコンポーネント。  
OrganismsやViewsと依存関係を持つ。  
スタイルやHTML構造を持たない。ステートを持たないが、ステートを渡される場合もある。

例:)ログイン機能、問題の正否判定、API通信など

**Organisms**  
複数のPartsを組み合わせてひとつの目的に沿った機能提供を目的にしたコンポーネント

(例:残り時間や問題番号などの表示を目的とした問題ヘッダー)。  
ロジックを持ち、GlobalContextの提供元となりViewとはPropsを介してやり取りを直接行う。

例:)ヘッダー、フッター、一問一答問題表示エリア(本文・選択肢)、時間表示エリア、解説表示エリア、カレンダーなど

**Views**  
Organismsを配置し、ひとつの画面として構成するコンポーネント。  
Viewsのデータを各Organismsに流し込んだり、Organismsのステートの副作用が発生したらView内の他のコンポーネントに影響を及ぼしたり(例:計算機ボタンを押すことで計算機を表示する)するController的な役割。  
ReactNavigationはここで使用・管理する。Viewは1ページに複数持つことも可能。  
例えば、設定画面View↔詳細設定画面Viewに相互に切り替わる場合など。

**Pages**  
Viewの表示にのみ使う階層。ページごとにひとつあるコンポーネント。  
外部API通信や内部キャッシュなどの読み込みを行い、グローバルステートとして管理する。  
ここで管理するデータやステートは基本的にPageを跨いでは持ち込めない。  

例:)タイトルページ、本体ページ、ローディングページなど  
