import { useEffect, useMemo, useState } from 'react';

type Katex = typeof import('katex').default;

// KaTeX (about 78 kB gzipped with its stylesheet) is loaded on first use instead of with the application shell.
let katexModule: Katex | null = null;
let katexPromise: Promise<Katex> | null = null;
function loadKatex(): Promise<Katex> {
  katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => {
    katexModule = m.default;
    return m.default;
  });
  return katexPromise;
}

interface MathFormulaProps {
  latex: string;
  display?: boolean;
  label?: string;
}

export function MathFormula({ latex, display = false, label }: MathFormulaProps) {
  const [katex, setKatex] = useState<Katex | null>(katexModule);
  useEffect(() => {
    if (katex) return;
    let alive = true;
    loadKatex().then((k) => { if (alive) setKatex(() => k); }).catch(() => {});
    return () => { alive = false; };
  }, [katex]);

  const html = useMemo(() => {
    if (!katex) return '';
    try {
      return katex.renderToString(latex, { displayMode: display, throwOnError: false, strict: false });
    } catch {
      return '';
    }
  }, [katex, latex, display]);

  // Until KaTeX has loaded (or if rendering fails) the LaTeX source is shown, so the formula is never missing.
  if (!html) {
    return (
      <code className={display ? 'cx-math-display tabular' : 'tabular'} style={{ fontSize: 12, color: 'var(--text-primary)' }} aria-label={label ?? latex}>
        {latex}
      </code>
    );
  }
  return (
    <span
      role="math"
      tabIndex={display ? 0 : undefined}
      className={display ? 'cx-math-display' : 'cx-math-inline'}
      aria-label={label ?? latex}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
