import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { API } from "@/lib/api";
import { Board, Token } from "@/components/game/Board";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { GameState, Session } from "@shared/api";
import { toast } from "sonner";

const RUG_TEXTURE_URL = "https://cdn.builder.io/api/v1/image/assets%2F9c98f74ce2d9433495c720297d8c0a5c%2F22506cd4c0d54c62a09870a1145f0ae3?format=webp&width=800";

export default function SessionPage() {
  const { id = "" } = useParams();
  const { token, user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [placingPhase, setPlacingPhase] = useState<0 | 1 | 2>(0); // 0=not placing, 1=pick first, 2=pick second
  const [firstCell, setFirstCell] = useState<{ x: number; y: number } | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let s = await API.getSession(id, token ?? undefined);
        if (user && !s.players.some((p) => p.id === user.id)) {
          s = await API.joinSession(id, token ?? undefined);
        }
        setSession(s);
      } catch (e: any) {
        toast.error(e.message || "Сессия не найдена");
      }
    })();
  }, [id, token, user]);

  useEffect(() => {
    function startPoll() {
      stopPoll();
      pollRef.current = window.setInterval(async () => {
        try {
          const st = await API.getGameState(id, token ?? undefined);
          setState(st);
        } catch {}
      }, 800);
    }
    function stopPoll() { if (pollRef.current) window.clearInterval(pollRef.current); pollRef.current = null; }
    startPoll();
    return () => stopPoll();
  }, [id, token]);

  const tokenViews: Token[] = useMemo(() => {
    const p = state?.pieces?.[0];
    if (!p) return [];
    return [{ id: "assam", color: "#c2410c", x: p.x ?? 3, y: p.y ?? 3 }];
  }, [state]);

  const size = state?.boardSize || 7;

  function colorFor(id: string) {
    let hash = 0; for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const hue = hash % 360; return `hsl(${hue} 70% 60%)`;
  }

  const rugsTop = useMemo(() => {
    const n = size; const grid = state?.rugsGrid; if (!grid) return [] as any;
    return grid.map((row, y) =>
      row.map((cell, x) => {
        const top = cell.stack.at(-1);
        if (!top) return undefined;
        const { ownerId, rugId } = top;
        const right = grid[y]?.[x + 1]?.stack.at(-1);
        const left = grid[y]?.[x - 1]?.stack.at(-1);
        const down = grid[y + 1]?.[x]?.stack.at(-1);
        const up = grid[y - 1]?.[x]?.stack.at(-1);

        let orientation: "H" | "V" | undefined;
        let segment: "start" | "end" | undefined;

        if (right?.rugId === rugId) {
          orientation = "H";
          segment = "start";
        } else if (left?.rugId === rugId) {
          orientation = "H";
          segment = "end";
        } else if (down?.rugId === rugId) {
          orientation = "V";
          segment = "start";
        } else if (up?.rugId === rugId) {
          orientation = "V";
          segment = "end";
        }

        return {
          ownerId,
          color: ownerId ? colorFor(ownerId) : undefined,
          textureUrl: RUG_TEXTURE_URL,
          orientation,
          segment,
        };
      }),
    );
  }, [state, size]);

  async function onRotate(turn: "left" | "right") {
    try { const st = await API.rotate(id, turn, token ?? undefined); setState(st); } catch (e: any) { toast.error(e.message || "��шибка поворота"); }
  }
  async function onRoll() {
    try { const st = await API.rollDice(id, token ?? undefined); setState(st); setPlacingPhase(1); setFirstCell(null); } catch (e: any) { toast.error(e.message || "Ошибка броска"); }
  }

  async function onCellClick(x: number, y: number) {
    if (!state?.pieces?.[0]) return;
    const a = state.pieces[0];
    if (placingPhase === 0) return;
    if (placingPhase === 1) {
      const manh = Math.abs(x - a.x) + Math.abs(y - a.y);
      if (manh !== 1) return; // first must touch Assam
      setFirstCell({ x, y });
      setPlacingPhase(2);
      return;
    }
    if (placingPhase === 2) {
      if (!firstCell) return;
      const manh1 = Math.abs(x - firstCell.x) + Math.abs(y - firstCell.y);
      const manhAssam = Math.abs(x - a.x) + Math.abs(y - a.y);
      if (manh1 !== 1) return; // second must touch first
      if (a.x === x && a.y === y) return; // cannot be Assam cell
      // Build rug orientation and base from two selected cells
      const horizontal = firstCell.y === y;
      let baseX = horizontal ? Math.min(firstCell.x, x) : firstCell.x;
      let baseY = horizontal ? firstCell.y : Math.min(firstCell.y, y);
      const orientation: "H" | "V" = horizontal ? "H" : "V";
      try {
        const st = await API.placeRug(id, { x: baseX, y: baseY, orientation }, token ?? undefined);
        setState(st);
        setPlacingPhase(0);
        setFirstCell(null);
      } catch (e: any) { toast.error(e.message || "Нельзя положить ковёр"); }
    }
  }

  const players = session?.players ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px] bg-white p-2 sm:p-4 rounded-md">
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px] items-start">
          <div className="rounded-2xl border bg-card p-4">
            <Board size={size} tokens={tokenViews} rugsTop={rugsTop as any} dir={state?.direction as any} onRotate={onRotate} onCellClick={onCellClick} backgroundUrl={"https://cdn.builder.io/api/v1/image/assets%2F9c98f74ce2d9433495c720297d8c0a5c%2Fdcd20b8d47da4d1883d4d20b82fcfab2?format=webp&width=800"} highlight={firstCell ? [{ x: firstCell.x, y: firstCell.y }] : undefined} tokenImageUrl="/algerian-avatar.svg" />
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-sm space-y-2">
            <div className="text-sm font-semibold">Кубик: {state?.lastRoll ?? "—"}</div>
            <Button onClick={onRoll} className="w-full">Бросить</Button>
            <div className="text-xs text-muted-foreground">
              {placingPhase === 0 && "Сначала выберите направление и бросьте кубик"}
              {placingPhase === 1 && "Выберите первую клетку рядом с Ассамом"}
              {placingPhase === 2 && "Выберите вторую клетку, соседнюю с первой (не клетка Ассама)"}
            </div>
          </div>
        </div>
      </section>
      <aside className="space-y-4">
        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Сессия</div>
          <div className="font-semibold">{session?.name ?? `#${id}`}</div>
          <div className="mt-2 text-sm text-muted-foreground">Игроков: {players.length}</div>
        </div>

        <div className="rounded-xl border p-0 overflow-hidden">
          <div className="border-b bg-muted/50 px-4 py-2 text-sm font-medium">Игроки</div>
          <ul className="divide-y">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full" style={{ backgroundColor: colorFor(p.id) }}>{p.name?.[0]?.toUpperCase() || "?"}</span>
                  <span className={p.id === state?.activePlayerId ? "font-semibold text-foreground" : "text-foreground"}>{p.name}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span title="Монеты" className="min-w-10 text-right">💰 {state?.balances?.[p.id] ?? 30}</span>
                  <span title="Ковры" className="min-w-8 text-right">🧶 {state?.rugsLeft?.[p.id] ?? 12}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Статус</div>
          <div className="font-semibold">{state?.status === "finished" ? "Игра завершена" : "Идет игра"}</div>
          {state?.winnerId && (
            <div className="mt-2 rounded-md bg-emerald-100 p-2 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">Победитель: {state.winnerId}</div>
          )}
        </div>
      </aside>
    </div>
  );
}
