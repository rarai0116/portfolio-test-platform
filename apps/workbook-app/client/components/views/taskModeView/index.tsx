import {useEffect} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {View} from 'react-native';
import ModalManagerContextProvider from '../../hooks/useModalManagerContext';
import TaskModeMainView from './taskModeMain';
import TaskModeViewContextProvider from './hooks/useTaskModeViewContext';
import Background from '@/components/parts/background';
import tw from '@/tailwind.custom';

export type TaskModeViewProps = Record<string, never>;

const TaskModeView = () => {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
  }, [isFocused]);

  return (
    <Background>
      <View style={tw`flex-1 bg-white`}>
        <ModalManagerContextProvider>
          <TaskModeViewContextProvider>
            <TaskModeMainView />
          </TaskModeViewContextProvider>
        </ModalManagerContextProvider>
      </View>
    </Background>
  );
};

export default TaskModeView;
