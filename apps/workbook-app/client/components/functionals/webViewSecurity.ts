import {Asset} from 'expo-asset';
import type {WebViewSource} from 'react-native-webview/lib/WebViewTypes';

export const resolveWebViewSourceUri = (
  source: WebViewSource | string | number,
): string | undefined => {
  if (typeof source === 'object' && 'uri' in source) return source.uri;
  if (typeof source === 'string' && /^[a-z][a-z\d+.-]*:/i.test(source))
    return source;
  if (typeof source === 'string' || typeof source === 'number') {
    return Asset.fromModule(source).uri;
  }
  return undefined;
};

export const createLocalOriginWhitelist = (sourceUri?: string): string[] => {
  const whitelist = ['file://'];
  if (!__DEV__ || !sourceUri) return whitelist;
  const origin = /^([a-z][a-z\d+.-]*:\/\/[^/?#]+)/i.exec(sourceUri)?.[1];
  if (origin && origin !== 'file://') whitelist.push(`${origin}/*`);
  return whitelist;
};
