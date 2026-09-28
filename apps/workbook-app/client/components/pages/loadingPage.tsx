// import {SafeAreaView} from 'react-native-safe-area-context';
import LoadingView from '../views/loadingView';
import LoadingContextProvider, {
  type LoadingPageProps,
} from '../hooks/useLoadingContext';
import ModalManagerContextProvider from '../hooks/useModalManagerContext';
import ReloadInfoModal from '../parts/reloadInfoModal';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
const LoadingPage = ({navigation}: LoadingPageProps) => {
  return (
    <ModalManagerContextProvider>
      <LoadingContextProvider navigation={navigation}>
        <GestureHandlerRootView style={{flex: 1}}>
          <ReloadInfoModal />
          <LoadingView />
        </GestureHandlerRootView>
      </LoadingContextProvider>
    </ModalManagerContextProvider>
  );
};

export default LoadingPage;
