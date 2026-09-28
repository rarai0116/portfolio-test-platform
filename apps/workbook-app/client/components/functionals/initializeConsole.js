import Constants from 'expo-constants';
import {createConsoleController} from './consoleLevels';

// Fast Refreshでも元の出力先を再利用し、ラッパーの多重化を防ぐ。
const key = Symbol.for('workbook.consoleController');
const state =
  globalThis[key] ??
  (() => {
    const original = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
    return createConsoleController(original, __DEV__);
  })();
globalThis[key] = state;
Object.assign(console, state.console);
const environment = Constants.expoConfig?.extra?.APP_ENV;
const disabled = () => {};
if (environment === 'production') {
  Object.assign(console, {
    log: disabled,
    info: disabled,
    warn: disabled,
    error: disabled,
    debug: disabled,
  });
} else if (environment === 'staging') {
  state.setLevel('warn');
  Object.assign(console, {log: disabled, info: disabled, debug: disabled});
}
if (__DEV__ && environment !== 'production' && environment !== 'staging') {
  // React Native DevToolsのConsoleから、アプリ再起動なしで変更できる。
  globalThis.appConsole = {setLevel: state.setLevel, getLevel: state.getLevel};
} else {
  delete globalThis.appConsole;
}
