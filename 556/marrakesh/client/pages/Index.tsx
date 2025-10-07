import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Board, Token } from "@/components/game/Board";
import { API } from "@/lib/api";
import { Session } from "@shared/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Index() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [token]);

  async function refresh() {
    try {
      setLoading(true);
      const list = await API.listSessions(token ?? undefined);
      setSessions(list);
    } catch (e: any) {
      // fail silently if backend not ready
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name")) || "Новая партия";
    try {
      setCreating(true);
      const s = await API.createSession({ name }, token ?? undefined);
      setSessions((prev) => [s, ...prev]);
      toast.success("Партия создана");
      (e.target as HTMLFormElement).reset();
    } catch (e: any) {
      toast.error(e.message || "Не удалось создать партию");
    } finally {
      setCreating(false);
    }
  }

  async function onAutoOrder(id: string) {
    try {
      const s = await API.autoOrder(id, token ?? undefined);
      setSessions((prev) => prev.map((x) => (x.id === id ? s : x)));
      toast.success("Очередность назначена");
    } catch (e: any) {
      toast.error(e.message || "Не удалось назначить очередность");
    }
  }

  // Demo tokens movement to showcase animations
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 7), 1500);
    return () => clearInterval(t);
  }, []);
  const demoTokens: Token[] = useMemo(
    () => [
      { id: "p1", color: "#c2410c", x: step, y: 0 },
      { id: "p2", color: "#0f766e", x: 6 - step, y: 6 },
    ],
    [step],
  );

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <section className="space-y-6">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-3xl font-extrabold tracking-tight">Веб‑игра «Маракеш»</h1>
          <p className="mt-2 text-muted-foreground">Создавайте и управляйте игровыми сессиями, подключайтесь и играйте в реальном времени.</p>
          <a href="#sessions" className="mt-4 inline-block"><Button size="lg">Начать игру</Button></a>
        </div>

        <div id="new" className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-bold">Создать новую партию</h2>
          <form onSubmit={onCreate} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input name="name" placeholder="Название партии" />
            <Button disabled={creating} type="submit">Создать</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Для продвинутых опций используйте серверные настройки (бэк уже готов).</p>
        </div>

        <div id="sessions" className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Игровые сессии</h2>
            <Button variant="outline" onClick={refresh} disabled={loading}>Обновить</Button>
          </div>
          <ul className="space-y-3">
            {sessions.length === 0 && (
              <li className="text-sm text-muted-foreground">Пока нет активных партий. Создайте первую!</li>
            )}
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={"inline-flex size-2 rounded-full "+(s.status === "active" ? "bg-emerald-500" : s.status === "waiting" ? "bg-amber-500" : "bg-stone-400")} />
                    <div className="font-semibold">{s.name}</div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">Игроков: {s.players?.length ?? 0} • Статус: {labelStatus(s.status)}{s.activePlayerId ? ` • Ход: ${shortId(s.activePlayerId)}` : ""}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onAutoOrder(s.id)}>Авто‑очередность</Button>
                  <a href={`/session/${s.id}`}><Button>Открыть</Button></a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-bold">Игровое поле</h2>
          <p className="mb-4 text-sm text-muted-foreground">Отображение поля, фигур и анимация ходов.</p>
          <Board size={7} tokens={demoTokens} tokenImageUrl="/algerian-avatar.svg" />
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Текущий ход</div>
              <div className="font-semibold">Игрок 1</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Состояние игры</div>
              <div className="font-semibold">В реальном времени</div>
            </div>
            <div className="rounded-lg border p-3 col-span-2">
              <div className="text-xs text-muted-foreground">События</div>
              <div className="font-semibold">Завершение партии и объявление победителя, дисконнекты игроков — будут визуализированы в интерфейсе игры.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function labelStatus(s: Session["status"]) {
  switch (s) {
    case "waiting":
      return "ожидание";
    case "active":
      return "идет игра";
    case "finished":
      return "завершена";
  }
}

function shortId(id?: string) {
  return id ? id.slice(0, 6) : "";
}
