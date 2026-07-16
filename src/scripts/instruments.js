const SVG_NS = 'http://www.w3.org/2000/svg';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function initOptimizerLab() {
  const root = document.querySelector('[data-optimizer-lab]');
  if (!root) return;

  const svg = root.querySelector('svg');
  const path = root.querySelector('[data-opt-path]');
  const stepsLayer = root.querySelector('[data-opt-steps]');
  const startHandle = root.querySelector('[data-opt-start]');
  const endpoint = root.querySelector('[data-opt-end]');
  const status = root.querySelector('[data-opt-status]');
  const rateInput = root.querySelector('[data-opt-rate-input]');
  const momentumInput = root.querySelector('[data-opt-momentum-input]');
  const rateOutput = root.querySelector('[data-opt-rate]');
  const momentumOutput = root.querySelector('[data-opt-momentum]');
  const momentumControl = root.querySelector('[data-opt-momentum-control]');
  const reset = root.querySelector('[data-opt-reset]');
  const modes = [...root.querySelectorAll('input[name="optimizer"]')];

  if (!svg || !path || !stepsLayer || !startHandle || !endpoint || !rateInput || !momentumInput) return;

  const plot = { cx: 320, cy: 178, sx: 88, sy: 72 };
  const defaults = { start: [2.5, -1.55], rate: 0.14, momentum: 0.68, mode: 'momentum' };
  let start = [...defaults.start];

  const toSvg = ([x, y]) => [plot.cx + x * plot.sx, plot.cy - y * plot.sy];
  const loss = ([x, y]) => 0.55 * x * x + 1.15 * y * y + 0.35 * x * y;

  const run = (mode, rate, momentum, count = 22) => {
    let [x, y] = start;
    let vx = 0;
    let vy = 0;
    const points = [[x, y]];

    for (let index = 0; index < count; index++) {
      const gx = 1.1 * x + 0.35 * y;
      const gy = 2.3 * y + 0.35 * x;
      if (mode === 'momentum') {
        vx = momentum * vx + gx;
        vy = momentum * vy + gy;
      } else {
        vx = gx;
        vy = gy;
      }
      x -= rate * vx;
      y -= rate * vy;
      points.push([x, y]);
      if (!Number.isFinite(x + y) || Math.abs(x) > 12 || Math.abs(y) > 12) break;
    }
    return points;
  };

  const render = () => {
    const mode = modes.find((input) => input.checked)?.value || defaults.mode;
    const rate = Number(rateInput.value);
    const momentum = Number(momentumInput.value);
    const points = run(mode, rate, momentum);
    const svgPoints = points.map(toSvg);

    path.setAttribute('d', `M ${svgPoints.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}`);
    stepsLayer.replaceChildren(...svgPoints.slice(1, -1).map(([x, y], index) => {
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'descent-dot');
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      dot.setAttribute('r', index % 2 === 0 ? '2.5' : '2');
      // Runtime SVG nodes do not receive Astro's scoped-style attribute.
      dot.style.fill = 'var(--cobalt)';
      return dot;
    }));

    const [startX, startY] = svgPoints[0];
    const [endX, endY] = svgPoints.at(-1);
    startHandle.setAttribute('transform', `translate(${startX.toFixed(1)} ${startY.toFixed(1)})`);
    startHandle.setAttribute('aria-valuenow', start[0].toFixed(2));
    startHandle.setAttribute('aria-valuetext', `x ${start[0].toFixed(2)}, y ${start[1].toFixed(2)}`);
    endpoint.setAttribute('transform', `translate(${endX.toFixed(1)} ${endY.toFixed(1)})`);

    rateOutput.textContent = rate.toFixed(2);
    momentumOutput.textContent = momentum.toFixed(2);
    const usesMomentum = mode === 'momentum';
    momentumInput.disabled = !usesMomentum;
    momentumControl.classList.toggle('is-disabled', !usesMomentum);
    const finalLoss = loss(points.at(-1));
    const lossLabel = finalLoss < 0.001 ? '<0.001' : finalLoss.toFixed(finalLoss < 1 ? 3 : 1);
    status.textContent = `${usesMomentum ? 'Momentum' : 'SGD'} / ${points.length - 1} updates / loss ${lossLabel}`;
  };

  const pointFromEvent = (event) => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    return [
      clamp((local.x - plot.cx) / plot.sx, -2.85, 2.85),
      clamp((plot.cy - local.y) / plot.sy, -1.95, 1.95),
    ];
  };

  startHandle.addEventListener('pointerdown', (event) => {
    startHandle.setPointerCapture(event.pointerId);
    start = pointFromEvent(event);
    render();
  });
  startHandle.addEventListener('pointermove', (event) => {
    if (!startHandle.hasPointerCapture(event.pointerId)) return;
    start = pointFromEvent(event);
    render();
  });
  startHandle.addEventListener('keydown', (event) => {
    const amount = event.shiftKey ? 0.3 : 0.12;
    const directions = {
      ArrowLeft: [-amount, 0],
      ArrowRight: [amount, 0],
      ArrowUp: [0, amount],
      ArrowDown: [0, -amount],
    };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault();
    start = [
      clamp(start[0] + delta[0], -2.85, 2.85),
      clamp(start[1] + delta[1], -1.95, 1.95),
    ];
    render();
  });

  modes.forEach((input) => {
    input.disabled = false;
    input.addEventListener('change', render);
  });
  rateInput.disabled = false;
  rateInput.addEventListener('input', render);
  momentumInput.disabled = false;
  momentumInput.addEventListener('input', render);
  reset.disabled = false;
  reset.addEventListener('click', () => {
    start = [...defaults.start];
    rateInput.value = String(defaults.rate);
    momentumInput.value = String(defaults.momentum);
    modes.forEach((input) => { input.checked = input.value === defaults.mode; });
    render();
  });

  render();
}

function initDetectionThreshold() {
  const root = document.querySelector('[data-detection-threshold]');
  if (!root) return;

  const input = root.querySelector('[data-threshold-input]');
  const valueOutput = root.querySelector('[data-threshold-value]');
  const resultOutput = root.querySelector('[data-threshold-result]');
  const figure = root.closest('.cv-figure-wrap');
  const detections = [...(figure?.querySelectorAll('[data-confidence]') || [])];
  if (!input || !valueOutput || !resultOutput || !detections.length) return;

  const render = () => {
    const threshold = Number(input.value);
    let retained = 0;
    detections.forEach((detection) => {
      const visible = Number(detection.dataset.confidence) >= threshold;
      detection.classList.toggle('is-filtered', !visible);
      retained += Number(visible);
    });
    valueOutput.textContent = threshold.toFixed(2);
    resultOutput.textContent = `${retained} of ${detections.length} proposals retained`;
  };

  input.disabled = false;
  input.addEventListener('input', render);
  render();
}

function initGenSystemControl() {
  const root = document.querySelector('.gen-system');
  if (!root) return;

  const stages = [...root.querySelectorAll('.gen-system-stage')];
  const controls = [...root.querySelectorAll('[data-gen-stage]')];
  if (!stages.length || !controls.length) return;

  const activate = (index, pin = false) => {
    const selected = clamp(index, 0, stages.length - 1);
    stages.forEach((stage, stageIndex) => stage.classList.toggle('is-active', stageIndex === selected));
    controls.forEach((control, controlIndex) => control.setAttribute('aria-pressed', String(controlIndex === selected)));
    if (pin) root.dataset.stagePinned = String(selected);
  };

  controls.forEach((control) => {
    control.disabled = false;
    control.addEventListener('click', () => activate(Number(control.dataset.genStage), true));
  });
}

function initProductionComparison() {
  const root = document.querySelector('[data-production-comparison]');
  if (!root) return;

  const controls = [...root.querySelectorAll('[data-production-state]')];
  const latency = root.querySelector('[data-production-latency]');
  const errors = root.querySelector('[data-production-errors]');
  if (!controls.length || !latency || !errors) return;

  const values = {
    before: { latency: '~25 s', errors: '100 / 100' },
    after: { latency: '<1 s', errors: '5 / 100' },
  };
  const activate = (state) => {
    const selected = values[state] ? state : 'after';
    root.dataset.state = selected;
    controls.forEach((control) => control.setAttribute('aria-pressed', String(control.dataset.productionState === selected)));
    latency.textContent = values[selected].latency;
    errors.textContent = values[selected].errors;
  };

  controls.forEach((control) => {
    control.disabled = false;
    control.addEventListener('click', () => activate(control.dataset.productionState));
  });
  activate(root.dataset.state);
}

function initDefenceAtlas() {
  const root = document.querySelector('[data-defence-atlas]');
  if (!root) return;

  const nodes = [...root.querySelectorAll('[data-defence-node]')];
  const indexOutput = root.querySelector('[data-defence-index]');
  const title = root.querySelector('[data-defence-title]');
  const description = root.querySelector('[data-defence-description]');
  const related = root.querySelector('[data-defence-related]');
  if (!nodes.length || !indexOutput || !title || !description || !related) return;

  let pinned = nodes.find((node) => node.getAttribute('aria-pressed') === 'true') || nodes[0];

  const preview = (node) => {
    const index = nodes.indexOf(node);
    nodes.forEach((candidate) => candidate.classList.toggle('is-active', candidate === node));
    indexOutput.textContent = `${String(index + 1).padStart(2, '0')} / ${String(nodes.length).padStart(2, '0')}`;
    title.textContent = node.dataset.title;
    description.textContent = node.dataset.description;
    related.textContent = node.dataset.related;
  };

  const pin = (node) => {
    pinned = node;
    nodes.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === node)));
    preview(node);
  };

  nodes.forEach((node) => {
    node.addEventListener('pointerenter', () => preview(node));
    node.addEventListener('pointerleave', () => preview(pinned));
    node.addEventListener('focus', () => preview(node));
    node.addEventListener('blur', () => preview(pinned));
    node.addEventListener('click', () => pin(node));
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      pin(node);
    });
  });

  pin(pinned);
}

export function initNotebookInstruments() {
  initOptimizerLab();
  initDetectionThreshold();
  initGenSystemControl();
  initProductionComparison();
  initDefenceAtlas();
}
