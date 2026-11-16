import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';

const ObservatoryPage = lazy(() => import('../modules/m01-observatory/ObservatoryPage').then((m) => ({ default: m.ObservatoryPage })));
const NeuroanatomyPage = lazy(() => import('../modules/m02-neuroanatomy/NeuroanatomyPage').then((m) => ({ default: m.NeuroanatomyPage })));
const CellularPage = lazy(() => import('../modules/m03-cellular/CellularPage').then((m) => ({ default: m.CellularPage })));
const MolecularPage = lazy(() => import('../modules/m04-molecular/MolecularPage').then((m) => ({ default: m.MolecularPage })));
const SynapticPage = lazy(() => import('../modules/m05-synaptic/SynapticPage').then((m) => ({ default: m.SynapticPage })));
const ConnectomicsPage = lazy(() => import('../modules/m06-connectomics/ConnectomicsPage').then((m) => ({ default: m.ConnectomicsPage })));
const NeurophysiologyPage = lazy(() => import('../modules/m07-neurophysiology/NeurophysiologyPage').then((m) => ({ default: m.NeurophysiologyPage })));
const ComputationalLabPage = lazy(() => import('../modules/m08-comp-lab/ComputationalLabPage').then((m) => ({ default: m.ComputationalLabPage })));
const DigitalTwinPage = lazy(() => import('../modules/m08-comp-lab/DigitalTwinPage').then((m) => ({ default: m.DigitalTwinPage })));
const SystemsPage = lazy(() => import('../modules/m09-systems/SystemsPage').then((m) => ({ default: m.SystemsPage })));
const CognitivePage = lazy(() => import('../modules/m10-cognitive/CognitivePage').then((m) => ({ default: m.CognitivePage })));
const AnalyticsPage = lazy(() => import('../modules/m11-analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const KnowledgePage = lazy(() => import('../modules/m12-knowledge-library/KnowledgePage').then((m) => ({ default: m.KnowledgePage })));
const ResearchPage = lazy(() => import('../modules/m12-knowledge-library/ResearchPage').then((m) => ({ default: m.ResearchPage })));

const Loading = () => <div className="cx-banner cx-banner-cyan">Loading scientific module…</div>;

export function AppRoutes() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  return (
    <BrowserRouter basename={base}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/explore/observatory" replace />} />
            <Route path="/explore/observatory" element={<ObservatoryPage />} />
            <Route path="/explore/anatomy" element={<NeuroanatomyPage />} />
            <Route path="/explore/anatomy/:entityId" element={<NeuroanatomyPage />} />
            <Route path="/explore/cellular" element={<CellularPage />} />
            <Route path="/explore/cellular/:entityId" element={<CellularPage />} />
            <Route path="/explore/molecular" element={<MolecularPage />} />
            <Route path="/explore/molecular/:entityId" element={<MolecularPage />} />
            <Route path="/explore/synapses" element={<SynapticPage />} />
            <Route path="/explore/synapses/:entityId" element={<SynapticPage />} />
            <Route path="/explore/circuits" element={<ConnectomicsPage />} />
            <Route path="/explore/circuits/:entityId" element={<ConnectomicsPage />} />
            <Route path="/explore/physiology" element={<NeurophysiologyPage />} />
            <Route path="/explore/physiology/:entityId" element={<NeurophysiologyPage />} />
            <Route path="/explore/systems" element={<SystemsPage />} />
            <Route path="/explore/systems/:systemId" element={<SystemsPage />} />
            <Route path="/explore/cognition" element={<CognitivePage />} />
            <Route path="/explore/cognition/:conceptId" element={<CognitivePage />} />

            <Route path="/lab" element={<ComputationalLabPage />} />
            <Route path="/lab/digital-twin" element={<DigitalTwinPage />} />
            <Route path="/lab/digital-twin/:experimentId" element={<DigitalTwinPage />} />
            <Route path="/lab/:modelId" element={<ComputationalLabPage />} />

            <Route path="/analytics" element={<Navigate to="/analytics/signals" replace />} />
            <Route path="/analytics/:workspace" element={<AnalyticsPage />} />

            <Route path="/knowledge" element={<KnowledgePage section="browse" />} />
            <Route path="/knowledge/graph" element={<KnowledgePage section="graph" />} />
            <Route path="/knowledge/graph/:entityId" element={<KnowledgePage section="graph" />} />
            <Route path="/knowledge/equations" element={<KnowledgePage section="equations" />} />
            <Route path="/knowledge/equations/:equationId" element={<KnowledgePage section="equations" />} />
            <Route path="/knowledge/datasets" element={<KnowledgePage section="datasets" />} />
            <Route path="/knowledge/datasets/:datasetId" element={<KnowledgePage section="datasets" />} />
            <Route path="/knowledge/validation" element={<KnowledgePage section="validation" />} />
            <Route path="/knowledge/references" element={<KnowledgePage section="references" />} />
            <Route path="/knowledge/:entityId" element={<KnowledgePage section="entity" />} />

            <Route path="/research" element={<ResearchPage tab="runs" />} />
            <Route path="/research/notebook" element={<ResearchPage tab="notebook" />} />
            <Route path="/research/notebook/:notebookId" element={<ResearchPage tab="notebook" />} />

            <Route path="*" element={<Navigate to="/explore/observatory" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
