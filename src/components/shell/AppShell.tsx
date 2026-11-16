import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SCALES, SCALE_INFO } from '../../data/types';
import { resolveEntityRoute } from '../../data/routeResolver';
import { useLabStore } from '../../stores/labStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { UCESInspectorDrawer } from '../uces/UCESInspectorDrawer';
import { UCESTooltipPortal } from '../uces/UCESTooltipPortal';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { CommandSearchModal } from './CommandSearchModal';

const ENVIRONMENTS = [
  { key: 'explore', label: 'Explore', to: '/explore/observatory' },
  { key: 'lab', label: 'Laboratory', to: '/lab' },
  { key: 'analytics', label: 'Analytics', to: '/analytics/signals' },
  { key: 'knowledge', label: 'Knowledge', to: '/knowledge' },
  { key: 'research', label: 'Research', to: '/research' },
] as const;

const SUB_RAILS: Record<string, { label: string; to: string; tag: string }[]> = {
  explore: [
    { label: 'Observatory', to: '/explore/observatory', tag: 'MOD-01' },
    { label: 'Neuroanatomy (Studio A)', to: '/explore/anatomy', tag: 'MOD-02' },
    { label: 'Cellular (Studio B)', to: '/explore/cellular', tag: 'MOD-03' },
    { label: 'Molecular (Studio C)', to: '/explore/molecular', tag: 'MOD-04' },
    { label: 'Synaptic & Plasticity', to: '/explore/synapses', tag: 'MOD-05' },
    { label: 'Circuits & Connectomics', to: '/explore/circuits', tag: 'MOD-06' },
    { label: 'Neurophysiology', to: '/explore/physiology', tag: 'MOD-07' },
    { label: 'Systems Neuroscience', to: '/explore/systems', tag: 'MOD-09' },
    { label: 'Cognitive Neuroscience', to: '/explore/cognition', tag: 'MOD-10' },
  ],
  lab: [
    { label: '28-Model Simulator', to: '/lab', tag: 'MOD-08' },
    { label: '5-Tier Digital Twin', to: '/lab/digital-twin/EXP-040', tag: 'TWIN' },
    { label: 'Exp A: Excitability → PING', to: '/lab/digital-twin/EXP-040', tag: 'EXP-040' },
    { label: 'Exp B: STDP → Recall', to: '/lab/digital-twin/EXP-041', tag: 'EXP-041' },
    { label: 'Exp C: Connectome PLV', to: '/lab/digital-twin/EXP-042', tag: 'EXP-042' },
  ],
  analytics: [
    { label: 'EEG & Signal Lab', to: '/analytics/signals', tag: 'MOD-11' },
    { label: 'Spike Train Suite', to: '/analytics/spikes', tag: 'SPIKE' },
    { label: 'Network & Graph Suite', to: '/analytics/networks', tag: 'GRAPH' },
    { label: 'Statistics & Inference', to: '/analytics/stats', tag: 'STATS' },
    { label: 'CSV Dataset Importer', to: '/analytics/import', tag: 'CSV' },
  ],
  knowledge: [
    { label: 'Library Home', to: '/knowledge', tag: 'MOD-12' },
    { label: 'Knowledge Graph', to: '/knowledge/graph', tag: 'KG' },
    { label: 'Equations & Units', to: '/knowledge/equations', tag: 'EQ-*' },
    { label: 'Dataset Catalog', to: '/knowledge/datasets', tag: 'DSET-*' },
    { label: 'Validation Reports', to: '/knowledge/validation', tag: 'VAL-*' },
    { label: 'Scientific References', to: '/knowledge/references', tag: 'REF-*' },
  ],
  research: [
    { label: 'Runs & Comparisons', to: '/research', tag: 'RUN-*' },
    { label: 'Research Notebooks', to: '/research/notebook', tag: 'NB' },
  ],
};

function currentEnv(pathname: string): keyof typeof SUB_RAILS {
  if (pathname.startsWith('/lab')) return 'lab';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/knowledge')) return 'knowledge';
  if (pathname.startsWith('/research')) return 'research';
  return 'explore';
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  const activeScale = useSelectionStore((s) => s.activeScale);
  const setActiveScale = useSelectionStore((s) => s.setActiveScale);
  const selectedId = useSelectionStore((s) => s.selectedEntityId);
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const inspectorOpen = useSelectionStore((s) => s.inspectorOpen);
  const toggleInspector = useSelectionStore((s) => s.toggleInspector);
  const setSearchOpen = useSelectionStore((s) => s.setSearchOpen);
  const notifications = useSelectionStore((s) => s.notifications);
  const dismissNotification = useSelectionStore((s) => s.dismissNotification);

  const jobStatus = useLabStore((s) => s.jobStatus);
  const progress = useLabStore((s) => s.progress);
  const progressLabel = useLabStore((s) => s.progressLabel);
  const cancelActiveJob = useLabStore((s) => s.cancelActiveJob);

  const env = currentEnv(location.pathname);
  const railLinks = SUB_RAILS[env] ?? SUB_RAILS.explore!;

  // Sync URL ?inspect=<id> → store on load/navigation
  useEffect(() => {
    const inspectParam = searchParams.get('inspect');
    if (inspectParam && inspectParam !== selectedId) {
      selectEntity(inspectParam, { openInspector: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sync store selectedId -> URL ?inspect=<id>
  useEffect(() => {
    const curr = searchParams.get('inspect');
    if (selectedId && inspectorOpen && curr !== selectedId) {
      const next = new URLSearchParams(searchParams);
      next.set('inspect', selectedId);
      setSearchParams(next, { replace: true });
    } else if ((!inspectorOpen || !selectedId) && curr) {
      const next = new URLSearchParams(searchParams);
      next.delete('inspect');
      setSearchParams(next, { replace: true });
    }
  }, [selectedId, inspectorOpen, searchParams, setSearchParams]);

  // Global keyboard shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+I, K for full page)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleInspector();
      } else if (!inInput && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'k' && selectedId) {
        e.preventDefault();
        navigate(resolveEntityRoute(selectedId).knowledgePath);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen, toggleInspector, selectedId, navigate]);

  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="cx-shell">
      <header className="cx-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            className="cx-btn"
            style={{ padding: '4px 8px' }}
            aria-label="Toggle module navigation"
            onClick={() => setMobileRailOpen((o) => !o)}
          >
            ☰
          </button>
          <Link to="/explore/observatory" className="cx-brand">
            <span style={{ color: 'var(--accent-ice-blue)' }}>◈</span> CORTEXIA
          </Link>
          <nav className="cx-env-nav" aria-label="Work Environments">
            {ENVIRONMENTS.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={() => `cx-env-link${env === item.key ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="cx-topbar-actions">
          <button
            type="button"
            className="cx-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Open Global Scientific Search"
          >
            Search <kbd className="tabular" style={{ color: 'var(--text-secondary)', fontSize: 10 }}>⌘K</kbd>
          </button>
          <button
            type="button"
            className={`cx-btn${inspectorOpen ? ' cx-btn-primary' : ''}`}
            onClick={toggleInspector}
            aria-pressed={inspectorOpen}
            aria-label="Toggle UCES Inspector"
          >
            Inspector
          </button>
        </div>
      </header>

      <div className="cx-subbar">
        <nav className="cx-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/explore/observatory">CORTEXIA</Link>
          {segments.map((seg, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.45 }}>/</span>
              <span style={{ color: i === segments.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {decodeURIComponent(seg)}
              </span>
            </span>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="cx-scale-strip" role="group" aria-label="Biological scale context">
            {SCALES.map((sc) => (
              <button
                key={sc}
                type="button"
                className={`cx-scale-pill${activeScale === sc ? ' active' : ''}`}
                title={`${sc} ${SCALE_INFO[sc].name} (${SCALE_INFO[sc].span})`}
                onClick={() => setActiveScale(sc)}
              >
                {sc}
              </button>
            ))}
          </div>
          <span className="cx-badge" title="Educational & computational research software only; not for clinical diagnosis.">
            Educational / Non-Clinical
          </span>
        </div>
      </div>

      <div className="cx-body">
        <aside className={`cx-rail${mobileRailOpen ? ' cx-rail-drawer' : ''}`} aria-label="Module Navigation">
          <div className="cx-rail-section">{env} modules</div>
          {railLinks.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.to === '/lab' || item.to === '/knowledge' || item.to === '/research'}
              className={({ isActive }) => `cx-rail-link${isActive ? ' active' : ''}`}
              onClick={() => setMobileRailOpen(false)}
            >
              <span>{item.label}</span>
              <span className="tabular" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{item.tag}</span>
            </NavLink>
          ))}
          <div className="cx-rail-section" style={{ marginTop: 10 }}>Scale Scope ({activeScale})</div>
          <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{SCALE_INFO[activeScale].name}</strong>
            <div className="tabular" style={{ fontSize: 10, color: 'var(--accent-neural-cyan)', margin: '2px 0' }}>
              {SCALE_INFO[activeScale].span} · {SCALE_INFO[activeScale].time}
            </div>
            <div>{SCALE_INFO[activeScale].scope}</div>
          </div>
        </aside>

        <main className="cx-main" id="main-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <UCESInspectorDrawer />
      </div>

      <footer className="cx-telemetry">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tabular">
            Worker: <strong>{jobStatus}</strong>
            {jobStatus === 'RUNNING' ? ` (${Math.round(progress * 100)}%) — ${progressLabel}` : progressLabel ? ` · ${progressLabel}` : ''}
          </span>
          {jobStatus === 'RUNNING' && (
            <button type="button" className="cx-btn cx-btn-danger" style={{ padding: '2px 8px', fontSize: 10 }} onClick={cancelActiveJob}>
              Cancel
            </button>
          )}
        </div>
        <div className="tabular" style={{ color: 'var(--text-muted)' }}>
          CORTEXIA v1.0 · Deterministic Client-Side Neuroscience Runtime
        </div>
      </footer>

      {notifications.length > 0 && (
        <div style={{ position: 'fixed', bottom: 44, right: 16, zIndex: 85, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 340 }}>
          {notifications.map((n) => (
            <div key={n.id} className={`cx-banner cx-banner-${n.kind === 'error' ? 'rose' : n.kind === 'warning' ? 'amber' : n.kind === 'success' ? 'emerald' : 'cyan'}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <strong style={{ fontSize: 12 }}>{n.title}</strong>
                {n.detail && <div style={{ fontSize: 11 }}>{n.detail}</div>}
              </div>
              <button type="button" className="cx-btn" style={{ padding: '2px 6px', fontSize: 10, height: 22 }} onClick={() => dismissNotification(n.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <UCESTooltipPortal />
      <CommandSearchModal />
    </div>
  );
}
