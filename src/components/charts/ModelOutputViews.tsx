import type { ModelOutput, ViewSpec } from '../../kernels/core/types';
import { CurvePlot } from './CurvePlot';
import { HeatmapCanvas } from './HeatmapCanvas';
import { PhasePlanePlot } from './PhasePlanePlot';
import { RasterCanvasPlot } from './RasterCanvasPlot';
import { TraceCanvasPlot } from './TraceCanvasPlot';

export function ModelOutputViews({
  views,
  output,
  timeUnit = 'ms',
  onInspectSeries,
}: {
  views: ViewSpec[];
  output: ModelOutput;
  timeUnit?: string;
  onInspectSeries?: (key: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {views.map((v, idx) => {
        if (v.kind === 'traces') {
          const series = v.series
            .map((s) => {
              const arr = output.series[s.key];
              return arr ? { key: s.key, label: s.label, unit: s.unit, data: arr, ...(s.dashed ? { dashed: true } : {}) } : null;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);
          if (series.length === 0) return null;
          return (
            <TraceCanvasPlot
              key={idx}
              title={v.title}
              x={output.t}
              xLabel={`time (${timeUnit})`}
              yLabel={v.yLabel}
              series={series}
              {...(onInspectSeries ? { onInspectSeries } : {})}
            />
          );
        }
        if (v.kind === 'phase') {
          const xs = output.series[v.xKey];
          const ys = output.series[v.yKey];
          if (!xs || !ys) return null;
          const nullclines = v.curves
            .map((c) => (output.curves[c.key] ? { key: c.key, label: c.label, curve: output.curves[c.key]! } : null))
            .filter((x): x is NonNullable<typeof x> => x !== null);
          return (
            <PhasePlanePlot
              key={idx}
              title={v.title}
              xData={xs}
              yData={ys}
              xLabel={v.xLabel}
              yLabel={v.yLabel}
              nullclines={nullclines}
            />
          );
        }
        if (v.kind === 'curve') {
          const curves = v.curves
            .map((c) =>
              output.curves[c.key]
                ? {
                    key: c.key,
                    label: c.label,
                    curve: output.curves[c.key]!,
                    ...(c.points ? { points: true } : {}),
                    ...(c.dashed ? { dashed: true } : {}),
                  }
                : null,
            )
            .filter((x): x is NonNullable<typeof x> => x !== null);
          if (curves.length === 0) return null;
          return <CurvePlot key={idx} title={v.title} xLabel={v.xLabel} yLabel={v.yLabel} curves={curves} />;
        }
        if (v.kind === 'raster') {
          if (!output.spikes) return null;
          return <RasterCanvasPlot key={idx} title={v.title} spikes={output.spikes} />;
        }
        if (v.kind === 'matrix') {
          const mat = output.matrices[v.key];
          if (!mat) return null;
          return (
            <HeatmapCanvas
              key={idx}
              title={v.title}
              rows={mat.rows}
              cols={mat.cols}
              data={mat.data}
              xLabel={v.xLabel}
              yLabel={v.yLabel}
              {...(v.diverging ? { diverging: true } : {})}
              {...(mat.rowLabels ? { rowLabels: mat.rowLabels } : {})}
              {...(mat.colLabels ? { colLabels: mat.colLabels } : {})}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
