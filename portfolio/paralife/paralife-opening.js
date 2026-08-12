'use strict';

(function () {
  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const smooth = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };
  const between = (progress, start, end) => smooth((progress - start) / (end - start));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixRect = (from, to, t) => ({
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
  });

  function clientPhase(progress, reducedMotion) {
    if (reducedMotion) return 'static';
    const local = clamp01((progress - 0.62) / 0.38);
    if (local < 0.18) return 'healthy';
    if (local < 0.36) return 'lagging';
    if (local < 0.55) return 'stalled';
    if (local < 0.76) return 'reconnecting';
    return 'recovered';
  }

  function deriveState(progress, reducedMotion = false) {
    const p = clamp01(progress);
    const beat = p < 0.18 ? 'world'
      : p < 0.40 ? 'perception'
      : p < 0.62 ? 'emergence'
      : 'concurrency';

    return {
      beat,
      lineOpacities: [
        1 - between(p, 0.15, 0.20),
        between(p, 0.15, 0.20) * (1 - between(p, 0.37, 0.42)),
        between(p, 0.37, 0.42) * (1 - between(p, 0.59, 0.65)),
        between(p, 0.59, 0.65),
      ],
      fieldAmount: 1 - between(p, 0.13, 0.22),
      perceptionAmount: between(p, 0.13, 0.22) * (1 - between(p, 0.39, 0.49)),
      legendAmount: between(p, 0.39, 0.49) * (1 - between(p, 0.60, 0.70)),
      networkAmount: between(p, 0.60, 0.70),
      clientPhase: clientPhase(p, reducedMotion),
    };
  }

  function deterministicObserverGeometry(progress, viewport) {
    const mobile = viewport.width <= 800;
    const frameWidth = mobile
      ? viewport.width * 0.86
      : Math.min(viewport.width * 0.52, 680);
    const frameHeight = mobile
      ? viewport.height * 0.42
      : Math.min(viewport.height * 0.46, 460);
    const start = mobile
      ? { x: viewport.width * 0.50, y: viewport.height * 0.55 }
      : { x: viewport.width * 0.54, y: viewport.height * 0.54 };
    const end = mobile
      ? { x: viewport.width * 0.50, y: viewport.height * 0.55 }
      : { x: viewport.width * 0.50, y: viewport.height * 0.56 };
    const travel = between(progress, 0.18, 0.40);
    const center = { x: lerp(start.x, end.x, travel), y: lerp(start.y, end.y, travel) };
    return {
      frame: {
        x: center.x - frameWidth / 2,
        y: center.y - frameHeight / 2,
        width: frameWidth,
        height: frameHeight,
      },
      entity: { x: center.x, y: center.y },
    };
  }

  function create(root) {
    const svg = document.getElementById('opening-visuals');
    const frame = document.getElementById('morph-frame');
    const observed = document.getElementById('observed-entity');
    const lines = Array.from(root.querySelectorAll('.opening-line'));
    const frameLayer = document.getElementById('frame-layer');
    const perceptionLayer = document.getElementById('perception-layer');
    const legendLayer = document.getElementById('legend-layer');
    const networkLayer = document.getElementById('network-layer');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function render({ progress, techFade, viewport, ambientTime }) {
      const state = deriveState(progress, reduced.matches);
      const observer = deterministicObserverGeometry(progress, viewport);
      const legendRect = viewport.width <= 800
        ? { x: viewport.width * 0.10, y: viewport.height * 0.32, width: viewport.width * 0.80, height: viewport.height * 0.42 }
        : { x: viewport.width * 0.18, y: viewport.height * 0.24, width: viewport.width * 0.64, height: viewport.height * 0.52 };
      const legendMorph = between(progress, 0.39, 0.49);
      const currentFrame = mixRect(observer.frame, legendRect, legendMorph);

      svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
      frame.setAttribute('x', currentFrame.x.toFixed(2));
      frame.setAttribute('y', currentFrame.y.toFixed(2));
      frame.setAttribute('width', currentFrame.width.toFixed(2));
      frame.setAttribute('height', currentFrame.height.toFixed(2));
      observed.setAttribute('cx', observer.entity.x.toFixed(2));
      observed.setAttribute('cy', observer.entity.y.toFixed(2));

      root.dataset.activeBeat = state.beat;
      root.dataset.clientPhase = state.clientPhase;
      root.style.opacity = techFade;
      lines.forEach((line, index) => {
        line.style.opacity = reduced.matches
          ? String(index === ['world', 'perception', 'emergence', 'concurrency'].indexOf(state.beat) ? 1 : 0)
          : state.lineOpacities[index].toFixed(3);
      });
      const fieldCompression = between(progress, 0.13, 0.20);
      lines[0].style.transform = reduced.matches
        ? 'translateY(-50%)'
        : `translateY(-50%) scale(${lerp(1, 0.42, fieldCompression).toFixed(3)})`;
      lines[1].style.transform = reduced.matches
        ? 'translate(-50%, -50%)'
        : `translate(-50%, -50%) scale(${lerp(0.82, 1, state.perceptionAmount).toFixed(3)})`;
      const frameAmount = Math.max(state.perceptionAmount, state.legendAmount, state.networkAmount);
      frameLayer.style.opacity = (frameAmount * techFade).toFixed(3);
      perceptionLayer.style.opacity = (state.perceptionAmount * techFade).toFixed(3);
      legendLayer.style.opacity = (state.legendAmount * techFade).toFixed(3);
      networkLayer.style.opacity = (state.networkAmount * techFade).toFixed(3);
      svg.style.opacity = String(techFade);
      svg.dataset.ambientPhase = reduced.matches ? '0' : String((ambientTime % 1).toFixed(3));
    }

    return { render };
  }

  window.ParalifeOpening = { deriveState, deterministicObserverGeometry, create };
}());
