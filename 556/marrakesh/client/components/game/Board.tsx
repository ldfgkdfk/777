import * as React from "react";
import { motion } from "framer-motion";
import { useMemo } from "react";

export interface Token {
  id: string;
  color: string;
  x: number; // column 0..(size-1)
  y: number; // row 0..(size-1)
}

export type Dir = "N" | "E" | "S" | "W";

export interface RugTopCell {
  ownerId?: string;
  color?: string;
  textureUrl?: string;
  orientation?: "H" | "V";
  segment?: "start" | "end";
}

export function Board({
  size = 7,
  tokens = [] as Token[],
  rugsTop,
  dir,
  onRotate,
  onCellClick,
  backgroundUrl,
  highlight,
  tokenImageUrl,
}: {
  size?: number;
  tokens?: Token[];
  rugsTop?: (RugTopCell | undefined)[][];
  dir?: Dir;
  onRotate?: (turn: "left" | "right") => void;
  onCellClick?: (x: number, y: number) => void;
  backgroundUrl?: string;
  highlight?: Array<{ x: number; y: number; color?: string }>;
  tokenImageUrl?: string;
}) {
  const cells = useMemo(() => Array.from({ length: size * size }, (_, i) => i), [size]);

  function arrowPos(kind: "left" | "right" | "forward", t: Token) {
    const cx = ((t.x + 0.5) / size) * 100;
    const cy = ((t.y + 0.5) / size) * 100;
    const base: React.CSSProperties = { left: `${cx}%`, top: `${cy}%` };
    const map: Record<Dir, Record<"left" | "right" | "forward", string>> = {
      N: { left: "translate(-160%, -50%)", right: "translate(60%, -50%)", forward: "translate(-50%, -160%)" },
      E: { left: "translate(-50%, -160%)", right: "translate(-50%, 60%)", forward: "translate(60%, -50%)" },
      S: { left: "translate(60%, -50%)", right: "translate(-160%, -50%)", forward: "translate(-50%, 60%)" },
      W: { left: "translate(-50%, 60%)", right: "translate(-50%, -160%)", forward: "translate(-160%, -50%)" },
    };
    const transform = map[dir || "N"][kind];
    return { base, transform };
  }

  const INSET = 12; // percent; tuned for the provided board image

  function arrowRotation(kind: "left" | "right" | "forward"): number {
    const d = dir || "N";
    if (d === "N") return kind === "forward" ? 0 : kind === "left" ? -90 : 90;
    if (d === "E") return kind === "forward" ? 90 : kind === "left" ? 0 : 180;
    if (d === "S") return kind === "forward" ? 180 : kind === "left" ? 90 : -90;
    return kind === "forward" ? -90 : kind === "left" ? 180 : 0; // W
  }

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[720px] overflow-hidden rounded-xl border border-border bg-amber-50 p-2 shadow-inner"
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className="absolute" style={{ inset: `${INSET}%` }}>
        <div
          className="grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {cells.map((i) => {
            const x = i % size;
            const y = Math.floor(i / size);
            const top = rugsTop?.[y]?.[x];
            const color = top?.color;
            const texture = top?.textureUrl;
            const orientation = top?.orientation;
            const segment = top?.segment;
            return (
              <button
                key={i}
                onClick={() => onCellClick?.(x, y)}
                className="relative focus:outline-none"
                aria-label={`cell-${x}-${y}`}
              >
                {color ? (
                  <div
                    className="absolute inset-0 m-[2px] rounded-sm opacity-90"
                    style={{
                      backgroundColor: color,
                      backgroundImage: texture ? `url(${texture})` : undefined,
                      backgroundSize:
                        orientation === "H"
                          ? "200% 100%"
                          : orientation === "V"
                            ? "100% 200%"
                            : "cover",
                      backgroundPosition:
                        orientation === "H"
                          ? segment === "end"
                            ? "right center"
                            : "left center"
                          : orientation === "V"
                            ? segment === "end"
                              ? "center bottom"
                              : "center top"
                            : "center",
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                ) : null}
                {highlight?.some((h) => h.x === x && h.y === y) ? (
                  <div className="absolute inset-0 rounded-sm ring-2 ring-sky-500/80" style={{ boxShadow: "inset 0 0 0 2px rgba(14,165,233,0.8)" }} />
                ) : null}
              </button>
            );
          })}
        </div>

        {tokens.map((t) => (
          tokenImageUrl ? (
            <motion.img
              key={t.id}
              src={tokenImageUrl}
              alt={t.id}
              className="absolute size-8 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow"
              animate={{
                left: `${((t.x + 0.5) / size) * 100}%`,
                top: `${((t.y + 0.5) / size) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            />
          ) : (
            <motion.div
              key={t.id}
              className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/10 shadow-md border border-black/20"
              style={{ backgroundColor: t.color }}
              animate={{
                left: `${((t.x + 0.5) / size) * 100}%`,
                top: `${((t.y + 0.5) / size) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            />
          )
        ))}

        {tokens[0] && (
          <>
            {(["left", "forward", "right"] as const).map((kind) => {
              const t = tokens[0]!;
              const { base, transform } = arrowPos(kind, t);
              const rot = arrowRotation(kind);
              return (
                <button
                  key={kind}
                  onClick={() => { if (kind !== "forward") onRotate?.(kind); }}
                  className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600/95 text-white shadow-lg ring-2 ring-white/40 transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300"
                  style={{
                    ...base,
                    transform: `${transform} rotate(${rot}deg)`,
                  }}
                  aria-label={kind}
                >
                  <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                    <path
                      d="M12 3l7 7h-4v11h-6V10H5l7-7z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
