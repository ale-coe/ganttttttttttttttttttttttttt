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

/**
 * Performance Ideas do batches of cols, mwo, text so that the ctx.fillStyle doesnt need to be changed that often
 */
const render = () => {
  const scrollIndexX = Math.floor(scrollWrapper.scrollLeft / COL_WIDTH);
  const scrollIndexY = Math.floor(scrollWrapper.scrollTop / ROW_HEIGHT);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const endCol =
    scrollIndexX + Math.ceil((canvas.width - X_OFFSET) / COL_WIDTH) + 1;
  const endRow =
    scrollIndexY + Math.ceil((canvas.height - 50) / ROW_HEIGHT) + 1;
  let datesPrinted = false;
  // render codes
  for (let i = scrollIndexY; i < Math.min(endRow, codes.length); i++) {
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(codes[i], 2, ROW_HEIGHT * (i - scrollIndexY) + Y_OFFSET);

    // render dates and blocks
    for (let j = scrollIndexX; j < Math.min(endCol, dates.length); j++) {
      const x =
        j === scrollIndexX
          ? COL_WIDTH * (j - scrollIndexX) + X_OFFSET
          : COL_WIDTH * (j - scrollIndexX) +
            X_OFFSET -
            (scrollWrapper.scrollLeft % COL_WIDTH);
      // TODO1: height (for codes)
      const width =
        scrollWrapper.scrollLeft % COL_WIDTH && j === scrollIndexX
          ? COL_WIDTH - (scrollWrapper.scrollLeft % COL_WIDTH)
          : COL_WIDTH;

      if (!datesPrinted) {
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(
          dates[j],
          width < COL_WIDTH ? x - (COL_WIDTH - width) : x, // if not enough width, set start to negative value since container for text cannot really shrink
          40
        );

        if (j % 2) {
          ctx.fillStyle = SECOND_COL_COLOR;
        } else {
          ctx.fillStyle = FIRST_COL_COLOR;
        }

        ctx.fillRect(x, 50, width, 750);
      }

      const row = matrix[i];
      const element = row[j];
      if (element) {
        ctx.fillStyle = element.drag
          ? DRAGGED_MWO_PLACEHOLDER_COLOR
          : MWO_COLOR;
        ctx.fillRect(
          x,
          ROW_HEIGHT * (i - scrollIndexY) + Y_OFFSET - 9,
          width,
          ROW_HEIGHT
        );

        if (!drag) {
          if (width === COL_WIDTH) {
            ctx.beginPath();
            ctx.fillStyle = DRAG_ANCHOR_FRONT_COLOR;
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
            ctx.fillStyle = DRAG_ANCHOR_BACK_COLOR;
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
    }

    datesPrinted = true;
  }

  for (let i = 0; i < connections.length; i++) {
    drawConnection(connections[i]);
  }

  if (drag) {
    const currentIndexX = Math.floor(
      (dragX - X_OFFSET + scrollWrapper.scrollLeft) / COL_WIDTH
    );

    const element = matrix[dragIndexY][dragIndexX];
    const x =
      currentIndexX > element.maxCol
        ? COL_WIDTH * element.maxCol +
          X_OFFSET +
          COL_WIDTH -
          10 -
          scrollWrapper.scrollLeft
        : currentIndexX < element.minCol
        ? COL_WIDTH * element.minCol + X_OFFSET + 2 - scrollWrapper.scrollLeft
        : dragX;

    outOfBounds = x !== dragX;

    ctx.fillStyle = DRAGGED_MWO_COLOR;
    ctx.fillRect(
      x,
      ROW_HEIGHT * dragIndexY + Y_OFFSET - scrollWrapper.scrollTop - 9,
      COL_WIDTH,
      ROW_HEIGHT
    );
  }

  if (connectionMode) {
    ctx.fillStyle = CONNECTION_LINE_COLOR;
    const connectionStartX =
      connectionStartIndexX * COL_WIDTH +
      COL_WIDTH -
      5 -
      scrollWrapper.scrollLeft +
      X_OFFSET;

    const connectionStartY =
      connectionStartIndexY * ROW_HEIGHT + 10 - scrollWrapper.scrollTop + 50;

    // TODO1: use linear equation to make it better
    // TODO1: check if /0 -> NaN/Infinity
    // const m =
    //   (connectionEndY - connectionStartY) / (connectionStartX - connectionEndX);
    // const n = connectionStartY / (m * connectionStartX);
    // y = mx + n
    // x = (y-n)/m

    // more of a heuristic
    const _connectionStartX = Math.max(connectionStartX, X_OFFSET);
    const _connectionStartY = Math.max(connectionStartY, 50);
    ctx.beginPath();
    ctx.moveTo(_connectionStartX, _connectionStartY);
    ctx.lineTo(connectionEndX, connectionEndY);
    ctx.stroke();
  }
};

const drawConnection = (connection) => {
  const { startIndexX, startIndexY, endIndexX, endIndexY } = connection;

  const start = {
    x: Math.max(
      startIndexX * COL_WIDTH - scrollWrapper.scrollLeft + COL_WIDTH + X_OFFSET,
      X_OFFSET
    ),
    y: Math.max(
      startIndexY * ROW_HEIGHT - scrollWrapper.scrollTop + 10 + 50,
      50
    ),
  };

  const end = {
    x: Math.max(
      endIndexX * COL_WIDTH - scrollWrapper.scrollLeft + X_OFFSET,
      X_OFFSET
    ),
    y: Math.max(endIndexY * ROW_HEIGHT - scrollWrapper.scrollTop + 10 + 50, 50),
  };

  if (start.x === end.x || start.y === endIndexY) {
    return;
  }
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
  const color = `rgb(${r} ${g} ${b})`;

  console.log(matrix[indexY][indexX]);

  // start drag
  if (color === MWO_COLOR) {
    dragIndexX = indexX;
    dragIndexY = indexY;
    drag = true;

    ctx.fillStyle = DRAGGED_MWO_PLACEHOLDER_COLOR;
    ctx.fillRect(
      COL_WIDTH * indexX + X_OFFSET - scrollWrapper.scrollLeft,
      ROW_HEIGHT * indexY + Y_OFFSET - scrollWrapper.scrollTop - 9,
      COL_WIDTH,
      ROW_HEIGHT
    );

    try {
      matrix[indexY][indexX].drag = true;
    } catch (error) {}
  }

  // start connection
  if (color === DRAG_ANCHOR_BACK_COLOR) {
    connectionMode = true;

    connectionStartIndexX = indexX;
    connectionStartIndexY = indexY;

    try {
      matrix[connectionStartIndexY][
        connectionStartIndexX
      ].connectionMode = true;
    } catch (error) {}
  }
}

addEventListener("mousemove", (event) => {
  if (drag) {
    dragX = event.clientX;

    clearInterval(timer);
    requestAnimationFrame(render);

    // Horizontal scroll
    if (!outOfBounds && event.clientX > 1150 && event.clientX < 1200) {
      timer = setInterval(() => {
        if (outOfBounds) {
          clearInterval(timer);
          return;
        }
        scrollWrapper.scrollLeft += COL_WIDTH;
      }, 50);
    } else if (
      !outOfBounds &&
      event.clientX > X_OFFSET &&
      event.clientX < 150
    ) {
      if (outOfBounds) {
        clearInterval(timer);
        return;
      }
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

    // Horizontal + vertical scroll
    if (event.clientX > 1150 && event.clientX < 1200) {
      timer = setInterval(() => {
        scrollWrapper.scrollLeft += COL_WIDTH;
      }, 50);
    } else if (event.clientX > X_OFFSET && event.clientX < 150) {
      timer = setInterval(() => {
        scrollWrapper.scrollLeft -= COL_WIDTH;
      }, 50);
    } else if (event.clientY > 750 && event.clientY < 800) {
      timer = setInterval(() => {
        // I know COL_WIDTH although ROW
        scrollWrapper.scrollTop += COL_WIDTH;
      }, 50);
    } else if (event.clientY > 50 && event.clientY < 100) {
      timer = setInterval(() => {
        // I know COL_WIDTH although ROW
        scrollWrapper.scrollTop -= COL_WIDTH;
      }, 50);
    }
  }
});

addEventListener("mouseup", (event) => {
  if (drag) {
    const { indexX } = getIndicesFromEvent(event);
    clearInterval(timer);
    matrix[dragIndexY][dragIndexX].drag = false;

    if (!outOfBounds) {
      if (indexX !== dragIndexX) {
        const mwo = matrix[dragIndexY][dragIndexX];
        matrix[dragIndexY][indexX] = mwo;
        matrix[dragIndexY][dragIndexX] = null;

        mwo.startDate = new Date(dates[indexX]);
        for (let i = 0; i < mwo.connectionsAsStart.length; i++) {
          mwo.connectionsAsStart[i].startIndexX = indexX;
        }

        for (let i = 0; i < mwo.connectionsAsEnd.length; i++) {
          mwo.connectionsAsEnd[i].endIndexX = indexX;
        }

        for (let i = 0; i < mwo.predecessorMwos.length; i++) {
          mwo.predecessorMwos[i].maxCol = Math.max(
            mwo.predecessorMwos[i].maxCol,
            indexX - 1
          );
        }

        for (let i = 0; i < mwo.successorMwos.length; i++) {
          mwo.successorMwos[i].minCol = Math.min(
            mwo.successorMwos[i].minCol,
            indexX + 1
          );
        }
      }
    }

    drag = false;
    requestAnimationFrame(render);
  }

  if (connectionMode) {
    const { data } = ctx.getImageData(event.clientX, event.clientY, 1, 1);
    const [r, g, b] = data;
    const color = `rgb(${r} ${g} ${b})`;

    // EnSt
    if (color === DRAG_ANCHOR_FRONT_COLOR) {
      // connected with another mwo
      const { indexX: connectionEndIndexX, indexY: connectionEndIndexY } =
        getIndicesFromEvent(event);

      const predecessor = matrix[connectionStartIndexY][connectionStartIndexX];
      const successor = matrix[connectionEndIndexY][connectionEndIndexX];

      predecessor.maxCol = Math.min(
        predecessor.maxCol,
        connectionEndIndexX - 1
      );

      successor.minCol = Math.max(successor.minCol, connectionStartIndexX + 1);

      const connection = {
        startIndexX: connectionStartIndexX,
        startIndexY: connectionStartIndexY,
        endIndexX: connectionEndIndexX,
        endIndexY: connectionEndIndexY,
      };

      predecessor.successorMwos.push(successor);
      predecessor.connectionsAsStart.push(connection);

      successor.predecessorMwos.push(predecessor);
      successor.connectionsAsEnd.push(connection);

      connections.push(connection);
    }

    connectionMode = false;
    requestAnimationFrame(render);
  }
});

const getIndicesFromEvent = (event) => {
  const indexX = Math.floor(
    (event.clientX - X_OFFSET + scrollWrapper.scrollLeft) / COL_WIDTH
  );
  const indexY = Math.floor(
    (event.clientY + scrollWrapper.scrollTop - 50) / ROW_HEIGHT
  );

  return { indexX, indexY };
};

const FIRST_COL_COLOR = `rgb(255 255 255)`;
const SECOND_COL_COLOR = `rgb(155 155 155)`;
const TEXT_COLOR = `rgb(0 0 0)`;
const DRAG_ANCHOR_FRONT_COLOR = `rgb(1 1 1)`;
const DRAG_ANCHOR_BACK_COLOR = `rgb(2 2 2)`;
const MWO_COLOR = `rgb(0 128 0)`;
const DRAGGED_MWO_COLOR = `rgb(0 0 255)`;
const DRAGGED_MWO_PLACEHOLDER_COLOR = `rgb(255 0 0)`;
const CONNECTION_LINE_COLOR = `rgb(3 3 3)`;

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
ctx.font = "10px Arial";

const items = getData() || generateItems(300);
const codes = getCodes(items);
const dates = getDates(items);
const startDate = dates[0];
const matrix = [];
let connections = [];

let timer = null;

let dragIndexX = 0;
let dragIndexY = 0;
let dragX = 0;
let drag = false;
let outOfBounds = false;

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
