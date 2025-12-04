// ----- CONFIG -----
const ROW_HEIGHT = 24;
const LEFT_COL_WIDTH = 150;
const HEADER_HEIGHT = 30;
const PX_PER_DAY = 20;
const ROW_GAP = 4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ----- SAMPLE DATA -----
const today = new Date();

function addDays(base, days) {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

// Generate many steps
const steps = [];
for (let i = 0; i < 1000; i++) {
  const startOffset = Math.floor(Math.random() * 60) - 10; // -10..49
  const duration = 3 + Math.floor(Math.random() * 20); // 3..22
  steps.push({
    id: i,
    code: `STEP-${String(i).padStart(4, "0")}`,
    start: addDays(today, startOffset),
    end: addDays(today, startOffset + duration)
  });
}

// Global time range
const minStart = steps.reduce(
  (min, s) => (s.start < min ? s.start : min),
  steps[0].start
);
const maxEnd = steps.reduce(
  (max, s) => (s.end > max ? s.end : max),
  steps[0].end
);

// Padding around chart
const chartStart = addDays(minStart, -2);
const chartEnd = addDays(maxEnd, 2);

// Derived world size (logical, not canvas size)
const timeSpanDays = Math.ceil((chartEnd - chartStart) / MS_PER_DAY);
const worldWidth = LEFT_COL_WIDTH + timeSpanDays * PX_PER_DAY;
const worldHeight = HEADER_HEIGHT + steps.length * ROW_HEIGHT;

// ----- DOM / CANVAS SETUP -----
const wrapper = document.getElementById("gantt-wrapper");
const scrollHost = document.getElementById("gantt-scroll");
const virtualSize = document.getElementById("gantt-virtual-size");
const canvas = document.getElementById("gantt-canvas");
const ctx = canvas.getContext("2d");

// Make virtual element define the scrollable area (world size)
virtualSize.style.width = worldWidth + "px";
virtualSize.style.height = worldHeight + "px";

// Viewport (canvas) size = size of scrollHost’s visible area
function resizeCanvasToViewport() {
  const dpr = window.devicePixelRatio || 1;
  const viewportWidth = scrollHost.clientWidth;
  const viewportHeight = scrollHost.clientHeight;

  canvas.width = viewportWidth * dpr;
  canvas.height = viewportHeight * dpr;

  canvas.style.width = viewportWidth + "px";
  canvas.style.height = viewportHeight + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  draw();
}

// World → screen helpers (don’t include scroll offset here)
function dateToXWorld(date) {
  const diffDays = (date - chartStart) / MS_PER_DAY;
  return LEFT_COL_WIDTH + diffDays * PX_PER_DAY;
}

function rowToYWorld(index) {
  return HEADER_HEIGHT + index * ROW_HEIGHT;
}

// ----- DRAWING -----
function draw() {
  const viewportWidth = scrollHost.clientWidth;
  const viewportHeight = scrollHost.clientHeight;

  const scrollX = scrollHost.scrollLeft;
  const scrollY = scrollHost.scrollTop;

  // Clear the viewport
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  // Visible rows
  const firstVisibleRow = Math.max(
    0,
    Math.floor((scrollY - HEADER_HEIGHT) / ROW_HEIGHT)
  );
  const lastVisibleRow = Math.min(
    steps.length - 1,
    Math.ceil((scrollY + viewportHeight - HEADER_HEIGHT) / ROW_HEIGHT)
  );

  // Visible days (for grid & labels)
  let firstDay = Math.floor((scrollX - LEFT_COL_WIDTH) / PX_PER_DAY);
  let lastDay = Math.ceil((scrollX + viewportWidth - LEFT_COL_WIDTH) / PX_PER_DAY);

  firstDay = Math.max(0, firstDay);
  lastDay = Math.min(timeSpanDays, lastDay);

  // ----- HEADER -----
  // Header background (only visible part)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, viewportWidth, HEADER_HEIGHT);

  // Vertical line separating left column
  const sepXScreen = LEFT_COL_WIDTH - scrollX;
  if (sepXScreen >= 0 && sepXScreen <= viewportWidth) {
    ctx.strokeStyle = "#cccccc";
    ctx.beginPath();
    ctx.moveTo(sepXScreen + 0.5, 0);
    ctx.lineTo(sepXScreen + 0.5, viewportHeight);
    ctx.stroke();
  }

  drawTimeScale(scrollX, firstDay, lastDay, viewportWidth, viewportHeight);

  // ----- ROWS -----
  for (let i = firstVisibleRow; i <= lastVisibleRow; i++) {
    drawRow(i, scrollX, scrollY, viewportWidth, viewportHeight);
  }
}

function drawTimeScale(scrollX, firstDay, lastDay, viewportWidth, viewportHeight) {
  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  for (let day = firstDay; day <= lastDay; day++) {
    const date = addDays(chartStart, day);
    const xWorld = LEFT_COL_WIDTH + day * PX_PER_DAY;
    const x = xWorld - scrollX;

    // Grid line down the viewport
    ctx.strokeStyle = day % 7 === 0 ? "#cccccc" : "#e5e5e5";
    ctx.beginPath();
    ctx.moveTo(x + 0.5, HEADER_HEIGHT);
    ctx.lineTo(x + 0.5, viewportHeight);
    ctx.stroke();

    // Day label
    const label = `${date.getDate().toString().padStart(2, "0")}`;
    ctx.fillStyle = "#333333";
    ctx.fillText(label, x + PX_PER_DAY / 2, HEADER_HEIGHT / 2);
  }
}

function drawRow(index, scrollX, scrollY, viewportWidth, viewportHeight) {
  const step = steps[index];
  const yWorld = rowToYWorld(index);
  const y = yWorld - scrollY;

  // Skip if this row is completely outside the viewport
  if (y > viewportHeight || y + ROW_HEIGHT < HEADER_HEIGHT) {
    return;
  }

  // Row background
  const isEven = index % 2 === 0;
  ctx.fillStyle = isEven ? "#fcfcfc" : "#f2f2f2";
  ctx.fillRect(0, y, viewportWidth, ROW_HEIGHT);

  // Left column: step code
  const codeX = 8 - scrollX; // left col is at xWorld 0, so screen = -scrollX
  if (codeX < viewportWidth) {
    ctx.fillStyle = "#333333";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(step.code, codeX + 8, y + ROW_HEIGHT / 2);
  }

  // Task bar
  const barXWorld = dateToXWorld(step.start);
  const barEndXWorld = dateToXWorld(step.end);
  const barWidthWorld = barEndXWorld - barXWorld;

  const barX = barXWorld - scrollX;
  const barY = y + ROW_GAP;
  const barHeight = ROW_HEIGHT - ROW_GAP * 2;

  // Skip if bar not visible horizontally
  if (barX > viewportWidth || barX + barWidthWorld < 0) {
    return;
  }

  ctx.fillStyle = "#4a90e2";
  ctx.beginPath();
  const radius = 4;
  roundRect(ctx, barX, barY, barWidthWorld, barHeight, radius);
  ctx.fill();

  ctx.strokeStyle = "#2c5faa";
  ctx.stroke();
}

// Rounded rect helper
function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ----- EVENTS -----
resizeCanvasToViewport();

scrollHost.addEventListener("scroll", () => {
  draw();
});

window.addEventListener("resize", () => {
  resizeCanvasToViewport();
});
