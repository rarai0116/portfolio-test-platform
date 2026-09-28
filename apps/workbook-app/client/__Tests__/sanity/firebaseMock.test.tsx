/**
 * Sanity test for the firebase mock foundation.
 * Confirms that firebase-dependent modules can be imported and rendered
 * under Jest without hitting the native RNFBAppModule.
 */
import React from 'react';
import {Text} from 'react-native';
import {render} from '@testing-library/react-native';
import {getApp} from '@react-native-firebase/app';

describe('firebase mock foundation', () => {
  it('mocks @react-native-firebase/app instead of loading the native module', () => {
    const app = getApp();
    expect(app).toBeDefined();
    expect(jest.isMockFunction(getApp)).toBe(true);
  });

  it('loads firebase.ts (module-load side effects) without throwing', () => {
    expect(() => require('../../components/functionals/firebase')).not.toThrow();
  });

  it('renders a component tree under the mocked environment', () => {
    const {getByText} = render(<Text>ok</Text>);
    expect(getByText('ok')).toBeTruthy();
  });
});
