import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadIndex, type EntityIndex } from '../../data/registry';
import { resolveEntityRoute, searchEntities } from '../../data/routeResolver';
import { useSelectionStore } from '../../stores/selectionStore';

export function CommandSearchModal() {
  const open = useSelectionStore((s) => s.searchOpen);
  const setOpen = useSelectionStore((s) => s.setSearchOpen);
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const navigate = useNavigate();

  const [index, setIndex] = useState<EntityIndex | null>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      loadIndex().then(setIndex).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const close = () => {
    setQuery('');
    setActiveIdx(0);
    setOpen(false);
  };

  const results = useMemo(() => (index ? searchEntities(index, query, 24) : []), [index, query]);

  if (!open) return null;

  const choose = (id: string, mode: 'inspect' | 'page') => {
    close();
    selectEntity(id, { openInspector: mode === 'inspect' });
    if (mode === 'page') navigate(resolveEntityRoute(id).knowledgePath);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Scientific Search"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(2, 6, 23, 0.72)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '10vh',
      }}
      onClick={close}
    >
      <div
        className="cx-card"
        style={{ width: 640, maxWidth: 'calc(100vw - 24px)', padding: 14, boxShadow: 'var(--shadow-popover)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            ref={inputRef}
            type="search"
            className="cx-input"
            style={{ flex: 1 }}
            placeholder="Search brain structures, cells, channels, models, equations, or prefix (anat:, model:, eq:, ref:)…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(results.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === 'Enter' && results[activeIdx]) {
                e.preventDefault();
                choose(results[activeIdx]!.id, e.shiftKey ? 'page' : 'inspect');
              }
            }}
          />
          <button type="button" className="cx-btn" onClick={close}>Esc</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          Prefixes: <code>anat:</code> <code>cell:</code> <code>mol:</code> <code>mech:</code> <code>circ:</code> <code>model:</code> <code>eq:</code> <code>analytic:</code> <code>dset:</code> <code>ref:</code> · Enter = Inspect · Shift+Enter = Full Page
        </div>
        <div style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '7px 10px',
                borderRadius: 6,
                background: idx === activeIdx ? 'rgba(56, 189, 248, 0.14)' : '#0d1422',
                border: idx === activeIdx ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
              }}
            >
              <button
                type="button"
                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', flex: 1, minWidth: 0 }}
                onClick={() => choose(item.id, 'inspect')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 13 }}>{item.name}</strong>
                  <span className="cx-badge tabular" style={{ fontSize: 10 }}>{item.id}</span>
                  <span className="cx-badge tabular" style={{ fontSize: 10 }}>{item.scale}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.shortDefinition}
                </div>
              </button>
              <button type="button" className="cx-btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => choose(item.id, 'page')}>
                Full Page
              </button>
            </div>
          ))}
          {index && results.length === 0 && (
            <div className="cx-banner">No matching scientific entity found for "{query}".</div>
          )}
        </div>
      </div>
    </div>
  );
}
