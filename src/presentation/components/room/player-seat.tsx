"use client";

import { cn } from "@/presentation/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/presentation/components/ui/avatar";
import { TileStack } from "./face-down-tile";

/** Ancho fijo para que todos los asientos tengan proporciones similares. */
const SEAT_WIDTH = "w-[7.5rem]";

interface Props {
  displayName: string;
  image: string | null;
  handCount: number;
  teamIndex: number;
  isCurrentTurn: boolean;
  isMe?: boolean;
  position: "top" | "bottom" | "left" | "right";
}

export function PlayerSeat({
  displayName,
  image,
  handCount,
  teamIndex,
  isCurrentTurn,
  isMe,
  position,
}: Props) {
  const initials = displayName.slice(0, 2).toUpperCase();
  const label = isMe ? `${displayName} (tú)` : displayName;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center gap-1.5 overflow-hidden rounded-xl border border-border/60 bg-card/80 px-2 py-2 backdrop-blur-sm transition",
        SEAT_WIDTH,
        isCurrentTurn && "border-domino-blue-light ring-2 ring-domino-blue-light/60 shadow-lg shadow-domino-blue/20",
      )}
      title={label}
      data-seat-position={position}
    >
      <div className="relative shrink-0">
        <Avatar className={cn("h-9 w-9", isCurrentTurn && "ring-2 ring-domino-blue-light")}>
          {image && <AvatarImage src={image} alt={displayName} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        {isCurrentTurn && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-domino-blue-light ring-2 ring-background" />
        )}
      </div>
      <div className="w-full min-w-0 text-center">
        <p className="truncate text-xs font-medium leading-tight">{label}</p>
        <p className="truncate text-[10px] text-muted-foreground">Eq. {teamIndex + 1}</p>
      </div>
      {!isMe && <TileStack count={handCount} className="shrink-0" />}
      {isMe && handCount > 0 && (
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{handCount} fichas</span>
      )}
    </div>
  );
}
