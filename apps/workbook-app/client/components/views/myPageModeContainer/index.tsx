import {useRoute} from '@react-navigation/native';
import ModalManagerContextProvider from '../../hooks/useModalManagerContext';
import type {MyPageViewsProps} from '../../../types/viewParameter';
import {InquiryFormContextProvider} from '../../hooks/useInquiryFormContextProvider';
import MyPageModeContainerBody from './container';

const MyPageModeContainer = () => {
  const _route = useRoute<MyPageViewsProps<'MyPageHome'>['route']>();

  return (
    <ModalManagerContextProvider>
      <InquiryFormContextProvider>
        <MyPageModeContainerBody />
      </InquiryFormContextProvider>
    </ModalManagerContextProvider>
  );
};

export default MyPageModeContainer;
