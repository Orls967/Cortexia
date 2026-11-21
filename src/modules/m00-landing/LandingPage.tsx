import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

interface Node { x: number; y: number; vx: number; vy: number; r: number; glow: number; kind: 'E' | 'I' }
interface Pulse { a: number; b: number; t: number; speed: number }

/** Continuously running neural-network animation: drifting neurons, travelling spikes, reacts to pointer and clicks. */
function useNetworkAnimation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now();
    let nodes: Node[] = [];
    const pulses: Pulse[] = [];
    const pointer = { x: -9999, y: -9999, active: false };
    const LINK = () => Math.max(110, Math.min(190, w / 8));

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(130, Math.max(45, (w * h) / 15000)));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
        r: 1.6 + Math.random() * 2.2, glow: 0, kind: Math.random() < 0.2 ? 'I' : 'E',
      }));
    };

    const fire = (i: number) => {
      const nd = nodes[i]!;
      nd.glow = 1;
      const L = LINK();
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const d = Math.hypot(nd.x - nodes[j]!.x, nd.y - nodes[j]!.y);
        if (d < L && Math.random() < 0.5) pulses.push({ a: i, b: j, t: 0, speed: 0.012 + Math.random() * 0.012 });
      }
    };
    const nearest = (x: number, y: number) => { let b = 0, bd = Infinity; nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; b = i; } }); return b; };

    const frame = (now: number) => {
      const dt = Math.min(48, now - last) / 16.7; last = now;
      ctx.clearRect(0, 0, w, h);
      const L = LINK();
      // Spontaneous activity keeps the animation alive even without interaction.
      if (Math.random() < 0.035 * dt) fire(Math.floor(Math.random() * nodes.length));
      for (const n of nodes) {
        if (!reduced) {
          n.x += n.vx * dt; n.y += n.vy * dt;
          if (pointer.active) {
            const dx = pointer.x - n.x, dy = pointer.y - n.y, d = Math.hypot(dx, dy);
            if (d < 170 && d > 1) { n.x += (dx / d) * 0.35 * dt; n.y += (dy / d) * 0.35 * dt; if (d < 60 && n.glow < 0.4 && Math.random() < 0.02) n.glow = 1; }
          }
        }
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
        n.glow = Math.max(0, n.glow - 0.012 * dt);
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!, b = nodes[j]!, d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > L) continue;
        ctx.strokeStyle = `rgba(56,189,248,${(1 - d / L) * 0.22})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k]!, a = nodes[p.a]!, b = nodes[p.b]!;
        p.t += p.speed * dt;
        if (p.t >= 1) { pulses.splice(k, 1); if (Math.random() < 0.7 && pulses.length < 220) fire(p.b); else b.glow = 1; continue; }
        const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(168,85,247,0.95)'); g.addColorStop(1, 'rgba(168,85,247,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
      }
      for (const n of nodes) {
        const base = n.kind === 'E' ? '56,189,248' : '245,158,11';
        if (n.glow > 0.02) {
          const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 22 * n.glow + 6);
          g.addColorStop(0, `rgba(${base},${0.55 * n.glow})`); g.addColorStop(1, `rgba(${base},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 22 * n.glow + 6, 0, 7); ctx.fill();
        }
        ctx.fillStyle = `rgba(${base},${0.55 + 0.45 * n.glow})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.glow * 1.5, 0, 7); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true; };
    const leave = () => { pointer.active = false; };
    const click = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); fire(nearest(e.clientX - r.left, e.clientY - r.top)); };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', click);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerleave', leave); window.removeEventListener('pointerdown', click);
    };
  }, [canvasRef]);
}

export function LandingPage() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useNetworkAnimation(ref);
  return (
    <main className="cx-landing" id="main-content">
      <canvas ref={ref} className="cx-landing-canvas" aria-hidden="true" />
      <div className="cx-landing-center">
        <div className="cx-landing-mark" aria-hidden="true">◈</div>
        <h1>CORTEXIA</h1>
        <p className="cx-landing-tag">Explore the Brain. Decode Its Dynamics. Model Its Intelligence.</p>
        <Link to="/explore/observatory" className="cx-landing-cta">Enter CORTEXIA</Link>
        <p className="cx-landing-hint">Move the pointer or click anywhere: the network responds.</p>
      </div>
      <p className="cx-landing-foot">Educational and computational research environment · not a clinical tool</p>
    </main>
  );
}
