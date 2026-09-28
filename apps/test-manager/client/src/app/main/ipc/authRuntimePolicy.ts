type LocalAuthEmulatorPolicyInput = {
  isPackaged: boolean;
  useFirebaseEmulator?: string;
};

export const shouldUseLocalAuthEmulator = ({
  isPackaged,
  useFirebaseEmulator,
}: LocalAuthEmulatorPolicyInput): boolean => {
  return !isPackaged && useFirebaseEmulator === 'true';
};
