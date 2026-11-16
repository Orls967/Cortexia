// Runtime contracts for the Phase 0 registries. Zod schemas mirror schemas/*.schema.json and are
// applied at the fetch boundary so that malformed data never reaches the UI (ERR_SCHEMA_VALIDATION).
import { z } from 'zod';

export const SCALES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'] as const;
export type ScaleId = (typeof SCALES)[number];
const scale = z.enum(SCALES);

export const EPISTEMIC = ['ESTABLISHED', 'ACTIVE_RESEARCH', 'THEORETICAL_MODEL', 'SYNTHETIC_ILLUSTRATIVE'] as const;
export type EpistemicStatus = (typeof EPISTEMIC)[number];

export const RELATION_TYPES = [
  'CONTAINS', 'PART_OF', 'ANATOMICAL_CONNECTION', 'FUNCTIONALLY_ASSOCIATED_WITH', 'EXPRESSES', 'RELEASES', 'BINDS_TO',
  'MODULATES', 'PARTICIPATES_IN', 'MODELED_BY', 'GOVERNED_BY_EQUATION', 'PARAMETERIZED_BY', 'VISUALIZED_BY',
  'EVALUATED_BY_EXPERIMENT', 'EXPERIMENTALLY_SUPPORTED_BY', 'DOCUMENTED_BY',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** Compact index tuple: [id, name, entityType, scale, shortDefinition, epistemicStatus, aliases] */
export const indexTuple = z.tuple([z.string(), z.string(), z.string(), scale, z.string(), z.enum(EPISTEMIC), z.array(z.string())]);
export const indexFile = z.object({ entities: z.array(indexTuple) });

export interface IndexEntity {
  id: string;
  name: string;
  type: string;
  scale: ScaleId;
  shortDefinition: string;
  epistemic: EpistemicStatus;
  aliases: string[];
}

export const explanationRecord = z.object({
  id: z.string(),
  canonicalName: z.string(),
  aliases: z.array(z.string()).default([]),
  entityType: z.string(),
  scientificDomain: z.string(),
  primaryScale: scale,
  secondaryScales: z.array(z.string()).optional(),
  abstractionLevel: z.string(),
  epistemicStatus: z.enum(EPISTEMIC),
  shortDefinition: z.string(),
  overview: z.string(),
  biologicalContext: z.string(),
  anatomicalContext: z.string().optional(),
  detailedMechanism: z.string(),
  functionalSignificance: z.string(),
  components: z.array(z.string()).optional(),
  relationships: z.array(z.object({ relationType: z.string(), targetId: z.string(), note: z.string().optional() })),
  equations: z.array(z.string()).optional(),
  parameters: z.array(z.string()).optional(),
  associatedModels: z.array(z.string()).optional(),
  associatedExperiments: z.array(z.string()).optional(),
  associatedDatasets: z.array(z.string()).optional(),
  associatedAssets: z.array(z.string()).optional(),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
  references: z.array(z.string()),
  dedicatedPageRoute: z.string(),
  explanationCompleteness: z.enum(['COMPLETE', 'PARTIAL_REVIEW', 'INCOMPLETE']),
});
export type ExplanationRecord = z.infer<typeof explanationRecord>;
export const explanationChunk = z.record(z.string(), explanationRecord);

export const anatomicalEntity = z.object({
  id: z.string(), canonicalName: z.string(), tnaLatinName: z.string().optional(), aliases: z.array(z.string()).default([]),
  division: z.string(), parentId: z.string().nullable(), primaryScale: scale,
  mniCentroidMm: z.tuple([z.number(), z.number(), z.number()]).nullable(),
  atlasProvenance: z.string(), provenanceClass: z.string(), shortDefinition: z.string(), biologicalRole: z.string(),
  connectedStructureIds: z.array(z.string()).default([]), associatedSystemIds: z.array(z.string()).default([]),
  associatedModelIds: z.array(z.string()).default([]), assetId: z.string().optional(), references: z.array(z.string()),
});
export type AnatomicalEntity = z.infer<typeof anatomicalEntity>;

export const cellularEntity = z.object({
  id: z.string(), canonicalName: z.string(), aliases: z.array(z.string()).default([]), cellCategory: z.string(), primaryScale: scale,
  primaryNeurotransmitter: z.string().nullable().optional(), morphologySummary: z.string(), physiologicalRole: z.string(),
  characteristicMarkers: z.array(z.string()).default([]), locatedInIds: z.array(z.string()).default([]),
  associatedModelIds: z.array(z.string()).default([]), assetId: z.string().optional(), references: z.array(z.string()),
});
export type CellularEntity = z.infer<typeof cellularEntity>;

export const molecularEntity = z.object({
  id: z.string(), canonicalName: z.string(), geneOrSubunitSymbols: z.array(z.string()).default([]), molecularCategory: z.string(),
  primaryScale: scale, ionOrLigandSpecificity: z.string().nullable().optional(), biophysicalMechanism: z.string(),
  reversalPotentialMv: z.number().nullable().optional(), educationalScopeNote: z.string().optional(),
  associatedModelIds: z.array(z.string()).default([]), references: z.array(z.string()),
});
export type MolecularEntity = z.infer<typeof molecularEntity>;

export const mechanismEntity = z.object({
  id: z.string(), canonicalName: z.string(), mechanismDomain: z.string(), primaryScale: scale, timescaleRange: z.string(),
  shortDefinition: z.string(), detailedMechanism: z.string(), governingEquationIds: z.array(z.string()).default([]),
  associatedModelIds: z.array(z.string()).default([]), references: z.array(z.string()),
});
export type MechanismEntity = z.infer<typeof mechanismEntity>;

export const circuitEntity = z.object({
  id: z.string(), canonicalName: z.string(), circuitCategory: z.string(), primaryScale: scale,
  connectivityProvenance: z.enum(['EMPIRICAL_STRUCTURAL', 'ESTIMATED_FUNCTIONAL', 'SYNTHETIC_SIMULATION']),
  orderedNodeIds: z.array(z.string()), dominantNeurotransmitters: z.array(z.string()).default([]), functionalSummary: z.string(),
  associatedModelIds: z.array(z.string()).default([]), references: z.array(z.string()),
});
export type CircuitEntity = z.infer<typeof circuitEntity>;

export const systemEntity = z.object({
  id: z.string(), canonicalName: z.string(), primaryScale: scale, coreStructureIds: z.array(z.string()),
  circuitIds: z.array(z.string()).default([]), mechanismIds: z.array(z.string()).default([]),
  associatedModelIds: z.array(z.string()).default([]), systemSummary: z.string(), references: z.array(z.string()),
});
export type SystemEntity = z.infer<typeof systemEntity>;

export const equationEntity = z.object({
  id: z.string(), name: z.string(), domain: z.string(), latex: z.string(), lhsUnit: z.string().optional(), rhsUnit: z.string().optional(),
  variables: z.array(z.object({ symbol: z.string(), meaning: z.string(), unit: z.string() })).default([]),
  description: z.string(), relatedModelIds: z.array(z.string()).default([]), references: z.array(z.string()),
});
export type EquationEntity = z.infer<typeof equationEntity>;

export const parameterEntity = z.object({
  id: z.string(), symbol: z.string(), name: z.string(), modelId: z.string(), unit: z.string(), defaultValue: z.number(),
  minValue: z.number(), maxValue: z.number(), valueProvenance: z.string(), biologicalMeaning: z.string(), references: z.array(z.string()),
});
export type ParameterEntity = z.infer<typeof parameterEntity>;

export const modelEntity = z.object({
  id: z.string(), name: z.string(), modelFamilyId: z.string(), modelFamilyName: z.string(), primaryScale: scale,
  abstractionLevel: z.string(), biologicalInterpretation: z.string(), governingEquationIds: z.array(z.string()),
  stateVariables: z.array(z.object({ symbol: z.string(), name: z.string(), unit: z.string() })),
  parameterIds: z.array(z.string()), initialConditions: z.record(z.string(), z.number()),
  numericalMethod: z.object({
    defaultSolver: z.string(), supportedSolvers: z.array(z.string()), defaultDtMs: z.number(), minDtMs: z.number(), maxSafeDtMs: z.number(),
  }),
  computeEnvelope: z.object({ maxUnitsInBrowser: z.number(), maxDurationMs: z.number(), workerMemoryBudgetMb: z.number() }),
  assumptions: z.array(z.string()), limitations: z.array(z.string()), validityDomain: z.array(z.string()),
  validationCaseIds: z.array(z.string()), references: z.array(z.string()), version: z.string(),
});
export type ModelEntity = z.infer<typeof modelEntity>;

export const experimentEntity = z.object({
  id: z.string(), title: z.string(), experimentType: z.string(), modelId: z.string(), primaryScale: scale, hypothesis: z.string(),
  independentVariables: z.array(z.string()), dependentMetrics: z.array(z.string()), solverId: z.string(), dtMs: z.number(),
  durationMs: z.number(), randomSeed: z.number(), digitalTwinCouplingMode: z.string(), validationCaseId: z.string().optional(),
  references: z.array(z.string()),
});
export type ExperimentEntity = z.infer<typeof experimentEntity>;

export const analysisMethodEntity = z.object({
  id: z.string(), name: z.string(), category: z.string(), governingEquationId: z.string(), inputSpecification: z.string(),
  outputSpecification: z.string(), assumptions: z.array(z.string()), limitations: z.array(z.string()),
  causalInferenceWarning: z.string(), references: z.array(z.string()),
});
export type AnalysisMethodEntity = z.infer<typeof analysisMethodEntity>;

export const datasetEntity = z.object({
  id: z.string(), title: z.string(), category: z.string(), sourceRepository: z.string(), provenanceType: z.string(), format: z.string(),
  license: z.string(), attributionText: z.string(), primaryScale: scale, samplingRateHz: z.number().nullable(),
  channelCount: z.number().nullable(), units: z.string(), description: z.string(), references: z.array(z.string()),
});
export type DatasetEntity = z.infer<typeof datasetEntity>;

export const assetEntity = z.object({
  id: z.string(), name: z.string(), studio: z.string(), format: z.string(), sourceMethod: z.string(), license: z.string(),
  mappedEntityIds: z.array(z.string()).min(1), accuracyClassification: z.string(), simplificationDisclosure: z.string(),
  spatialScaleUnit: z.string(), lodTriangleBudgets: z.object({ lod0: z.number(), lod1: z.number(), lod2: z.number() }),
  version: z.string(), references: z.array(z.string()),
});
export type AssetEntity = z.infer<typeof assetEntity>;

export const referenceEntity = z.object({
  id: z.string(), title: z.string(), authors: z.string(), year: z.number(), venue: z.string(), identifier: z.string().optional(),
  doi: z.string().nullable().optional(), url: z.string().nullable().optional(), sourceType: z.string(),
  scientificTopics: z.array(z.string()).default([]), claimsSupported: z.string(), accessDate: z.string().optional(),
  licensingNote: z.string().optional(),
});
export type ReferenceEntity = z.infer<typeof referenceEntity>;

export const validationCaseEntity = z.object({
  id: z.string(), targetModelId: z.string(), validationLevel: z.string(), referenceCondition: z.string(), expectedBehavior: z.string(),
  quantitativeTolerance: z.string(), referenceId: z.string(),
});
export type ValidationCaseEntity = z.infer<typeof validationCaseEntity>;

export const kgFile = z.object({
  relTypes: z.array(z.string()),
  categories: z.array(z.string()),
  nodes: z.array(z.tuple([z.string(), z.string(), z.number(), z.string()])),
  edges: z.array(z.tuple([z.number(), z.number(), z.number()])),
});
export type KgFile = z.infer<typeof kgFile>;

export const REGISTRY_SCHEMAS = {
  anatomy: anatomicalEntity,
  cells: cellularEntity,
  molecules: molecularEntity,
  mechanisms: mechanismEntity,
  circuits: circuitEntity,
  systems: systemEntity,
  equations: equationEntity,
  parameters: parameterEntity,
  models: modelEntity,
  experiments: experimentEntity,
  analysisMethods: analysisMethodEntity,
  datasets: datasetEntity,
  assets: assetEntity,
  references: referenceEntity,
  validationCases: validationCaseEntity,
} as const;
export type RegistryName = keyof typeof REGISTRY_SCHEMAS;
export type RegistryItem<N extends RegistryName> = z.infer<(typeof REGISTRY_SCHEMAS)[N]>;

export const SCALE_INFO: Record<ScaleId, { name: string; span: string; time: string; scope: string }> = {
  L1: { name: 'Molecular', span: '0.1 nm – 20 nm', time: 'µs – s', scope: 'Ion channels, receptors, neurotransmitters, transporters, SNARE proteins, second messengers' },
  L2: { name: 'Subcellular', span: '20 nm – 10 µm', time: 'ms – min', scope: 'Membrane, vesicles, dendritic spines, postsynaptic density, axon initial segment, cytoskeleton' },
  L3: { name: 'Cellular', span: '5 µm – meters (axons)', time: 'ms – hours', scope: 'Pyramidal cells, interneurons, sensory and motor neurons, astrocytes, oligodendrocytes, microglia' },
  L4: { name: 'Synaptic', span: '20 nm – 5 µm', time: 'ms – days', scope: 'Chemical and electrical synapses, EPSP/IPSP, short- and long-term plasticity, STDP, homeostatic scaling' },
  L5: { name: 'Microcircuit', span: '50 µm – 1 mm', time: 'ms – s', scope: 'E/I balanced motifs, feedforward and feedback inhibition, disinhibition, recurrent loops' },
  L6: { name: 'Mesoscopic', span: '0.5 mm – 10 mm', time: '10 ms – min', scope: 'Cortical layers and columns, thalamic and basal-ganglia nuclei, hippocampal subfields, mean-field dynamics' },
  L7: { name: 'Brain Regions', span: '1 cm – 15 cm', time: '100 ms – lifetime', scope: 'Lobes, gyri and sulci, hippocampus, amygdala, thalamus, cerebellum, brainstem, spinal cord, cranial nerves' },
  L8: { name: 'Whole-Brain Networks', span: '5 cm – 20 cm', time: '100 ms – years', scope: 'White-matter pathways, structural connectome, functional networks, graph topology' },
  L9: { name: 'Systems & Cognition', span: 'Whole organism', time: '100 ms – lifetime', scope: 'Sensory, motor, autonomic, sleep, reward, memory, attention, language, decision-making' },
};
