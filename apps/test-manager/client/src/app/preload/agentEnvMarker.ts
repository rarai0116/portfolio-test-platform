// 起動済みアプリへ CDP でアタッチしたエージェントが、接続先の Firebase 環境を
// 判別するための読み取り専用マーカー。
//
// - 公開条件は main 側で CDP ポートを開いた場合と同一（demo_UI_AGENT_ACTIVE）。
//   ポートが開いていなければ外部から読む手段がないため、公開しても到達されない。
// - 環境の識別に必要な最小限のみを載せ、操作用 API は一切公開しない。
// - 個人情報や資格情報は載せない。
import { contextBridge } from 'electron';

export const AGENT_ENV_MARKER_KEY = '__demo_AGENT_ENV__';

type AgentEnvMarker = {
  useFirebaseEmulator: boolean;
  projectId: string | null;
};

if (process.env.demo_UI_AGENT_ACTIVE === '1') {
  const marker: AgentEnvMarker = {
    useFirebaseEmulator: process.env.USE_FIREBASE_EMULATOR === 'true',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? null,
  };

  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld(AGENT_ENV_MARKER_KEY, marker);
    } catch (error) {
      console.error(error);
    }
  } else {
    (globalThis as unknown as Record<string, AgentEnvMarker>)[
      AGENT_ENV_MARKER_KEY
    ] = marker;
  }
}
