import type React from 'react';
import {
  createContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useContext,
  useRef,
} from 'react';
import type {ReactNode} from 'react';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';

type ModalManagerContextObject = {
  activeModal: string | null;
  showModal: (modalState: string) => void;
  hideModal: (callBack?: () => void) => void;
  isModalHideAnimated: boolean;
  setIsModalHideAnimated: React.Dispatch<React.SetStateAction<boolean>>;
  modalLayoutedCount: React.MutableRefObject<number>;
  headerLayoutedCount: React.MutableRefObject<number>;
};

type Props = {
  // initialModalList?: ModalList;
  readonly children: ReactNode;
};

export const ModalManagerContext = createContext<ModalManagerContextObject>(
  {} as ModalManagerContextObject,
);
/**
 * モーダルの表示・非表示を管理するコンテキスト
 * @param children
 * @module showModal(modalID:string) 任意のIDのモーダルを表示する
 * @module hideModal() 表示中のモーダルを非表示にする
 * @desc 基本的にモーダルを設置するViewに設置してください
 * @desc モーダルはModalManagerContextProviderが必須です(存在しない場合、表示されません)
 * @sample <ModalManagerContextProvider>
 * 				<ModalView />
 * 			</ModalManagerContextProvider>
 *
 */
const ModalManagerContextProvider = (props: Props) => {
  const {setIsDisabledInput, isDisabledInput, isModalVisibleRef} = useContext(
    GlobalUserSettingContext,
  );
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [nextModal, setNextModal] = useState<string | null>(null);
  const [isModalHideAnimated, setIsModalHideAnimated] =
    useState<boolean>(false);
  const modalLayoutedCount = useRef<number>(0);
  const headerLayoutedCount = useRef<number>(0);
  /*
  const _isModalHideAnimated = useRef<boolean>(false);
  const isModalHideAnimated = _isModalHideAnimated.current;
  const setIsModalHideAnimated = useCallback(
    (modalState: boolean) => {
      _isModalHideAnimated.current = modalState;
    },
    [_isModalHideAnimated],
  );
  */
  // 次にモーダルが隠れたときに呼び出されるコールバック
  const hideModalCallBack = useRef<null | (() => void)>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const hideModal = useCallback(
    (callBack?: () => void) => {
      if (!activeModal) return;
      if (isModalHideAnimated) return;

      isModalVisibleRef.current = false; // モーダルが非表示になったことを参照に通知する
      //      setIsModalVisible(false);
      setActiveModal(null);
      setIsModalHideAnimated(true);
      setTimeout(() => {
        setIsModalHideAnimated(false);
      }, 1000);
      if (!callBack) return;
      hideModalCallBack.current = () => {
        setTimeout(() => {
          callBack();
        }, 1000); // アニメーションが終わるまで待つ
      };
    },
    [
      activeModal,
      isModalHideAnimated,
      //      setIsModalVisible,
      setActiveModal,
      setIsModalHideAnimated,
      isModalVisibleRef,
    ],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const showModal = useCallback(
    (modalState: string) => {
      if (activeModal === modalState) return;
      if (activeModal === null && !isModalHideAnimated) {
        setIsDisabledInput(false).catch((error: unknown) => {
          console.error('setIsDisabledInput failed', error);
        });
        isModalVisibleRef.current = true; // モーダルが表示されたことを参照に通知する
        setActiveModal(modalState);
      } else if (activeModal !== null && !isModalHideAnimated) {
        hideModal();
        setNextModal(modalState);
      } else {
        setActiveModal(null);
        setNextModal(modalState);
      }
    },
    [
      isDisabledInput,
      setIsDisabledInput,
      activeModal,
      setActiveModal,
      isModalHideAnimated,
      hideModal,
      isModalVisibleRef,
      // setIsModalVisible,
    ],
  );

  // モーダルが非表示になったときに呼び出されるuseEffect
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (isModalHideAnimated) return;
    if (hideModalCallBack.current) {
      hideModalCallBack.current();
      hideModalCallBack.current = null;
    }

    modalLayoutedCount.current = 0;
    headerLayoutedCount.current = 0;

    if (!nextModal) return;
    if (nextModal && activeModal === nextModal) {
      setNextModal(null);
      return;
    }

    if (activeModal) return;

    showModal(nextModal);
    setNextModal(null);
  }, [isModalHideAnimated, nextModal]);
  // isModalHideAnimatedがtrueになってから0.5秒後にisModalHideAnimatedをfalseにする

  /*
  useEffect(() => {
    if (!isModalHideAnimated) return;
    console.log('isModalHideAnimated', isModalHideAnimated);
    const timer = setTimeout(() => {
      setIsModalHideAnimated(false);
      console.log('setIsModalHideAnimated', isModalHideAnimated);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [isModalHideAnimated, setIsModalHideAnimated]);
  */

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      activeModal,
      showModal,
      hideModal,
      isModalHideAnimated,
      setIsModalHideAnimated,
      modalLayoutedCount,
      headerLayoutedCount,
    };
  }, [
    activeModal,
    hideModal,
    showModal,
    isModalHideAnimated,
    setIsModalHideAnimated,
    modalLayoutedCount,
    headerLayoutedCount,
  ]);

  return (
    <ModalManagerContext.Provider value={value}>
      {props.children}
    </ModalManagerContext.Provider>
  );
};

export default ModalManagerContextProvider;
