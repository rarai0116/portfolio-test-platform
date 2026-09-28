import type { katex } from 'katex';

declare global {
  interface Window {
    katex: katex;
    Quill: typeof import('quill').default;
  }
}
