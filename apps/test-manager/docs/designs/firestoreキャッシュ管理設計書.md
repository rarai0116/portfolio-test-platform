# Firestoreキャッシュ管理設計書

## 1. 目的

本書は、client/main 配下で扱う Firestore キャッシュの現状仕様、問題点、再設計方針、および段階的な移行計画を整理するための設計書です。

今回の主目的は以下です。

- Firestore の不要な全件 read を大幅に削減する
- renderer の画面遷移時に同一データを再読込しないようにする
- main 側の複数機能で同じ Firestore データを共有できるようにする
- 削除を含む差分同期を安定して扱えるようにする
- 今後の Firestore キャッシュ改修時の基準文書とする

本書では、現状仕様の整理に加え、今回採用する「シャーディングした変更インデックス方式」を中心に、Firestore キャッシュ全体の流れを定義します。

---

## 2. 対象範囲

### 2.1 対象データ

- TestData
	- firstGrade
	- secondGrade
- AssetData
	- storageList/firstGrade/images
	- storageList/secondGrade/images

### 2.2 対象コンポーネント

- main 側
	- ipc/firestore
	- ipc/testCategory
	- ipc/assetStorage
- preload 側
	- window.fs API
- renderer 側
	- useFirestoreHandler
	- useTypedFirestoreHandler
	- TestDataList
	- TestDataEditor
	- 画像アセット関連画面

---

## 3. 現状仕様

### 3.1 現状の基本構成

現状は、renderer が useFirestoreHandler を通じて main の IPC を呼び、main 側で Firestore Web SDK を使って getDocs または onSnapshot を実行する構成である。

流れは以下の通り。

1. renderer の useFirestoreHandler が mount 時に getOnce を呼ぶ
2. 必要に応じて setActiveKeys で購読を開始する
3. main 側の FirestoreIpcHandlers が client.getOnce または client.listenQuery を呼ぶ
4. listen の patch は renderer へ配送される
5. 一部の patch と getOnce 結果は SQLite に保存される

### 3.2 現状のデータ取得経路

#### 3.2.1 一括取得

- renderer の初期表示時は getOnce が呼ばれる
- getOnce は毎回 Firestore の getDocs を直接実行する
- 取得結果は返却後に docs_cache へ保存される
- ただし getOnce 自体は docs_cache を参照していない

結果として、画面を開くたびに同一コレクションの全件取得が発生しやすい。

#### 3.2.2 購読

- setActiveKeys により QueryKey 単位で購読を管理する
- listenQuery は QuerySpec ごとに onSnapshot を生成する
- patch は購読中 renderer に配送される
- patch 受信時に docs_cache が更新される

### 3.3 現状の永続キャッシュ

現状の SQLite には主に以下が存在する。

- docs テーブル
	- putDoc/getDoc/removeDoc で扱う単票保存用テーブル
- docs_cache テーブル
	- path 単位のドキュメント本体を保持
	- key には QueryKey が格納される
- outbox テーブル
	- Firestore への書き込みキュー

### 3.4 現状の課題

#### 3.4.1 getOnce がキャッシュを利用していない

取得結果は保存しているが、次回取得時に再利用していないため、全件取得が繰り返される。

#### 3.4.2 docs_cache の key 設計が QueryKey 前提になっている

同一ドキュメントが複数クエリに属する場合、最後に保存した QueryKey で上書きされる。これはクエリ結果キャッシュとして不安定である。

#### 3.4.3 クエリ結果を SQLite 上で厳密再現できない

現状の getFromCache は limit 以外の where や orderBy を十分に再現していないため、renderer へ「原則キャッシュを返す」基盤としては弱い。

#### 3.4.4 renderer が同一コレクションを画面ごとに再取得している

TestDataList と TestDataEditor が同じ級の TestData 全件をそれぞれ mount 時に取得するため、画面遷移で全件 getDocs が繰り返される。

#### 3.4.5 main 側の別機能も独自に購読している

testCategory は renderer の購読とは独立して firstGrade と secondGrade を常時購読している。そのため、UI 用購読と機能用購読が重複する。

#### 3.4.6 削除差分の扱いが弱い

現状の物理削除前提では、前回終了後から次回起動までの間に削除されたドキュメントを差分取得だけで検出することが難しい。

#### 3.4.7 listener 初期スナップショットが重い

Firestore の query listener は初回スナップショットで一致する既存ドキュメント全件の added を返すため、collection 全量 listener を常時監視の中心に置くと、起動時 read コストを大きく下げにくい。

---

## 4. 現状のキャッシュ全体フロー

### 4.1 起動時

1. main が起動する
2. CacheDao と Outbox が初期化される
3. FirestoreIpcHandlers が登録される
4. TestCategoryClient が初期化されると、独自に Firestore の常時購読を開始する
5. renderer は各画面 mount 時に getOnce を呼ぶ

### 4.2 画面表示時

1. renderer が getOnce を呼ぶ
2. main が Firestore getDocs を実行する
3. 取得結果を renderer に返す
4. 取得結果を docs_cache に保存する
5. renderer が setActiveKeys を送り、必要なら購読を開始する

### 4.3 購読中

1. main の onSnapshot が patch を受け取る
2. patch を renderer へ送る
3. 同時に docs_cache を更新する
4. renderer は patch をローカル state に反映する

### 4.4 書き込み時

1. renderer は mutate を呼ぶ
2. main は Outbox に enqueue する
3. OutboxRunner が Firestore 書き込みを実行する
4. 反映結果は購読 patch と outboxUpdate により renderer へ戻る

### 4.5 画像アセット時

1. renderer は storageList/{grade}/images を useFirestoreHandler 経由で取得する
2. AssetManager は別の assets.db とローカルファイルキャッシュを持つ
3. Firestore メタ取得と Storage ダウンロード制御は AssetManager が行う
4. 画像ファイル本体は Firestore キャッシュではなく assets.db とローカルファイルで管理する

---

## 5. 再設計の基本方針

今回の再設計では、QueryKey 単位の一時キャッシュから、コレクション単位の永続ローカル正本へ軸足を移す。

ただし、Firestore の常時監視はコレクション全体 listener ではなく、シャーディングした変更インデックスを監視の起点とする。

基本方針は以下とする。

1. Firestore の全件読込は、キャッシュ未形成時のみ行う
2. キャッシュ形成後は、変更インデックスの更新を検知して対象 doc のみ差分同期する
3. 起動時も同じ変更インデックスを基準に同期する
4. renderer からの読み取り要求は、原則としてローカルキャッシュから返す
5. renderer が受ける patch は、第1段階では collection 単位の購読者へ changed doc を配送して返す
6. 削除は論理削除に統一
7. main 側の各機能は同じローカル正本を共有する

---

## 6. 改修点

本節は、今回の再設計における主要な改修点を示す。

### 6.1 改修点1: キャッシュ単位の変更

現状:

- QuerySpec 単位で取得し、その都度結果を保存する

改修後:

- firstGrade などのコレクション単位でローカル正本を持つ
- renderer の query は正本に対するローカル検索とする

### 6.2 改修点2: 監視方式の変更

現状:

- QuerySpec ごとに Firestore listener を張る

改修後:

- Firestore の常時監視は、シャーディングした変更インデックスに集約する
- 変更があった doc key のみを対象に差分取得する

### 6.3 改修点3: getOnce の責務変更

現状:

- getOnce は Firestore getDocs を直接呼ぶ

改修後:

- getOnce は FirestoreCacheManager の local query を呼ぶ
- ネットワーク同期は getOnce ではなく cache manager の責務とする

### 6.4 改修点4: patch 生成責務の変更

現状:

- Firestore の QuerySpec listener 結果をそのまま renderer に返す

改修後:

- cache manager がローカル正本更新後に collection 購読者へ changed doc を配送する
- 第1段階では collection 全件取得前提の added / modified / removed を生成して renderer に返す

### 6.5 改修点5: 削除方式の変更

現状:

- delete により物理削除する

改修後:

- 論理削除に変更する
- deleted を付与し、通常クエリは deleted == false を既定条件として扱う

### 6.6 改修点6: main 側の重複購読整理

現状:

- renderer 用購読と testCategory 用購読が別々に存在する

改修後:

- testCategory を cache manager の更新ストリームへ依存させる
- Firestore 実購読は変更インデックス listener に集約する

---

## 7. 採用設計: シャーディングした変更インデックス方式

### 7.1 概要

各対象コレクションに対し、変更検知専用のインデックスドキュメント群を用意する。

例:

- cacheIndex/firstGrade_00
- cacheIndex/firstGrade_01
- cacheIndex/secondGrade_00
- cacheIndex/storageList_firstGrade_images_00

各インデックスドキュメントは、対象 doc key と更新時刻情報の組を保持する。

### 7.2 インデックスの役割

変更インデックスは、データ本体の代替ではなく「何が変わったか」を知るための目次とする。

変更インデックスで行うこと:

- doc key ごとの updatedAt / deleted の保持
- shard 単位の最終更新時刻の保持
- listener の軽量監視対象の提供

変更インデックスで行わないこと:

- renderer に返す最終データの保持
- ソート済み一覧の保持
- QuerySpec 結果の直接保持

### 7.3 単一 dict 方式を採用しない理由

以下の理由により、1 collection = 1 dict ドキュメント方式は採用しない。

- 単一ドキュメントへの書き込み集中が発生する
- ドキュメントサイズ上限 1 MiB に将来的に到達しやすい
- フィールド数増加により更新コストが重くなる
- テストデータ件数・画像件数の増加に弱い

そのため、変更インデックスは最初から shard 分割前提とする。

### 7.4 shard 方式

doc key からハッシュを生成し、shard を決定する。

例:

- shard 数: 16 または 32
- shard key: `hash(docId) % shardCount`
- 1 shard あたりの上限目安:
	- 最大 1000 key
	- ドキュメントサイズ 512 KiB 以内
	- 上限に近づいた shard は分割対象とする

例:

- firstGrade/123 -> firstGrade_0a
- firstGrade/456 -> firstGrade_03

### 7.5 変更インデックスの Firestore 例

```ts
// cacheIndex/firstGrade_0a
{
	collectionPath: 'firstGrade',
	shard: '0a',
	updatedAt: Timestamp,
	items: {
		'123': { updatedAt: Timestamp, deleted: false },
		'456': { updatedAt: Timestamp, deleted: true }
	}
}
```

### 7.6 更新契約

create / set / update / delete の全経路で、対象ドキュメント本体の更新と変更インデックス更新を同時に行う。

契約:

- create
	- 本体を upsert
	- items[key].updatedAt を更新
	- items[key].deleted を false にする
- update
	- 本体を更新
	- items[key].updatedAt を更新
- delete
	- 本体の deleted を true にする
	- items[key].updatedAt を更新
	- items[key].deleted を true にする

同一バッチまたは同一トランザクションで本体と変更インデックスを更新することとする。

---

## 8. 再設計後のアーキテクチャ

### 8.1 新しい責務分割

#### 8.1.1 FirestoreCacheManager

main 側に FirestoreCacheManager を新設する。

責務:

- コレクション単位のキャッシュ形成
- 初回フル同期
- 起動時差分同期
- 変更インデックス listener の維持
- SQLite 更新
- renderer への patch 通知
- 他 main 機能への更新通知

#### 8.1.2 FirestoreIpcHandlers

責務を縮小する。

- renderer からの getOnce を cache manager に委譲する
- setActiveKeys は renderer の画面更新通知対象管理に限定する
- mutate と outbox は従来通り扱う

#### 8.1.3 TestCategoryClient

Firestore を直接購読しない。

責務:

- cache manager から渡される更新イベントを受ける
- SQLite でカテゴリツリーを更新する

#### 8.1.4 AssetManager

画像本体キャッシュは assets.db とローカルファイルで管理する。

ただし Firestore メタ参照は cache manager のローカル正本を参照する。

追加責務:

- `replaceAsset` による Storage 本体差し替え
- Firestore メタ更新反映待ちと local file cache の無効化
- base64 応答時の local file hit / miss 計測
- key ごとの generation 管理による stale ready / progress / error の抑止

generation 管理の考え方:

- AssetKey ごとに generation を持つ
- replace 開始時または Firestore メタ変更による invalidate 時に generation を進める
- download / local read / progress 通知は、開始時点の generation と現行 generation が一致する時だけ有効とする
- これにより、replace 中に先行していた旧ダウンロードや旧ローカル読込が完了しても、古い base64 や progress を renderer へ返さない

### 8.2 コレクション定義

cache manager が管理する対象を CollectionCacheDefinition として定義する。

想定対象:

- firstGrade
- secondGrade
- storageList/firstGrade/images
- storageList/secondGrade/images

各定義は以下を持つ。

- collectionPath
- group の有無
- 論理削除フィールド名
- 差分同期に使う updatedAt フィールド名
- 変更インデックス collectionPath
- shard 数
- デフォルト並び順

---

## 9. 再設計後のデータモデル

### 9.1 基本方針

ローカル正本、同期状態、インデックス監視状態を分離して保持する。

### 9.2 Firestore 側データ

#### 9.2.1 本体ドキュメント

既存の TestData / AssetData ドキュメントを継続利用する。

前提フィールド:

- updatedAt
- deleted

#### 9.2.2 変更インデックスドキュメント

cacheIndex 配下に shard ごとのドキュメントを持つ。

保持項目:

- collectionPath
- shard
- updatedAt
- items
	- key ごとの updatedAt / deleted

### 9.3 ローカル SQLite

#### 9.3.1 firestore_docs

コレクション単位のローカル正本。

- path TEXT PRIMARY KEY
- collection_path TEXT NOT NULL
- doc_id TEXT NOT NULL
- data TEXT NOT NULL
- updated_seconds INTEGER NOT NULL
- updated_nanos INTEGER NOT NULL
- deleted INTEGER NOT NULL DEFAULT 0
- cached_at_ms INTEGER NOT NULL

インデックス:

- collection_path
- collection_path, doc_id
- collection_path, updated_seconds, updated_nanos
- collection_path, deleted

#### 9.3.2 firestore_sync_state

コレクションごとの同期状態。

- collection_path TEXT PRIMARY KEY
- cache_ready INTEGER NOT NULL
- last_full_sync_ms INTEGER NULL
- last_delta_sync_ms INTEGER NULL
- last_seen_updated_seconds INTEGER NULL
- last_seen_updated_nanos INTEGER NULL
- last_seen_doc_id TEXT NULL
- auto_rebuild_last_reason TEXT NULL
- auto_rebuild_same_reason_failures INTEGER NOT NULL
- auto_rebuild_total_failures INTEGER NOT NULL
- auto_rebuild_last_attempt_ms INTEGER NULL
- auto_rebuild_blocked INTEGER NOT NULL
- auto_rebuild_blocked_reason TEXT NULL
- last_rebuild_succeeded_ms INTEGER NULL
- schema_version INTEGER NOT NULL

備考:

- 境界時刻の取りこぼし回避のため、updatedAt だけでなく doc_id を含む複合カーソルを持つ
- 差分同期カーソルは updatedAt 系 1 本に統一する
- delete を含む全更新で updatedAt を serverTimestamp に更新する前提とする


#### 9.3.3 firestore_index_items

変更インデックスの軽量ローカル写像。

- shard_path TEXT NOT NULL
- collection_path TEXT NOT NULL
- doc_id TEXT NOT NULL
- updated_seconds INTEGER NOT NULL
- updated_nanos INTEGER NOT NULL
- deleted INTEGER NOT NULL
- PRIMARY KEY (shard_path, doc_id)

用途:

- listener で受け取った shard 内 items と比較し、changed key を抽出する
- JSON 全文 snapshot を保持せず、軽量な key 単位状態で差分計算する

#### 9.3.4 既存 outbox

outbox は継続利用する。

### 9.4 既存 docs_cache との関係

docs_cache は最終的に廃止候補とする。

理由:

- QueryKey ベースのため正本管理に向かない
- where/orderBy を再現できない
- コレクション横断での再利用性が低い

移行期間中は互換レイヤを置いてもよいが、新規機能は firestore_docs を正とする。

---

## 10. 削除方針

### 10.1 採用方針

削除は論理削除とし、deleted を持たせる。

### 10.2 理由

- フルリスキャン頻度を下げられる
- 変更インデックスに削除情報を残せる
- 実装変更が比較的小さい
- 差分同期カーソルを updatedAt 1 本に統一できる

### 10.3 Firestore ドキュメント仕様

通常状態:

- deleted は false または未設定

削除状態:

- deleted に true を設定する
- updatedAt にも serverTimestamp を設定する
- 必要であれば status なども削除状態に更新する

### 10.4 delete の扱い

renderer の delete mutate は、最終的に本体物理削除ではなく deleted 更新へ変換する。

同時に変更インデックスも更新する。

補足:

- renderer の public API は維持し、MutatePayload および Outbox 上の kind は `delete` のままとする
- OutboxRunner は delete を特別扱いせず、main 側の書き込み実行レイヤへ委譲する
- main 側の書き込み実行レイヤで delete 意図を論理削除へ変換し、本体更新と変更インデックス更新を同時に行う
- 変換レイヤは FirestoreClient の直上に置く専用の mutation executor または cache manager 内の共通書き込み経路とする
- delete を含む全書き込み経路は、共通の論理削除 API を通す
- Firestore の `deleteDoc` を直接呼ぶ経路は通常運用から排除する
- AssetStorage を含む周辺機能も同じ論理削除契約へ統一する

### 10.5 再作成時の扱い

論理削除済み doc を再利用する場合は、deleted を false に戻す。

### 10.6 物理削除の扱い

物理削除は即時には行わない。

必要であれば、別途バックエンドの定期バッチで deleted から一定期間経過したものを削除する。

---

## 11. 差分同期仕様

### 11.1 基本方針

初回起動時と通常起動時で別処理を持たず、同じ同期パイプラインを利用する。

基本ルール:

- app 起動直後に変更インデックス listener を開始する
- listener の初回 snapshot を処理する前に、当該コレクションのローカルキャッシュ有無と可読性を判定する
- 差分同期カーソルは updatedAt 1 本で扱う
- delete を含む全更新で updatedAt を serverTimestamp に更新する
- deleted は表示除外と論理削除判定に使用し、同期再開位置の主カーソルには使わない

### 11.2 起動時フロー

1. app 起動
2. FirestoreCacheManager が同期対象コレクションをロードする
3. firestore_sync_state を確認する
4. 変更インデックス listener を開始する
5. listener の初回 snapshot を受け取る
6. 差分比較に入る前に、当該コレクションのローカルキャッシュが存在するか、正常に読めるかを判定する
7. ローカルキャッシュが存在しない、または読めない場合は full sync を実施する
8. full sync 中に到着した listener snapshot は直ちに適用せず、shard ごとの最新 snapshot として一時保持する
9. full sync 成功後、firestore_docs と firestore_index_items を初期化し、last_seen_updated_* を更新し、cache_ready を true にする
10. full sync 中に更新があった shard については、一時保持した最新 snapshot と firestore_index_items を再比較し、追加の changed key を抽出して反映する
11. 追加差分の反映完了後に通常の listener 適用モードへ移行する
12. ローカルキャッシュが存在し、正常に読める場合は snapshot 内 items と firestore_index_items を比較する
13. 変化した key 一覧を抽出する
14. 対応する doc path を組み立てる
15. 対象 doc のみ Firestore から取得する
16. firestore_docs を更新する
17. firestore_index_items を更新する
18. last_seen_updated_* を更新する
19. cache_ready を true にする

備考:

- ここでの「full collection getDocs を行わない」は通常フロー時に限る
- ローカル破損や schema 不一致など、フルリビルド許容条件に一致した場合は full sync へフォールバックしてよい
- 初回 full sync は、当該コレクションのローカルキャッシュが存在しない場合、または何らかの理由で読めない場合に限る
- full sync 中の listener イベントは逐次キューには積まず、shard ごとの最新状態だけを保持して full sync 後に再比較する

### 11.3 変更インデックス listener

変更インデックスの shard ドキュメントを常時監視する。

listener の対象:

- cacheIndex/firstGrade_**　
- cacheIndex/secondGrade_**
- cacheIndex/storageList_firstGrade_images_**
- cacheIndex/storageList_secondGrade_images_**

例: firstGrade_00, firstGrade_01, ... firstGrade_0f

受信時の流れ:

1. shard ドキュメント内 items と firestore_index_items を比較する
2. 変化した key 一覧を抽出する
3. 対応する doc path を組み立てる
4. 対象 doc のみ Firestore から取得する
5. firestore_docs、firestore_index_items、firestore_sync_state を同一 SQLite transaction で更新する
6. transaction 成功後に collection 購読者へ changed doc を配送する

full sync 中の追加ルール:

- full sync 中は listener 自体は停止しない
- ただし受信した snapshot は直ちに local 正本へ適用しない
- 代わりに shard_path ごとの最新 snapshot を保持し、dirty shard として記録する
- 同じ shard に対して複数 snapshot が届いた場合は、最後の snapshot で上書きする
- full sync 完了後に dirty shard のみ再比較し、必要な追加差分だけを反映する

### 11.4 listener 初期スナップショットの扱い

変更インデックス listener の初回スナップショットを、そのまま同期開始点として利用する。

この設計では、初回専用の別同期処理は持たない。

ただし、初回 snapshot を受けた時点でローカルキャッシュが存在しない、または読めない場合は、差分比較へ入らず full sync を優先する。

また、full sync 中に後続 snapshot が届いた場合はイベント列として蓄積せず、shard 単位の最新状態のみ保持する。

### 11.5 updatedAt 単一カーソル方針

差分同期の再開位置は updatedAt と doc_id の複合カーソルで管理する。

ルール:

- create 時は createdAt / updatedAt を serverTimestamp に設定する
- update 時は updatedAt を serverTimestamp に設定する
- logical delete 時は updatedAt を serverTimestamp に設定する
- 再作成時は deleted を false に戻し、updatedAt を serverTimestamp に設定する

この方針により、削除差分も updatedAt 1 本のカーソルで追跡する。

---

## 12. local query 仕様

### 12.1 基本方針

renderer の getOnce は原則としてローカル SQLite の正本に対する問い合わせとする。
キャッシュ未形成時は、エラーを返す（基本的に、キャッシュ未形成での getOnce は想定しない）。

### 12.2 local query と listener の責務分離

local query と listener は、内部的に同一範囲である必要はない。

- listener
	- 変更インデックス経由で collection 単位の変更検知を行う
- local query
	- renderer や main 機能から必要な範囲の読み取りを行う

第1段階では、renderer への patch は collection 単位の購読者へ changed doc を配送する形とする。

### 12.3 第1段階で正式対応する local query

第1段階では以下を正式対応とする。

- collection 全件取得

補足:

- 第1段階では QuerySpec は実質的に「collectionPath 単位の全件取得」に限定する
- 既存 renderer の主要利用箇所は全件取得後に renderer 側でフィルタリング・ソートしているため、まずはこの範囲に絞る
- where / orderBy / limit のローカル再現は第2段階以降で段階的に導入する

### 12.4 第1段階で非正式または後続対応とするもの

- document path 指定取得
- where 全般
- in
- not-in
- array-contains
- array-contains-any
- 複雑な複合条件
- orderBy
- limit
- Firestore 固有の厳密な index 制約再現

必要に応じて段階的に拡張する。

### 12.5 document 単位取得

document path 指定取得は QuerySpec には含めず、別 API として扱う。

理由:

- 現行の FirestoreQuerySpec は collection query 前提であり、document path 単位取得と責務が異なる
- 第1段階では local query 実装を単純化し、通信量削減の主目的に集中する

想定:

- `getDoc(path)` のような単票取得 API を追加する
- AssetStorage など既存の単票参照経路はこの API に寄せる

shared types 契約例:

- GetDocPayload
	- path: string
- GetDocResult
	- doc: CachedDoc | null
- Channel
	- `fs:getDoc`

---

## 13. patch 生成仕様

### 13.1 基本方針

変更インデックス listener は collection 単位の変更検知を行い、第1段階では同一 collection の購読者に changed doc をそのまま配送する。

第1段階では QuerySpec を collection 全件取得に限定するため、汎用的な QueryKey 差分再計算は行わない。

### 13.2 流れ

1. changed key に対応する doc を取得する
2. firestore_docs を更新する
3. 更新結果を collection 単位の購読者へ配送する
4. doc が新規追加なら added、既存更新なら modified、論理削除または対象外化なら removed を返す

### 13.3 reset の扱い

大規模再同期や full rebuild 時のみ reset を利用する。

通常の差分同期では added / modified / removed のみを返す。

---

## 14. renderer 側の扱い

### 14.1 基本方針

renderer は Firestore を直接読むのではなく、常に main 側キャッシュを読む。

### 14.2 useFirestoreHandler の扱い

外部 API は可能な限り維持する。

- getOnce は local query へ変更
- setActiveKeys は patch 配送対象管理として継続
- refresh は「ネット再取得」ではなく「ローカルキャッシュの再問い合わせ」とする

### 14.3 画面遷移時の期待動作

- TestDataList で firstGrade を表示してキャッシュ形成済みなら、Editor に遷移して戻っても全件 getDocs は発生しない
- 画面遷移では同一データをローカルから即時返す
- 更新は patch により追随する

---

## 15. main 内他機能との連携

### 15.1 TestCategory

testCategory は独自の Firestore listener を持たず、cache manager の更新イベントを利用する。

これにより:

- firstGrade / secondGrade の重複購読を回避する
- 同じローカル正本を共有できる
- 起動時の buildFromCacheOnce と差分更新が一貫する

### 15.2 AssetStorage

画像ファイル本体キャッシュは現状維持とする。

ただし Firestore 上の画像メタは cache manager の firestore_docs を正とし、AssetManager はそこから objectPath や md5Hash を取得する。

また、単票参照用 API は firestore_docs を参照する互換レイヤを用意する。

補足:

- renderer に返す base64 は、永続的に別保存するのではなく、local file cache から生成する
- したがって Asset の base64 キャッシュ整合性は、Firestore メタ更新時に local file cache を無効化できることをもって担保する
- `md5Hash`、`objectPath`、`updatedAt` のいずれかが変化した場合は、既存 local file を再利用せず再取得対象とする
- `size` や logical delete の変化も invalidate 判定に含める
- 今回の step2 では、画像入れ替えも想定に含め、Storage 本体差し替え後に Firestore メタを更新する契約を持つ
- `replaceAsset` は、まず既存 local file を破棄し generation を進め、その後 Storage 更新と Firestore メタ反映待ちを行う
- replace 中または invalidate 後に残っていた旧 download / read 完了通知は、generation 不一致として破棄する

---

## 16. 実装方針

### 16.1 段階的移行

#### 第1段階

- FirestoreCacheManager を新設する
- firstGrade / secondGrade のローカル正本を形成する
- 変更インデックス方式を TestData に導入する
- 起動時は listener 先行で同期を開始する
- 変更インデックスのローカル比較は firestore_index_items を用いる
- getOnce をローカル問い合わせへ差し替える
- getOnce の対象は collection 全件取得のみに限定する
- document 単位取得は別 API を追加して切り分ける
- patch は collection 全件取得購読者へ changed doc を配送する方式に簡略化する
- delete を論理削除へ統一する
- delete の変換は renderer や Outbox ではなく、main 側の共通書き込み経路で行う
- delete を含む全更新で updatedAt を serverTimestamp に統一する
- testCategory の独自 listener を廃止し、cache manager 経由に変える
- full sync 中の listener snapshot は shard ごとの最新状態のみ保持し、完了後に再比較する

この段階で、画面遷移ごとの full getDocs を大幅に減らすことを目的とする。


#### 第2段階

- storageList/{grade}/images を同じ仕組みに寄せる
- assetStorage の Firestore メタ参照先を統一する
- document 単位 local query API を整理する
- base64 応答の元になる local file cache の無効化条件を Firestore メタ更新と揃える
- 画像入れ替え API を実装し、Storage 更新と Firestore メタ更新を同一契約に揃える
- AssetData の計測項目を FirestoreCacheManager の metrics に統合し、手動確認経路を追加する
- AssetKey ごとの generation 管理を導入し、replace や invalidate と並行した旧 download / read の stale 通知を抑止する

#### 第3段階

- docs_cache と旧 getDoc/putDoc 系 API を縮退させる
- 旧 QueryKey キャッシュ経路を削除する

### 16.2 既存 public API の維持方針

極力維持する。

- window.fs.getOnce
- window.fs.setActiveKeys
- window.fs.mutate
- patch / outboxUpdate

内部実装のみ差し替えることで、renderer の変更量を抑える。

### 16.3 テスト・計測方針

今回の再実装では、Firestore 通信量とローカルキャッシュ利用状況を main 側で一元計測できるようにする。

計測の基本方針:

- renderer や各画面ではなく、FirestoreCacheManager を主計測点とする
- セッション内の累計値を memory 上で保持する
- 必要時のみ参照できる metrics 取得 API を用意する
- 常時詳細ログを増やしすぎず、必要最小限の summary と手動確認用ログに留める

最低限保持する計測項目:

- remote.fullSyncCount
	- full sync 実行回数
- remote.deltaFetchDocCount
	- changed key に基づいて Firestore から取得した doc 件数
- remote.indexSnapshotCount
	- 変更インデックス listener の server 由来 snapshot 受信回数
- remote.returnedDocCount
	- Firestore から返却された doc 総件数
- local.queryCount
	- collection 全件 local query 実行回数
- local.getDocCount
	- document 単位 local query 実行回数
- local.returnedDocCount
	- ローカル正本から返却した doc 総件数
- cache.hitCount
	- ローカルキャッシュ応答で完結した回数
- cache.missCount
	- ローカルに存在せず full sync または remote 再取得へ進んだ回数
- sync.rebuildCount
	- full rebuild 実行回数
- sync.lastReason
	- 直近の rebuild または full sync の理由

想定する確認 API:

- getMetrics()
	- 現在セッションの計測値を返す
- resetMetrics()
	- 手動テスト開始前に計測値をリセットする

補足:

- 課金 read 数の厳密再現は第1段階の目的ではない
- 今回は「不要な Firestore 通信が減ったか」「ローカルキャッシュ応答へ寄せられたか」を確認できる粒度を優先する
- step2 では、Asset についても同じ metrics API に集約し、Firestore メタ cache hit、local file hit / miss、base64 応答、再ダウンロード、invalidate 理由まで確認対象に含める

Asset で追加する計測項目:

- asset.localFileHitCount
	- local file からそのまま base64 応答できた回数
- asset.localFileMissCount
	- local file を再利用できず再取得へ進んだ回数
- asset.base64EmitCount
	- renderer へ base64 を返した回数
- asset.downloadCount
	- Storage から再ダウンロードした回数
- asset.downloadBytes
	- ダウンロードした総バイト数
- asset.metaCacheHitCount
	- Firestore メタを cache manager の local 正本から取得できた回数
- asset.metaInvalidationCount
	- local file cache を invalidate した回数
- asset.lastInvalidationReason
	- 直近の invalidate 理由

### 16.4 自動テスト方針

自動テストは、UI 挙動そのものよりも cache manager の責務が成立しているかを優先して確認する。

テスト対象:

- FirestoreCacheManager
- Firestore 実通信 client の計測連携
- getOnce / getDoc の local query 経路
- listener 経由の差分反映経路

テストの基本方針:

- 単体テストは Vitest を用いる
- cache manager の主要判定は fake client と fake cache を使って安定検証する
- Firestore SDK 実挙動との接続確認は emulator 前提テストで補完する
- describe や it の説明文は日本語で記述する

最低限必要な自動テスト項目:

1. 初回同期時にローカルキャッシュが無ければ full sync する
2. ローカルキャッシュが存在すれば初回 snapshot 後に差分比較へ進み、full sync しない
3. 同一 collection の 2 回目以降の getOnce は remote を増やさず local のみ増える
4. changed key が 1 件の時、remote 再取得も対象 doc のみに限定される
5. 論理削除 doc が差分同期で local 正本から除外される
6. rebuild 許容条件に一致した場合のみ full sync へフォールバックする
7. metrics の hit / miss / fullSyncCount / deltaFetchDocCount が期待通り更新される

補足:

- 既存の emulator テスト群とは別に、cache manager 専用テストファイルを追加する
- Firestore 実通信ログの有無そのものではなく、metrics の値を主要なアサーション対象とする

### 16.5 手動テスト方針

手動テストは、実際の画面遷移と更新操作に対して metrics とログ summary を確認する。

手動確認の基本手順:

1. テスト開始前に resetMetrics() を実行する
2. 対象シナリオを操作する
3. getMetrics() を取得する
4. 必要に応じて FirestoreNetwork 系ログ summary を確認する

最低限必要な手動テスト項目:

1. 初回起動確認
	- 期待値: fullSyncCount が 1 増える
	- 期待値: cache.missCount が増える
	- 期待値: local.queryCount も増える
2. 同一 collection 再表示確認
	- 例: TestDataList を開く → Editor へ遷移する → 一覧へ戻る
	- 期待値: remote.fullSyncCount は増えない
	- 期待値: remote.deltaFetchDocCount も増えない
	- 期待値: local.queryCount と cache.hitCount が増える
3. 差分更新確認
	- 例: emulator または別操作で 1 件更新する
	- 期待値: remote.indexSnapshotCount が増える
	- 期待値: remote.deltaFetchDocCount は changed doc 件数相当に留まる
	- 期待値: remote.fullSyncCount は増えない
4. 論理削除確認
	- 期待値: 削除後の通常表示から対象 doc が消える
	- 期待値: metrics 上も full sync ではなく差分更新として処理される

補足:

- 手動テストでは詳細な逐次ログよりもセッション集計値を主確認対象とする
- ログは調査補助として用い、日常確認は metrics 取得結果で完結できる状態を目指す

---

## 17. 受入基準

### 17.1 基本受入基準

- 初回起動時も通常起動時も、listener 先行の同一同期パイプラインで動作する
- 2 回目以降の通常起動では full collection getDocs が発生しない
- 初回 full sync は、当該コレクションのローカルキャッシュが存在しない場合、または読めない場合に限って実行される
- 通常起動後の同期は、変更インデックスに基づく対象 doc 取得で進む
- TestDataList から Editor に遷移して戻っても、同一級の full getDocs が繰り返されない
- renderer の getOnce は原則ローカルキャッシュのみで応答する
- 第1段階の patch は collection 全件取得購読者に対する changed doc 配送で成立する
- main 側の testCategory で重複 Firestore 購読が発生しない

### 17.2 削除受入基準

- delete 実行時に deleted がtrueに設定される
- delete 実行時に updatedAt も serverTimestamp で更新される
- 変更インデックスにも deleted がtrueに反映される
- 通常表示からは deleted 付きドキュメントが除外される
- 前回終了後に deleted が設定されたドキュメントは、次回起動時の差分同期でローカルキャッシュから除外される
- 通常運用経路に Firestore 物理削除が残っていない
- renderer の delete mutate と Outbox の kind は維持され、main 側の共通書き込み経路で論理削除へ変換される

### 17.3 変更インデックス受入基準

- create / set / update / delete の全経路で変更インデックスが更新される
- 特定 shard の更新時に、対象 key のみ差分取得される
- 単一ドキュメント集中更新が避けられている
- 変更インデックスのローカル比較は、JSON 全文 snapshot ではなく key 単位の軽量状態で行われる
- full sync 中に届いた listener snapshot は逐次キュー化せず、shard ごとの最新状態として再比較に使われる

### 17.4 資産メタ受入基準

- storageList/{grade}/images のメタ取得が Firestore 再読込ではなくローカル正本参照で成立する
- 画像本体ダウンロードは従来通り assets.db とローカルファイルで管理される
- Firestore メタの `md5Hash` / `objectPath` / `updatedAt` の変化を契機に local file cache が無効化される
- 同一画像の再表示では、Storage 再ダウンロードではなく既存 local file から base64 が返る
- 画像入れ替え後は旧 local file / 旧 base64 が残らず、新しいメタと内容に切り替わる
- replace 中や invalidate 後に旧 download / read が完了しても、generation 不一致の ready / progress / error が renderer に配送されない

### 17.5 テスト・計測受入基準

- セッション内の Firestore 通信量と local query 利用状況を metrics として取得できる
- metrics は reset 可能であり、手動テストシナリオごとに再計測できる
- 自動テストで full sync 条件、local hit、差分取得、論理削除反映を検証できる
- 手動テストで初回起動、同一 collection 再表示、差分更新、論理削除の各シナリオを確認できる
- 日常確認は metrics の summary で完結でき、詳細ログは補助用途に留まる
- Asset 系の local file hit / miss、base64 応答回数、再ダウンロード回数、メタ無効化回数が FirestoreCacheManager の metrics summary に統合されて確認できる
- 手動テストで画像再表示、メタ更新、画像入れ替え、論理削除の各シナリオを確認できる
- replace と並行した旧ダウンロードや旧ローカル読込があっても、generation 管理により古い ready / progress / error が混入しない

### 18.8 Asset replace と generation 管理

Asset の replace は、Storage 更新と Firestore メタ更新の両方が関わるため、単に local file を消すだけでは race condition を防ぎ切れない。

想定する競合:

- 旧画像のダウンロード中に replace が開始される
- 旧 local file の base64 読込中に replace が開始される
- Firestore メタ変更による invalidate 後に、直前の download / read が完了する

対策:

- AssetKey ごとに generation を保持する
- replace 開始時に generation を進める
- Firestore メタ差分により local file cache を invalidate する時も generation を進める
- download / read / progress / error は開始時の generation を引き回して評価する
- 完了時に generation が一致しなければ、DB 更新や ready 通知を行わず破棄する

この設計により、replace 中の並行処理が残っていても「最後に有効化された世代」のみが renderer へ観測される。

---

## 18. 懸念点と補足

### 18.1 フルリビルド許容条件

以下に該当する場合は、通常フローから外れて full sync にフォールバックしてよい。

- ローカルデータ破損検知時
- ローカルデータ消去時
- schema_version 不一致または migration 失敗時
- 一定回数以上の連続同期失敗時
- 手動メンテナンスまたは明示的な再構築指示時

抑制装置:

- 同一原因で連続して full rebuild を繰り返さないよう、rebuild reason と回数を保持する
- 同じ理由で 2 回連続失敗した場合は自動 rebuild を停止する
- 理由を問わず 3 回失敗した場合は自動 rebuild を停止する
- 停止後はエラー表示を行い、運用判断または手動復旧へ切り替える

firestore_sync_state の rebuild 制御項目:

- auto_rebuild_last_reason
- auto_rebuild_same_reason_failures
- auto_rebuild_total_failures
- auto_rebuild_last_attempt_ms
- auto_rebuild_blocked
- auto_rebuild_blocked_reason
- last_rebuild_succeeded_ms

### 18.2 transaction 境界

listener で抽出した changed key の反映は、少なくとも以下を同一 SQLite transaction で更新する。

- firestore_docs
- firestore_index_items
- firestore_sync_state

transaction 成功後にのみ renderer へ patch を配送する。

これにより、途中クラッシュ時も次回起動で同じ changed key を再評価しやすくする。

### 18.3 where/orderBy のローカル再現

SQLite 上で Firestore と同等の where/orderBy を再現する必要がある。

初期段階では対象クエリを絞る方が安全である。

### 18.4 updatedAt の品質

差分同期は updatedAt 前提のため、create / update / logical delete の全経路で updatedAt が確実に更新される必要がある。

また、updatedAt / createdAt の永続化時刻は serverTimestamp を使用する。

一方で、heartbeat、retry、UI の一時状態管理などローカル制御用時刻は Date.now のままでよい。

### 18.5 変更インデックス更新漏れ

一部経路だけ変更インデックス更新が漏れると、差分同期が破綻するため、書き込み API の統一が必要である。

### 18.6 shard 数の設計

shard 数が少なすぎると更新集中が起き、多すぎると listener 数が増える。

初期値は TestData と AssetData の件数、更新頻度、今後の伸びを見て決定する。

また、shard ごとに以下を上限目安とする。

- 最大 1000 key
- ドキュメントサイズ 512 KiB 以内

いずれかの上限に近づいた shard は分割対象とする。

### 18.7 オフライン時の扱い

本設計では renderer の参照はローカルキャッシュ優先のため、オフラインでも既存データの閲覧は継続できる。

ただし差分同期は次回接続時に再開される前提とする。

---

## 19. 今回の設計結論

今回のキャッシュ再設計では、以下を採用する。

1. Firestore キャッシュは QueryKey 単位ではなくコレクション単位のローカル正本に再編する
2. Firestore の常時監視は、シャーディングした変更インデックスを用いる
3. 変更インデックスの差分から対象 doc のみを取得してローカル正本を更新する
4. renderer の getOnce は原則ローカルキャッシュ応答へ変更する
5. 第1段階の patch は collection 単位の購読者へ changed doc を配送する
6. 削除は deleted を用いた論理削除に統一する
7. testCategory を含む main 側の他機能も、同じキャッシュ正本を共有する

この方針により、現状の IPC と renderer API を大きく崩さずに、画面遷移ごとの不要な getDocs と起動時の過大な listener 読込を抑制できる見込みである。
