"use client";

import * as React from "react";
import type { MatchActionDto } from "@/shared/socket/contract";
import { MATCH_ANIM_MS } from "@/shared/socket/contract";
import { cn } from "@/presentation/lib/utils";

type SeatPosition = "top" | "bottom" | "left" | "right";

/**
 * DEV: alertas de pase en bucle para ajustar posición/visual.
 * Poner en false antes de producción.
 */
export const PASS_ALERT_DEV_LOOP = false;

/** true = previsualizar bono de pase; false = "Pasa" normal. */
export const PASS_ALERT_DEV_BONUS = false;

const PASS_DEV_LABELS: Record<SeatPosition, string> = {
  top: "Arriba",
  right: "Derecha",
  bottom: "Tú (abajo)",
  left: "Izquierda",
};

function playerSeatPosition(
  playerId: string,
  currentUserId: string,
  mySeat: number,
  playerCount: number,
  playerSeats: Map<string, number>,
): SeatPosition {
  const seat = playerSeats.get(playerId) ?? 0;
  const relative = (seat - mySeat + playerCount) % playerCount;
  if (playerCount === 2) return relative === 0 ? "bottom" : "top";
  const map: SeatPosition[] = ["bottom", "right", "top", "left"];
  return map[relative % 4] ?? "top";
}

/** Respaldo aproximado: centro de cada borde del área central de la mesa. */
const ORIGIN: Record<SeatPosition, { x: string; y: string }> = {
  top: { x: "50%", y: "28%" },
  bottom: { x: "50%", y: "62%" },
  left: { x: "32%", y: "45%" },
  right: { x: "68%", y: "45%" },
};

const DEAL_SEATS: Record<number, SeatPosition[]> = {
  2: ["bottom", "top"],
  4: ["bottom", "right", "top", "left"],
};

const TILES_PER_SEAT = 5;

function FaceDownDealTile({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-sm bg-linear-to-br from-slate-100 to-slate-300 shadow-md ring-1 ring-black/20",
        className,
      )}
      style={style}
    />
  );
}

function DealAnimation({
  roundIndex,
  duration,
  playerCount,
}: {
  roundIndex: number;
  duration: number;
  playerCount: number;
}) {
  const seatList = DEAL_SEATS[playerCount] ?? DEAL_SEATS[4];
  const tileDuration = Math.min(900, Math.floor(duration / (seatList.length * TILES_PER_SEAT + 2)));
  const stagger = Math.floor((duration - tileDuration) / (seatList.length * TILES_PER_SEAT));

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        className="absolute inset-0 bg-domino-blue/20 backdrop-blur-[1px]"
        style={{ animation: `results-backdrop 300ms ease-out forwards` }}
      />

      {/* Mazo central */}
      <div
        className="absolute left-1/2 top-1/2 animate-deal-deck-pulse"
        style={{ "--deal-duration": `${duration}ms` } as React.CSSProperties}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <FaceDownDealTile
            key={i}
            className="absolute left-1/2 top-1/2 h-9 w-6 animate-deal-deck-layer"
            style={
              {
                "--layer-x": `${i * 2}px`,
                "--layer-y": `${-i * 2}px`,
                "--deal-duration": `${duration * 0.85}ms`,
                animationDelay: `${i * 60}ms`,
                marginLeft: -12,
                marginTop: -18,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Fichas hacia cada jugador */}
      {seatList.flatMap((seat, seatIdx) =>
        Array.from({ length: TILES_PER_SEAT }).map((_, tileIdx) => {
          const pos = ORIGIN[seat];
          const delay = (seatIdx * TILES_PER_SEAT + tileIdx) * stagger;
          return (
            <FaceDownDealTile
              key={`${seat}-${tileIdx}`}
              className="absolute h-8 w-5 animate-deal-to-seat"
              style={
                {
                  "--deal-to-x": pos.x,
                  "--deal-to-y": pos.y,
                  "--deal-tile-duration": `${tileDuration}ms`,
                  animationDelay: `${delay}ms`,
                } as React.CSSProperties
              }
            />
          );
        }),
      )}

      <div
        className="absolute left-1/2 top-[62%] -translate-x-1/2 animate-round-banner"
        style={{ "--round-duration": `${duration}ms` } as React.CSSProperties}
      >
        <div className="rounded-full border border-domino-blue-light/40 bg-domino-blue/70 px-5 py-2 shadow-lg backdrop-blur-sm">
          <p className="text-center text-sm font-semibold text-domino-cream">
            Ronda {roundIndex + 1}
          </p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  action: MatchActionDto | null;
  currentUserId: string;
  mySeat: number;
  playerCount: number;
  playerSeats: Map<string, number>;
  /** Posición en px (relativa al contenedor de mesa) en el borde del tablero verde. */
  getPassAnchor?: (seat: SeatPosition) => { x: number; y: number } | null;
}

function PassNotification({
  seat,
  duration,
  isBonus,
  displayName,
  amount,
  teamIndex,
  getPassAnchor,
  loop = false,
}: {
  seat: SeatPosition;
  duration: number;
  isBonus: boolean;
  displayName: string;
  amount?: number;
  teamIndex?: number;
  getPassAnchor?: (seat: SeatPosition) => { x: number; y: number } | null;
  loop?: boolean;
}) {
  const [anchor, setAnchor] = React.useState<{ x: number; y: number } | null>(null);

  React.useLayoutEffect(() => {
    const measure = () => setAnchor(getPassAnchor?.(seat) ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [seat, getPassAnchor]);

  const fallback = ORIGIN[seat];
  const style = {
    left: anchor ? anchor.x : fallback.x,
    top: anchor ? anchor.y : fallback.y,
    transform: "translate(-50%, -50%)",
    "--pass-duration": `${duration}ms`,
  } as React.CSSProperties;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* Posición fija; la animación va en un hijo para no pisar translate(-50%, -50%). */}
      <div className="absolute" style={style}>
        <div className={loop ? "animate-pass-float-infinite" : "animate-pass-float"}>
          <div
            className={cn(
              "rounded-full px-4 py-2 text-center shadow-lg backdrop-blur-sm",
              isBonus
                ? "border border-emerald-400/50 bg-emerald-500/15"
                : "border border-amber-400/60 bg-amber-500/20",
            )}
          >
            <p
              className={cn(
                "text-xs font-semibold",
                isBonus ? "text-emerald-200/90" : "text-amber-200",
              )}
            >
              {displayName}
            </p>
            {isBonus ? (
              <>
                <p className="text-sm font-bold text-emerald-100">+{amount} puntos</p>
                <p className="text-[10px] text-emerald-200/70">
                  Eq. {(teamIndex ?? 0) + 1} · todos pasaron
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-amber-100">Pasa 🃏</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatchAnimationLayer({
  action,
  currentUserId,
  mySeat,
  playerCount,
  playerSeats,
  getPassAnchor,
}: Props) {
  if (PASS_ALERT_DEV_LOOP) {
    const seats = DEAL_SEATS[playerCount] ?? DEAL_SEATS[4]!;
    return (
      <>
        {seats.map((seat) => (
          <PassNotification
            key={seat}
            seat={seat}
            duration={MATCH_ANIM_MS.pass}
            isBonus={PASS_ALERT_DEV_BONUS}
            displayName={PASS_DEV_LABELS[seat]}
            amount={PASS_ALERT_DEV_BONUS ? 25 : undefined}
            teamIndex={0}
            getPassAnchor={getPassAnchor}
            loop
          />
        ))}
      </>
    );
  }

  if (!action) return null;

  if (action.type === "play") {
    return null;
  }

  if (action.type === "pass" || action.type === "passBonus") {
    const seat = playerSeatPosition(
      action.playerId,
      currentUserId,
      mySeat,
      playerCount,
      playerSeats,
    );
    const duration =
      action.type === "pass" ? MATCH_ANIM_MS.pass : MATCH_ANIM_MS.passBonus;

    return (
      <PassNotification
        seat={seat}
        duration={duration}
        isBonus={action.type === "passBonus"}
        displayName={action.displayName}
        amount={action.type === "passBonus" ? action.amount : undefined}
        teamIndex={action.type === "passBonus" ? action.teamIndex : undefined}
        getPassAnchor={getPassAnchor}
      />
    );
  }

  if (action.type === "deal") {
    return (
      <DealAnimation
        roundIndex={action.roundIndex}
        duration={MATCH_ANIM_MS.deal}
        playerCount={playerCount}
      />
    );
  }

  if (action.type === "roundEnd") {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
        <div
          className="animate-round-banner rounded-2xl border border-domino-blue-light/50 bg-domino-blue/80 px-8 py-5 text-center shadow-2xl backdrop-blur-md"
          style={{ "--round-duration": `${MATCH_ANIM_MS.roundEnd}ms` } as React.CSSProperties}
        >
          <p className="text-sm uppercase tracking-widest text-domino-cream/80">Fin de ronda</p>
          <p className="mt-1 text-xl font-bold text-white">{action.message}</p>
        </div>
      </div>
    );
  }

  return null;
}

/** Confeti decorativo para el overlay de resultados. */
export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const colors = ["#4091c9", "#df2e1e", "#fedfd4", "#fbbf24", "#34d399"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <span
          key={i}
          className="absolute animate-confetti-fall block h-2 w-2 rounded-sm"
          style={{
            left: `${(i * 2.5) % 100}%`,
            top: "-5%",
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 10) * 0.25}s`,
            "--confetti-duration": `${2.5 + (i % 5) * 0.4}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
