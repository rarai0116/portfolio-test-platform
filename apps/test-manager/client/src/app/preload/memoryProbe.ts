import {
  MemoryProbeChannels,
  type MemoryProbeLabel,
} from '@shared/types/memoryProbe';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld(
  '__memoryProbeMark',
  (label: MemoryProbeLabel) => {
    ipcRenderer.send(MemoryProbeChannels.mark, label);
  },
);
