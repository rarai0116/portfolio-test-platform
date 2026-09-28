export const panel = {
  questionEditor: 'questionEditor',
  imageAsset: 'imageAsset',
  preview: 'preview',
} as const;

export type DockViewPanel = (typeof panel)[keyof typeof panel];
