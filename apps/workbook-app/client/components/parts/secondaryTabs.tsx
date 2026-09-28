import {View, ScrollView} from 'react-native';
import {useMemo, useContext} from 'react';
import tw from '../../tailwind.custom';
import {CheckButtonContext} from '../hooks/useCheckButtonContext';
import SecondaryTabPart from './secondaryTabPart';
import Spacer from './spacer';

export type SecondaryTabsProps = {
  readonly onActivateFunctionList?: Array<() => void>;
};

const SecondaryTabs = (properties: SecondaryTabsProps) => {
  const {buttonInfoList} = useContext(CheckButtonContext);

  const array: React.JSX.Element[] = useMemo(() => {
    if (!buttonInfoList) return [];
    return buttonInfoList.map((_v, i) => {
      const keyView = `secondaryTabPartViewA${i}`;
      return (
        <View key={keyView} style={tw`flex-row`}>
          <Spacer isHorizontal size={12} />
          <SecondaryTabPart
            info={buttonInfoList[i]}
            id={buttonInfoList[i].id}
            name={buttonInfoList[i].name}
            onActivateFromProps={() => {
              if (properties.onActivateFunctionList?.[i]) {
                properties.onActivateFunctionList[i]();
              }
            }}
          />
        </View>
      );
    });
  }, [buttonInfoList, properties.onActivateFunctionList]);

  return (
    <ScrollView
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tw`min-w-full py-3.5 bg-background flex-row`}
    >
      {array}
      <Spacer isHorizontal size={12} />
    </ScrollView>
  );
};

export default SecondaryTabs;
