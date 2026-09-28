import {createContext, useCallback, useMemo} from 'react';
import type {ReactNode} from 'react';
import type React from 'react';
import {
  findNodeHandle,
  type TextInput,
  type ScrollView,
  type View,
  Platform,
} from 'react-native';

type ScrollToComponentContextObject = {
  scrollViewRef: React.MutableRefObject<ScrollView | null>;
  scrollToTargetComponent: (
    targetRef: React.MutableRefObject<TextInput | View | null>,
  ) => void;
};

type Props = {
  readonly children: ReactNode;
  readonly scrollViewRef: React.MutableRefObject<ScrollView | null>;
};

export const ScrollToComponentContext =
  createContext<ScrollToComponentContextObject>(
    {} as ScrollToComponentContextObject,
  );

export const ScrollToComponentContextProvider = (props: Props) => {
  const scrollViewRef: React.MutableRefObject<ScrollView | null> = useMemo(
    () => props.scrollViewRef,
    [props.scrollViewRef],
  );

  //* * scrollView内にあるInputにfocusした時、keyboardに隠れないようにscrollする */
  // 参考: https://zenn.dev/mczk9402/articles/6be16689238ad4
  const scrollToTargetComponent = useCallback(
    (targetRef: React.MutableRefObject<TextInput | View | null>) => {
      if (Platform.OS === 'android') return;
      const target = targetRef.current;
      const scrollView = scrollViewRef.current;

      if (!target || !scrollView) return;
      //      const nativeScrollView = findNodeHandle(scrollView);
      const nativeTarget = findNodeHandle(target);
      //      if (!nativeScrollView) return;

      scrollView.scrollResponderScrollNativeHandleToKeyboard(
        nativeTarget,
        40,
        true,
      );
      /*
      target.measureLayout(
        nativeScrollView,
        // measureLayoutはrefではアクセスできないため、findNodeHandleでラッピングする
        (x, y) => {
          scrollView.scrollTo({y});
        },
        () => {
          console.error('measureLayout error');
        },
      );
      */
    },
    [scrollViewRef],
  );

  const value = useMemo(() => {
    return {
      scrollViewRef,
      scrollToTargetComponent,
    };
  }, [scrollViewRef, scrollToTargetComponent]);

  return (
    <ScrollToComponentContext.Provider value={value}>
      {props.children}
    </ScrollToComponentContext.Provider>
  );
};
