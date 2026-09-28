import CrossIcon from '@components/icons/crossIcon';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('CrossIcon', () => {
  it('SVGが描画される', () => {
    // title は prop 化され既定値が空文字のため、アクセシブルタイトルを明示的に渡す
    render(<CrossIcon title="CrossIcon" />);
    expect(screen.getByTitle('CrossIcon')).toBeInTheDocument();
  });

  it('props.fillで色が変わる', () => {
    render(<CrossIcon title="CrossIcon" fill="#ff0000" />);
    const path = screen
      .getByTitle('CrossIcon')
      .parentElement?.querySelector('path[fill="#ff0000"]');
    expect(path).not.toBeNull();
  });

  it('props.sizeでサイズが変わる', () => {
    render(<CrossIcon title="CrossIcon" size={48} />);
    const svg = screen.getByTitle('CrossIcon').parentElement;
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });
});
