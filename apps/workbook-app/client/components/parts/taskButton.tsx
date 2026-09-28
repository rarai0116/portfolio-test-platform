import {useCallback} from 'react';
import type {ReactNode} from 'react';
import PlayIcon from '../../assets/svg/play_start-task-button.svg';
import CheckIcon from '../../assets/svg/check_save-task-button.svg';
import PlusIcon from '../../assets/svg/plus_add-task-button.svg';
import BasisButton from '../identities/button';

export type TaskButtonProps = {readonly type: string};

const TaskButton = (props: TaskButtonProps) => {
  const icon: ReactNode = useCallback(() => {
    switch (props.type) {
      case 'add': {
        return <PlusIcon />;
      }

      case 'save': {
        return <CheckIcon />;
      }

      case 'start': {
        return <PlayIcon />;
      }

      default: {
        return <PlusIcon />;
      }
    }
  }, [props.type])();

  return (
    <BasisButton
      width="40px"
      height="40px"
      pressedOpacity={1}
      releasedButtonStyle={['rounded-full bg-workbookblue-500']}
      pressedButtonStyle={['rounded-full bg-workbookblue-600 ']}
      disabledButtonStyle={['rounded-full bg-workbookblue-100 ']}
    >
      {icon}
    </BasisButton>
  );
};

export default TaskButton;
