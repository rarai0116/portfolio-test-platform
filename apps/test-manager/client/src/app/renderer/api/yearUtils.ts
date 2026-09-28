const getCurrentYear = (date = new Date()) => date.getFullYear();

const getFiscalYear = (date = new Date()) =>
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

const getJapaneseEra = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
    era: 'long',
    year: 'numeric',
  }).formatToParts(date);

  return {
    era: parts.find((part) => part.type === 'era')?.value ?? '',
    year: parts.find((part) => part.type === 'year')?.value ?? '',
  };
};

export const currentYear = getCurrentYear();
export const fiscalYear = getFiscalYear();

// 今年の和暦
export const currentWareki = getJapaneseEra(new Date());
// 今年度の和暦
export const fiscalWareki = getJapaneseEra(new Date(fiscalYear, 3, 1));
