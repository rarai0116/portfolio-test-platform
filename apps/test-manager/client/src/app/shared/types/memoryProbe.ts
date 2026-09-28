export const MemoryProbeChannels = {
  mark: 'memory-probe:mark',
} as const;

export type MemoryProbeLabel = `S${0 | 1 | 2 | 3 | 4}`;
