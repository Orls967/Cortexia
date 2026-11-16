import katex from 'katex';
import { useMemo } from 'react';

interface MathFormulaProps {
  latex: string;
  display?: boolean;
  label?: string;
}

export function MathFormula({ latex, display = false, label }: MathFormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return '';
    }
  }, [latex, display]);

  if (!html) {
    return (
      <code className="tabular" style={{ fontSize: 12, color: 'var(--text-primary)' }} aria-label={label ?? latex}>
        {latex}
      </code>
    );
  }
  return (
    <span
      className={display ? 'cx-math-display' : 'cx-math-inline'}
      style={display ? { display: 'block', overflowX: 'auto', padding: '6px 0' } : undefined}
      aria-label={label ?? latex}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
