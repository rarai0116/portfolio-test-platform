import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  TelemetryBreadcrumb,
  TelemetryEvent,
  TelemetryRuntimeMode,
} from '@shared/types/telemetry';
import { app } from 'electron';

export type StoredTelemetrySession = {
  installationId: string;
  sessionId: string;
  runtimeMode: TelemetryRuntimeMode;
  startedAt: string;
  cleanExit: boolean;
  lastKnownRoute?: string;
  lastBreadcrumbs: TelemetryBreadcrumb[];
};

const MAX_PENDING_EVENTS = 50;

export class TelemetryStore {
  private readonly dirPath = path.join(app.getPath('userData'), 'telemetry');
  private readonly pendingFilePath = path.join(this.dirPath, 'pending.json');
  private readonly sessionFilePath = path.join(this.dirPath, 'session.json');

  constructor() {
    mkdirSync(this.dirPath, { recursive: true });
  }

  readSession(): StoredTelemetrySession | null {
    return this.readJsonFile<StoredTelemetrySession>(this.sessionFilePath);
  }

  writeSession(session: StoredTelemetrySession): void {
    this.writeJsonFile(this.sessionFilePath, session);
  }

  readPending(): TelemetryEvent[] {
    return this.readJsonFile<TelemetryEvent[]>(this.pendingFilePath) ?? [];
  }

  writePending(events: TelemetryEvent[]): void {
    this.writeJsonFile(this.pendingFilePath, events.slice(-MAX_PENDING_EVENTS));
  }

  appendPending(event: TelemetryEvent): void {
    const current = this.readPending();
    current.push(event);
    this.writePending(current);
  }

  getOrCreateInstallationId(): string {
    const currentSession = this.readSession();
    if (currentSession?.installationId) {
      return currentSession.installationId;
    }

    return randomUUID();
  }

  private readJsonFile<T>(filePath: string): T | null {
    if (!existsSync(filePath)) return null;

    try {
      return JSON.parse(readFileSync(filePath, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private writeJsonFile(filePath: string, value: unknown): void {
    writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  }
}
