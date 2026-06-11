"use client";

import * as React from "react";
import { cn } from "@/presentation/lib/utils";
import type { Side } from "@/domain/domino/types";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import { Tile } from "@/domain/domino/value-objects/tile";
import type { MatchActionDto } from "@/shared/socket/contract";
import {
  LONG,
  MIN_BOARD_H,
  UNIT,
  computeLayout,
  getLayoutExtent,
  predictNext,
  type LayoutExtent,
  type PositionedTile,
} from "./board-layout-engine";
import { DominoTile } from "./domino-tile";

interface Props {
  board: MatchState["board"];
  selectedTile: string | null;
  playableSides: Side[];
  matchAction: MatchActionDto | null;
  onPlace: (side: Side) => void;
  onDropTile?: (side: Side) => void;
}

/** Pixel projection of a logical cell, computed only by the renderer. */
interface TileBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Center, used for animation targets and nearest-side detection. */
  cx: number;
  cy: number;
}

type Projection = {
  unit: number;
  originX: number;
  originY: number;
};

/** Reference px per logical UNIT (short tile side at 100% scale). */
const UNIT_PX = 44;
/** Max/min tile scale on screen (short side in px). */
const UNIT_MAX_PX = 44;
const UNIT_MIN_PX = 20;
/** Inner padding of the board (matches the `p-6` container). */
const BOARD_PADDING = 48;
const MIN_CHAIN_HEIGHT = 300;

function projectCell(
  tile: PositionedTile,
  extent: LayoutExtent,
  proj: Projection,
): TileBox {
  const { unit, originX, originY } = proj;
  const left = originX + (tile.x - extent.minX) * unit;
  const top = originY + (tile.y - extent.minY) * unit;
  const width = tile.w * unit;
  const height = tile.h * unit;
  return {
    left,
    top,
    width,
    height,
    cx: left + width / 2,
    cy: top + height / 2,
  };
}

function PlacementZone({
  side,
  visible,
  highlighted,
  onPlace,
  style,
  ariaLabel,
  zoneRef,
}: {
  side: Side;
  visible: boolean;
  highlighted: boolean;
  onPlace: (side: Side) => void;
  style: React.CSSProperties;
  ariaLabel: string;
  zoneRef?: React.Ref<HTMLButtonElement>;
}) {
  if (!visible) return null;
  return (
    <button
      ref={zoneRef}
      type="button"
      onClick={() => onPlace(side)}
      style={style}
      className={cn(
        "absolute rounded-md border-2 border-dashed shadow-inner transition-all duration-200",
        highlighted
          ? "z-10 scale-105 border-domino-cream/70 bg-domino-blue/45 ring-2 ring-domino-cream/35 shadow-md"
          : "border-domino-blue-light/50 bg-domino-blue/15 hover:border-domino-cream/50 hover:bg-domino-blue/25",
      )}
      aria-label={ariaLabel}
    />
  );
}

type Point = { x: number; y: number };

export type BoardViewHandle = {
  getTargetPoint: (target: Side | "center") => Point | null;
  getBoardElement: () => HTMLDivElement | null;
};

export const BoardView = React.forwardRef<BoardViewHandle, Props>(function BoardView(
  { board, selectedTile, playableSides, matchAction, onPlace, onDropTile },
  ref,
) {
  const isEmpty = board.tiles.length === 0;
  const hasSelection = Boolean(selectedTile);
  const showCenter = hasSelection && isEmpty;
  const showLeft = !isEmpty && hasSelection && playableSides.includes("left");
  const showRight = !isEmpty && hasSelection && playableSides.includes("right");

  const selected = selectedTile ? Tile.fromId(selectedTile) : null;

  const boardRef = React.useRef<HTMLDivElement>(null);
  const chainRef = React.useRef<HTMLDivElement>(null);
  const leftZoneRef = React.useRef<HTMLButtonElement>(null);
  const rightZoneRef = React.useRef<HTMLButtonElement>(null);
  const centerZoneRef = React.useRef<HTMLButtonElement>(null);

  const [hoverSide, setHoverSide] = React.useState<Side | null>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [landingId, setLandingId] = React.useState<string | null>(null);
  const [chainSize, setChainSize] = React.useState({ w: 0, h: MIN_CHAIN_HEIGHT });

  const measureChainArea = React.useCallback(() => {
    const el = boardRef.current;
    if (!el || el.clientWidth <= 0) return;
    setChainSize({
      w: el.clientWidth - BOARD_PADDING,
      h: Math.max(MIN_CHAIN_HEIGHT, el.clientHeight - BOARD_PADDING),
    });
  }, []);

  React.useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    measureChainArea();
    const ro = new ResizeObserver(measureChainArea);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isEmpty, measureChainArea]);

  // --- Layer 2: logical layout (pure, no pixels) -----------------------------
  const boardTileInputs = React.useMemo(
    () =>
      board.tiles.map((t) => ({
        leftValue: t.leftValue,
        rightValue: t.rightValue,
        side: t.side,
      })),
    [board.tiles],
  );

  const boardLogical = React.useMemo(
    () => ({
      w: chainSize.w / UNIT_PX,
      h: Math.max(MIN_BOARD_H, chainSize.h / UNIT_PX),
    }),
    [chainSize.w, chainSize.h],
  );

  const placed = React.useMemo(
    () => computeLayout(boardTileInputs, boardLogical.w, boardLogical.h),
    [boardTileInputs, boardLogical.w, boardLogical.h],
  );
  const extent = React.useMemo(() => getLayoutExtent(placed), [placed]);

  // --- Layer 3: pixel projection (scale + center) ----------------------------
  const projection = React.useMemo<Projection | null>(() => {
    if (!extent || chainSize.w <= 0 || extent.width <= 0 || extent.height <= 0) {
      return null;
    }
    const unit = Math.max(
      UNIT_MIN_PX / UNIT,
      Math.min(
        UNIT_MAX_PX / UNIT,
        chainSize.w / extent.width,
        chainSize.h / extent.height,
      ),
    );
    const gridW = extent.width * unit;
    const gridH = extent.height * unit;
    return {
      unit,
      originX: (chainSize.w - gridW) / 2,
      originY: (chainSize.h - gridH) / 2,
    };
  }, [extent, chainSize.w, chainSize.h]);

  const chainContentH = React.useMemo(() => {
    if (!extent || !projection) return MIN_CHAIN_HEIGHT;
    return Math.max(MIN_CHAIN_HEIGHT, extent.height * projection.unit + 24);
  }, [extent, projection]);

  const project = React.useCallback(
    (tile: PositionedTile): TileBox | null => {
      if (!extent || !projection) return null;
      return projectCell(tile, extent, projection);
    },
    [extent, projection],
  );

  const placementPreview = React.useMemo((): {
    left: PositionedTile | null;
    right: PositionedTile | null;
  } => {
    if (!selected || placed.length === 0 || !projection) {
      return { left: null, right: null };
    }
    const nextTile = { leftValue: selected.high, rightValue: selected.low };
    return {
      left: playableSides.includes("left")
        ? predictNext(boardTileInputs, "left", nextTile, boardLogical.w, boardLogical.h)
        : null,
      right: playableSides.includes("right")
        ? predictNext(boardTileInputs, "right", nextTile, boardLogical.w, boardLogical.h)
        : null,
    };
  }, [selected, boardTileInputs, boardLogical.w, boardLogical.h, projection, playableSides]);

  // Newest tile lands with the drop animation; existing tiles transition.
  const prevIdsRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    const currentIds = new Set(board.tiles.map((t) => t.id));
    let added: string | null = null;
    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id)) {
        added = id;
        break;
      }
    }
    prevIdsRef.current = currentIds;
    if (added) {
      setLandingId(added);
      const timer = setTimeout(() => setLandingId(null), 480);
      return () => clearTimeout(timer);
    }
  }, [board.tiles]);

  const getTargetPoint = React.useCallback(
    (target: Side | "center"): Point | null => {
      const boardEl = boardRef.current;
      if (!boardEl) return null;
      const boardRect = boardEl.getBoundingClientRect();
      const chainEl = chainRef.current;

      if (target === "center" || isEmpty) {
        if (chainEl) {
          const r = chainEl.getBoundingClientRect();
          return {
            x: r.left - boardRect.left + r.width / 2,
            y: r.top - boardRect.top + r.height / 2,
          };
        }
        return { x: boardRect.width / 2, y: boardRect.height / 2 };
      }

      const preview = target === "left" ? placementPreview.left : placementPreview.right;
      const box = preview ? project(preview) : null;
      if (box && chainEl) {
        const chainRect = chainEl.getBoundingClientRect();
        return {
          x: chainRect.left - boardRect.left + box.cx,
          y: chainRect.top - boardRect.top + box.cy,
        };
      }
      return { x: boardRect.width / 2, y: boardRect.height / 2 };
    },
    [isEmpty, placementPreview, project],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      getTargetPoint,
      getBoardElement: () => boardRef.current,
    }),
    [getTargetPoint],
  );

  function resolveNearestSide(clientX: number, clientY: number): Side | null {
    if (isEmpty) return playableSides.includes("right") ? "right" : null;
    if (playableSides.length === 1) return playableSides[0] ?? null;

    const chainEl = chainRef.current;
    if (!chainEl) return playableSides[0] ?? null;
    const chainRect = chainEl.getBoundingClientRect();

    const leftBox = placementPreview.left ? project(placementPreview.left) : null;
    const rightBox = placementPreview.right ? project(placementPreview.right) : null;
    if (!leftBox && !rightBox) return playableSides[0] ?? null;

    const leftX = leftBox ? chainRect.left + leftBox.cx : -Infinity;
    const leftY = leftBox ? chainRect.top + leftBox.cy : 0;
    const rightX = rightBox ? chainRect.left + rightBox.cx : Infinity;
    const rightY = rightBox ? chainRect.top + rightBox.cy : 0;
    const distLeft = Math.hypot(clientX - leftX, clientY - leftY);
    const distRight = Math.hypot(clientX - rightX, clientY - rightY);
    const preferred: Side = distLeft <= distRight ? "left" : "right";
    if (playableSides.includes(preferred)) return preferred;
    return playableSides[0] ?? null;
  }

  function handleBoardDragOver(e: React.DragEvent) {
    if (!hasSelection || !selectedTile) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDraggingOver(true);
    setHoverSide(resolveNearestSide(e.clientX, e.clientY));
  }

  function handleBoardDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    setHoverSide(null);
    if (!hasSelection || !onDropTile) return;
    const side = isEmpty ? "right" : resolveNearestSide(e.clientX, e.clientY);
    if (side) onDropTile(side);
  }

  function handleBoardDragLeave(e: React.DragEvent) {
    if (!boardRef.current?.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
      setHoverSide(null);
    }
  }

  const highlightLeft = hoverSide === "left";
  const highlightRight = hoverSide === "right";
  const highlightCenter = isEmpty && isDraggingOver;

  const leftBox = placementPreview.left ? project(placementPreview.left) : null;
  const rightBox = placementPreview.right ? project(placementPreview.right) : null;

  const zoneScale = projection?.unit ?? UNIT_PX / UNIT;
  const zoneW = selected?.isDouble ? UNIT * zoneScale : LONG * zoneScale;
  const zoneH = selected?.isDouble ? LONG * zoneScale : UNIT * zoneScale;

  const zoneStyle = (b: TileBox): React.CSSProperties => ({
    position: "absolute",
    left: b.left,
    top: b.top,
    width: b.width,
    height: b.height,
  });

  return (
    <div
      ref={boardRef}
      className="relative flex min-h-[360px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-emerald-800/40 p-6 shadow-inner md:min-h-[460px] lg:min-h-[540px]"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(34, 120, 70, 0.55), transparent 70%), linear-gradient(160deg, #0d3d28 0%, #145c38 50%, #0a2e1f 100%)",
      }}
      onDragOver={handleBoardDragOver}
      onDrop={handleBoardDrop}
      onDragLeave={handleBoardDragLeave}
    >
      {isEmpty && !selectedTile && (
        <p className="pointer-events-none text-center text-sm text-domino-cream/70">
          El tablero está vacío. Selecciona una ficha para abrir el juego.
        </p>
      )}

      {showCenter && (
        <PlacementZone
          side="right"
          visible={showCenter || highlightCenter}
          highlighted={highlightCenter}
          onPlace={onPlace}
          ariaLabel="Colocar ficha para abrir el juego"
          zoneRef={centerZoneRef}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: zoneW,
            height: zoneH,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {!isEmpty && (
        <div
          ref={chainRef}
          className={cn(
            "relative mx-auto w-full",
            isDraggingOver && hasSelection && "ring-1 ring-domino-blue-light/20 rounded-xl",
          )}
          style={{ height: chainSize.h /*chainContentH*/, maxHeight: chainSize.h }}
        >
          {board.tiles.map((t, i) => {
            const tile = placed[i];
            const box = tile ? project(tile) : null;
            if (!tile || !box) return null;
            if (matchAction?.type === "play" && matchAction.tile === t.id) return null;
            return (
              <div
                key={t.id}
                style={{
                  position: "absolute",
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                  transition:
                    "left 300ms ease, top 300ms ease, width 300ms ease, height 300ms ease",
                }}
              >
                <DominoTile
                  low={t.rightValue}
                  high={t.leftValue}
                  orientation={tile.orientation}
                  reversed={tile.reversed}
                  fillContainer
                  className={cn(landingId === t.id && "animate-domino-land")}
                />
              </div>
            );
          })}

          {leftBox && (
            <PlacementZone
              side="left"
              visible={showLeft || (isDraggingOver && playableSides.includes("left"))}
              highlighted={highlightLeft}
              onPlace={onPlace}
              ariaLabel="Colocar ficha a la izquierda"
              zoneRef={leftZoneRef}
              style={zoneStyle(leftBox)}
            />
          )}

          {rightBox && (
            <PlacementZone
              side="right"
              visible={showRight || (isDraggingOver && playableSides.includes("right"))}
              highlighted={highlightRight}
              onPlace={onPlace}
              ariaLabel="Colocar ficha a la derecha"
              zoneRef={rightZoneRef}
              style={zoneStyle(rightBox)}
            />
          )}
        </div>
      )}

      {hasSelection && isDraggingOver && (
        <p className="pointer-events-none absolute bottom-2 text-xs text-domino-cream/60">
          Suelta cerca del extremo donde quieras jugar
        </p>
      )}
    </div>
  );
});
