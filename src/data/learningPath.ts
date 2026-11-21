// One guided route through the platform and one grouping of the 28 models, so the interface has a clear main path
// instead of a flat list. Pure data: the models themselves still come from the registry and the kernels.

export interface PathStep { to: string; match: RegExp; title: string; why: string }

/** The recommended order: overview, structure, cell, the flagship model, synapse, network experiment, analysis, library. */
export const GUIDED_PATH: PathStep[] = [
  { to: '/explore/observatory', match: /^\/explore\/observatory/, title: 'Overview', why: 'See the nine scales and how the modules connect.' },
  { to: '/explore/anatomy', match: /^\/explore\/anatomy/, title: 'The brain', why: 'Orient yourself in 3D: lobes, deep structures, hierarchy.' },
  { to: '/explore/cellular', match: /^\/explore\/cellular/, title: 'A neuron', why: 'Zoom in to one cell: soma, dendrites, axon, glia.' },
  { to: '/lab/MODEL-001', match: /^\/lab\/MODEL-001|^\/lab\/?$/, title: 'Simulate it: Hodgkin–Huxley', why: 'The main model. Run an action potential and change its parameters.' },
  { to: '/explore/synapses', match: /^\/explore\/synapses/, title: 'Connect two neurons', why: 'Synaptic transmission and plasticity, linked to their models.' },
  { to: '/lab/digital-twin/EXP-040', match: /^\/lab\/digital-twin/, title: 'Build a circuit', why: 'Chain cell, synapse and network models in one experiment.' },
  { to: '/analytics/signals', match: /^\/analytics/, title: 'Analyse the signals', why: 'Spectra, spikes and graph metrics on real model output.' },
  { to: '/knowledge', match: /^\/knowledge/, title: 'Look it up', why: 'Equations, references and the knowledge graph behind everything.' },
];

export const FLAGSHIP_MODEL = 'MODEL-001';

export interface ModelTrack { id: string; title: string; blurb: string; start: string; models: string[] }

const ids = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `MODEL-${String(a + i).padStart(3, '0')}`);

/** The 28 models grouped by what they explain; `start` is the model to open first in each group. */
export const MODEL_TRACKS: ModelTrack[] = [
  { id: 'neuron', title: '1 · Single neuron', blurb: 'How one cell makes a spike.', start: 'MODEL-001', models: ids(1, 10) },
  { id: 'synapse', title: '2 · Synapses', blurb: 'How one cell talks to another.', start: 'MODEL-013', models: ids(11, 16) },
  { id: 'population', title: '3 · Populations & rhythms', blurb: 'Brain waves from many cells.', start: 'MODEL-017', models: ['MODEL-017', 'MODEL-018', 'MODEL-019', 'MODEL-027'] },
  { id: 'network', title: '4 · Spiking networks', blurb: 'Circuits of excitatory and inhibitory neurons.', start: 'MODEL-021', models: ids(20, 22) },
  { id: 'plasticity', title: '5 · Learning & plasticity', blurb: 'How connections change with experience.', start: 'MODEL-024', models: ids(23, 26) },
  { id: 'connectome', title: '6 · Whole-brain networks', blurb: 'Structure and function across regions.', start: 'MODEL-028', models: ['MODEL-028'] },
];

export const trackOfModel = (id: string) => MODEL_TRACKS.find((t) => t.models.includes(id));

export function stepIndex(pathname: string): number {
  return GUIDED_PATH.findIndex((s) => s.match.test(pathname));
}
