import type Quill from 'quill';

export type Delta = ReturnType<Quill['getContents']>;
