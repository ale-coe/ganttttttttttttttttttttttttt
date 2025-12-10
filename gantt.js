const getDates = (items) => {
  const dates = [];
  const startDate = items[0].startDate - START_OFFSET * MS_PER_DAY;
  const endDate = items[items.length - 1].startDate + END_OFFSET * MS_PER_DAY;

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

const render = (timestamp) => {
  // prevents rerender at same point in time (performance.now)
  if (lastRenderTimestamp === timestamp) {
    return;
  }
  lastRenderTimestamp = timestamp;

  const { scrollTop, scrollLeft } = scrollWrapper;
  const scrollIndexX = Math.floor(scrollLeft / COL_WIDTH);
  const scrollIndexY = Math.floor(scrollTop / ROW_HEIGHT);
  const startIndexX = Math.max(0, scrollIndexX - MWO_WIDTH / COL_WIDTH + 1);
  const endIndexX =
    scrollIndexX + Math.ceil((canvas.width - X_OFFSET) / COL_WIDTH) + 1;
  const endIndexY =
    scrollIndexY + Math.ceil((canvas.height - Y_OFFSET) / ROW_HEIGHT) + 1;

  const maxRow = Math.min(endIndexY, codes.length, items.length);
  const maxCol = Math.min(endIndexX, xLabels.length);
  const rowRemainder = scrollTop % ROW_HEIGHT;
  const colRemainder = scrollLeft % COL_WIDTH;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rowArr = Array(maxRow);
  ctx.fillStyle = TEXT_COLOR;
  // render codes
  for (let i = scrollIndexY; i < maxRow; i++) {
    // 1st row might be rendered differently
    const indexYOffset = i - scrollIndexY;
    const isFirstRow = !indexYOffset;
    // convert bool to number
    const y = Y_OFFSET + ROW_HEIGHT * indexYOffset - !isFirstRow * rowRemainder;
    const shrink = isFirstRow * rowRemainder;
    const height = ROW_HEIGHT - shrink;

    rowArr[i] = { y, height };

    // + 5 to push it to the right
    // + 15 to push it to the middle
    ctx.fillText(
      codes[i],
      i === dragElementStartIndexY ? 25 : 5,
      y - (ROW_HEIGHT - height) + 15
    );
  }

  const colArr = Array(maxCol);
  // render dates
  for (let i = scrollIndexX; i < maxCol; i++) {
    // 1st col might be rendered differently
    const indexXOffset = i - scrollIndexX;
    const isFirstCol = !indexXOffset;
    // convert bool to number
    const x = X_OFFSET + COL_WIDTH * indexXOffset - !isFirstCol * colRemainder;
    const shrink = isFirstCol * colRemainder;
    const width = COL_WIDTH - shrink;

    colArr[i] = { x, width };

    const label = xLabels[i];
    if (label !== xLabels[i - 1]) {
      // - 10 to push it up a bit
      ctx.fillText(label, x - (COL_WIDTH - width), Y_OFFSET - 10);
    }
  }

  // render cols
  for (let i = scrollIndexX; i < maxCol; i++) {
    // accounts for duplicate labels (week / month)
    let virtualLabelIndex = LABEL_ARR[i];
    const desiredFillStyle =
      virtualLabelIndex % 2 ? SECOND_COL_COLOR : FIRST_COL_COLOR;

    // for month/week
    if (ctx.fillStyle !== desiredFillStyle) {
      ctx.fillStyle = desiredFillStyle;
    }
    ctx.fillRect(
      colArr[i].x,
      Y_OFFSET,
      colArr[i].width + 1, // + 1 since in month/week view there were vertical lines in the colored cols, just overlay them
      CANVAS_DRAW_HEIGHT
    );
  }

  // if month / week MWO needs to be rendered even if startIndex of MWO is out of bounds
  for (let i = scrollIndexY; i < maxRow; i++) {
    renderElement(
      items[i],
      rowArr[i].y,
      rowArr[i].height,
      startIndexX,
      endIndexX,
      scrollLeft
    );
  }

  drawConnections(connections);

  if (connectionMode) {
    ctx.strokeStyle = CONNECTION_LINE_COLOR;
    ctx.lineWidth = 1;

    // render multiple lines
    ctx.beginPath();
    for (const [
      connectionStartIndexX,
      connectionStartIndexY,
    ] of connectionIndicators) {
      const connectionStartX =
        connectionStartIndexX * COL_WIDTH +
        COL_WIDTH -
        DRAG_ANCHOR_RADIUS -
        scrollLeft +
        X_OFFSET;

      const connectionStartY =
        connectionStartIndexY * ROW_HEIGHT +
        ROW_HEIGHT / 2 -
        scrollTop +
        Y_OFFSET;

      // more of a heuristic
      const _connectionStartX = Math.max(connectionStartX, X_OFFSET);
      const _connectionStartY = Math.max(connectionStartY, Y_OFFSET);

      ctx.moveTo(_connectionStartX, _connectionStartY);
      ctx.lineTo(connectionEndX, connectionEndY);
    }

    ctx.stroke();
  }
};

const renderElement = (
  element,
  y,
  height,
  startIndexX,
  endIndexX,
  scrollLeft
) => {
  let currentDragIndexX = -1;
  let dragElementStartIndeX = -1;

  if (drag) {
    currentDragIndexX = getXIndexFromPosition(dragX);
    dragElementStartIndeX = getElement(
      dragElementStartIndexX,
      dragElementStartIndexY
    ).startIndexX;
  }

  // account for delta (dragDepLevel[element.code].delta) between drag element and drag dep element so that drag dep elements get picked up along the drag and do not jump
  const dragDep =
    drag &&
    DRAG_DEP_MAX_LEVEL &&
    element.code in dragDepLevel &&
    // drag towards successor and stay at their "correct" place if dragged back
    ((element.startIndexX <=
      currentDragIndexX + dragDepLevel[element.code].delta &&
      dragElementStartIndeX <= element.startIndexX) ||
      // drag towards predecessor and stay at their "correct" place if dragged back
      (currentDragIndexX + dragDepLevel[element.code].delta + 1 <=
        element.startIndexX &&
        element.startIndexX <= dragElementStartIndeX));

  // render element at current "real" position
  if (element.startIndexX >= startIndexX && element.startIndexX <= endIndexX) {
    // (h)ypothetical/(r)eal start of element on x-axis
    const hStartX = element.startIndexX * COL_WIDTH;
    const rStartX =
      (hStartX < scrollWrapper.scrollLeft
        ? scrollWrapper.scrollLeft
        : hStartX) +
      X_OFFSET -
      scrollWrapper.scrollLeft;
    const rMwoWidth =
      MWO_WIDTH - (rStartX - X_OFFSET + scrollWrapper.scrollLeft - hStartX);
    const plannedOverdue = element.startIndexX > element.dueIndexX;

    const desiredFillStyle =
      element.drag || dragDep
        ? plannedOverdue
          ? DRAGGED_MWO_PLACEHOLDER_OVERDUE_COLOR
          : DRAGGED_MWO_PLACEHOLDER_COLOR
        : plannedOverdue
        ? MWO_OVERDUE_COLOR
        : MWO_COLOR;
    if (desiredFillStyle !== ctx.fillStyle) {
      ctx.fillStyle = desiredFillStyle;
    }
    ctx.fillRect(rStartX, y, rMwoWidth, height);

    // render due date block
    const dueDateX = element.dueIndexX * COL_WIDTH + X_OFFSET - scrollLeft;
    if (X_OFFSET <= dueDateX && dueDateX <= X_OFFSET + CANVAS_DRAW_WIDTH) {
      ctx.fillStyle = DUE_DATE_COLOR;
      ctx.fillRect(dueDateX, y, DUE_DATE_INDICATOR_WIDTH, height);
    }

    // only render anchors if mwo has full height
    if (!drag && height === ROW_HEIGHT) {
      if (rMwoWidth === MWO_WIDTH) {
        ctx.beginPath();
        ctx.fillStyle = DRAG_ANCHOR_FRONT_COLOR;
        ctx.arc(
          rStartX +
            DRAG_ANCHOR_RADIUS +
            DUE_DATE_INDICATOR_WIDTH *
              (element.startIndexX === element.dueIndexX), // dueDate === startDate
          y + ROW_HEIGHT / 2,
          DRAG_ANCHOR_RADIUS,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      if (rMwoWidth >= DRAG_ANCHOR_RADIUS * 2) {
        ctx.fillStyle = DRAG_ANCHOR_BACK_COLOR;
        ctx.beginPath();
        ctx.arc(
          rStartX + rMwoWidth - DRAG_ANCHOR_RADIUS,
          y + ROW_HEIGHT / 2,
          DRAG_ANCHOR_RADIUS,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  // render element at position resulting from drag
  if (element.drag || dragDep) {
    // calc only once for element that is dragged
    if (element.drag) {
      const realX = dragX - X_OFFSET + scrollWrapper.scrollLeft;
      outOfBounds =
        realX < dragMinCol * COL_WIDTH
          ? MIN_BOUND_CROSSED
          : realX > dragMaxCol * COL_WIDTH + COL_WIDTH
          ? MAX_BOUND_CROSSED
          : NO_BOUND_CROSSED;

      ctx.fillStyle =
        currentDragIndexX > element.dueIndexX
          ? DRAGGED_MWO_OVERDUE_COLOR
          : DRAGGED_MWO_COLOR;
    } else {
      ctx.fillStyle =
        currentDragIndexX + dragDepLevel[element.code].delta > element.dueIndexX
          ? DRAGGED_MWO_OVERDUE_COLOR
          : DRAGGED_MWO_COLOR;
    }

    const scrollLeft = scrollWrapper.scrollLeft;
    const xOffsetHelper = X_OFFSET - scrollLeft;

    const baseX =
      outOfBounds === NO_BOUND_CROSSED
        ? dragX
        : outOfBounds > NO_BOUND_CROSSED
        ? dragMaxCol * COL_WIDTH + xOffsetHelper + COL_WIDTH - 2 // stop before right border
        : dragMinCol * COL_WIDTH + xOffsetHelper + 2; // stop before left border
    const x = baseX + (dragDepLevel[element.code]?.delta | 0) * COL_WIDTH; // use of single pipe | is intended here, bitwise operator hopefully faster
    ctx.fillRect(x, y, MWO_WIDTH, height);
  }
};

// prevents duplicates from being added
const pushPoint = (points, p) => {
  const last = points[points.length - 1];
  if (!last || last.x !== p.x || last.y !== p.y) {
    points.push(p);
  }
};

const addSegment = (points, a, b, X_MIN, X_MAX, Y_MIN, Y_MAX) => {
  // Horizontal segment
  if (a.y === b.y) {
    const y = a.y;
    // Completely above or below viewport therefore skip
    if (y < Y_MIN || y > Y_MAX) return;

    let x1 = Math.max(X_MIN, Math.min(a.x, b.x));
    let x2 = Math.min(X_MAX, Math.max(a.x, b.x));
    if (x1 > x2) return; // outside horizontally

    const p1 = { x: x1, y };
    const p2 = { x: x2, y };

    pushPoint(points, p1);
    pushPoint(points, p2);
  }
  // Vertical segment
  else if (a.x === b.x) {
    const x = a.x;
    // Completely left or right of viewport therefore skip
    if (x < X_MIN || x > X_MAX) return;

    let y1 = Math.max(Y_MIN, Math.min(a.y, b.y));
    let y2 = Math.min(Y_MAX, Math.max(a.y, b.y));
    if (y1 > y2) return; // outside vertically

    const p1 = { x, y: y1 };
    const p2 = { x, y: y2 };

    pushPoint(points, p1);
    pushPoint(points, p2);
  }
};

const getPoints = (connection) => {
  const { startIndexX, startIndexY, endIndexX, endIndexY } = connection;

  const hypotheticalStart = {
    x:
      startIndexX * COL_WIDTH -
      scrollWrapper.scrollLeft +
      (MWO_WIDTH / COL_WIDTH) * COL_WIDTH +
      X_OFFSET,
    y:
      startIndexY * ROW_HEIGHT -
      scrollWrapper.scrollTop +
      ROW_HEIGHT / 2 +
      Y_OFFSET,
  };

  const hypotheticalEnd = {
    x: endIndexX * COL_WIDTH - scrollWrapper.scrollLeft + X_OFFSET,
    y:
      endIndexY * ROW_HEIGHT -
      scrollWrapper.scrollTop +
      ROW_HEIGHT / 2 +
      Y_OFFSET,
  };

  const connectionX = hypotheticalEnd.x - 10;

  const mid1 = { x: connectionX, y: hypotheticalStart.y };
  const mid2 = { x: connectionX, y: hypotheticalEnd.y };

  const X_MIN = X_OFFSET;
  const X_MAX = X_OFFSET + CANVAS_DRAW_WIDTH;
  const Y_MIN = Y_OFFSET;
  const Y_MAX = Y_OFFSET + CANVAS_DRAW_HEIGHT;

  const points = [];

  // Build + clip H–V–H segments
  addSegment(points, hypotheticalStart, mid1, X_MIN, X_MAX, Y_MIN, Y_MAX);
  addSegment(points, mid1, mid2, X_MIN, X_MAX, Y_MIN, Y_MAX);
  addSegment(points, mid2, hypotheticalEnd, X_MIN, X_MAX, Y_MIN, Y_MAX);

  return points.length >= 2 ? points : [];
};

const drawConnections = (connections) => {
  const pathSet = new Set();
  const dedupedConnections = [];

  // TODO: draws all connections, better only those which are necessary and set max values
  for (let i = 0; i < connections.length; i++) {
    const points = getPoints(connections[i]);
    const paths = [];

    for (let j = 0; j < points.length - 1; j++) {
      const start = points[j];
      const end = points[j + 1];
      const path = `${start.x}|${start.y}|${end.x}|${end.y}`;

      if (pathSet.has(path)) {
        continue;
      }

      pathSet.add(path);
      paths.push([start, end]);
    }

    dedupedConnections.push(paths);
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = CONNECTION_LINE_COLOR;

  ctx.beginPath();
  for (let i = 0; i < dedupedConnections.length; i++) {
    const connection = dedupedConnections[i];
    if (!connection.length) continue;

    const [firstStart, firstEnd] = connection[0];
    ctx.moveTo(firstStart.x, firstStart.y);
    ctx.lineTo(firstEnd.x, firstEnd.y);

    for (let j = 1; j < connection.length; j++) {
      const [, end] = connection[j]; // take only end, since only lineTo
      ctx.lineTo(end.x, end.y);
    }
  }
  ctx.stroke();
};

function onScroll() {
  requestAnimationFrame(render);
}

function onCanvasClick(event) {
  if (event.clientY < Y_OFFSET || event.clientX > 90) {
    return;
  }

  const indexY = Math.floor(
    (event.clientY - Y_OFFSET + scrollWrapper.scrollTop) / ROW_HEIGHT
  );

  scrollWrapper.scrollLeft = items[indexY].startIndexX * COL_WIDTH;
}

function onContextMenu(event) {
  event.preventDefault();
}

/**
 * if week/month "real" index is different from index derived by event
 */
const getRealIndicesFromEvent = (event) => {
  const { indexX, indexY } = getIndicesFromEvent(event);
  if (VIEW === "day") return { realIndexX: indexX, realIndexY: indexY };

  return { realIndexX: items[indexY].startIndexX, realIndexY: indexY };
};

function pointInBox(x, y, minX, maxX, minY, maxY) {
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function linesIntersect(line1, line2) {
  const [x11, x12, y11, y12] = line1;
  const [x21, x22, y21, y22] = line2;

  const dx1 = x12 - x11;
  const dy1 = y12 - y11;
  const dx2 = x22 - x21;
  const dy2 = y22 - y21;

  const denom = dx1 * dy2 - dy1 * dx2;

  if (denom === 0) return false;

  const dx3 = x21 - x11;
  const dy3 = y21 - y11;

  const t = (dx3 * dy2 - dy3 * dx2) / denom;
  const u = (dx3 * dy1 - dy3 * dx1) / denom;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function lineIntersectsBox(start, end, box) {
  const [minX, minY, maxX, maxY] = box;
  const { x: x1, y: y1 } = start;
  const { x: x2, y: y2 } = end;
  const line = [x1, x2, y1, y2];

  return (
    pointInBox(x1, y1, minX, maxX, minY, maxY) ||
    pointInBox(x2, y2, minX, maxX, minY, maxY) ||
    linesIntersect(line, [minX, maxX, minY, minY]) ||
    linesIntersect(line, [minX, minX, minY, maxY]) ||
    linesIntersect(line, [minX, maxX, maxY, maxY]) ||
    linesIntersect(line, [maxX, maxX, minY, maxY])
  );
}

function onScrollWrapperMouseDown(event) {
  // right click
  if (event.button === 2) {
    return;
  }

  const { indexX, indexY } = getIndicesFromEvent(event);
  const { realIndexX, realIndexY } = getRealIndicesFromEvent(event);
  const { colorSet, exactColor } = getColorFromEventPosition(event);

  // start drag
  if (exactColor === MWO_COLOR || exactColor === MWO_OVERDUE_COLOR) {
    dragElementStartIndexX = realIndexX;
    dragElementStartIndexY = realIndexY;
    drag = true;

    ctx.fillStyle = DRAGGED_MWO_PLACEHOLDER_COLOR;
    ctx.fillRect(
      COL_WIDTH * realIndexX + X_OFFSET - scrollWrapper.scrollLeft,
      ROW_HEIGHT * realIndexY + Y_OFFSET - scrollWrapper.scrollTop,
      COL_WIDTH,
      ROW_HEIGHT
    );

    const element = getElement(realIndexX, realIndexY);
    element.drag = true;

    dragMinCol = element.minCol;
    dragMaxCol = element.maxCol;

    if (!DRAG_DEP_MAX_LEVEL) {
      return;
    }

    let successorMwos = element.successorMwos;
    let predecessorMwos = element.predecessorMwos;
    const _dragDepLevel = {};

    let iMax = 1;
    let iMin = 1;

    // TODO1: MWO might not be draggable, cause already finished
    // TODO1: whats with MWOs that are not visible on y-axis? (should be fine?!)
    // if there is more than 1 path from MWOa to MWOf, account for that, too (add image in docs)
    //  MWOa -> MWOb -> MOWf and MWOa -> MWOc -> MWOd -> MWOe -> MWOf
    let i = 1;
    while (i <= DRAG_DEP_MAX_LEVEL) {
      let nextSuccessorMwos = [];
      let nextPredecessorMwos = [];

      if (successorMwos.length) {
        let _dragMaxCol = 0;
        iMax++;

        for (let j = 0; j < successorMwos.length; j++) {
          const successor = successorMwos[j];
          _dragDepLevel[successor.code] = {
            delta: i,
            startIndexX: successor.startIndexX,
            startIndexY: successor.startIndexY,
          };
          nextSuccessorMwos = nextSuccessorMwos.concat(successor.successorMwos);

          _dragMaxCol = Math.max(_dragMaxCol, successor.maxCol);
        }

        dragMaxCol = _dragMaxCol;
      }

      if (predecessorMwos.length) {
        let _dragMinCol = days.length - 1;
        iMin++;

        for (let j = 0; j < predecessorMwos.length; j++) {
          const predecessor = predecessorMwos[j];
          _dragDepLevel[predecessor.code] = {
            delta: -i,
            startIndexX: predecessor.startIndexX,
            startIndexY: predecessor.startIndexY,
          };
          nextPredecessorMwos = nextPredecessorMwos.concat(
            predecessor.predecessorMwos
          );

          _dragMinCol = Math.min(_dragMinCol, predecessor.minCol);
        }

        dragMinCol = _dragMinCol;
      }

      predecessorMwos = nextPredecessorMwos;
      successorMwos = nextSuccessorMwos;
      i++;
    }

    // TODO2: store subgraph for later use?!
    dragMinCol = Math.max(dragMinCol, 0) + (iMin - 1);
    dragMaxCol = Math.min(dragMaxCol, days.length - 1) - iMax + 1;
    dragDepLevel = _dragDepLevel;

    // remove MWOs whose startIndexX doesnt fit dragMaxCol/dragMinCol (cause those can never be dragDep)
    for (const [key, { delta, startIndexX }] of Object.entries(dragDepLevel)) {
      console.log();
      if (delta > 0) {
        if (dragMaxCol + 1 < startIndexX) {
          delete dragDepLevel[key];
        }
      }

      if (delta < 0) {
        // TODO1: why -2?
        if (startIndexX < dragMinCol - 2) {
          delete dragDepLevel[key];
        }
      }
    }
  }

  // start connection
  if (exactColor === DRAG_ANCHOR_BACK_COLOR) {
    connectionMode = true;

    connectionIndicators.push([indexX, indexY, realIndexX, realIndexY]);
  }

  // delete connections
  if (colorSet.has(CONNECTION_LINE_COLOR)) {
    const currentIndexXMin = Math.floor(scrollWrapper.scrollLeft / COL_WIDTH);
    const currentIndexXMax =
      currentIndexXMin + Math.ceil(CANVAS_DRAW_WIDTH / COL_WIDTH);
    const currentIndexYMin = Math.floor(scrollWrapper.scrollTop / ROW_HEIGHT);
    const currentIndexYMax =
      currentIndexYMin + Math.ceil(CANVAS_DRAW_HEIGHT / ROW_HEIGHT);

    const deletedConnections = [];
    for (const connection of connections) {
      const cxMin = Math.min(connection.startIndexX, connection.endIndexX);
      const cxMax = Math.max(connection.startIndexX, connection.endIndexX);
      const cyMin = Math.min(connection.startIndexY, connection.endIndexY);
      const cyMax = Math.max(connection.startIndexY, connection.endIndexY);

      const xOverlap = cxMax >= currentIndexXMin && cxMin <= currentIndexXMax;
      const yOverlap = cyMax >= currentIndexYMin && cyMin <= currentIndexYMax;

      if (xOverlap && yOverlap) {
        const points = getPoints(connection);
        if (!points) {
          continue;
        }

        for (let i = 0; i < points.length - 1; i++) {
          const start = points[i];
          const end = points[i + 1];

          const boxAroundClick = [
            event.clientX - CONNECTION_LINE_DELETION_GRACE_PIXELS,
            event.clientY - CONNECTION_LINE_DELETION_GRACE_PIXELS,
            event.clientX + CONNECTION_LINE_DELETION_GRACE_PIXELS,
            event.clientY + CONNECTION_LINE_DELETION_GRACE_PIXELS,
          ];

          // connection hit therefore delete connection
          if (lineIntersectsBox(start, end, boxAroundClick)) {
            const connectionId = `${connection.startIndexX}.${connection.startIndexY}.${connection.endIndexX}.${connection.endIndexY}`;
            connections = connections.filter((c) => c.id !== connectionId);

            deletedConnections.push(connectionId);

            const startElement = getElement(
              connection.startIndexX,
              connection.startIndexY
            );
            const endElement = getElement(
              connection.endIndexX,
              connection.endIndexY
            );

            startElement.successorMwos = startElement.successorMwos.filter(
              (mwo) => mwo !== endElement
            );
            startElement.connectionsAsStart =
              startElement.connectionsAsStart.filter(
                (c) => c.id !== connectionId
              );
            startElement.maxCol =
              Math.min(
                ...startElement.successorMwos.map((e) =>
                  getXIndexFromDate(e.startDate)
                )
              ) - 1;

            endElement.predecessorMwos = endElement.predecessorMwos.filter(
              (mwo) => mwo !== startElement
            );
            endElement.connectionsAsEnd = endElement.connectionsAsEnd.filter(
              (c) => c.id !== connectionId
            );
            endElement.minCol =
              Math.max(
                ...endElement.predecessorMwos.map((e) =>
                  getXIndexFromDate(e.startDate)
                )
              ) + 1;
          }
        }
      }
    }

    requestAnimationFrame(render);
  }
}

addEventListener("mousemove", (event) => {
  if (drag) {
    dragX = event.clientX;
    clearInterval(intervalTimer);

    if (!outOfBounds) {
      const { indexX } = getIndicesFromEvent(event);
      dragTargetDate.innerText = days[indexX];

      // Horizontal scroll
      if (
        event.clientX > UPPER_BOUND_SCROLL_X - SCROLL_AREA &&
        event.clientX < UPPER_BOUND_SCROLL_X
      ) {
        intervalTimer = setInterval(() => {
          // can happen due to interval and automatic scrolling
          if (outOfBounds) {
            clearInterval(intervalTimer);
            return;
          }

          scrollWrapper.scrollLeft += SCROLL_SPEED_PX;
        }, SCROLL_SPEED_MS);
      } else if (
        event.clientX > X_OFFSET &&
        event.clientX < X_OFFSET + SCROLL_AREA
      ) {
        intervalTimer = setInterval(() => {
          // can happen due to interval
          if (outOfBounds) {
            clearInterval(intervalTimer);
            return;
          }

          scrollWrapper.scrollLeft -= SCROLL_SPEED_PX;
        }, SCROLL_SPEED_MS);
      }
    }

    requestAnimationFrame(render);
  }

  if (connectionMode) {
    clearInterval(intervalTimer);

    connectionEndX = event.clientX;
    connectionEndY = event.clientY;

    requestAnimationFrame(render);

    // Horizontal + vertical scroll
    if (
      event.clientX > UPPER_BOUND_SCROLL_X - SCROLL_AREA &&
      event.clientX < UPPER_BOUND_SCROLL_X
    ) {
      intervalTimer = setInterval(() => {
        scrollWrapper.scrollLeft += SCROLL_SPEED_PX;
      }, SCROLL_SPEED_MS);
    } else if (
      event.clientX > X_OFFSET &&
      event.clientX < X_OFFSET + SCROLL_AREA
    ) {
      intervalTimer = setInterval(() => {
        scrollWrapper.scrollLeft -= SCROLL_SPEED_PX;
      }, SCROLL_SPEED_MS);
    } else if (
      event.clientY > UPPER_BOUND_SCROLL_Y - SCROLL_AREA &&
      event.clientY < UPPER_BOUND_SCROLL_Y
    ) {
      intervalTimer = setInterval(() => {
        scrollWrapper.scrollTop += SCROLL_SPEED_PX;
      }, SCROLL_SPEED_MS);
    } else if (
      event.clientY > Y_OFFSET &&
      event.clientY < Y_OFFSET + SCROLL_AREA
    ) {
      intervalTimer = setInterval(() => {
        scrollWrapper.scrollTop -= SCROLL_SPEED_PX;
      }, SCROLL_SPEED_MS);
    }
  }
});

const moveMwoAfterDrag = (index, indexY, dragTargetIndexX) => {
  const mwo = getElement(index, indexY);
  setElement(dragTargetIndexX, indexY, mwo);
  deleteElement(index, indexY);

  mwo.startDate = new Date(xLabels[dragTargetIndexX]);
  mwo.startIndexX = dragTargetIndexX;
  for (let i = 0; i < mwo.connectionsAsStart.length; i++) {
    mwo.connectionsAsStart[i].startIndexX = dragTargetIndexX;
  }

  for (let i = 0; i < mwo.connectionsAsEnd.length; i++) {
    mwo.connectionsAsEnd[i].endIndexX = dragTargetIndexX;
  }

  for (let i = 0; i < mwo.predecessorMwos.length; i++) {
    // get all successorMwos from current item, min index is new maxCol
    mwo.predecessorMwos[i].maxCol =
      Math.min(
        ...mwo.predecessorMwos[i].successorMwos.map((sMwo) =>
          getXIndexFromDate(sMwo.startDate)
        )
      ) - 1;
  }

  for (let i = 0; i < mwo.successorMwos.length; i++) {
    // get all predecessorMwos from current item, max index is new minCol
    mwo.successorMwos[i].minCol =
      Math.max(
        ...mwo.successorMwos[i].predecessorMwos.map((pMwo) =>
          getXIndexFromDate(pMwo.startDate)
        )
      ) + 1;
  }
};

// drag end, connection end
addEventListener("mouseup", (event) => {
  if (drag) {
    clearInterval(intervalTimer);
    dragTargetDate.innerText = "";
    getElement(dragElementStartIndexX, dragElementStartIndexY).drag = false;

    if (!outOfBounds) {
      const { indexX: dragTargetIndexX } = getIndicesFromEvent(event);

      // drag to another col happended
      if (
        dragTargetIndexX !== dragElementStartIndexX &&
        dragTargetIndexX >= 0 &&
        dragTargetIndexX <= xLabels.length - 1
      ) {
        // move dragged mwo
        moveMwoAfterDrag(
          dragElementStartIndexX,
          dragElementStartIndexY,
          dragTargetIndexX
        );

        // move other dragged dep mwo
        for (const [, { delta, startIndexX, startIndexY }] of Object.entries(
          dragDepLevel
        )) {
          if (
            (delta > 0 && startIndexX < dragTargetIndexX + delta) ||
            (delta < 0 && startIndexX > dragTargetIndexX + delta)
          ) {
            moveMwoAfterDrag(
              startIndexX,
              startIndexY,
              dragTargetIndexX + delta
            );
          }
        }
      }
    }

    drag = false;
    dragDepLevel = {};
    dragMinCol = days.length - 1;
    dragMaxCol = 0;
    dragElementStartIndexX = -1;
    dragElementStartIndexY = -1;
    requestAnimationFrame(render);
  }

  if (connectionMode) {
    clearInterval(intervalTimer);
    const { exactColor } = getColorFromEventPosition(event);

    // EnSt
    if (exactColor === DRAG_ANCHOR_FRONT_COLOR) {
      // connected with another mwo
      const { indexX: connectionEndIndexX, indexY: connectionEndIndexY } =
        getIndicesFromEvent(event);

      for (const [
        ,
        ,
        connectionStartRealIndexX,
        connectionStartRealIndexY,
      ] of connectionIndicators) {
        addConnection(
          connectionStartRealIndexX,
          connectionStartRealIndexY,
          connectionEndIndexX,
          connectionEndIndexY
        );
      }
    }

    connectionMode = false;
    connectionIndicators = [];
    requestAnimationFrame(render);
  }
});

addEventListener("keydown", (event) => {
  // !event.repeat prevents indefinite pressing from being emitted over and over again
  if (event.ctrlKey && !event.repeat) {
    const _event = {
      clientX: connectionEndX,
      clientY: connectionEndY,
    };
    const { exactColor } = getColorFromEventPosition(_event);

    if (exactColor === DRAG_ANCHOR_BACK_COLOR) {
      const { indexX, indexY } = getIndicesFromEvent(_event);

      const { realIndexX, realIndexY } = getRealIndicesFromEvent(_event);
      connectionIndicators.push([indexX, indexY, realIndexX, realIndexY]);
    }
  }
});

addEventListener("resize", () => {
  clearTimeout(timeoutTimer);

  timeoutTimer = setTimeout(() => {
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    scrollWrapper.style.width = `${canvas.width - X_OFFSET}px`;
    scrollWrapper.style.height = `${canvas.height - Y_OFFSET}px`;
    UPPER_BOUND_SCROLL_X = scrollWrapper.clientWidth + X_OFFSET;
    UPPER_BOUND_SCROLL_Y = scrollWrapper.clientHeight + Y_OFFSET;
    CANVAS_DRAW_WIDTH = canvas.width - X_OFFSET;
    CANVAS_DRAW_HEIGHT = canvas.height - Y_OFFSET;
    requestAnimationFrame(render);
  }, 500);
});

document.querySelector("#radiogroup").addEventListener("change", (e) => {
  if (e.target.value === "day") {
    xLabels = days;
    COL_WIDTH = COL_WIDTH_DAY;
  } else if (e.target.value === "week") {
    xLabels = weeks;
    COL_WIDTH = COL_WIDTH_DAY_WEEK;
  } else if (e.target.value === "month") {
    xLabels = months;
    COL_WIDTH = COL_WIDTH_DAY_MONTH;
  }

  LABEL_ARR = Array(xLabels.length);
  for (let i = 0; i < xLabels.length; i++) {
    LABEL_ARR[i] =
      xLabels[i] !== xLabels[i - 1]
        ? (typeof LABEL_ARR[i - 1] !== "number" ? -1 : LABEL_ARR[i - 1]) + 1 // value might be 0 and 0 is falsy :(
        : LABEL_ARR[i - 1] || 0;
  }

  VIEW = e.target.value;
  virtualSize.style.height = `${codes.length * ROW_HEIGHT}px`;
  virtualSize.style.width = `${xLabels.length * COL_WIDTH}px`;

  requestAnimationFrame(render);
});

document.getElementById("cascading-drag").addEventListener("change", (e) => {
  DRAG_DEP_MAX_LEVEL = e.target.checked ? 3 : 0;
});

const addConnection = (
  connectionStartIndexX,
  connectionStartIndexY,
  connectionEndIndexX,
  connectionEndIndexY
) => {
  const predecessor = getElement(connectionStartIndexX, connectionStartIndexY);
  const successor = getElement(connectionEndIndexX, connectionEndIndexY);

  predecessor.maxCol = Math.min(predecessor.maxCol, connectionEndIndexX - 1);

  successor.minCol = Math.max(successor.minCol, connectionStartIndexX + 1);

  const connection = {
    startIndexX: connectionStartIndexX,
    startIndexY: connectionStartIndexY,
    endIndexX: connectionEndIndexX,
    endIndexY: connectionEndIndexY,
    id: `${connectionStartIndexX}.${connectionStartIndexY}.${connectionEndIndexX}.${connectionEndIndexY}`,
  };

  predecessor.successorMwos.push(successor);
  predecessor.connectionsAsStart.push(connection);

  successor.predecessorMwos.push(predecessor);
  successor.connectionsAsEnd.push(connection);

  connections.push(connection);
};

const getIndicesFromEvent = (event) => {
  const indexX = Math.floor(
    (event.clientX + scrollWrapper.scrollLeft - X_OFFSET) / COL_WIDTH
  );
  const indexY = Math.floor(
    (event.clientY + scrollWrapper.scrollTop - Y_OFFSET) / ROW_HEIGHT
  );

  return { indexX, indexY };
};

const getElement = (indexX, indexY) => {
  return matrix[`${indexY}.${indexX}`];
};
const setElement = (indexX, indexY, element) => {
  matrix[`${indexY}.${indexX}`] = element;
};
const deleteElement = (indexX, indexY) => {
  matrix[`${indexY}.${indexX}`] = null;
};

const getXIndexFromDate = (date) => {
  return Math.floor((date - startDateMs) / MS_PER_DAY);
};

const getXIndexFromPosition = (x) => {
  return Math.floor((x - X_OFFSET + scrollWrapper.scrollLeft) / COL_WIDTH);
};

const getColorFromEventPosition = (event) => {
  const { data: dataExact } = ctx.getImageData(
    event.clientX,
    event.clientY,
    1,
    1
  );
  const exactColor = `rgb(${dataExact[0]} ${dataExact[1]} ${dataExact[2]})`;

  const { data } = ctx.getImageData(
    event.clientX - CONNECTION_LINE_DELETION_GRACE_PIXELS,
    event.clientY - CONNECTION_LINE_DELETION_GRACE_PIXELS,
    CONNECTION_LINE_DELETION_GRACE_PIXELS * 2,
    CONNECTION_LINE_DELETION_GRACE_PIXELS * 2
  );

  const colorSet = new Set();
  // rgba, therefore take batches of 4
  for (let i = 0; i <= data.length - 3; i += 4) {
    colorSet.add(`rgb(${data[i]} ${data[i + 1]} ${data[i + 2]})`);
  }

  return { colorSet, exactColor };
};

const getCalendarWeek = (date) => {
  const d = new Date(date);

  // ISO week date weeks start on Monday (1 = Monday, 7 = Sunday)
  const dayNum = d.getUTCDay() || 7; // Sunday should be 7, not 0

  // Shift date to Thursday of this week → ISO rules
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  // Start of the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  // ISO week number
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  return `${d.getUTCFullYear()}-${weekNum}`;
};

const END_OFFSET = 30;
const START_OFFSET = 0;

const FIRST_COL_COLOR = `rgb(255 255 255)`;
const SECOND_COL_COLOR = `rgb(155 155 155)`;
const TEXT_COLOR = `rgb(0 0 0)`;
const DRAG_ANCHOR_FRONT_COLOR = `rgb(1 1 1)`;
const DRAG_ANCHOR_BACK_COLOR = `rgb(2 2 2)`;
const MWO_COLOR = `rgb(0 128 0)`;
const DRAGGED_MWO_COLOR = `rgba(0, 128, 0, 0.8)`;
const DRAGGED_MWO_PLACEHOLDER_COLOR = `rgba(0, 128, 0, 0.4)`;
const MWO_OVERDUE_COLOR = `rgb(227 100 16)`;
const DRAGGED_MWO_OVERDUE_COLOR = `rgba(227, 100, 16, 0.8)`;
const DRAGGED_MWO_PLACEHOLDER_OVERDUE_COLOR = `rgba(227, 100, 16, 0.4)`;
const CONNECTION_LINE_COLOR = `rgb(3 3 3)`;
const DUE_DATE_COLOR = `rgb(4 4 4)`;
const DRAGGED_MWO_CONNECTION_COLOR = `rgb(255 0 0)`;

const SCROLL_SPEED_MS = 50;
const SCROLL_SPEED_PX = 50;
const SCROLL_AREA = 50;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 20;
const MWO_WIDTH = 60;
const DUE_DATE_INDICATOR_WIDTH = 5;

const COL_WIDTH_DAY = 60;
const COL_WIDTH_DAY_WEEK = 30;
const COL_WIDTH_DAY_MONTH = 10;

const CONNECTION_LINE_DELETION_GRACE_PIXELS = 4;

const DRAG_ANCHOR_RADIUS = 5;
let DRAG_DEP_MAX_LEVEL = 0;

let VIEW = "day";
let COL_WIDTH = COL_WIDTH_DAY;
let UPPER_BOUND_SCROLL_X = 1;
let UPPER_BOUND_SCROLL_Y = 1;
let CANVAS_DRAW_HEIGHT = 1;
let CANVAS_DRAW_WIDTH = 1;

const Y_OFFSET = 50;
const X_OFFSET = 100;

const dragTargetDate = document.querySelector("#drag-target-date");
const wrapper = document.querySelector("#gantt-wrapper");
const virtualSize = document.querySelector("#gantt-virtual-size");
const scrollWrapper = document.querySelector("#gantt-scroll-wrapper");
const canvas = document.querySelector("#gantt-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
ctx.font = "10px Arial";

canvas.width = wrapper.clientWidth;
canvas.height = wrapper.clientHeight;
scrollWrapper.style.width = `${canvas.width - X_OFFSET}px`;
scrollWrapper.style.height = `${canvas.height - Y_OFFSET}px`;
UPPER_BOUND_SCROLL_X = scrollWrapper.clientWidth + X_OFFSET;
UPPER_BOUND_SCROLL_Y = scrollWrapper.clientHeight + Y_OFFSET;
CANVAS_DRAW_WIDTH = canvas.width - X_OFFSET;
CANVAS_DRAW_HEIGHT = canvas.height - Y_OFFSET;

const items = getData() || generateItems(300);
const codes = getCodes(items);

const days = getDates(items);
const weeks = days.map((d) => getCalendarWeek(d));
const months = days.map((d) => d.slice(0, 7));

let xLabels = days;
const startDate = xLabels[0];
const startDateMs = new Date(startDate).getTime();
const endDate = xLabels[xLabels.length - 1];

let LABEL_ARR = [];

const matrix = {};
let connections = [];

let intervalTimer = null;
let timeoutTimer = null;

let dragElementStartIndexX = -1;
let dragElementStartIndexY = -1;
let dragX = 0;
let drag = false;

const MIN_BOUND_CROSSED = -1;
const NO_BOUND_CROSSED = 0;
const MAX_BOUND_CROSSED = 1;
let outOfBounds = NO_BOUND_CROSSED;
let dragDepLevel = {};
let dragMinCol = days.length - 1;
let dragMaxCol = 0;

let connectionIndicators = [];
let connectionEndX = 0;
let connectionEndY = 0;
let connectionMode = false;
let lastRenderTimestamp = 0;

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const indexX = Math.floor(
    (item.startDate - new Date(startDate).getTime()) / MS_PER_DAY
  );
  const key = `${i}.${indexX}`;
  matrix[key] = item;
}

virtualSize.style.height = `${codes.length * ROW_HEIGHT}px`;
virtualSize.style.width = `${xLabels.length * COL_WIDTH}px`;

// FOR TESTING PURPOSES -------------------------------------------------------------------------
const testConnections = [
  [0, 0, 699, 211],
  [6, 2, 9, 4],
  [6, 3, 9, 4],
  [5, 1, 9, 4],
  [5, 1, 13, 5],
  [9, 4, 25, 9],
  [13, 5, 15, 6],
  [15, 6, 17, 7],
  [17, 7, 21, 8],
  [21, 8, 25, 9],
];

// for (let i = 0; i < items.length; i++) {
//   const elem = items[i];
//   const indexX = getXIndexFromDate(elem.startDate);

//   for (let j = i + 1; j < items.length; j++) {
//     const _elem = items[j];
//     const _indexX = getXIndexFromDate(_elem.startDate);
//     if (_indexX > indexX + 2) {
//       testConnections.push([indexX, i, _indexX, j]);
//     }
//   }
// }

// console.log(testConnections.length);
for (const testConnection of testConnections) {
  addConnection(...testConnection);
}

// const selecteValue = "month";
// const selecteValue = "week";
const selecteValue = "day";
document.querySelector(`input[value='${selecteValue}']`).checked = true;
document
  .querySelector(`input[value='${selecteValue}']`)
  .dispatchEvent(new Event("change", { bubbles: true }));

document.querySelector("#cascading-drag").checked = true;
document
  .querySelector("#cascading-drag")
  .dispatchEvent(new Event("change", { bubbles: true }));
// FOR TESTING PURPOSES -------------------------------------------------------------------------

render(performance.now());

// ideas:
// * render background cols "as whole" for month/week (needs object where "length of weeks/months" is saved)
// * cache connections, recalc connections only if scrollLeft/scrollTop changes (during drag, not much scrolling)
// next steps:
// * small inconsistency: drag 9GCZEK twice to the max and see for yourself...
// * -if drag one, drag connected as well-
// * * save predecessor and successor with indexX in resp. arrays instead of plain array
// * * cascading drag is kind of a hard problem (Directed Acyclic Graph!)
// * * * dragging only 2-3 levels deep
// * * * * locally understandable vs. global powerful but scary effects
// * * * * * especially for mwo that are currently not in viewport (vertically)
// * * * * * * Somewhere 10000px to the right/bottom, a critical mwo moved by 10 days.
// * * * * easier to undo changes
// * * * * * "I touched one thing and my whole plan exploded"
// * * * * dragging one MWO a bit could affect potentially all MWOs -> feels chaotic and out of control.
// * * * * Most meaningful dependencies are within a few levels
// * * * otherwise: Either a higher-level bulk operation / “shift whole/sub chain” tool, not automatic cascading (recursive query CTE )
// * * * * massive reschedule should be dedicated function
// * * performance "hack" and protecting user from accidental chaos
// * while drag, draw connection for dragged element (get calculated anyway...)
// * performance issues and better data structure

// features: drag elements + 2-3 lvl of successor/predecessor, connect elements, delete connections

// make vs. buy
// frappe OS: kinda choppy no good way to connect tasks
// DHTMLX license
// anychart
// styling implies make

// TODO1: use logic in other places, too
// hypothetical start/end of element on x-axis
// const hSTartX = element.startIndexX * COL_WIDTH + X_OFFSET - scrollLeft;
// const hEndX = hSTartX + COL_WIDTH;
// const realStartX = Math.max(X_OFFSET, hSTartX);
// const realEndX = Math.min(hEndX, X_OFFSET + CANVAS_DRAW_WIDTH);
// const realMwoWidth = realEndX - realStartX;
