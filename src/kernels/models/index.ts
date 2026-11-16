// Runtime catalog of the 28 model kernels (MODEL_CATALOG §2). Each entry has its own governing equations and run
// function; presets never count as models (anti-inflation rule).
import type { ModelDefinition } from '../core/types';
import { MODEL_010 } from './cable';
import { MODEL_001, MODEL_002, MODEL_003, MODEL_004 } from './conductance';
import { MODEL_028 } from './connectome';
import { MODEL_005, MODEL_006, MODEL_007, MODEL_008, MODEL_009 } from './integrateFire';
import { MODEL_020, MODEL_021, MODEL_022 } from './networks';
import { MODEL_023, MODEL_024, MODEL_025, MODEL_026 } from './plasticity';
import { MODEL_017, MODEL_018, MODEL_019, MODEL_027 } from './populations';
import { MODEL_011, MODEL_012, MODEL_013, MODEL_014, MODEL_015, MODEL_016 } from './synapses';

export const MODELS: readonly ModelDefinition[] = [
  MODEL_001, MODEL_002, MODEL_003, MODEL_004, MODEL_005, MODEL_006, MODEL_007, MODEL_008, MODEL_009, MODEL_010,
  MODEL_011, MODEL_012, MODEL_013, MODEL_014, MODEL_015, MODEL_016, MODEL_017, MODEL_018, MODEL_019, MODEL_020,
  MODEL_021, MODEL_022, MODEL_023, MODEL_024, MODEL_025, MODEL_026, MODEL_027, MODEL_028,
];

export const MODEL_BY_ID: ReadonlyMap<string, ModelDefinition> = new Map(MODELS.map((m) => [m.id, m]));

export const hasModel = (id: string) => MODEL_BY_ID.has(id);

export function getModel(id: string): ModelDefinition {
  const m = MODEL_BY_ID.get(id);
  if (!m) throw new Error(`No kernel registered for ${id}`);
  return m;
}
