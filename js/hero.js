// hero canvas

import { $ } from './util.js';

// animated canvas (pixel level drawing)
export function start_hero_canvas() {

  // boilerplate for setting up canvas
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('.hero-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');

  // particle array
  let w, h, dpr, parts;

  // window resize handler thingy
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.offsetWidth; h = c.offsetHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const N = Math.min(70, Math.floor((w * h) / 20000));

    // randomly initialize particles with position, velocity, and radius
    parts = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.6 + 0.4,
    }));
  }

  // run the resize once to set up canvas and particles 
  resize();
  window.addEventListener('resize', resize);

  // animation frame function, runs in a loop
  const frame = () => {

    // skip in retro mode
    if (document.body.classList.contains('retro')) {
      requestAnimationFrame(frame);
      return;
    }

    // clear canvas, compute forces and redraw particles and lines each frame
    ctx.clearRect(0, 0, w, h);
    const vertex = { x: w / 2, y: h * 0.55 };

    // loop through particles, draw lines to nearby particles and update positions based on velocity, bouncing off walls
    for (const p of parts) {
      const dx = p.x - vertex.x;
      const dy = p.y - vertex.y;
      const d = Math.hypot(dx, dy);
      if (d > 320) continue;
      const a = 0.12 * (1 - d / 320);
      ctx.strokeStyle = `rgba(230,57,70,${a})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(vertex.x, vertex.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // update particle bouncing off walls, and draw them as circles
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.fillStyle = 'rgba(244,162,97,0.55)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // draw a glowing radial gradient around the vertex point
    const grd = ctx.createRadialGradient(vertex.x, vertex.y, 0, vertex.x, vertex.y, 80);
    grd.addColorStop(0, 'rgba(230,57,70,0.35)');
    grd.addColorStop(1, 'rgba(230,57,70,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, 80, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
