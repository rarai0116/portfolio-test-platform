import { render, screen } from '@testing-library/react';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DetailInfoAccordion from './detailInfoAccordion';

vi.mock('@views/testDataEditor/store/useSelectedIdStore', () => ({
  default: vi.fn(),
}));

describe('DetailInfoAccordion', () => {
  const id = 'test-detail-id';
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSelectedIdStore).mockReturnValue({
      selectedDataId: id,
      selectedGrade: '1',
    });
  });

  it('主要なフォームラベルが表示される', () => {
    render(
      <DetailInfoAccordion
        onPatchEdit={() => {}}
        bigOptions={[]}
        smallOptions={[]}
        onCreateBigOption={() => {}}
        onCreateSmallOption={() => {}}
      />,
    );

    expect(screen.getByText('大分類')).toBeInTheDocument();
    expect(screen.getByText('小分類')).toBeInTheDocument();
    expect(screen.getByText('テーマ')).toBeInTheDocument();
    expect(screen.queryByText('出典元情報')).not.toBeInTheDocument();
    expect(screen.queryByText('発行年')).not.toBeInTheDocument();
    expect(screen.queryByText('資料No')).not.toBeInTheDocument();
  });
});
