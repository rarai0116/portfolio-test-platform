export const CsvFileChannels = {
  open: 'csvFile:open', // Renderer/Preload -> Main (invoke)
  save: 'csvFile:save', // Renderer/Preload -> Main (invoke)
} as const;

export type OpenCsvResult =
  | { ok: true; bytes: Uint8Array; fileName?: string }
  | { ok: false; error: string };

export type SaveCsvResult = { ok: true } | { ok: false; error: string };
