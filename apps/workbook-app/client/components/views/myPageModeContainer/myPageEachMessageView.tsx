import {View} from 'react-native';
import {useContext, useMemo} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {MyPageViewsProps} from '../../../types/viewParameter';
import ModalManagerContextProvider from '../../hooks/useModalManagerContext';
import Spacer from '../../parts/spacer';
import displayMessageCardList from '../../parts/displayMessageCardList';
import {messageCardStyle} from '../../../types/commonUnionType';
import {GlobalSaveDataContext} from '../../hooks/useGlobalSaveDataContext';

export type MyPageEachMessageViewProps = {readonly id: string};

const InnerView = (props: MyPageEachMessageViewProps) => {
  const _navigation =
    useNavigation<MyPageViewsProps<'MyPageHome'>['navigation']>();

  const {messageData} = useContext(GlobalSaveDataContext);

  const data = useMemo(() => {
    return Object.values(messageData)
      .filter((v) => v.id === props.id)
      .map((v) => ({
        // ...v,
        id: v.id,
        cardType: messageCardStyle.detail,
      }));
  }, [messageData, props.id]);

  return (
    <View>
      <Spacer isHorizontal={false} size={12} />
      {displayMessageCardList({list: data})}
    </View>
  );
};

const MyPageEachMessageView = () => {
  const route = useRoute<MyPageViewsProps<'MyPageEachMessage'>['route']>();

  return (
    <ModalManagerContextProvider>
      <InnerView id={route.params.id} />
    </ModalManagerContextProvider>
  );
};

export default MyPageEachMessageView;
