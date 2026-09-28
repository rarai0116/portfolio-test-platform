/**
 * 回帰テスト: BasisButton の Pressable の disabled は「外部の props.isDisabled」だけで決まり、
 * 「押下中の内部状態(buttonState===disabled)」では無効化されないこと。
 *
 * 背景: Fabric(新アーキ)では Pressable の disabled を true→false に戻すとタッチ応答が
 * 復活せず、「1回押すと再度押せない」不具合が起きる。内部状態で disabled をトグルしない
 * 実装を保証する。
 */
import React from 'react';
import {Text} from 'react-native';
import {render} from '@testing-library/react-native';
import BasisButton from '../../components/identities/button';
import {
  ButtonContextProvider,
  ButtonStates,
} from '../../components/hooks/useButtonContext';

// レンダリングツリー(host)に accessibilityState.disabled===true / aria-disabled===true
// のノードが存在するか
const hasDisabledHost = (node: any): boolean => {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => hasDisabledHost(n));
  const props = node.props ?? {};
  if (props.accessibilityState?.disabled === true) return true;
  if (props['aria-disabled'] === true) return true;
  return hasDisabledHost(node.children);
};

describe('BasisButton disabled binding (Fabric stuck-press regression)', () => {
  it('内部状態が disabled でも、props.isDisabled=false なら Pressable は無効化されない', () => {
    const {toJSON} = render(
      <ButtonContextProvider state={ButtonStates.disabled}>
        <BasisButton isDisabled={false}>
          <Text>btn</Text>
        </BasisButton>
      </ButtonContextProvider>,
    );
    expect(hasDisabledHost(toJSON())).toBe(false);
  });

  it('props.isDisabled=true のときは Pressable が無効化される(外部無効化は機能する)', () => {
    const {toJSON} = render(
      <ButtonContextProvider>
        <BasisButton isDisabled>
          <Text>btn</Text>
        </BasisButton>
      </ButtonContextProvider>,
    );
    expect(hasDisabledHost(toJSON())).toBe(true);
  });
});
