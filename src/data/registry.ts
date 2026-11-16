// Single registry resolver (SYSTEM_ARCHITECTURE §5.3): every entity lookup in the app goes through here.
import { z } from 'zod';
import {
  REGISTRY_SCHEMAS, explanationChunk, indexFile, kgFile,
  type ExplanationRecord, type IndexEntity, type KgFile, type RegistryItem, type RegistryName,
} from './types';

export class DataError extends Error {
  constructor(public code: 'ERR_ASSET_LOAD_FAILED' | 'ERR_SCHEMA_VALIDATION', message: string) {
    super(message);
  }
}

const base = () => `${import.meta.env.BASE_URL}data/`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch with 2 retries and exponential backoff (ERROR_HANDLING: ERR_ASSET_LOAD_FAILED). */
async function fetchJson(path: string): Promise<unknown> {
  let lastError: unknown;
  for (const delay of [0, 300, 900]) {
    if (delay) await sleep(delay);
    try {
      const res = await fetch(base() + path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
    }
  }
  throw new DataError('ERR_ASSET_LOAD_FAILED', `Could not load ${path}: ${String(lastError)}`);
}

function validate<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DataError('ERR_SCHEMA_VALIDATION', `${label}: ${issue?.path.join('.') ?? ''} ${issue?.message ?? 'invalid'}`);
  }
  return parsed.data;
}

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().catch((e: unknown) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, p);
  }
  return p;
}

export interface EntityIndex {
  list: IndexEntity[];
  byId: Map<string, IndexEntity>;
}

export function loadIndex(): Promise<EntityIndex> {
  return once('index', async () => {
    const file = validate(indexFile, await fetchJson('index.json'), 'index.json');
    const list: IndexEntity[] = file.entities.map(([id, name, type, scale, shortDefinition, epistemic, aliases]) => ({
      id, name, type, scale, shortDefinition, epistemic, aliases,
    }));
    return { list, byId: new Map(list.map((e) => [e.id, e])) };
  });
}

export function loadRegistry<N extends RegistryName>(name: N): Promise<RegistryItem<N>[]> {
  return once(`reg:${name}`, async () => {
    const schema = z.array(REGISTRY_SCHEMAS[name]) as unknown as z.ZodType<RegistryItem<N>[]>;
    return validate(schema, await fetchJson(`reg/${name}.json`), `reg/${name}.json`);
  });
}

export async function loadRegistryMap<N extends RegistryName>(name: N): Promise<Map<string, RegistryItem<N>>> {
  return once(`regmap:${name}`, async () => new Map((await loadRegistry(name)).map((i) => [i.id, i] as const)));
}

const EXPLANATION_PREFIXES = new Set(['ANALYTIC', 'ANAT', 'CELL', 'CIRC', 'COG', 'DOM', 'DSET', 'EQ', 'MECH', 'MODEL', 'MOL', 'PARAM', 'SYS']);
export const prefixOf = (id: string) => id.split('-')[0] ?? '';

function loadExplanationChunk(prefix: string): Promise<Record<string, ExplanationRecord>> {
  return once(`expl:${prefix}`, async () => validate(explanationChunk, await fetchJson(`expl/${prefix}.json`), `expl/${prefix}.json`));
}

/** Returns the UCES documentation record for an entity, or null when the registry has none (never fabricated). */
export async function loadExplanation(id: string): Promise<ExplanationRecord | null> {
  const prefix = prefixOf(id);
  if (!EXPLANATION_PREFIXES.has(prefix)) return null;
  const chunk = await loadExplanationChunk(prefix);
  return chunk[id] ?? null;
}

export interface KnowledgeGraph {
  raw: KgFile;
  indexOf: Map<string, number>;
  out: number[][]; // edge indices leaving node
  inc: number[][]; // edge indices entering node
}

export function loadKnowledgeGraph(): Promise<KnowledgeGraph> {
  return once('kg', async () => {
    const raw = validate(kgFile, await fetchJson('kg.json'), 'kg.json');
    const indexOf = new Map(raw.nodes.map((n, i) => [n[0], i] as const));
    const out: number[][] = raw.nodes.map(() => []);
    const inc: number[][] = raw.nodes.map(() => []);
    raw.edges.forEach(([s, t], ei) => {
      out[s]?.push(ei);
      inc[t]?.push(ei);
    });
    return { raw, indexOf, out, inc };
  });
}

export interface Manifest {
  counts: Record<string, number>;
  explanationChunks: string[];
}
export function loadManifest(): Promise<Manifest> {
  return once('manifest', async () => (await fetchJson('manifest.json')) as Manifest);
}
