import {useContext, useEffect, useMemo} from 'react';
import {useIsFocused} from '@react-navigation/native';
import ModalManagerContextProvider, {
  ModalManagerContext,
} from '../hooks/useModalManagerContext';
import {AuthContext} from '../hooks/useAuthContext';
import {GlobalUserSettingContext} from '../hooks/useGlobalUserSettingContext';
import BasicHalfModal from './basicHalfModal';
import type {BasicHalfModalProps} from './basicHalfModal';

const InnerModal = () => {
  // モーダルの表示状態を管理するためのコンテキスト
  const isFocused = useIsFocused();
  const {setIsResetApp} = useContext(AuthContext);
  const {hideModal} = useContext(ModalManagerContext);
  const {isReloadRequired} = useContext(GlobalUserSettingContext);
  const props = useMemo<BasicHalfModalProps>(() => {
    return {
      id: 'reloadInfoModal',
      hasInput: false,
      isBackDropPressFreeze: true,
      title: '他の端末での操作を検知しました',
      primaryButtonTitle: 'リロード',
      primaryButtonText: 'リロード',
      onPressOutPrimaryButton() {
        hideModal();
        setIsResetApp(true);
      },
    };
  }, [setIsResetApp, hideModal]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    if (isReloadRequired) {
      /** 一時的にリロードを停止 */
      // showModal('reloadInfoModal');
    }
  }, [isReloadRequired]);
  return <BasicHalfModal {...props} />;
};

/**
 * リロード通知用モーダル
 * @description 他の端末での操作を検知したため、アプリをリロードすることを伝えてリロードを行うモーダル
 * @requires ModalManagerContextProvider
 * @returns
 */
const ReloadInfoModal = () => {
  return (
    <ModalManagerContextProvider>
      <InnerModal />
    </ModalManagerContextProvider>
  );
};

export default ReloadInfoModal;
