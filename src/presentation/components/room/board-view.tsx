"use client";

import * as React from "react";
import { cn } from "@/presentation/lib/utils";
import type { Side } from "@/domain/domino/types";
import type { MatchState } from "@/domain/domino/engine/domino-engine";
import { Tile } from "@/domain/domino/value-objects/tile";
import type { MatchActionDto } from "@/shared/socket/contract";
import {
  BOARD_TILE,
  SIDE_RESERVE,
  anchorToCss,
  computeChainLayout,
  getChainExtent,
  openingTileToCss,
  predictNextTileStyle,
  type PlacedTileStyle,
} from "./board-layout";
import { DominoTile } from "./domino-tile";

interface Props {
  board: MatchState["board"];
  selectedTile: string | null;
  playableSides: Side[];
  matchAction: MatchActionDto | null;
  onPlace: (side: Side) => void;
  onDropTile?: (side: Side) => void;
}

function PlacementZone({
  side,
  visible,
  highlighted,
  onPlace,
  style,
  tileClassName,
  ariaLabel,
  zoneRef,
}: {
  side: Side;
  visible: boolean;
  highlighted: boolean;
  onPlace: (side: Side) => void;
  style: React.CSSProperties;
  tileClassName: string;
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
        tileClassName,
        highlighted
          ? "z-10 scale-105 border-domino-cream/70 bg-domino-blue/45 ring-2 ring-domino-cream/35 shadow-md"
          : "border-domino-blue-light/50 bg-domino-blue/15 hover:border-domino-cream/50 hover:bg-domino-blue/25",
      )}
      aria-label={ariaLabel}
    />
  );
}

type Point = { x: number; y: number };

/** Apertura centrada con 50%/50%; zonas deben usar el mismo origen visual. */
function zoneStyleFromPreview(
  preview: PlacedTileStyle,
  placedStyles: PlacedTileStyle[],
  tilesOnBoard: number,
): React.CSSProperties {
  const opening = placedStyles[0];
  if (tilesOnBoard === 1 && opening?.isOpening) {
    const deltaLeft = (preview.anchor.left ?? 0) - (opening.anchor.left ?? 0);
    const deltaTop = (preview.anchor.top ?? 0) - (opening.anchor.top ?? 0);
    return {
      position: "absolute",
      left: `calc(50% - ${opening.width / 2}px + ${deltaLeft}px)`,
      top: `calc(50% - ${opening.height / 2}px + ${deltaTop}px)`,
      width: preview.width,
      height: preview.height,
    };
  }
  return {
    ...anchorToCss(preview.anchor),
    width: preview.width,
    height: preview.height,
  };
}

function previewCenterInChain(
  preview: PlacedTileStyle,
  opening: PlacedTileStyle,
  chainRect: DOMRect,
): Point {
  const deltaLeft = (preview.anchor.left ?? 0) - (opening.anchor.left ?? 0);
  const deltaTop = (preview.anchor.top ?? 0) - (opening.anchor.top ?? 0);
  return {
    x:
      chainRect.left +
      chainRect.width / 2 -
      opening.width / 2 +
      deltaLeft +
      preview.width / 2,
    y:
      chainRect.top +
      chainRect.height / 2 -
      opening.height / 2 +
      deltaTop +
      preview.height / 2,
  };
}

export type BoardViewHandle = {
  getTargetPoint: (target: Side | "center") => Point | null;
  getBoardElement: () => HTMLDivElement | null;
};

export const BoardView = React.forwardRef<BoardViewHandle, Props>(function BoardView(
  {
    board,
    selectedTile,
    playableSides,
    matchAction,
    onPlace,
    onDropTile,
  },
  ref,
) {
  const isEmpty = board.tiles.length === 0;
  const hasSelection = Boolean(selectedTile);
  const showCenter = hasSelection && isEmpty;
  const showLeft = !isEmpty && hasSelection && playableSides.includes("left");
  const showRight = !isEmpty && hasSelection && playableSides.includes("right");

  const tileHorizontal = "box-border h-11 w-[5.5rem] shrink-0";
  const tileVertical = "box-border h-[5.5rem] w-11 shrink-0";

  const selected = selectedTile ? Tile.fromId(selectedTile) : null;
  const zoneClassName = selected?.isDouble ? tileVertical : tileHorizontal;
  const zoneW = selected?.isDouble ? BOARD_TILE.vW : BOARD_TILE.hW;
  const zoneH = selected?.isDouble ? BOARD_TILE.vH : BOARD_TILE.hH;

  const boardRef = React.useRef<HTMLDivElement>(null);
  const chainRef = React.useRef<HTMLDivElement>(null);
  const leftZoneRef = React.useRef<HTMLButtonElement>(null);
  const rightZoneRef = React.useRef<HTMLButtonElement>(null);
  const centerZoneRef = React.useRef<HTMLButtonElement>(null);

  const [hoverSide, setHoverSide] = React.useState<Side | null>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  const prevLenRef = React.useRef(board.tiles.length);
  const [landingIdx, setLandingIdx] = React.useState<number | null>(null);
  const [chainSize, setChainSize] = React.useState({ w: 0, h: 300 });

  const measureChainArea = React.useCallback(() => {
    const board = boardRef.current;
    const chain = chainRef.current;
    if (!board || board.clientWidth <= 0) return;
    setChainSize({
      w: board.clientWidth - 48,
      h: Math.max(300, chain?.clientHeight ?? 0, board.clientHeight - 120),
    });
  }, []);

  React.useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    measureChainArea();
    const ro = new ResizeObserver(measureChainArea);
    ro.observe(board);
    const chain = chainRef.current;
    if (chain) ro.observe(chain);
    return () => ro.disconnect();
  }, [board.tiles.length, isEmpty, measureChainArea]);

  const boardTileInputs = React.useMemo(
    () =>
      board.tiles.map((t) => ({
        leftValue: t.leftValue,
        rightValue: t.rightValue,
        side: t.side,
      })),
    [board.tiles],
  );

  const placedStyles = React.useMemo(() => {
    if (board.tiles.length === 0 || chainSize.w <= 0) return [];
    return computeChainLayout(boardTileInputs, chainSize.w, chainSize.h);
  }, [board.tiles.length, boardTileInputs, chainSize.w, chainSize.h]);

  const placementPreview = React.useMemo((): {
    left: PlacedTileStyle | null;
    right: PlacedTileStyle | null;
  } => {
    if (!selected || board.tiles.length === 0 || chainSize.w <= 0) {
      return { left: null, right: null };
    }
    const nextTile = { leftValue: selected.high, rightValue: selected.low };
    return {
      left: playableSides.includes("left")
        ? predictNextTileStyle(boardTileInputs, "left", nextTile, chainSize.w, chainSize.h)
        : null,
      right: playableSides.includes("right")
        ? predictNextTileStyle(boardTileInputs, "right", nextTile, chainSize.w, chainSize.h)
        : null,
    };
  }, [selected, board.tiles.length, boardTileInputs, chainSize.w, chainSize.h, playableSides]);

  const chainExtent = React.useMemo(() => getChainExtent(placedStyles), [placedStyles]);
  const chainMinHeight = chainExtent
    ? Math.max(300, chainExtent.maxBottom + SIDE_RESERVE)
    : 300;

  const firstStyle = placedStyles[0] ?? null;
  const lastStyle = placedStyles[placedStyles.length - 1] ?? null;

  React.useEffect(() => {
    if (board.tiles.length > prevLenRef.current) {
      setLandingIdx(board.tiles.length - 1);
      const timer = setTimeout(() => setLandingIdx(null), 480);
      prevLenRef.current = board.tiles.length;
      return () => clearTimeout(timer);
    }
    prevLenRef.current = board.tiles.length;
  }, [board.tiles.length]);

  const getTargetPoint = React.useCallback(
    (target: Side | "center"): Point | null => {
      const boardEl = boardRef.current;
      if (!boardEl) return null;
      const boardRect = boardEl.getBoundingClientRect();

      const zoneRef =
        target === "center"
          ? centerZoneRef.current
          : target === "left"
            ? leftZoneRef.current
            : rightZoneRef.current;

      if (zoneRef) {
        const r = zoneRef.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - boardRect.left,
          y: r.top + r.height / 2 - boardRect.top,
        };
      }

      const chainEl = chainRef.current;
      if (chainEl && firstStyle && lastStyle) {
        const chainRect = chainEl.getBoundingClientRect();
        if (target === "center" || (firstStyle.isOpening && board.tiles.length === 1)) {
          return {
            x: chainRect.left - boardRect.left + chainRect.width / 2,
            y: chainRect.top - boardRect.top + chainRect.height / 2,
          };
        }
        const preview = target === "left" ? placementPreview.left : placementPreview.right;
        if (!preview || !firstStyle) return null;
        const center =
          board.tiles.length === 1 && firstStyle.isOpening
            ? previewCenterInChain(preview, firstStyle, chainRect)
            : {
                x: chainRect.left + (preview.anchor.left ?? 0) + preview.width / 2,
                y: chainRect.top + (preview.anchor.top ?? 0) + preview.height / 2,
              };
        return {
          x: center.x - boardRect.left,
          y: center.y - boardRect.top,
        };
      }

      return { x: boardRect.width / 2, y: boardRect.height / 2 };
    },
    [board.tiles.length, firstStyle, lastStyle, placementPreview],
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

    const boardEl = boardRef.current;
    const chainEl = chainRef.current;
    if (!boardEl || !chainEl || !firstStyle || !lastStyle) return playableSides[0] ?? null;

    const boardRect = boardEl.getBoundingClientRect();
    const chainRect = chainEl.getBoundingClientRect();
    const leftPreview = placementPreview.left;
    const rightPreview = placementPreview.right;
    if (!leftPreview && !rightPreview) return playableSides[0] ?? null;

    const openingCenter =
      board.tiles.length === 1 && firstStyle.isOpening ? firstStyle : null;
    const leftCenter = leftPreview
      ? openingCenter
        ? previewCenterInChain(leftPreview, openingCenter, chainRect)
        : {
            x: chainRect.left + (leftPreview.anchor.left ?? 0) + leftPreview.width / 2,
            y: chainRect.top + (leftPreview.anchor.top ?? 0) + leftPreview.height / 2,
          }
      : null;
    const rightCenter = rightPreview
      ? openingCenter
        ? previewCenterInChain(rightPreview, openingCenter, chainRect)
        : {
            x: chainRect.left + (rightPreview.anchor.left ?? 0) + rightPreview.width / 2,
            y: chainRect.top + (rightPreview.anchor.top ?? 0) + rightPreview.height / 2,
          }
      : null;
    const leftX = leftCenter?.x ?? -Infinity;
    const leftY = leftCenter?.y ?? 0;
    const rightX = rightCenter?.x ?? Infinity;
    const rightY = rightCenter?.y ?? 0;
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

  const zoneClassForPreview = (preview: PlacedTileStyle) =>
    preview.orientation === "horizontal" ? tileHorizontal : tileVertical;

  const leftZoneStyle: React.CSSProperties | null = placementPreview.left
    ? zoneStyleFromPreview(placementPreview.left, placedStyles, board.tiles.length)
    : null;

  const rightZoneStyle: React.CSSProperties | null = placementPreview.right
    ? zoneStyleFromPreview(placementPreview.right, placedStyles, board.tiles.length)
    : null;

  return (
    <div
      ref={boardRef}
      className="relative flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border border-emerald-800/40 p-6 shadow-inner md:min-h-[460px] lg:min-h-[540px]"
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
          tileClassName={zoneClassName}
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
          style={{ minHeight: chainMinHeight }}
        >
          {board.tiles.map((t, i) => {
            const placed = placedStyles[i];
            if (!placed) return null;
            if (matchAction?.type === "play" && matchAction.tile === t.id) return null;
            const sizeClass = placed.orientation === "horizontal" ? tileHorizontal : tileVertical;
            return (
              <div
                key={`${t.id}-${i}`}
                style={
                  board.tiles.length === 1 && placed.isOpening
                    ? openingTileToCss(placed.width, placed.height)
                    : {
                        ...anchorToCss(placed.anchor),
                        width: placed.width,
                        height: placed.height,
                      }
                }
              >
                <DominoTile
                  low={t.rightValue}
                  high={t.leftValue}
                  orientation={placed.orientation}
                  reversed={placed.reversed}
                  className={cn(
                    "h-full w-full",
                    sizeClass,
                    landingIdx === i && "animate-domino-land",
                  )}
                />
              </div>
            );
          })}

          {leftZoneStyle && (
            <PlacementZone
              side="left"
              visible={showLeft || (isDraggingOver && playableSides.includes("left"))}
              highlighted={highlightLeft}
              onPlace={onPlace}
              tileClassName={zoneClassForPreview(placementPreview.left!)}
              ariaLabel="Colocar ficha a la izquierda"
              zoneRef={leftZoneRef}
              style={leftZoneStyle}
            />
          )}

          {rightZoneStyle && (
            <PlacementZone
              side="right"
              visible={showRight || (isDraggingOver && playableSides.includes("right"))}
              highlighted={highlightRight}
              onPlace={onPlace}
              tileClassName={zoneClassForPreview(placementPreview.right!)}
              ariaLabel="Colocar ficha a la derecha"
              zoneRef={rightZoneRef}
              style={rightZoneStyle}
            />
          )}
        </div>
      )}

      {!isEmpty && board.leftEnd !== null && (
        <p className="pointer-events-none mt-2 text-xs text-domino-cream/60">
          Extremos: {board.leftEnd} — {board.rightEnd}
        </p>
      )}

      {hasSelection && isDraggingOver && (
        <p className="pointer-events-none text-xs text-domino-cream/60">
          Suelta cerca del extremo donde quieras jugar
        </p>
      )}
    </div>
  );
});
