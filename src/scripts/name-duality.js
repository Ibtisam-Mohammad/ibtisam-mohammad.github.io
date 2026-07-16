// The real h1 remains untouched; this local canvas samples its glyphs and gives
// each character an independent particle-wave phase while the pointer is over it.
const TAU = Math.PI * 2;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const mix = (from, to, amount) => from + (to - from) * amount;
const smooth = (value) => value * value * (3 - 2 * value);
const hash = (x, y) => {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export function initNameDuality() {
  const target = document.querySelector('[data-duality-name]');
  const label = target?.querySelector('[data-duality-label]');
  const canvas = target?.querySelector('[data-duality-canvas]');
  const precisePointer = matchMedia('(hover: hover) and (pointer: fine)');

  if (!target || !label || !canvas || !precisePointer.matches) return;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  const state = {
    particles: [],
    width: 0,
    height: 0,
    pad: 0,
    glyphs: [],
    ink: '',
    progress: 0,
    destination: 0,
    phase: 0,
    lastTime: 0,
    frame: 0,
  };

  function buildParticles() {
    const rect = label.getBoundingClientRect();
    const styles = getComputedStyle(label);
    const fontSize = parseFloat(styles.fontSize);
    const pad = Math.ceil(fontSize * 0.24);
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));
    const canvasWidth = width + pad * 2;
    const canvasHeight = height + pad * 2;
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);

    canvas.width = Math.ceil(canvasWidth * pixelRatio);
    canvas.height = Math.ceil(canvasHeight * pixelRatio);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    canvas.style.left = `${-pad}px`;
    canvas.style.top = `${-pad}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const mask = document.createElement('canvas');
    mask.width = canvasWidth;
    mask.height = canvasHeight;
    const maskContext = mask.getContext('2d', { willReadFrequently: true });
    if (!maskContext) return;

    const font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    maskContext.font = font;
    if ('letterSpacing' in maskContext) maskContext.letterSpacing = styles.letterSpacing;
    maskContext.textBaseline = 'alphabetic';
    maskContext.fillStyle = '#000';

    const text = label.textContent.trim();
    const metrics = maskContext.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.78;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.22;
    const textHeight = ascent + descent;
    const baseline = pad + (height - textHeight) / 2 + ascent;
    maskContext.fillText(text, pad, baseline);

    const characters = [...text];
    const glyphs = characters.map((_, index) => {
      const prefix = characters.slice(0, index).join('');
      const throughGlyph = characters.slice(0, index + 1).join('');
      const left = pad + maskContext.measureText(prefix).width;
      const right = pad + maskContext.measureText(throughGlyph).width;
      return {
        index,
        left,
        right,
        width: Math.max(right - left, 1),
      };
    });

    const boundaries = glyphs.slice(0, -1).map((glyph, index) => (
      (glyph.right + glyphs[index + 1].left) / 2
    ));

    const pixels = maskContext.getImageData(0, 0, canvasWidth, canvasHeight).data;
    const step = Math.max(2, Math.round(fontSize / 24));
    const ink = styles.getPropertyValue('--ink').trim();
    const particles = [];

    for (let y = 0; y < canvasHeight; y += step) {
      for (let x = 0; x < canvasWidth; x += step) {
        const alpha = pixels[(y * canvasWidth + x) * 4 + 3];
        if (alpha < 80) continue;
        const seed = hash(x, y);
        const glyphIndex = boundaries.findIndex((boundary) => x < boundary);
        const resolvedGlyphIndex = glyphIndex === -1 ? glyphs.length - 1 : glyphIndex;
        const glyph = glyphs[resolvedGlyphIndex];
        particles.push({
          x,
          y,
          seed,
          radius: mix(0.7, 1.45, hash(x + 7, y + 3)),
          glyphIndex: resolvedGlyphIndex,
          localX: clamp01((x - glyph.left) / glyph.width),
        });
      }
    }

    state.particles = particles;
    state.width = width;
    state.height = height;
    state.pad = pad;
    state.glyphs = glyphs;
    state.ink = ink;
  }

  function render() {
    const { particles, glyphs, width, height, pad, ink, progress, phase } = state;
    const eased = smooth(progress);
    const centerY = pad + height / 2;
    const waveAmplitude = Math.max(1.4, height * 0.022);
    const lateralAmplitude = Math.max(0.45, height * 0.007);

    context.clearRect(0, 0, width + pad * 2, height + pad * 2);
    context.globalAlpha = clamp01(progress * 2.8);
    context.fillStyle = ink;

    for (const particle of particles) {
      const glyph = glyphs[particle.glyphIndex];
      if (!glyph) continue;
      const glyphPhase = glyph.index * 0.82;
      const localY = (particle.y - centerY) / Math.max(height / 2, 1);
      const wave = Math.sin(particle.localX * TAU * 1.15 - phase * 1.6 + glyphPhase);
      const vibration = Math.sin(phase * 3.5 + particle.seed * TAU + glyphPhase) * 0.32;
      const lateral = Math.sin(localY * Math.PI + phase * 1.8 + glyphPhase) * lateralAmplitude;
      const x = particle.x + (lateral + vibration * 0.35) * eased;
      const y = particle.y + (wave * waveAmplitude + vibration) * eased;
      const pulse = 0.97 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 2.4 + particle.seed * TAU));

      context.beginPath();
      context.arc(x, y, particle.radius * pulse, 0, TAU);
      context.fill();
    }

    context.globalAlpha = 1;
    label.style.opacity = String(1 - eased * 0.88);
    canvas.style.opacity = String(clamp01(progress * 3));
  }

  function tick(time) {
    const elapsed = state.lastTime ? Math.min((time - state.lastTime) / 1000, 0.05) : 1 / 60;
    state.lastTime = time;
    const response = state.destination > state.progress ? 7.5 : 9;
    state.progress += (state.destination - state.progress) * (1 - Math.exp(-response * elapsed));
    state.phase += elapsed * 1.15;
    render();

    if (state.destination === 0 && state.progress < 0.002) {
      state.progress = 0;
      state.lastTime = 0;
      label.style.opacity = '';
      canvas.style.opacity = '';
      context.clearRect(0, 0, state.width + state.pad * 2, state.height + state.pad * 2);
      state.frame = 0;
      return;
    }

    state.frame = requestAnimationFrame(tick);
  }

  function animateTo(destination) {
    state.destination = destination;
    if (!state.frame) state.frame = requestAnimationFrame(tick);
  }

  target.addEventListener('pointerenter', () => animateTo(1));
  target.addEventListener('pointerleave', () => animateTo(0));

  const resizeObserver = new ResizeObserver(() => {
    buildParticles();
    if (state.progress > 0) render();
  });

  document.fonts.ready.then(() => {
    buildParticles();
    target.classList.add('is-duality-ready');
    resizeObserver.observe(label);
  });
}
