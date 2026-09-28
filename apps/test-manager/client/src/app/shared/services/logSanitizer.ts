import type { AppLogContext } from '@shared/types/logger';

const MASK_KEYS = [
  'token',
  'idToken',
  'accessToken',
  'refreshToken',
  'claims',
  'payload',
  'html',
  'firebaseConfig',
  'path',
];

const maskValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return '[masked]';
  }
  return '[masked]';
};

export const sanitizeLogContext = (
  context?: AppLogContext,
): AppLogContext | undefined => {
  if (!context) return undefined;

  const result: AppLogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (MASK_KEYS.includes(key)) {
      result[key] = maskValue(value);
      continue;
    }
    result[key] = value;
  }
  return result;
};
