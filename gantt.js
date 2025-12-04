function generateItems(count) {
  const startMin = new Date("2024-02-01");
  const endMax = new Date("2026-11-01");

  const randomDate = (min, max) => {
    const timestamp =
      min.getTime() + Math.random() * (max.getTime() - min.getTime());
    return new Date(timestamp);
  };

  const makeCode = (length = 6) =>
    Array.from({ length }, () =>
      Math.floor(Math.random() * 36)
        .toString(36)
        .toUpperCase()
    ).join("");

  return Array.from({ length: count })
    .map(() => {
      const start = randomDate(startMin, endMax);
      let due = randomDate(start, endMax); // dueDate should be >= startDate

      return {
        startDate: start.getTime(),
        code: makeCode(),
        dueDate: due.getTime(),
      };
    })
    .sort((a, b) => a.startDate - b.startDate);
}

const getDates = (items) => {
  const dates = [];
  const startDate = items[0].startDate - 0 * MS_PER_DAY;
  const endDate = items[items.length - 1].startDate + 30 * MS_PER_DAY;

  let date = startDate;
  while (date < endDate) {
    const formatted = new Date(date).toISOString().slice(0, 10);
    dates.push(formatted);
    date += MS_PER_DAY;
  }

  return dates;
};

const getCodes = (items) => {
  return items.map((i) => i.code);
};

const render = () => {
  const scrollIndexX = Math.floor(scrollWrapper.scrollLeft / COL_WIDTH);
  // TODO1: height
  const scrollIndexY = Math.floor(scrollWrapper.scrollTop / ROW_HEIGHT);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "10px Arial";

  // render codes
  let datesPrinted = false;
  for (let i = scrollIndexY; i < codes.length; i++) {
    ctx.fillStyle = "black";
    ctx.fillText(codes[i], 2, ROW_HEIGHT * (i - scrollIndexY) + Y_OFFSET);

    if (ROW_HEIGHT * (i - scrollIndexY) + Y_OFFSET > CANVAS_HEIGHT) {
      break;
    }

    // render dates and blocks
    for (let j = scrollIndexX; j < dates.length; j++) {
      const x =
        j === scrollIndexX
          ? COL_WIDTH * (j - scrollIndexX) + X_OFFSET
          : COL_WIDTH * (j - scrollIndexX) +
            X_OFFSET -
            (scrollWrapper.scrollLeft % COL_WIDTH);
      const width =
        scrollWrapper.scrollLeft % COL_WIDTH && j === scrollIndexX
          ? COL_WIDTH - (scrollWrapper.scrollLeft % COL_WIDTH)
          : COL_WIDTH;

      if (!datesPrinted) {
        ctx.fillStyle = "black";
        ctx.fillText(dates[j], x, 40, width);

        if (j % 2) {
          ctx.fillStyle = "grey";
        } else {
          ctx.fillStyle = "white";
        }

        ctx.fillRect(x, 50, width, 750);
      }

      if (matrix[i][j]) {
        ctx.fillStyle = matrix[i][j].drag ? "red" : "green";
        ctx.fillRect(
          x,
          ROW_HEIGHT * (i - scrollIndexY) + Y_OFFSET - 9,
          width,
          ROW_HEIGHT
        );

        if (!drag) {
          if (width === COL_WIDTH) {
            ctx.beginPath();
            ctx.fillStyle = "black";
            ctx.arc(
              x + 5,
              ROW_HEIGHT * (i - scrollIndexY) + Y_OFFSET - 9 + 10,
              5,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }

          if (width >= 10) {
            ctx.beginPath();
            ctx.fillStyle = "black";
            ctx.arc(
              x + 5 + width - 10,
              ROW_HEIGHT * (i - scrollIndexY) + Y_OFFSET - 9 + 10,
              5,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
      }

      if (COL_WIDTH * (j - scrollIndexX) + X_OFFSET > CANVAS_WIDTH) {
        break;
      }
    }

    datesPrinted = true;
  }

  for (let i = 0; i < connections.length; i++) {
    drawConnection(connections[i]);
  }

  if (drag) {
    ctx.fillStyle = "blue";
    ctx.fillRect(
      dragX,
      ROW_HEIGHT * dragIndexY + Y_OFFSET - 9,
      COL_WIDTH,
      ROW_HEIGHT
    );
  }

  if (connectionMode) {
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(
      connectionStartIndexX * COL_WIDTH +
        COL_WIDTH -
        5 -
        scrollWrapper.scrollLeft +
        X_OFFSET,
      connectionStartIndexY * ROW_HEIGHT + 10 - scrollWrapper.scrollTop + 50
    );
    ctx.lineTo(connectionEndX, connectionEndY);
    ctx.stroke();
  }
};

const drawConnection = (connection) => {
  console.log(connection);
  const { startIndexX, startIndexY, endIndexX, endIndexY } = connection;

  const start = {
    x:
      startIndexX * COL_WIDTH - scrollWrapper.scrollLeft + COL_WIDTH + X_OFFSET,
    y: startIndexY * ROW_HEIGHT - scrollWrapper.scrollTop + 10 + 50,
  };

  const end = {
    x: endIndexX * COL_WIDTH - scrollWrapper.scrollLeft + X_OFFSET,
    y: endIndexY * ROW_HEIGHT - scrollWrapper.scrollTop + 10 + 50,
  };

  // Build a simple H → V → H "dog-leg" path (only right angles)
  const midX = (start.x + end.x) / 2;

  const points = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
};

function onScroll() {
  requestAnimationFrame(render);
}

function onCanvasClick(event) {
  if (event.clientY < 50 || event.clientX > 90) {
    return;
  }

  const indexY =
    Math.floor(
      (event.clientY - Y_OFFSET + scrollWrapper.scrollTop) / ROW_HEIGHT
    ) + 1;
  const item = items[indexY];
  const indexX = Math.floor(
    (item.startDate - new Date(startDate).getTime()) / MS_PER_DAY
  );

  scrollWrapper.scrollLeft = indexX * COL_WIDTH;
  console.log(item);
}

function onContextMenu(event) {
  event.preventDefault();
}

function onScrollWrapperMouseDown(event) {
  const indexX = Math.floor(
    (event.clientX - X_OFFSET + scrollWrapper.scrollLeft) / COL_WIDTH
  );

  const indexY = Math.floor(
    (event.clientY + scrollWrapper.scrollTop - 50) / ROW_HEIGHT
  );

  const { data } = ctx.getImageData(event.clientX, event.clientY, 1, 1);
  const [r, g, b] = data;
  const color = `${r}${g}${b}`;

  if (color === "01280") {
    // start drag

    dragIndexX = indexX;
    dragIndexY = indexY;
    drag = true;

    ctx.fillStyle = "red";
    ctx.fillRect(
      COL_WIDTH * indexX + X_OFFSET,
      ROW_HEIGHT * indexY + Y_OFFSET - 9,
      COL_WIDTH,
      ROW_HEIGHT
    );

    try {
      matrix[indexY][indexX].drag = true;
    } catch (error) {}
  }

  if (color === "000") {
    connectionMode = true;

    connectionStartIndexX = indexX;
    connectionStartIndexY = indexY;
    console.log(connectionStartIndexX);

    try {
      matrix[connectionStartIndexY][
        connectionStartIndexX
      ].connectionMode = true;
    } catch (error) {}
  }
}

addEventListener("mousemove", (event) => {
  if (drag) {
    clearInterval(timer);

    dragX = event.clientX;

    requestAnimationFrame(render);

    if (event.clientX > 1150 && event.clientX < 1200) {
      timer = setInterval(() => {
        scrollWrapper.scrollLeft += COL_WIDTH;
      }, 50);
    } else if (event.clientX > X_OFFSET && event.clientX < 150) {
      timer = setInterval(() => {
        scrollWrapper.scrollLeft -= COL_WIDTH;
      }, 50);
    }
  }

  if (connectionMode) {
    clearInterval(timer);

    connectionEndX = event.clientX;
    connectionEndY = event.clientY;

    requestAnimationFrame(render);

    if (event.clientX > 1150 && event.clientX < 1200) {
      timer = setInterval(() => {
        scrollWrapper.scrollLeft += COL_WIDTH;
      }, 50);
    } else if (event.clientX > X_OFFSET && event.clientX < 150) {
      timer = setInterval(() => {
        scrollWrapper.scrollLeft -= COL_WIDTH;
      }, 50);
    }
  }
});

addEventListener("mouseup", (event) => {
  if (drag) {
    clearInterval(timer);

    try {
      matrix[dragIndexY][dragIndexX].drag = false;
    } catch (error) {}

    drag = false;
    requestAnimationFrame(render);
  }

  if (connectionMode) {
    const { data } = ctx.getImageData(event.clientX, event.clientY, 1, 1);
    const [r, g, b] = data;
    const color = `${r}${g}${b}`;

    if (color === "000") {
      // connected with another mwo
      const indexX = Math.floor(
        (event.clientX - X_OFFSET + scrollWrapper.scrollLeft) / COL_WIDTH
      );
      const indexY = Math.floor(
        (event.clientY + scrollWrapper.scrollTop - 50) / ROW_HEIGHT
      );

      connections.push({
        startIndexX: connectionStartIndexX,
        startIndexY: connectionStartIndexY,
        endIndexX: indexX,
        endIndexY: indexY,
      });
    }

    try {
      matrix[connectionStartIndexY][connectionStartIndexX].connection = false;
    } catch (error) {}

    connectionMode = false;
    requestAnimationFrame(render);
  }
});

let timer = null;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 20;
const COL_WIDTH = 60;
const CANVAS_HEIGHT = 800;
const CANVAS_WIDTH = 1200;
const Y_OFFSET = 60;
const X_OFFSET = 100;

const virtualSize = document.querySelector("#gantt-virtual-size");
const scrollWrapper = document.querySelector("#gantt-scroll-wrapper");
const canvas = document.querySelector("#gantt-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const items = generateItems(300);
const codes = getCodes(items);
const dates = getDates(items);
const startDate = dates[0];
const matrix = [];
const connections = [];

let dragIndexX = 0;
let dragIndexY = 0;
let dragX = 0;
let drag = false;

let connectionStartIndexX = 0;
let connectionStartIndexY = 0;
let connectionEndX = 0;
let connectionEndY = 0;
let connectionMode = false;

for (const item of items) {
  const arr = Array(dates.length).fill();
  matrix.push(arr);
  const index = Math.floor(
    (item.startDate - new Date(startDate).getTime()) / MS_PER_DAY
  );
  arr[index] = item;
}

virtualSize.style.height = `${codes.length * ROW_HEIGHT}px`;
virtualSize.style.width = `${dates.length * COL_WIDTH}px`;

render();
