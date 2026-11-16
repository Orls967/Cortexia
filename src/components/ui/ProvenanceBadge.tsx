const STYLE_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ESTABLISHED: { label: 'Established', color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
  ACTIVE_RESEARCH: { label: 'Active Research', color: '#bae6fd', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.4)' },
  THEORETICAL_MODEL: { label: 'Theoretical Model', color: '#e9d5ff', bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.4)' },
  SYNTHETIC_ILLUSTRATIVE: { label: 'Synthetic / Illustrative', color: '#fde68a', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  EMPIRICAL_STRUCTURAL: { label: 'Empirical Structural', color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
  ESTIMATED_FUNCTIONAL: { label: 'Estimated Functional', color: '#bae6fd', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.4)' },
  SYNTHETIC_SIMULATION: { label: 'Synthetic Simulation', color: '#fde68a', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  SYNTHETIC_TOPOLOGY: { label: 'Synthetic Topology', color: '#fde68a', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  SYNTHETIC_BENCHMARK: { label: 'Synthetic Benchmark', color: '#fde68a', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  ATLAS_DERIVED: { label: 'Atlas Derived', color: '#bae6fd', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.4)' },
  PROCEDURAL_3D: { label: 'Procedural 3D Approx.', color: '#fde68a', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  USER_IMPORTED_CSV: { label: 'User Imported CSV', color: '#e9d5ff', bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.4)' },
  USER_IMPORTED_JSON: { label: 'User Imported JSON', color: '#e9d5ff', bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.4)' },
};

export function ProvenanceBadge({ status, text }: { status: string; text?: string }) {
  const s = STYLE_MAP[status] ?? {
    label: status.replace(/_/g, ' '),
    color: 'var(--text-secondary)',
    bg: 'var(--bg-control-input)',
    border: 'var(--border-strong)',
  };
  return (
    <span
      className="cx-badge"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
      title={`Provenance / epistemic classification: ${status}`}
    >
      {text ?? s.label}
    </span>
  );
}
