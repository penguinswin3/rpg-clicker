/// <reference lib="webworker" />

/**
 * Per-second calculator Web Worker.
 * Receives a SerializablePerSecondContext (no class instances) and returns
 * a PerSecondResult.  Runs entirely off the main thread so heavy calculations
 * don't block game interactions.
 */
import { calculatePerSecond } from './per-second-calculator';
import type { SerializablePerSecondContext, PerSecondResult } from './per-second-calculator';

interface WorkerRequest {
  id:  number;
  ctx: SerializablePerSecondContext;
}

interface WorkerResponse {
  id:     number;
  result: PerSecondResult;
}

addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  const { id, ctx: { upgradeLevels, ...rest } } = data;
  const result = calculatePerSecond({
    ...rest,
    upgrades: { level: (upgradeId: string) => upgradeLevels[upgradeId] ?? 0 },
  });
  postMessage({ id, result } as WorkerResponse);
});

