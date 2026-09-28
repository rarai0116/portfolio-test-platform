import {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import {GlobalUserSettingContext} from './useGlobalUserSettingContext';

/** intervalの単位: ms */
export type UseIntervalProps = {
  fn: () => void;
  interval: number;
  autostart: boolean;
};

export type TimeState = 'Running' | 'Stopped';
type Control = {
  startTime: () => void;
  stopTime: () => void;
};

type Fn = () => void;

const useInterval = (props: UseIntervalProps): [TimeState, Control] => {
  /* const onUpdateRef = useRef<UseIntervalProps['onUpdate']>(() => {
		console.log('useInterval');
	}); */
  const {setGlobalTimerId} = useContext(GlobalUserSettingContext);
  const onUpdateRef = useRef<Fn>(() => {});
  const [timeState, setTimerState] = useState<TimeState>('Stopped');
  const startTime = useCallback(() => {
    setTimerState('Running');
  }, []);

  const stopTime = useCallback(() => {
    setTimerState('Stopped');
  }, []);

  const timeController: Control = useMemo(() => {
    return {startTime, stopTime};
  }, [startTime, stopTime]);

  useEffect(() => {
    onUpdateRef.current = props.fn;
  }, [props.fn]);

  useEffect(() => {
    if (props.autostart) {
      setTimerState('Running');
    }
  }, [props.autostart]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    if (timeState === 'Running') {
      timerId = setInterval(() => {
        onUpdateRef.current?.();
      }, props.interval);
      setGlobalTimerId(timerId);
      // console.log('Running!');
    } else if (timerId) {
      clearInterval(timerId);
      // console.log('Stopped!');
      setGlobalTimerId(undefined);
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
        // console.log('Stopped!!');
        setGlobalTimerId(undefined);
      }
    };
  }, [props.interval, timeState, setGlobalTimerId]);

  return [timeState, timeController];
};

export default useInterval;
