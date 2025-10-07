import { AuthResponse, CreateSessionPayload, GameState, Session, SessionStatus, User, Direction, RugCell, RugLayer } from "@shared/api";

type StoredUser = User & { password: string };

const LS_USERS = "mock_users";
const LS_SESSIONS = "mock_sessions";
const LS_STATES = "mock_game_states";
const LS_TOKENS = "mock_tokens"; // token -> userId

const DEFAULT_BOARD = 7;

function nowIso() { return new Date().toISOString(); }

function generateId(bytes = 12): string {
  try { const arr = new Uint8Array(bytes); crypto.getRandomValues(arr); return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join(""); }
  catch { return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
}

function readJSON<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw) as T; } catch { return fallback; } }
function writeJSON<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

function getUsers(): StoredUser[] { return readJSON<StoredUser[]>(LS_USERS, []); }
function setUsers(users: StoredUser[]) { writeJSON(LS_USERS, users); }
function getSessions(): Session[] { return readJSON<Session[]>(LS_SESSIONS, []); }
function setSessions(sessions: Session[]) { writeJSON(LS_SESSIONS, sessions); }
function getStates(): Record<string, GameState> { return readJSON<Record<string, GameState>>(LS_STATES, {}); }
function setStates(states: Record<string, GameState>) { writeJSON(LS_STATES, states); }
function getTokens(): Record<string, string> { return readJSON<Record<string, string>>(LS_TOKENS, {}); }
function setTokens(tokens: Record<string, string>) { writeJSON(LS_TOKENS, tokens); }

function getUserByToken(token?: string | null): User | null {
  if (!token) return null; const tokens = getTokens(); const userId = tokens[token]; if (!userId) return null; const users = getUsers(); const u = users.find((x) => x.id === userId); if (!u) return null; const { password: _pw, ...user } = u; return user;
}

function activePlayerIdFor(session: Session, st: GameState): string | undefined {
  return st.activePlayerId ?? session.activePlayerId ?? session.turnOrder[0];
}

function ensureUser(token?: string | null): User {
  const me = getUserByToken(token);
  if (!me) throw new Error("Требуется вход в систему");
  return me;
}

function ensureActiveTurn(session: Session, st: GameState, token?: string | null): User {
  const me = ensureUser(token);
  const activeId = activePlayerIdFor(session, st);
  if (!activeId) throw new Error("Нет активного игрока");
  if (me.id !== activeId) throw new Error("Сейчас ход противника");
  return me;
}

function emptyGrid(n: number): RugCell[][] { return Array.from({ length: n }, () => Array.from({ length: n }, () => ({ stack: [] })) ); }

function ensureGameState(session: Session): GameState {
  const all = getStates(); const cur = all[session.id];
  if (cur) {
    const playerIds = new Set(session.players.map((p) => p.id));
    const count = session.players.length;
    const balances = { ...(cur.balances || {}) };
    const rugsLeft = { ...(cur.rugsLeft || {}) };
    let changed = false;
    for (const id of Object.keys(balances)) {
      if (!playerIds.has(id)) {
        delete balances[id];
        delete rugsLeft[id];
        changed = true;
      }
    }
    for (const id of playerIds) {
      if (!(id in balances)) {
        balances[id] = defaultCoinsForCount(count);
        rugsLeft[id] = defaultRugsForCount(count);
        changed = true;
      }
    }
    if (changed) {
      const updated: GameState = { ...cur, balances, rugsLeft };
      all[session.id] = updated;
      setStates(all);
      return updated;
    }
    return cur;
  }
  const balances: Record<string, number> = {}; const rugsLeft: Record<string, number> = {};
  const count = session.players.length;
  const startCoins = defaultCoinsForCount(count);
  const startRugs = defaultRugsForCount(count);
  for (const p of session.players) { balances[p.id] = startCoins; rugsLeft[p.id] = startRugs; }
  const initial: GameState = {
    id: generateId(), sessionId: session.id, status: "active", activePlayerId: session.turnOrder?.[0],
    pieces: [{ id: "assam", x: Math.floor(DEFAULT_BOARD / 2), y: Math.floor(DEFAULT_BOARD / 2) }],
    direction: "N", boardSize: DEFAULT_BOARD, rugsGrid: emptyGrid(DEFAULT_BOARD), balances, rugsLeft, lastRoll: undefined,
  };
  all[session.id] = initial; setStates(all); return initial;
}

function defaultCoinsForCount(count: number) {
  if (count === 2) return 60;
  if (count === 3) return 40;
  return 30;
}

function defaultRugsForCount(count: number) {
  if (count === 2) return 24;
  if (count === 3) return 15;
  return 12;
}

function nextPlayerId(session: Session, currentId?: string) { const order = session.turnOrder || []; if (order.length === 0) return undefined; const idx = currentId ? order.indexOf(currentId) : -1; const next = order[(idx + 1) % order.length]; return next; }

function requireSession(id: string): Session { const sessions = getSessions(); const s = sessions.find((x) => x.id === id); if (!s) throw new Error("Сессия не найдена"); return s; }
function saveSession(updated: Session) { const sessions = getSessions(); const next = sessions.map((s) => (s.id === updated.id ? updated : s)); setSessions(next); }

function rotate(dir: Direction, turn: "left" | "right"): Direction { const order: Direction[] = ["N", "E", "S", "W"]; const i = order.indexOf(dir); return order[(i + (turn === "right" ? 1 : -1) + 4) % 4]; }

function stepForward(st: GameState): { x: number; y: number; dir: Direction } {
  const n = st.boardSize || DEFAULT_BOARD; const p = st.pieces?.[0]; if (!p) throw new Error("Ассам не найден");
  let { x, y } = p; let dir = st.direction || "N";
  if (dir === "E") {
    if (x === n - 1) { y = Math.min(n - 1, y + 1); dir = "W"; }
    else { x = x + 1; }
  } else if (dir === "W") {
    if (x === 0) { y = Math.min(n - 1, y + 1); dir = "E"; }
    else { x = x - 1; }
  } else if (dir === "N") {
    if (y === 0) { x = Math.min(n - 1, x + 1); dir = "S"; }
    else { y = y - 1; }
  } else if (dir === "S") {
    if (y === n - 1) { x = Math.min(n - 1, x + 1); dir = "N"; }
    else { y = y + 1; }
  }
  return { x, y, dir };
}

function topOwnerId(grid: RugCell[][], x: number, y: number): string | undefined { const stack = grid[y]?.[x]?.stack; return stack && stack.length ? stack[stack.length - 1].ownerId : undefined; }

function bfsRegion(grid: RugCell[][], x: number, y: number): { owner?: string; size: number } {
  const n = grid.length; const owner = topOwnerId(grid, x, y); if (!owner) return { owner: undefined, size: 0 };
  const q: [number, number][] = [[x, y]]; const seen = new Set<string>([`${x},${y}`]); let size = 0;
  while (q.length) { const [cx, cy] = q.shift()!; const own = topOwnerId(grid, cx, cy); if (own !== owner) continue; size++;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]]; for (const [dx, dy] of dirs) { const nx = cx+dx, ny = cy+dy; if (nx<0||ny<0||nx>=n||ny>=n) continue; const k = `${nx},${ny}`; if (seen.has(k)) continue; if (topOwnerId(grid, nx, ny) === owner) { seen.add(k); q.push([nx, ny]); } }
  }
  return { owner, size };
}

function applyPayment(st: GameState, payerId: string, x: number, y: number) {
  const grid = st.rugsGrid!; const { owner, size } = bfsRegion(grid, x, y); if (!owner || owner === payerId || size === 0) return st;
  const balances = { ...(st.balances || {}) }; const pay = Math.min(balances[payerId] ?? 0, size); balances[payerId] = (balances[payerId] ?? 0) - pay; balances[owner] = (balances[owner] ?? 0) + pay; return { ...st, balances };
}

function canPlaceRug(st: GameState, playerId: string, x: number, y: number, orient: "H" | "V"): { ok: boolean; reason?: string } {
  const n = st.boardSize || DEFAULT_BOARD; const assam = st.pieces?.[0]!; const grid = st.rugsGrid!;
  const cells: [number, number][] = orient === "H" ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];
  for (const [cx, cy] of cells) { if (cx < 0 || cy < 0 || cx >= n || cy >= n) return { ok: false, reason: "Вне поля" }; if (cx === assam.x && cy === assam.y) return { ok: false, reason: "Нельзя на клетку Ассама" }; }
  if (!cells.some(([cx, cy]) => (Math.abs(cx - assam.x) + Math.abs(cy - assam.y)) === 1)) return { ok: false, reason: "Должен соприкасаться с Ассамом" };
  const top0 = grid[cells[0][1]][cells[0][0]].stack.at(-1);
  const top1 = grid[cells[1][1]][cells[1][0]].stack.at(-1);
  if ((top0?.ownerId === playerId) || (top1?.ownerId === playerId)) return { ok: false, reason: "Нельзя накрывать свой ковёр" };
  if (top0 && top1 && top0.rugId === top1.rugId) return { ok: false, reason: "Нельзя полностью накрыть ковёр" };
  return { ok: true };
}

function placeRug(st: GameState, playerId: string, x: number, y: number, orient: "H" | "V"): GameState {
  const check = canPlaceRug(st, playerId, x, y, orient); if (!check.ok) throw new Error(check.reason || "Нельзя положить ковёр");
  const grid = st.rugsGrid ? st.rugsGrid.map(row => row.map(cell => ({ stack: [...cell.stack] }))) : emptyGrid(DEFAULT_BOARD);
  const rugsLeft = { ...(st.rugsLeft || {}) }; if ((rugsLeft[playerId] ?? 0) <= 0) throw new Error("Ковры закончились");
  const rugId = generateId();
  const cells: [number, number][] = orient === "H" ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];
  for (const [cx, cy] of cells) { grid[cy][cx].stack.push({ ownerId: playerId, rugId }); }
  rugsLeft[playerId] = (rugsLeft[playerId] ?? 0) - 1;
  let status = st.status;
  if (Object.values(rugsLeft).every((v) => v <= 0)) {
    // finish game: coins + visible tiles
    const balances = { ...(st.balances || {}) };
    const visibleCount: Record<string, number> = {};
    for (let yy = 0; yy < grid.length; yy++) for (let xx = 0; xx < grid.length; xx++) { const top = grid[yy][xx].stack.at(-1); if (top) visibleCount[top.ownerId] = (visibleCount[top.ownerId] ?? 0) + 1; }
    let winnerId = Object.keys(balances)[0]; let best = -Infinity;
    for (const pid of Object.keys(balances)) { const score = (balances[pid] ?? 0) + (visibleCount[pid] ?? 0); if (score > best) { best = score; winnerId = pid; } }
    return { ...st, rugsGrid: grid, rugsLeft, status: "finished", winnerId };
  }
  return { ...st, rugsGrid: grid, rugsLeft };
}

export const API = {
  // Auth
  async register(body: { name: string; email: string; password: string }): Promise<AuthResponse> {
    const users = getUsers(); if (users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) throw new Error("Пользователь с таким email уже существует");
    const user: StoredUser = { id: generateId(), name: body.name || "Игрок", email: body.email, password: body.password };
    users.push(user); setUsers(users); const token = generateId(16); const tokens = getTokens(); tokens[token] = user.id; setTokens(tokens); const { password: _pw, ...publicUser } = user; return { token, user: publicUser };
  },
  async login(body: { email: string; password: string }): Promise<AuthResponse> {
    const users = getUsers(); const found = users.find((u) => u.email.toLowerCase() === body.email.toLowerCase() && u.password === body.password); if (!found) throw new Error("Неверный email или пароль"); const token = generateId(16); const tokens = getTokens(); tokens[token] = found.id; setTokens(tokens); const { password: _pw, ...publicUser } = found; return { token, user: publicUser };
  },

  // Sessions
  async listSessions(_token?: string): Promise<Session[]> { return getSessions().slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); },
  async createSession(payload: CreateSessionPayload, token?: string): Promise<Session> {
    const me = getUserByToken(token); if (!me) throw new Error("Требуется вход �� систему"); const sessions = getSessions(); const id = generateId(); const status: SessionStatus = "waiting";
    const session: Session = { id, name: payload.name || "Новая партия", players: [me], status, turnOrder: [me.id], activePlayerId: me.id, createdAt: nowIso() };
    sessions.unshift(session); setSessions(sessions); return session;
  },
  async autoOrder(sessionId: string, _token?: string): Promise<Session> {
    const s = requireSession(sessionId); const order = s.players.map((p) => p.id);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const updated: Session = { ...s, turnOrder: order, activePlayerId: order[0], status: s.players.length > 0 ? "active" : s.status };
    saveSession(updated); const states = getStates(); const st = states[sessionId]; if (st) { states[sessionId] = { ...st, activePlayerId: updated.activePlayerId }; setStates(states); }
    return updated;
  },
  async joinSession(sessionId: string, token?: string): Promise<Session> {
    const me = getUserByToken(token);
    if (!me) throw new Error("Требуется вход в систему");
    const sessions = getSessions();
    const idx = sessions.findIndex((session) => session.id === sessionId);
    if (idx === -1) throw new Error("Сессия не найдена");
    const session = sessions[idx];
    if (session.players.some((p) => p.id === me.id)) return session;
    const updatedPlayers = [...session.players, me];
    const turnOrder = session.turnOrder.includes(me.id) ? session.turnOrder : [...session.turnOrder, me.id];
    const updated: Session = {
      ...session,
      players: updatedPlayers,
      turnOrder,
      status: session.status,
      activePlayerId: session.activePlayerId || turnOrder[0],
    };
    sessions[idx] = updated;
    setSessions(sessions);
    const states = getStates();
    const st = states[sessionId];
    if (st) {
      const count = updatedPlayers.length;
      const balances = { ...(st.balances || {}) };
      const rugsLeft = { ...(st.rugsLeft || {}) };
      if (!(me.id in balances)) {
        balances[me.id] = defaultCoinsForCount(count);
      }
      if (!(me.id in rugsLeft)) {
        rugsLeft[me.id] = defaultRugsForCount(count);
      }
      states[sessionId] = { ...st, balances, rugsLeft };
      setStates(states);
    } else {
      ensureGameState(updated);
    }
    return updated;
  },
  async deleteSession(sessionId: string, token?: string) {
    const me = getUserByToken(token);
    if (!me) throw new Error("Требуется ��ход в систему");
    const sessions = getSessions();
    const existing = sessions.find((session) => session.id === sessionId);
    if (!existing) throw new Error("Сессия не найдена");
    if (!existing.players.some((player) => player.id === me.id)) throw new Error("Нет доступа");
    const remaining = sessions.filter((session) => session.id !== sessionId);
    setSessions(remaining);
    const states = getStates();
    if (states[sessionId]) {
      delete states[sessionId];
      setStates(states);
    }
  },
  async getSession(sessionId: string, _token?: string): Promise<Session> { return requireSession(sessionId); },
  async getGameState(sessionId: string, _token?: string) { const s = requireSession(sessionId); const st = ensureGameState(s); return st; },

  // Actions
  async rotate(sessionId: string, turn: "left" | "right", token?: string) {
    const session = requireSession(sessionId); const states = getStates(); const st = ensureGameState(session);
    if (st.status === "finished") throw new Error("Игра завершена");
    ensureActiveTurn(session, st, token);
    const dir = rotate(st.direction || "N", turn); const updated: GameState = { ...st, direction: dir };
    states[sessionId] = updated; setStates(states);
    return updated;
  },
  async step(sessionId: string, _token?: string) {
    const session = requireSession(sessionId); const states = getStates(); let st = ensureGameState(session); const nxt = stepForward(st); st = { ...st, pieces: [{ id: "assam", x: nxt.x, y: nxt.y }], direction: nxt.dir };
    // payments
    st = applyPayment(st, st.activePlayerId || session.activePlayerId || session.turnOrder[0], nxt.x, nxt.y);
    states[sessionId] = st; setStates(states); return st;
  },
  async rollDice(sessionId: string, token?: string) {
    const session = requireSession(sessionId); const states = getStates(); let st = ensureGameState(session);
    if (st.status === "finished") throw new Error("Игра завершена");
    ensureActiveTurn(session, st, token);
    const diceFaces = [1, 2, 2, 3, 3, 4];
    const roll = diceFaces[Math.floor(Math.random() * diceFaces.length)];
    let res = st;
    for (let i = 0; i < roll; i++) { res = await this.step(sessionId, token); st = res; }
    const updated: GameState = { ...st, lastRoll: roll };
    states[sessionId] = updated; setStates(states);
    saveSession({ ...session, activePlayerId: activePlayerIdFor(session, updated) });
    return updated;
  },
  async placeRug(sessionId: string, body: { x: number; y: number; orientation: "H" | "V" }, token?: string) {
    const session = requireSession(sessionId); const states = getStates(); const st0 = ensureGameState(session);
    if (st0.status === "finished") throw new Error("Игра завершена");
    const me = ensureActiveTurn(session, st0, token);
    const stPlaced = placeRug(st0, me.id, body.x, body.y, body.orientation);
    const currentActive = activePlayerIdFor(session, stPlaced) ?? me.id;
    const nextActive = nextPlayerId(session, currentActive);
    const st1: GameState = { ...stPlaced, activePlayerId: nextActive };
    states[sessionId] = st1; setStates(states);
    saveSession({ ...session, activePlayerId: nextActive });
    return st1;
  },
};
