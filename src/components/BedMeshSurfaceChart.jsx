import React, { Suspense, lazy, useMemo, useState, useCallback, memo } from 'react';
import { cn } from '../lib/utils';

const Plot3D = lazy(async () => {
    const [{ default: createPlotlyComponent }, plotlyModule] = await Promise.all([
        import('react-plotly.js/factory'),
        import('plotly.js-dist-min')
    ]);
    const Plotly = plotlyModule.default || plotlyModule;
    return { default: createPlotlyComponent(Plotly) };
});

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const toFiniteNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const BedMeshSurfaceChartComponent = ({ matrix, isDark = false, className = '', title = '평탄도 3D 뷰', chartHeight = 360 }) => {
    const [cameraState, setCameraState] = useState({
        eye: { x: 1.55, y: -1.58, z: 0.95 },
        up: { x: 0, y: 0, z: 1 },
        center: { x: 0, y: 0, z: -0.05 }
    });

    const prepared = useMemo(() => {
        if (!Array.isArray(matrix) || matrix.length < 2 || !Array.isArray(matrix[0]) || matrix[0].length < 2) {
            return null;
        }
        const normalized = matrix.map((row) => (
            Array.isArray(row) ? row.map((v) => toFiniteNumber(v)) : []
        ));
        const cols = normalized[0].length;
        if (cols < 2 || normalized.some((row) => row.length !== cols)) return null;

        const values = normalized.flat().filter((v) => Number.isFinite(v));
        const min = values.length ? Math.min(...values) : 0;
        const max = values.length ? Math.max(...values) : 0;
        const absMax = Math.max(Math.abs(min), Math.abs(max), 0.0001);
        const rows = normalized.length;

        const x = Array.from({ length: cols }, (_, idx) => idx + 1);
        const y = Array.from({ length: rows }, (_, idx) => idx + 1);
        const flatLevel = -absMax * 0.015;
        const flatPlane = Array.from({ length: rows }, () => Array.from({ length: cols }, () => flatLevel));
        const cLimit = Math.max(absMax, 0.02);

        const path = [];
        for (let yi = 1; yi <= rows; yi += 1) {
            const leftToRight = yi % 2 === 1;
            if (leftToRight) {
                for (let xi = 1; xi <= cols; xi += 1) {
                    path.push({ x: xi, y: yi, z: normalized[yi - 1][xi - 1], order: path.length + 1 });
                }
            } else {
                for (let xi = cols; xi >= 1; xi -= 1) {
                    path.push({ x: xi, y: yi, z: normalized[yi - 1][xi - 1], order: path.length + 1 });
                }
            }
        }

        return { normalized, rows, cols, min, max, cLimit, x, y, flatPlane, path };
    }, [matrix]);

    if (!prepared) {
        return (
            <div className={cn(
                'rounded-xl border px-3 py-4 text-sm',
                isDark ? 'border-slate-700 bg-slate-900/50 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600',
                className
            )}>
                3D 그래프를 표시하려면 2x2 이상 매트릭스가 필요합니다.
            </div>
        );
    }

    const { normalized, rows, cols, min, max, cLimit, x, y, flatPlane, path } = prepared;
    const height = Math.max(240, Number(chartHeight) || 360);
    const surfaceColorscale = [
        [0, '#1e3a8a'],
        [0.24, '#3b82f6'],
        [0.5, '#f8fafc'],
        [0.76, '#fb923c'],
        [1, '#dc2626']
    ];

    const pathLift = Math.max(cLimit * 0.04, 0.003);
    const pathX = path.map((p) => p.x);
    const pathY = path.map((p) => p.y);
    const pathZ = path.map((p) => p.z + pathLift);
    const pathText = path.map((p) => `#${p.order}`);
    const startPoint = path[0];
    const endPoint = path[path.length - 1];

    const data = useMemo(() => ([
        {
            type: 'surface',
            name: 'Flat',
            x,
            y,
            z: flatPlane,
            showscale: false,
            opacity: 0.36,
            colorscale: [
                [0, isDark ? '#a3a3a3' : '#cbd5e1'],
                [1, isDark ? '#a3a3a3' : '#cbd5e1']
            ],
            hoverinfo: 'skip',
            contours: { z: { show: false } },
            lighting: { ambient: 0.75, diffuse: 0.2, roughness: 1, specular: 0 }
        },
        {
            type: 'surface',
            name: 'Probed',
            x,
            y,
            z: normalized,
            cmin: -cLimit,
            cmax: cLimit,
            colorscale: surfaceColorscale,
            opacity: 1,
            hovertemplate: 'X %{x}<br>Y %{y}<br>Z %{z:.4f} mm<extra></extra>',
            colorbar: {
                title: '',
                thickness: 10,
                len: 0.9,
                tickfont: { color: isDark ? '#e2e8f0' : '#334155' },
                outlinecolor: isDark ? '#94a3b8' : '#475569'
            },
            contours: {
                x: { show: true, color: isDark ? 'rgba(241,245,249,0.28)' : 'rgba(15,23,42,0.2)', width: 1, highlight: false },
                y: { show: true, color: isDark ? 'rgba(241,245,249,0.28)' : 'rgba(15,23,42,0.2)', width: 1, highlight: false },
                z: { show: false }
            },
            lighting: { ambient: 0.5, diffuse: 0.85, roughness: 0.9, specular: 0.08 }
        },
        {
            type: 'scatter3d',
            name: 'Probe Path',
            mode: 'lines+markers',
            x: pathX,
            y: pathY,
            z: pathZ,
            text: pathText,
            line: {
                color: isDark ? '#22d3ee' : '#0e7490',
                width: 5
            },
            marker: {
                size: 3,
                color: isDark ? '#67e8f9' : '#0f766e',
                opacity: 0.95
            },
            hovertemplate: '순서 %{text}<br>X %{x}<br>Y %{y}<br>Z %{z:.4f} mm<extra></extra>',
            showlegend: false
        },
        {
            type: 'scatter3d',
            name: 'Start',
            mode: 'markers+text',
            x: [startPoint.x],
            y: [startPoint.y],
            z: [startPoint.z + (pathLift * 1.3)],
            text: ['START'],
            textposition: 'top center',
            textfont: { size: 9, color: isDark ? '#86efac' : '#166534' },
            marker: { size: 5, color: isDark ? '#22c55e' : '#16a34a' },
            hovertemplate: 'START (X %{x}, Y %{y})<extra></extra>',
            showlegend: false
        },
        {
            type: 'scatter3d',
            name: 'End',
            mode: 'markers+text',
            x: [endPoint.x],
            y: [endPoint.y],
            z: [endPoint.z + (pathLift * 1.3)],
            text: ['END'],
            textposition: 'top center',
            textfont: { size: 9, color: isDark ? '#fca5a5' : '#991b1b' },
            marker: { size: 5, color: isDark ? '#ef4444' : '#dc2626' },
            hovertemplate: 'END (X %{x}, Y %{y})<extra></extra>',
            showlegend: false
        }
    ]), [cLimit, cols, endPoint.x, endPoint.y, flatPlane, isDark, normalized, pathLift, pathText, pathX, pathY, pathZ, rows, startPoint.x, startPoint.y]);

    const layout = useMemo(() => ({
        margin: { l: 8, r: 8, t: 8, b: 8 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        uirevision: 'bed-mesh-3d-camera',
        font: {
            size: 10,
            color: isDark ? '#cbd5e1' : '#334155'
        },
        scene: {
            bgcolor: isDark ? '#111827' : '#f8fafc',
            aspectmode: 'manual',
            aspectratio: { x: 1.08, y: 1.08, z: 0.52 },
            camera: {
                eye: cameraState.eye,
                up: cameraState.up,
                center: cameraState.center
            },
            uirevision: 'bed-mesh-3d-camera',
            xaxis: {
                title: 'X (좌 → 우)',
                showbackground: true,
                backgroundcolor: isDark ? 'rgba(15,23,42,0.70)' : 'rgba(248,250,252,0.88)',
                gridcolor: isDark ? 'rgba(148,163,184,0.28)' : 'rgba(71,85,105,0.24)',
                zerolinecolor: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(71,85,105,0.35)',
                color: isDark ? '#cbd5e1' : '#334155',
                range: [1, cols],
                tickfont: { size: 10 }
            },
            yaxis: {
                title: 'Y (앞 → 뒤)',
                showbackground: true,
                backgroundcolor: isDark ? 'rgba(15,23,42,0.70)' : 'rgba(248,250,252,0.88)',
                gridcolor: isDark ? 'rgba(148,163,184,0.28)' : 'rgba(71,85,105,0.24)',
                zerolinecolor: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(71,85,105,0.35)',
                color: isDark ? '#cbd5e1' : '#334155',
                range: [1, rows],
                tickfont: { size: 10 }
            },
            zaxis: {
                title: 'Z(mm)',
                showbackground: true,
                backgroundcolor: isDark ? 'rgba(15,23,42,0.76)' : 'rgba(241,245,249,0.92)',
                gridcolor: isDark ? 'rgba(148,163,184,0.28)' : 'rgba(71,85,105,0.24)',
                zerolinecolor: isDark ? 'rgba(148,163,184,0.42)' : 'rgba(71,85,105,0.35)',
                color: isDark ? '#cbd5e1' : '#334155',
                range: [
                    clamp(min - (cLimit * 0.15), -cLimit * 1.6, cLimit * 1.6),
                    clamp(max + (cLimit * 0.15), -cLimit * 1.6, cLimit * 1.6)
                ],
                tickfont: { size: 10 }
            }
        }
    }), [cameraState.center, cameraState.eye, cameraState.up, cLimit, cols, isDark, max, min, rows]);

    const handleRelayout = useCallback((eventData) => {
        const camera = eventData?.['scene.camera'];
        if (!camera) return;
        setCameraState((prev) => {
            const nextEye = camera.eye || prev.eye;
            const nextUp = camera.up || prev.up;
            const nextCenter = camera.center || prev.center;
            return {
                eye: nextEye,
                up: nextUp,
                center: nextCenter
            };
        });
    }, []);

    return (
        <div className={cn(
            'rounded-xl border p-3',
            isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50',
            className
        )}>
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className={cn('text-xs font-bold', isDark ? 'text-slate-300' : 'text-slate-700')}>{title}</div>
                <div className={cn('text-[11px] font-mono', isDark ? 'text-slate-400' : 'text-slate-600')}>
                    Min {min.toFixed(3)} / Max {max.toFixed(3)} · {rows}x{cols}
                </div>
            </div>

            <div className={cn('rounded-lg overflow-hidden border', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <Suspense
                    fallback={
                        <div className={cn(
                            'w-full flex items-center justify-center text-sm',
                            isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-600'
                        )}
                        style={{ height }}>
                            3D 그래프 로딩 중...
                        </div>
                    }
                >
                    <Plot3D
                        data={data}
                        layout={layout}
                        onRelayout={handleRelayout}
                        config={{
                            responsive: true,
                            displayModeBar: false,
                            scrollZoom: false,
                            staticPlot: false
                        }}
                        style={{ width: '100%', height }}
                        useResizeHandler
                    />
                </Suspense>
            </div>
            <div className={cn(
                'mt-1 text-[10px]',
                isDark ? 'text-slate-400' : 'text-slate-600'
            )}>
                경로: START (X1,Y1) → 지그재그(serpentine) → END (X{endPoint.x},Y{endPoint.y}) · Y는 프린터 앞에서 뒤 방향
            </div>
        </div>
    );
};

const BedMeshSurfaceChart = memo(BedMeshSurfaceChartComponent, (prevProps, nextProps) => (
    prevProps.matrix === nextProps.matrix &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.className === nextProps.className &&
    prevProps.title === nextProps.title &&
    prevProps.chartHeight === nextProps.chartHeight
));

export default BedMeshSurfaceChart;
