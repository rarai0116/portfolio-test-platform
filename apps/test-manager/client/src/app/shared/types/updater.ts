export const UpdaterChannels = {
  check: 'updater:check',        // Renderer -> Main (invoke)
  install: 'updater:install',    // Renderer -> Main (invoke)
  status: 'updater:status',      // Main -> Renderer (send)
} as const;

export type UpdaterStatusEvent =
  | { type: 'checking' }
  | { type: 'available' }
  | { type: 'not-available' }
  | { type: 'downloading'; percent?: number; transferred?: number; total?: number }
  | { type: 'downloaded'; releaseName?: string; releaseNotes?: string }
  | { type: 'error'; message: string };