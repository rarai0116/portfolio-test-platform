export const filterValuesByOptions = (
  selectedValues: string[],
  options: string[],
): string[] => {
  if (options.length === 0) return [];

  const optionSet = new Set(options);
  const seen = new Set<string>();

  return selectedValues.filter((value) => {
    if (!optionSet.has(value) || seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
};

export const areAllFilterOptionsSelected = (
  selectedValues: string[],
  options: string[],
): boolean => {
  const filteredValues = filterValuesByOptions(selectedValues, options);

  if (options.length === 0) {
    return filteredValues.length === 0;
  }

  if (filteredValues.length !== options.length) {
    return false;
  }

  const selectedSet = new Set(filteredValues);
  return options.every((option) => selectedSet.has(option));
};

export const normalizeCheckedFilterValues = (args: {
  selectedValues: string[];
  options: string[];
  initializeEmptyAsAll: boolean;
}): string[] => {
  const { selectedValues, options, initializeEmptyAsAll } = args;

  if (
    initializeEmptyAsAll &&
    selectedValues.length === 0 &&
    options.length > 0
  ) {
    return options;
  }

  return filterValuesByOptions(selectedValues, options);
};
