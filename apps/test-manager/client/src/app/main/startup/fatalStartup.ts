import { app, dialog } from 'electron';

/**
 * 起動処理のどの段階で失敗したかを表す（設計4.2）。
 * 画像アセット初期化のphaseと、それ以外の起動失敗を区別するために使う。
 */
export type StartupErrorPhase =
  | 'scheme-register'
  | 'asset-root-create'
  | 'asset-root-trust-check'
  | 'asset-root-realpath'
  | 'asset-db-open'
  | 'asset-ipc-register'
  | 'unknown';

const ASSET_PHASES: ReadonlySet<StartupErrorPhase> = new Set([
  'scheme-register',
  'asset-root-create',
  'asset-root-trust-check',
  'asset-root-realpath',
  'asset-db-open',
  'asset-ipc-register',
]);

export class StartupError extends Error {
  readonly phase: StartupErrorPhase;

  constructor(
    phase: StartupErrorPhase,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'StartupError';
    this.phase = phase;
  }
}

export const isAssetStartupPhase = (phase: StartupErrorPhase): boolean =>
  ASSET_PHASES.has(phase);

const getPhase = (error: unknown): StartupErrorPhase =>
  error instanceof StartupError ? error.phase : 'unknown';

const ASSET_DIALOG_MESSAGE = [
  '画像アセットの初期化に失敗したため、アプリを起動できません。',
  '',
  'アプリを再起動しても解決しない場合は、管理者へログの確認を依頼してください。',
].join('\n');

const GENERIC_DIALOG_MESSAGE = [
  'アプリの起動処理に失敗したため、起動を中止します。',
  '',
  'アプリを再起動しても解決しない場合は、管理者へログの確認を依頼してください。',
].join('\n');

// ダイアログと終了を多重に走らせない（設計4.2）。
let handled = false;

/**
 * 起動Promise内の未処理例外を受け取り、ログ・ダイアログ・終了を1回だけ行う。
 * 起動後の一般例外やIPC個別失敗をアプリ終了へ昇格させる用途では使わない。
 */
export function handleFatalStartupError(error: unknown): void {
  if (handled) {
    // 2件目以降は記録だけ行い、終了処理は最初の1件に任せる。
    console.error(
      '[startup] additional fatal error after shutdown started',
      error,
    );
    return;
  }
  handled = true;

  const phase = getPhase(error);
  const isAssetPhase = isAssetStartupPhase(phase);

  // 詳細なerror、stack、ローカルパスはログだけに残す。
  console.error('[startup] fatal startup error', {
    phase,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    cause: error instanceof Error ? error.cause : undefined,
  });

  try {
    dialog.showErrorBox(
      isAssetPhase
        ? '画像アセットの初期化に失敗しました'
        : 'アプリを起動できません',
      isAssetPhase ? ASSET_DIALOG_MESSAGE : GENERIC_DIALOG_MESSAGE,
    );
  } catch (dialogError) {
    // ダイアログ自体が失敗しても終了する。
    console.error('[startup] failed to show startup error dialog', dialogError);
  }

  app.exit(1);
}
