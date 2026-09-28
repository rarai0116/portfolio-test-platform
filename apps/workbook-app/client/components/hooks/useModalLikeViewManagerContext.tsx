import type React from 'react';
import {
  createContext,
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useContext,
} from 'react';
import type {ReactNode} from 'react';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';

type ModalLikeViewManagerContextObject = {
  activeModalLikeView: string | null;
  setActiveModalLikeView: (modalState: string) => void;
  showModalLikeView: (modalState: string) => void;
  hideModalLikeView: (callBack?: () => void) => void;
  isModalLikeViewHideAnimated: boolean;
  setIsModalLikeViewHideAnimated: React.Dispatch<React.SetStateAction<boolean>>;
  isModalLikeViewShowAnimated: boolean;
  setIsModalLikeViewShowAnimated: React.Dispatch<React.SetStateAction<boolean>>;
  previousModalLikeView: string | null;
  setPreviousModalLikeView: React.Dispatch<React.SetStateAction<string | null>>;
  hidedModalProcess: () => void;
};

type Props = {
  readonly children: ReactNode;
};

export const ModalLikeViewManagerContext =
  createContext<ModalLikeViewManagerContextObject>(
    {} as ModalLikeViewManagerContextObject,
  );

const ModalLikeViewManagerContextProvider = (props: Props) => {
  const {setIsDisabledInput, isModalLikeViewVisibleRef} = useContext(
    GlobalUserSettingContext,
  );
  // ModalManagerContextと同じ
  const [activeModalLikeView, setActiveModalLikeView] = useState<string | null>(
    null,
  );
  const [nextModalLikeView, setNextModalLikeView] = useState<string | null>(
    null,
  );
  const [isModalLikeViewHideAnimated, setIsModalLikeViewHideAnimated] =
    useState<boolean>(false);
  const [isModalLikeViewShowAnimated, setIsModalLikeViewShowAnimated] =
    useState<boolean>(false);

  const [previousModalLikeView, setPreviousModalLikeView] = useState<
    string | null
  >(null);

  const showModalLikeView = useCallback(
    (modalState: string) => {
      if (activeModalLikeView === modalState) return;
      if (isModalLikeViewShowAnimated) return;

      setPreviousModalLikeView(activeModalLikeView);
      if (activeModalLikeView === null && !isModalLikeViewHideAnimated) {
        isModalLikeViewVisibleRef.current = true;
        setActiveModalLikeView(modalState);
        setIsDisabledInput(false);
      } else {
        // それ以外の場合はまず非表示アニメーションを行う
        setActiveModalLikeView(null);
        setNextModalLikeView(modalState);
        // setIsModalLikeViewHideAnimated(true);
      }
    },
    [
      setIsDisabledInput,
      activeModalLikeView,
      isModalLikeViewHideAnimated,
      isModalLikeViewShowAnimated,
      isModalLikeViewVisibleRef,
    ],
  );

  const hideModalCallBack = useRef<null | (() => void)>(null);
  const hideModalLikeView = useCallback(
    (callBack?: () => void) => {
      if (!activeModalLikeView) return;
      if (isModalLikeViewHideAnimated) return;
      if (isModalLikeViewShowAnimated) return;

      //      setIsModalLikeViewVisible(false);
      isModalLikeViewVisibleRef.current = false;
      setActiveModalLikeView(null);
      setPreviousModalLikeView(activeModalLikeView);
      // setIsModalLikeViewHideAnimated(true);
      if (!callBack) return;
      hideModalCallBack.current = callBack;
    },
    [
      isModalLikeViewVisibleRef,
      activeModalLikeView,
      isModalLikeViewHideAnimated,
      isModalLikeViewShowAnimated,
    ],
  );

  // モーダルが非表示になったときに呼び出される関数
  // 注: hideの過去形はhidだが、ここではわかりやすさ重視でhidedとしている
  const hidedModalProcess = useCallback(() => {
    setIsModalLikeViewHideAnimated(false);
    if (!nextModalLikeView) return;
    setActiveModalLikeView(nextModalLikeView);
    setNextModalLikeView(null);
    setPreviousModalLikeView(null);
  }, [nextModalLikeView]);

  // モーダルが非表示になったときに呼び出されるuseEffect
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (isModalLikeViewHideAnimated) return;
    if (hideModalCallBack.current) {
      hideModalCallBack.current();
      hideModalCallBack.current = null;
    }
  }, [hideModalCallBack, isModalLikeViewHideAnimated]);
  /*
  useEffect(() => {
    if (!nextModalLikeView) return;
    if (isModalLikeViewHideAnimated) return;
    console.log('nextModalLikeView', nextModalLikeView);
    setActiveModalLikeView(nextModalLikeView);
    setNextModalLikeView(null);
  }, [isModalLikeViewHideAnimated, nextModalLikeView]);
*/

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const value = useMemo(() => {
    return {
      activeModalLikeView,
      setActiveModalLikeView,
      showModalLikeView,
      hideModalLikeView,
      isModalLikeViewHideAnimated,
      setIsModalLikeViewHideAnimated,
      isModalLikeViewShowAnimated,
      setIsModalLikeViewShowAnimated,
      previousModalLikeView,
      setPreviousModalLikeView,
      hidedModalProcess,
    };
  }, [
    activeModalLikeView,
    setActiveModalLikeView,
    previousModalLikeView,
    setPreviousModalLikeView,
    showModalLikeView,
    hideModalLikeView,
    isModalLikeViewHideAnimated,
    setIsModalLikeViewHideAnimated,
    isModalLikeViewShowAnimated,
    setIsModalLikeViewShowAnimated,
    hidedModalProcess,
  ]);

  return (
    <ModalLikeViewManagerContext.Provider value={value}>
      {props.children}
    </ModalLikeViewManagerContext.Provider>
  );
};

export default ModalLikeViewManagerContextProvider;
