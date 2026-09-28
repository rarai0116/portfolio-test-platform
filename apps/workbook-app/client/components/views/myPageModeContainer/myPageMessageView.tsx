import {useWindowDimensions} from 'react-native';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {useRoute} from '@react-navigation/native';
import type {MyPageViewsProps} from '../../../types/viewParameter';
import MessageCardList from '../../organisms/messageCardList';
import ModalManagerContextProvider from '../../hooks/useModalManagerContext';

export type MyPageMessageViewProps = Record<string, never>;

const AllRoute = () => <MessageCardList index={0} />;
const TeacherRoute = () => <MessageCardList index={1} />;
const AppRoute = () => <MessageCardList index={2} />;

const Tab = createMaterialTopTabNavigator();

const MyPageMessageView = () => {
  const _route = useRoute<MyPageViewsProps<'MyPageMessage'>['route']>();
  const layout = useWindowDimensions();

  /*
  useEffect(() => {
    console.log('渡されたparams', route.params);
  }, [route.params]);
  */

  return (
    <ModalManagerContextProvider>
      <Tab.Navigator
        screenOptions={{
          tabBarIndicatorStyle: {backgroundColor: '#289DF4', height: 1},
          tabBarStyle: {backgroundColor: 'white'},
          tabBarInactiveTintColor: '#3F3F3F',
          tabBarActiveTintColor: '#289DF4',
          tabBarPressColor: 'transparent',
          tabBarScrollEnabled: false,
        }}
        initialLayout={{width: layout.width}}
        initialRouteName="すべて"
        tabBarPosition="top"
      >
        <Tab.Screen name="すべて" component={AllRoute} />
        <Tab.Screen name="講師" component={TeacherRoute} />
        <Tab.Screen name="アプリ" component={AppRoute} />
      </Tab.Navigator>
    </ModalManagerContextProvider>
  );
};

export default MyPageMessageView;
