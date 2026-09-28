const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

export const isSafeExternalUrl = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
};
