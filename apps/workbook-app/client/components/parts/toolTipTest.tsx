import {View} from 'react-native';
import {useState} from 'react';
import tw from '../../tailwind.custom';
import AppText from '../identities/appText';
import ToolTip from './toolTip';

export type ToolTipTestProps = Record<string, never>;

const ToolTipTest = (_props: ToolTipTestProps) => {
  const [_state, _setState] = useState(undefined);
  return (
    <View style={tw`w-1/2 h-1/2 bg-workbookblue-50 p-10`}>
      <AppText style={tw`text-primary text-base`}>
        テストテストテストテスト
      </AppText>
      <AppText style={tw`text-primary text-base`}>
        テストテストテストテスト
      </AppText>
      <ToolTip
        textPosition="top-5 left-5"
        toolTipText="これはツールチップのテストです"
      />
    </View>
  );
};

export default ToolTipTest;
