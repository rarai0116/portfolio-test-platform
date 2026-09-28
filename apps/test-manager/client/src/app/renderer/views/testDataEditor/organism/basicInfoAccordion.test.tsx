import { mockTestDocs } from '@renderer/mocks/mockTestDataList';
import { render, screen } from '@testing-library/react';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BasicInfoAccordion from './basicInfoAccordion';

vi.mock('@views/testDataEditor/store/useSelectedIdStore', () => ({
  default: vi.fn(),
}));
vi.mock('@views/testDataEditor/store/useTestDataStore', () => ({
  default: vi.fn(),
}));

describe('BasicInfoAccordion', () => {
  const ID = 'test-id';
  const mockData = mockTestDocs[0].data;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSelectedIdStore).mockReturnValue({
      selectedDataId: ID,
    });
    vi.mocked(useTestDataStore).mockReturnValue({
      editMap: {
        [ID]: {
          data: mockData,
        },
      },
    });
  });

  it('selectedDataIdが表示される', () => {
    render(<BasicInfoAccordion onPatchEdit={() => {}} />);
    expect(screen.getByText(/No\.test-id/)).toBeInTheDocument();
  });

  it('各フォームラベルが表示される', () => {
    render(<BasicInfoAccordion onPatchEdit={() => {}} />);
    expect(screen.getByText('答え')).toBeInTheDocument();
    expect(screen.getByText('元号')).toBeInTheDocument();
    expect(screen.getByText('年度')).toBeInTheDocument();
    expect(screen.getByText('問題No.')).toBeInTheDocument();
    expect(screen.getByText('難易度')).toBeInTheDocument();
    expect(screen.getByText('発行年')).toBeInTheDocument();
    expect(screen.getByText('資料No')).toBeInTheDocument();
  });

  it('入力フィールドが表示される', () => {
    render(<BasicInfoAccordion onPatchEdit={() => {}} />);
    expect(screen.getByLabelText('答え')).toBeInTheDocument();
    expect(screen.getByLabelText('元号')).toBeInTheDocument();
    expect(screen.getByLabelText('年度')).toBeInTheDocument();
    expect(screen.getByLabelText('問題No.')).toBeInTheDocument();
    expect(screen.getByLabelText('難易度')).toBeInTheDocument();
    expect(screen.getByLabelText('発行年')).toBeInTheDocument();
    expect(screen.getByLabelText('資料No')).toBeInTheDocument();
  });
});
