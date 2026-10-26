// DEAD CIRCUIT v2: one maze authority for player collision, hunter permissions,
// objectives and minimap. One world unit = 1000 mm; a tile is 2800 mm.
export const CELL = 2.8;
export type Cell = { x: number; z: number };
export type Point = { x: number; z: number };
export type Actor = 'player' | 'hunter';
export type Level = {
  id: string; title: string; subtitle: string; number: string;
  width: number; height: number; grid: string[]; start: Cell; exit: Cell;
  charges: Cell[]; relays: Cell[]; color: string; description: string;
  training?: boolean; chapter?: number;
  lockup?: { door: Cell; outside: Cell; homes: Cell[] };
  tunnelRow?: number; relic?: Cell;
  spots: { encounter: Cell; encounterHunter: Cell; contact: Cell };
  shortcuts?: { relay: Cell; cells: Cell[] }[];
};
export const key = (c: Cell) => `${c.x},${c.z}`;
export const worldAt = (c: Cell): Point => ({ x: (c.x + .5) * CELL, z: (c.z + .5) * CELL });
export const cellAt = (p: Point): Cell => ({ x: Math.floor(p.x / CELL), z: Math.floor(p.z / CELL) });
export function symbolAt(level: Level, x: number, z: number): string {
  // Only a declared tunnel can continue past the edge, never arbitrary boundary cells.
  if (z === level.tunnelRow && (x < 0 || x >= level.width)) return 'T';
  return level.grid[z]?.[x] ?? '#';
}
export const isWall = (l: Level, x: number, z: number, actor: Actor = 'player') => {
  const s = symbolAt(l, x, z);
  return s === '#' || (actor === 'player' && (s === 'H' || s === '-'));
};
export function neighbors(l: Level, c: Cell, actor: Actor = 'player'): Cell[] {
  return [{ x: c.x, z: c.z - 1 }, { x: c.x - 1, z: c.z }, { x: c.x, z: c.z + 1 }, { x: c.x + 1, z: c.z }]
    .map(n => n.z === l.tunnelRow ? { x: (n.x + l.width) % l.width, z: n.z } : n)
    .filter(n => n.x >= 0 && n.x < l.width && !isWall(l, n.x, n.z, actor));
}
export function walkable(l: Level, actor: Actor = 'player'): Cell[] {
  const cells: Cell[] = [];
  for (let z = 0; z < l.height; z++) for (let x = 0; x < l.width; x++) if (!isWall(l, x, z, actor)) cells.push({ x, z });
  return cells;
}
// BFS is shortest-path correct for this small unweighted graph, including wrap edges.
// Hunters use it ONLY when returning/exiting the Lockup, not to cheat at junctions.
export function findPath(l: Level, from: Cell, to: Cell, actor: Actor = 'player'): Cell[] {
  if (isWall(l, from.x, from.z, actor) || isWall(l, to.x, to.z, actor)) return [];
  const queue = [from], visited = new Set([key(from)]), came = new Map<string, Cell>();
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (key(current) === key(to)) {
      const path = [current];
      while (came.has(key(path[0]))) path.unshift(came.get(key(path[0]))!);
      return path;
    }
    for (const n of neighbors(l, current, actor)) if (!visited.has(key(n))) { visited.add(key(n)); came.set(key(n), current); queue.push(n); }
  }
  return [];
}
export function lineOfSight(l: Level, from: Point, to: Point): boolean {
  const count = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .2));
  for (let i = 0; i <= count; i++) {
    const c = cellAt({ x: from.x + (to.x - from.x) * i / count, z: from.z + (to.z - from.z) * i / count });
    if (isWall(l, c.x, c.z, 'hunter')) return false;
  }
  return true;
}
export function parseMaze(meta: Omit<Level, 'grid' | 'width' | 'height' | 'start' | 'exit' | 'charges' | 'lockup' | 'tunnelRow'>, rows: string[]): Level {
  const all = (symbol: string) => rows.flatMap((r, z) => Array.from(r).flatMap((s, x) => s === symbol ? [{ x, z }] : []));
  const starts = all('S'), exits = all('X'), doors = all('-'), homes = all('H'), tunnels = all('T');
  if (starts.length !== 1 || exits.length !== 1) throw new Error(`${meta.id}: exactly one start and exit required`);
  const l: Level = { ...meta, grid: [...rows], width: rows[0].length, height: rows.length, start: starts[0], exit: exits[0], charges: all('o') };
  if (doors.length) l.lockup = { door: doors[0], outside: { x: doors[0].x, z: doors[0].z - 1 }, homes };
  if (tunnels.length) l.tunnelRow = tunnels[0].z;
  const issues = validateLevel(l);
  if (issues.length) throw new Error(`${l.id}: ${issues.join('; ')}`);
  return l;
}
export function validateLevel(l: Level): string[] {
  const issues: string[] = [];
  if (l.grid.length !== l.height || l.grid.some(r => r.length !== l.width)) issues.push('Grid dimensions disagree');
  if (l.grid.some(r => /[^#. o\-HTSX]/.test(r))) issues.push('Unknown maze symbol');
  if (isWall(l, l.start.x, l.start.z)) issues.push('Start blocked');
  const visited = new Set([key(l.start)]), queue = [l.start];
  for (let i = 0; i < queue.length; i++) for (const n of neighbors(l, queue[i])) if (!visited.has(key(n))) { visited.add(key(n)); queue.push(n); }
  if (visited.size !== walkable(l).length) issues.push('Disconnected corridor');
  const objectives = [l.exit, ...l.charges, ...l.relays, ...Object.values(l.spots), ...(l.relic ? [l.relic] : [])];
  for (const c of objectives) if (!visited.has(key(c))) issues.push(`Unreachable objective ${key(c)}`);
  if (!l.training && l.charges.length !== 4) issues.push('Campaign requires four power cells');
  for (const c of walkable(l)) if (neighbors(l, c).length < 2) issues.push(`Dead end ${key(c)}`);
  if (l.tunnelRow !== undefined) {
    const r = l.grid[l.tunnelRow];
    if (r?.[0] !== 'T' || r?.[l.width - 1] !== 'T') issues.push('Tunnel mouths must be paired');
  }
  for (let z = 0; z < l.height; z++) for (let x = 0; x < l.width; x++) {
    if ((z === 0 || z === l.height - 1 || x === 0 || x === l.width - 1) && l.grid[z]?.[x] !== '#' && !(z === l.tunnelRow && l.grid[z]?.[x] === 'T')) issues.push('Open boundary outside tunnel');
  }
  if (l.lockup) {
    if (l.lockup.homes.length < 4 || l.grid.flatMap(r => Array.from(r)).filter(s => s === '-').length !== 1) issues.push('Lockup requires one door and four homes');
    for (const c of l.lockup.homes) if (!findPath(l, c, l.lockup.outside, 'hunter').length) issues.push('Lockup exit blocked');
  }
  return [...new Set(issues)];
}
