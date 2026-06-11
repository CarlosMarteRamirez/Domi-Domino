import type { Side } from "@/domain/domino/types";

/**
 * Board Layout Engine — edge-connected snake layout in logical units.
 * Ported from the proven legacy board-layout (bounds-aware wrapping).
 * UNIT=1 is the short tile side; renderer scales to pixels.
 */

export const UNIT = 1;
export const LONG = 2;
export const GAP = 2 / 44;
export const RESERVE = 12 / 44;
export const MIN_BOARD_H = 300 / 44;

export type Orientation = "horizontal" | "vertical";

export interface BoardTileInput {
  leftValue: number;
  rightValue: number;
  side?: Side | "first";
}

export interface PositionedTile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  orientation: Orientation;
  rotation: number;
  reversed: boolean;
  leftValue: number;
  rightValue: number;
  isOpening: boolean;
  isCorner: boolean;
}

export interface LayoutExtent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}


type TileOrientation = Orientation;

/** Lado por donde se conecta la siguiente ficha o la zona de juego. */
type AttachSide = "left" | "right" | "top" | "bottom";

export type TileAnchor = {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
};

interface PlacedTileStyle {
  anchor: TileAnchor;
  orientation: TileOrientation;
  width: number;
  height: number;
  leftValue: number;
  rightValue: number;
  isOpening: boolean;
  /** Por dónde llega la ficha anterior (para voltear la cara visible). */
  attachFrom?: AttachSide;
  /** Por dónde se colocaría la siguiente ficha en este extremo de cadena. */
  playAttach?: AttachSide;
  /** Voltear cara en filas fuera de la fila central (serpiente arriba/abajo). */
  reversed?: boolean;
}

interface ChainExtent {
  minLeft: number;
  minTop: number;
  maxRight: number;
  maxBottom: number;
}

type HDir = 1 | -1;

interface Bounds {
  minLeft: number;
  maxRight: number;
}

function tileOrientation(tile: BoardTileInput): TileOrientation {
  return tile.leftValue === tile.rightValue ? "vertical" : "horizontal";
}

function tileSize(orientation: TileOrientation) {
  return orientation === "horizontal"
    ? { width: LONG, height: UNIT }
    : { width: UNIT, height: LONG };
}

function buildStyle(tile: BoardTileInput, isOpening: boolean): PlacedTileStyle {
  const orientation = tileOrientation(tile);
  const size = tileSize(orientation);
  return {
    anchor: { left: 0, top: 0 },
    orientation,
    isOpening,
    leftValue: tile.leftValue,
    rightValue: tile.rightValue,
    ...size,
  };
}

function alignTop(neighbor: PlacedTileStyle, tile: PlacedTileStyle): number {
  const neighborTop = neighbor.anchor.top ?? 0;
  return neighborTop + (neighbor.height - tile.height) / 2;
}

/** Y de la fila horizontal más alta (fila superior de la serpiente). */
function topmostHorizontalTop(styles: PlacedTileStyle[]): number | null {
  let min: number | null = null;
  for (const s of styles) {
    if (s.orientation !== "horizontal") continue;
    const top = s.anchor.top ?? 0;
    if (min === null || top < min) min = top;
  }
  return min;
}

function isOnTopHorizontalRow(prev: PlacedTileStyle, styles: PlacedTileStyle[]): boolean {
  if (prev.orientation !== "horizontal") return false;
  const topRowY = topmostHorizontalTop(styles);
  return topRowY !== null && (prev.anchor.top ?? 0) === topRowY;
}

/** Primera horizontal de fila LTR tras un vertical: alinea el borde superior con el del vertical. */
function horizontalRowTopAfterVertical(prev: PlacedTileStyle): number {
  return prev.anchor.top ?? 0;
}

/** Primera horizontal RTL tras vertical bajo doble de esquina: alinea con la mitad inferior. */
function alignFirstRtlBesideVerticalBelowDouble(
  vertical: PlacedTileStyle,
  tile: PlacedTileStyle,
): number {
  return (vertical.anchor.top ?? 0) + vertical.height - tile.height;
}

function setAttach(tile: PlacedTileStyle, from: AttachSide) {
  tile.attachFrom = from;
}

/** Esquina que baja/sube: ficha perpendicular (vertical), salvo dobles que ya lo son. */
function ensureVerticalTurn(tile: PlacedTileStyle) {
  if (tile.leftValue === tile.rightValue) return;
  tile.orientation = "vertical";
  tile.width = UNIT;
  tile.height = LONG;
}

/** Tramo horizontal de la serpiente. */
function ensureHorizontal(tile: PlacedTileStyle) {
  if (tile.leftValue === tile.rightValue) return;
  tile.orientation = "horizontal";
  tile.width = LONG;
  tile.height = UNIT;
}

/** Fuerza horizontal incluso en dobles (fila RTL/LTR de la serpiente). */
function forceHorizontal(tile: PlacedTileStyle) {
  tile.orientation = "horizontal";
  tile.width = LONG;
  tile.height = UNIT;
}

/** Fuerza vertical incluso en dobles. */
function forceVertical(tile: PlacedTileStyle) {
  tile.orientation = "vertical";
  tile.width = UNIT;
  tile.height = LONG;
}

/**
 * Doble tras vertical → horizontal (|-|); doble tras horizontal → vertical (-|-).
 * Siempre centrado respecto al vecino con alignTop.
 */
function orientDoubleAfterPrev(prev: PlacedTileStyle, tile: PlacedTileStyle) {
  if (prev.orientation === "vertical") {
    forceHorizontal(tile);
  } else {
    forceVertical(tile);
  }
}

function placeDoubleInRow(
  prev: PlacedTileStyle,
  tile: PlacedTileStyle,
  hDir: HDir,
): TileAnchor {
  orientDoubleAfterPrev(prev, tile);
  const left =
    hDir === 1
      ? (prev.anchor.left ?? 0) + prev.width + GAP
      : (prev.anchor.left ?? 0) - tile.width - GAP;
  return { left, top: alignTop(prev, tile) };
}

function placeDownFromRight(prev: PlacedTileStyle, tile: PlacedTileStyle): TileAnchor {
  if (tile.leftValue === tile.rightValue) {
    orientDoubleAfterPrev(prev, tile);
  } else {
    ensureVerticalTurn(tile);
  }
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  setAttach(tile, "top");
  return {
    left: prevLeft + prev.width - tile.width,
    top: prevTop + prev.height + GAP,
  };
}

function placeDownFromLeft(prev: PlacedTileStyle, tile: PlacedTileStyle): TileAnchor {
  ensureVerticalTurn(tile);
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  setAttach(tile, "top");
  return {
    left: prevLeft,
    top: prevTop + prev.height + GAP,
  };
}

function placeUpFromLeft(prev: PlacedTileStyle, tile: PlacedTileStyle): TileAnchor {
  ensureVerticalTurn(tile);
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  setAttach(tile, "bottom");
  return {
    left: prevLeft,
    top: prevTop - tile.height - GAP,
  };
}

function placeUpFromRight(prev: PlacedTileStyle, tile: PlacedTileStyle): TileAnchor {
  ensureVerticalTurn(tile);
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  setAttach(tile, "bottom");
  return {
    left: prevLeft + prev.width - tile.width,
    top: prevTop - tile.height - GAP,
  };
}

function isSameRowBand(style: PlacedTileStyle, rowCenterY: number): boolean {
  const centerY = (style.anchor.top ?? 0) + style.height / 2;
  return Math.abs(centerY - rowCenterY) <= UNIT / 2 + 2;
}

/** Desplaza toda la fila un espacio hacia atrás (RTL: hacia la izquierda). */
function shiftArmRowLeft(
  styles: PlacedTileStyle[],
  fromIdx: number,
  toIdx: number,
  rowCenterY: number,
) {
  const shift = LONG + GAP;
  for (let j = fromIdx; j <= toIdx; j++) {
    const s = styles[j]!;
    if (!isSameRowBand(s, rowCenterY)) continue;
    s.anchor.left = (s.anchor.left ?? 0) - shift;
  }
}

/** Doble tras horizontal en fila RTL al borde: vertical (-|-) centrado; la fila retrocede un espacio. */
function placeDoubleAfterHorizontalRtl(
  styles: PlacedTileStyle[],
  rowStartIdx: number,
  prevIdx: number,
  tile: PlacedTileStyle,
): TileAnchor {
  const prev = styles[prevIdx]!;
  const rowCenterY = (prev.anchor.top ?? 0) + prev.height / 2;
  const slotLeft = prev.anchor.left ?? 0;
  forceVertical(tile);
  setAttach(tile, "right");
  // La primera ficha de la fila queda anclada al vertical; solo retroceden las siguientes.
  if (prevIdx > rowStartIdx) {
    shiftArmRowLeft(styles, rowStartIdx + 1, prevIdx, rowCenterY);
  }
  return {
    left: slotLeft,
    top: rowCenterY - tile.height / 2,
  };
}

/** Doble tras vertical de giro hacia abajo: horizontal debajo, centrado en la columna. */
function placeDoubleBelowVerticalCorner(
  neighbor: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  forceHorizontal(tile);
  setAttach(tile, "top");
  const neighborLeft = neighbor.anchor.left ?? 0;
  const neighborTop = neighbor.anchor.top ?? 0;
  return {
    left: neighborLeft + neighbor.width / 2 - tile.width / 2,
    top: neighborTop + neighbor.height + GAP,
  };
}

/** Doble tras vertical de giro hacia arriba: horizontal encima, centrado en la columna. */
function placeDoubleAboveVerticalCorner(
  neighbor: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  forceHorizontal(tile);
  setAttach(tile, "bottom");
  const neighborLeft = neighbor.anchor.left ?? 0;
  const neighborTop = neighbor.anchor.top ?? 0;
  return {
    left: neighborLeft + neighbor.width / 2 - tile.width / 2,
    top: neighborTop - tile.height - GAP,
  };
}

/** Primera horizontal de fila inferior: pegada a la mitad derecha del vertical, sigue a la derecha. */
function placeHorizontalBelowVerticalRight(
  prev: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  ensureHorizontal(tile);
  setAttach(tile, "top");
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  return {
    left: prevLeft - prev.width,
    top: prevTop + prev.height + GAP,
  };
}

/** Horizontal debajo de vertical en borde izquierdo: misma regla, mitad derecha del vertical. */
function placeHorizontalBelowVerticalFlush(
  prev: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  ensureHorizontal(tile);
  setAttach(tile, "top");
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  return {
    left: prevLeft + prev.width / 2,
    top: prevTop + prev.height + GAP,
  };
}

/** Primera horizontal de fila superior: pegada a la mitad izquierda del vertical, sigue a la izquierda. */
function placeHorizontalAboveVerticalLeft(
  prev: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  ensureHorizontal(tile);
  setAttach(tile, "bottom");
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  return {
    left: (prevLeft + prev.width) * 1.75 - tile.width,
    top: prevTop - tile.height - GAP,
  };
}

/** Ficha vertical encima de un doble de esquina (misma columna). */
function placeVerticalAboveCornerDouble(
  prev: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  ensureVerticalTurn(tile);
  setAttach(tile, "bottom");
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  return {
    left: prevLeft + prev.width / 4,//+ 24,
    top: prevTop - tile.height - GAP,
  };
}

/** Ficha vertical debajo de un doble horizontal de esquina (misma columna). */
function placeVerticalBelowCornerDouble(
  prev: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  ensureVerticalTurn(tile);
  setAttach(tile, "top");
  const prevLeft = prev.anchor.left ?? 0;
  const prevTop = prev.anchor.top ?? 0;
  return {
    left: prevLeft + prev.width / 4,
    top: prevTop + prev.height + GAP,
  };
}

/** Baja en la columna fija de la serpiente (mismo left que la esquina). */
function placeDownInColumn(
  columnLeft: number,
  prev: PlacedTileStyle,
  tile: PlacedTileStyle,
): TileAnchor {
  ensureVerticalTurn(tile);
  setAttach(tile, "top");
  return {
    left: columnLeft,
    top: (prev.anchor.top ?? 0) + prev.height + GAP,
  };
}

/** Primera ficha de fila RTL: a la izquierda de la esquina, misma altura. */
function placeAfterCornerRtl(
  corner: PlacedTileStyle,
  tile: PlacedTileStyle,
  columnLeft: number | null,
): TileAnchor {
  if (tile.leftValue === tile.rightValue) {
    orientDoubleAfterPrev(corner, tile);
  } else {
    ensureHorizontal(tile);
  }
  setAttach(tile, "right");
  const anchorLeft = columnLeft ?? corner.anchor.left ?? 0;
  return {
    left: anchorLeft - tile.width - GAP,
    top: alignTop(corner, tile),
  };
}

/** Primera ficha de fila LTR: a la derecha de la esquina, misma altura. */
function placeAfterCornerLtr(corner: PlacedTileStyle, tile: PlacedTileStyle): TileAnchor {
  if (tile.leftValue === tile.rightValue) {
    orientDoubleAfterPrev(corner, tile);
  } else {
    ensureHorizontal(tile);
  }
  setAttach(tile, "left");
  return {
    left: (corner.anchor.left ?? 0) + corner.width + GAP,
    top: alignTop(corner, tile),
  };
}

function walkRightArm(styles: PlacedTileStyle[], anchorIndex: number, bounds: Bounds) {
  let hDir: HDir = 1;
  let pendingRowStart: "rtl" | "ltr" | null = null;
  let columnLeft: number | null = null;
  let rowStartIndex: number | null = null;
  /** Solo la 1.ª horizontal RTL tras placeVerticalBelowCornerDouble. */
  let rtlBesideVerticalBelowDouble = false;
  let prev = styles[anchorIndex]!;
  prev.playAttach = "right";

  for (let i = anchorIndex + 1; i < styles.length; i++) {
    const tile = styles[i]!;

    if (pendingRowStart === "rtl") {
      if (prev.orientation === "vertical" && tile.leftValue === tile.rightValue) {
        tile.anchor = placeDoubleBelowVerticalCorner(prev, tile);
        pendingRowStart = "rtl";
      } else if (
        prev.leftValue === prev.rightValue &&
        tile.leftValue !== tile.rightValue
      ) {
        tile.anchor = placeVerticalBelowCornerDouble(prev, tile);
        pendingRowStart = null;
        rtlBesideVerticalBelowDouble = true;
      } else if (
        prev.orientation === "vertical" &&
        tile.leftValue !== tile.rightValue
      ) {
        tile.anchor = placeHorizontalBelowVerticalRight(prev, tile);
        pendingRowStart = null;
      } else {
        tile.anchor = placeAfterCornerRtl(prev, tile, columnLeft);
        pendingRowStart = null;
      }
      hDir = -1;
      rowStartIndex = i;
      prev.playAttach = "left";
      prev = tile;
      continue;
    }
    if (pendingRowStart === "ltr") {
      if (prev.orientation === "vertical" && tile.leftValue === tile.rightValue) {
        tile.anchor = placeDoubleBelowVerticalCorner(prev, tile);
        pendingRowStart = "rtl";
      } else {
        tile.anchor = placeAfterCornerLtr(prev, tile);
        pendingRowStart = null;
      }
      hDir = 1;
      rowStartIndex = i;
      prev.playAttach = "right";
      prev = tile;
      continue;
    }

    if (hDir === 1) {
      if (tile.leftValue === tile.rightValue) {
        const left = (prev.anchor.left ?? 0) + prev.width + GAP;
        if (left + tile.width <= bounds.maxRight) {
          tile.anchor = placeDoubleInRow(prev, tile, 1);
          setAttach(tile, "left");
          prev.playAttach = "right";
        } else {
          tile.anchor = placeDownFromRight(prev, tile);
          columnLeft = tile.anchor.left ?? null;
          pendingRowStart = "rtl";
          rowStartIndex = null;
          prev.playAttach = "left";
          hDir = -1;
        }
      } else {
        ensureHorizontal(tile);
        const left = (prev.anchor.left ?? 0) + prev.width + GAP;
        if (left + tile.width <= bounds.maxRight) {
          tile.anchor = { left, top: alignTop(prev, tile) };
          setAttach(tile, "left");
          prev.playAttach = "right";
        } else {
          tile.anchor = placeDownFromRight(prev, tile);
          columnLeft = tile.anchor.left ?? null;
          pendingRowStart = "rtl";
          rowStartIndex = null;
          prev.playAttach = "left";
          hDir = -1;
        }
      }
    } else {
      const left = (prev.anchor.left ?? 0) - tile.width - GAP;
      const isRightArmEnd = i === styles.length - 1;
      const turnDownAtTopRowEnd =
        isRightArmEnd &&
        left >= bounds.minLeft &&
        isOnTopHorizontalRow(prev, styles) &&
        tile.leftValue !== tile.rightValue;
      if (turnDownAtTopRowEnd) {
        tile.anchor = placeDownFromRight(prev, tile);
        setAttach(tile, "top");
        prev.playAttach = "left";
        rtlBesideVerticalBelowDouble = false;
      } else if (left >= bounds.minLeft) {
        if (tile.leftValue === tile.rightValue) {
          tile.anchor = placeDoubleInRow(prev, tile, -1);
        } else {
          ensureHorizontal(tile);
          const top =
            rtlBesideVerticalBelowDouble && prev.orientation === "vertical"
              ? alignFirstRtlBesideVerticalBelowDouble(prev, tile)
              : alignTop(prev, tile);
          tile.anchor = { left, top };
        }
        rtlBesideVerticalBelowDouble = false;
        setAttach(tile, "right");
        prev.playAttach = "left";
      } else if (
          columnLeft !== null &&
          tile.leftValue === tile.rightValue &&
          prev.orientation === "horizontal"
        ) {
          const rowStart = rowStartIndex ?? anchorIndex + 1;
          tile.anchor = placeDoubleAfterHorizontalRtl(styles, rowStart, i - 1, tile);
          prev.playAttach = "left";
        } else if (prev.orientation === "vertical") {
          tile.anchor = placeHorizontalBelowVerticalFlush(prev, tile);
          prev.playAttach = "right";
          hDir = 1;
          rowStartIndex = i;
        } else if (columnLeft !== null) {
          tile.anchor = placeDownInColumn(columnLeft, prev, tile);
          pendingRowStart = "ltr";
          rowStartIndex = null;
          prev.playAttach = "right";
          hDir = 1;
        } else {
          tile.anchor = placeDownFromLeft(prev, tile);
          columnLeft = tile.anchor.left ?? null;
          pendingRowStart = "ltr";
          rowStartIndex = null;
          prev.playAttach = "right";
          hDir = 1;
        }
    }

    prev = tile;
  }

  prev.playAttach = hDir === 1 ? "right" : "left";
}

function walkLeftArm(styles: PlacedTileStyle[], anchorIndex: number, bounds: Bounds) {
  let hDir: HDir = -1;
  let pendingRowStart: "rtl" | "ltr" | null = null;
  /** Y fija de la fila LTR actual (2/1, 2/5, … comparten el mismo top). */
  let rowTop: number | null = null;
  let prev = styles[anchorIndex]!;
  prev.playAttach = "left";

  for (let i = anchorIndex - 1; i >= 0; i--) {
    const tile = styles[i]!;

    if (pendingRowStart === "ltr") {
      rowTop = null;
      if (prev.orientation === "vertical" && tile.leftValue === tile.rightValue) {
        tile.anchor = placeDoubleAboveVerticalCorner(prev, tile);
        pendingRowStart = "ltr";
        rowTop = tile.anchor.top ?? null;
      } else if (
        prev.leftValue === prev.rightValue &&
        tile.leftValue !== tile.rightValue
      ) {
        tile.anchor = placeVerticalAboveCornerDouble(prev, tile);
        pendingRowStart = null;
      } else if (
        prev.orientation === "vertical" &&
        tile.leftValue !== tile.rightValue
      ) {
        tile.anchor = placeHorizontalAboveVerticalLeft(prev, tile);
        pendingRowStart = null;
        rowTop = tile.anchor.top ?? null;
      } else {
        tile.anchor = placeAfterCornerLtr(prev, tile);
        pendingRowStart = null;
        rowTop = tile.anchor.top ?? null;
      }
      hDir = 1;
      prev.playAttach = "right";
      prev = tile;
      continue;
    }
    if (pendingRowStart === "rtl") {
      rowTop = null;
      if (prev.orientation === "vertical" && tile.leftValue === tile.rightValue) {
        tile.anchor = placeDoubleAboveVerticalCorner(prev, tile);
        pendingRowStart = "ltr";
        rowTop = tile.anchor.top ?? null;
      } else {
        tile.anchor = placeAfterCornerRtl(prev, tile, null);
        pendingRowStart = null;
      }
      hDir = -1;
      prev.playAttach = "left";
      prev = tile;
      continue;
    }

    if (hDir === -1) {
      const left = (prev.anchor.left ?? 0) - tile.width - GAP;
      if (left >= bounds.minLeft) {
        if (tile.leftValue === tile.rightValue) {
          tile.anchor = placeDoubleInRow(prev, tile, -1);
        } else {
          ensureHorizontal(tile);
          tile.anchor = { left, top: alignTop(prev, tile) };
        }
        setAttach(tile, "right");
        prev.playAttach = "left";
      } else if (
        i === 0 &&
        isOnTopHorizontalRow(prev, styles) &&
        tile.leftValue !== tile.rightValue
      ) {
        tile.anchor = placeDownFromLeft(prev, tile);
        pendingRowStart = "ltr";
        rowTop = null;
        prev.playAttach = "right";
        hDir = 1;
      } else {
        tile.anchor = placeUpFromLeft(prev, tile);
        pendingRowStart = "ltr";
        rowTop = null;
        prev.playAttach = "right";
        hDir = 1;
      }
    } else {
      const left = (prev.anchor.left ?? 0) + prev.width + GAP;
      if (left + tile.width <= bounds.maxRight) {
        if (tile.leftValue === tile.rightValue) {
          tile.anchor = placeDoubleInRow(prev, tile, 1);
        } else {
          ensureHorizontal(tile);
          let top: number;
          if (rowTop !== null) {
            top = rowTop;
          } else if (prev.orientation === "vertical") {
            top = horizontalRowTopAfterVertical(prev);
            rowTop = top;
          } else {
            top = alignTop(prev, tile);
            rowTop = top;
          }
          tile.anchor = { left, top };
        }
        setAttach(tile, "left");
        prev.playAttach = "right";
      } else if (tile.leftValue === tile.rightValue) {
        orientDoubleAfterPrev(prev, tile);
        tile.anchor = placeUpFromRight(prev, tile);
        pendingRowStart = "rtl";
        rowTop = null;
        prev.playAttach = "left";
        hDir = -1;
      } else {
        ensureHorizontal(tile);
        tile.anchor = placeUpFromRight(prev, tile);
        pendingRowStart = "rtl";
        rowTop = null;
        prev.playAttach = "left";
        hDir = -1;
      }
    }

    prev = tile;
  }

  prev.playAttach = hDir === -1 ? "left" : "right";
}

/** Filas arriba/abajo de la apertura muestran horizontal invertida; la fila central no. */
function applyRowReversal(styles: PlacedTileStyle[], anchorIndex: number) {
  const anchor = styles[anchorIndex];
  if (!anchor) return;
  const middleY = (anchor.anchor.top ?? 0) + anchor.height / 2;
  const rowBand = UNIT / 2 + GAP;

  for (const tile of styles) {
    if (tile.orientation !== "horizontal") continue;
    const tileY = (tile.anchor.top ?? 0) + tile.height / 2;
    tile.reversed = Math.abs(tileY - middleY) > rowBand;
  }
}

function shiftVerticalIntoView(styles: PlacedTileStyle[]) {
  if (styles.length === 0) return;
  const minTop = Math.min(...styles.map((s) => s.anchor.top ?? 0));
  if (minTop < RESERVE) {
    const dy = RESERVE - minTop;
    for (const s of styles) {
      s.anchor.top = (s.anchor.top ?? 0) + dy;
    }
  }
}

/** Centra el bloque de fichas en el alto visible del contenedor. */
function centerChainInContainer(styles: PlacedTileStyle[], containerHeight: number) {
  const extent = getChainExtent(styles);
  if (!extent) return;
  const contentMid = extent.minTop + (extent.maxBottom - extent.minTop) / 2;
  const dy = containerHeight / 2 - contentMid;
  for (const s of styles) {
    s.anchor.top = (s.anchor.top ?? 0) + dy;
  }
}

function getChainExtent(styles: PlacedTileStyle[]): ChainExtent | null {
  if (styles.length === 0) return null;
  let minLeft = Infinity;
  let minTop = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;
  for (const s of styles) {
    const left = s.anchor.left ?? 0;
    const top = s.anchor.top ?? 0;
    minLeft = Math.min(minLeft, left);
    minTop = Math.min(minTop, top);
    maxRight = Math.max(maxRight, left + s.width);
    maxBottom = Math.max(maxBottom, top + s.height);
  }
  return { minLeft, minTop, maxRight, maxBottom };
}


/** Posición exacta donde iría la siguiente ficha (misma lógica que al colocarla). */
function predictNextTileStyle(
  tiles: BoardTileInput[],
  side: Side,
  nextTile: { leftValue: number; rightValue: number },
  chainWidth: number,
  chainHeight: number,
): PlacedTileStyle | null {
  if (tiles.length === 0) return null;

  const extended: BoardTileInput[] =
    side === "left"
      ? [{ ...nextTile, side: "left" }, ...tiles]
      : [...tiles, { ...nextTile, side: "right" }];

  const styles = layoutChainForView(extended, chainWidth, chainHeight);
  return side === "left" ? (styles[0] ?? null) : (styles[styles.length - 1] ?? null);
}

function computeChainLayout(
  tiles: BoardTileInput[],
  chainWidth: number,
  chainHeight: number,
): PlacedTileStyle[] {
  if (tiles.length === 0) return [];

  const firstIndex = tiles.findIndex((t) => t.side === "first");
  const anchorIndex = firstIndex >= 0 ? firstIndex : 0;
  const styles = tiles.map((t, i) => buildStyle(t, i === anchorIndex));
  const anchor = styles[anchorIndex]!;

  anchor.anchor = {
    left: chainWidth / 2 - anchor.width / 2,
    top: chainHeight / 2 - anchor.height / 2,
  };

  const bounds: Bounds = {
    minLeft: RESERVE,
    maxRight: chainWidth - RESERVE,
  };

  walkRightArm(styles, anchorIndex, bounds);
  walkLeftArm(styles, anchorIndex, bounds);
  shiftVerticalIntoView(styles);
  applyRowReversal(styles, anchorIndex);

  return styles;
}



function tileId(t: { leftValue: number; rightValue: number }): string {
  const a = Math.min(t.leftValue, t.rightValue);
  const b = Math.max(t.leftValue, t.rightValue);
  return `${a}-${b}`;
}

function styleToPositioned(s: PlacedTileStyle): PositionedTile {
  return {
    id: tileId(s),
    x: s.anchor.left ?? 0,
    y: s.anchor.top ?? 0,
    w: s.width,
    h: s.height,
    orientation: s.orientation,
    rotation: s.orientation === "vertical" ? 90 : 0,
    reversed: s.reversed ?? false,
    leftValue: s.leftValue,
    rightValue: s.rightValue,
    isOpening: s.isOpening ?? false,
    isCorner: false,
  };
}

function layoutChainForView(
  tiles: BoardTileInput[],
  boardWidth: number,
  boardHeight: number,
): PlacedTileStyle[] {
  const styles = computeChainLayout(tiles, boardWidth, boardHeight);
  const extent = getChainExtent(styles);
  const containerH = extent ? Math.max(boardHeight, extent.maxBottom + RESERVE) : boardHeight;
  centerChainInContainer(styles, containerH);
  return styles;
}

export function computeLayout(
  tiles: BoardTileInput[],
  boardWidth: number,
  boardHeight: number,
): PositionedTile[] {
  return layoutChainForView(tiles, boardWidth, boardHeight).map(styleToPositioned);
}

export function getLayoutExtent(placed: PositionedTile[]): LayoutExtent | null {
  if (placed.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function predictNext(
  tiles: BoardTileInput[],
  side: Side,
  nextTile: { leftValue: number; rightValue: number },
  boardWidth: number,
  boardHeight: number,
): PositionedTile | null {
  const style = predictNextTileStyle(tiles, side, nextTile, boardWidth, boardHeight);
  return style ? styleToPositioned(style) : null;
}
