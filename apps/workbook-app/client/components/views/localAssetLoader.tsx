import {View} from 'react-native';
import {useState} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
/**
 * LocalAssetLoader
 * アセットリストを取得してダウンロードする
 * @return {*}
 */
const LocalAssetLoader = () => {
  const [_state, _setState] = useState(undefined);
  const _AsyncStorageKey = 'assets';
  // サーバーのアセットリストの読み込み

  // ローカルのアセットリストの読み込み
  // 更新データの絞り込み
  // データ読み込みをしていいか確認
  // ダウンロード処理
  // ローカルアセットリストの更新

  return (
    <View>
      <AppText style={tw`text-workbookblue-300`}>
        アセットデータのダウンロード中...()
      </AppText>
    </View>
  );
};

export default LocalAssetLoader;
