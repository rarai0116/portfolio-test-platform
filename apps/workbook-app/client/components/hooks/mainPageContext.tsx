import type React from 'react';
import {createContext, useMemo, useCallback} from 'react';
import {CommonActions} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {allScreenIdList, type RootPagesList} from '@/types/viewParameter';

type MainPageNavigation = StackNavigationProp<RootPagesList, 'MainPage'>;
export type MainPageContextType = {
  navigateToQuestionAndChoiceView: () => void;
  navigation: MainPageNavigation;
};

export const MainPageContext = createContext<MainPageContextType>(
  {} as MainPageContextType,
);

export type MainPageContextProviderProps = {
  readonly children: React.ReactNode;
  readonly navigation: MainPageNavigation;
};

const MainPageContextProvider = (props: MainPageContextProviderProps) => {
  const {navigation} = props;
  // navigation の ref を作成
  // QuestionAndChoiceViewへの遷移
  const navigateToQuestionAndChoiceView = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainPage',
            params: {
              userId: allScreenIdList.MainPage,
              screen: 'Test',
              params: {
                userId: allScreenIdList.Test,
                screen: 'QuestionAndChoicesView',
                params: {
                  userId: allScreenIdList.QuestionAndChoicesView,
                },
              },
            },
          },
        ],
      }),
    );
  }, [navigation]);
  // useMemo を使って context value をメモ化
  const value = useMemo(() => {
    return {
      navigateToQuestionAndChoiceView,
      navigation,
    };
  }, [navigation, navigateToQuestionAndChoiceView]);

  return (
    <MainPageContext.Provider value={value}>
      {props.children}
    </MainPageContext.Provider>
  );
};

export default MainPageContextProvider;
