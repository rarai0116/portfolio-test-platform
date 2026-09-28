import type {EffectCallback, DependencyList} from 'react';
import {useEffect, useRef} from 'react';

// 初回の実行をスキップするuseEffect
export type UseUpdateEffectProps = {
  fn: EffectCallback;
  deps?: DependencyList;
};

const useUpdateEffect = (fn: EffectCallback, deps: DependencyList) => {
  const didMountRef = useRef<boolean>(false);

  useEffect(() => {
    if (didMountRef.current) {
      fn();
    } else {
      didMountRef.current = true;
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  }, deps);
  // deps: DependencyListで指定しているので以下のエラーは無視
  // React Hook useEffect was passed a dependency list that is not an array literal.
};

export default useUpdateEffect;
