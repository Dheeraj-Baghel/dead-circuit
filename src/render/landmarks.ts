// Every bulky decorative prop sits in a recessed WALL cell, never inside the
// player's walkable/collision envelope. No gameplay graph or movement changes.
import { CELL, isWall, key, type Cell, type Level } from '../game/maze';
export type Landmark = { wall: Cell; corridor: Cell; dx: number; dz: number; rotation: number; kind: 'arcade-machine' | 'claw-machine' | 'ticket-machine' | 'prizes' | 'locker' | 'panel' | 'tank'; title: string };
export const NICHE = { width: 2.05, height: 2.55, depth: 1.78 };
export function landmarkSites(level: Level): Landmark[] {
  if (level.training) return [];
  const anchors = [{ x: 9, z: 19 }, { x: 11, z: 19 }, { x: 3, z: 3 }, { x: 17, z: 3 }, { x: 5, z: 15 }, { x: 15, z: 15 }, { x: 7, z: 13 }, { x: 13, z: 13 }];
  const used = new Set<string>();
  return anchors.flatMap((c, i) => {
    if (isWall(level, c.x, c.z)) return [];
    const wall = [{ x: c.x, z: c.z - 1 }, { x: c.x - 1, z: c.z }, { x: c.x + 1, z: c.z }, { x: c.x, z: c.z + 1 }]
      .find(w => w.x > 0 && w.z > 0 && w.x < level.width - 1 && w.z < level.height - 1 && level.grid[w.z][w.x] === '#' && !used.has(key(w)));
    if (!wall) return [];
    used.add(key(wall)); const dx = c.x - wall.x, dz = c.z - wall.z;
    const kinds: Landmark['kind'][] = level.id === 'service' ? ['arcade-machine', 'claw-machine', 'ticket-machine', 'prizes', 'locker', 'arcade-machine', 'panel', 'locker'] : level.id === 'drainworks' ? ['tank', 'panel', 'locker', 'tank', 'panel', 'tank', 'locker', 'panel'] : ['panel', 'locker', 'panel', 'tank', 'locker', 'panel', 'tank', 'panel'];
    return [{ wall, corridor: c, dx, dz, rotation: Math.atan2(dx, dz), kind: kinds[i], title: level.id === 'service' ? ['LAST CREDIT', 'PRIZE VAULT', 'TICKET RETURN', 'LOST & FOUND', 'STAFF ONLY', 'NO PLAYERS', 'POWER RELAY', 'ARCHIVE'][i] : `${level.id === 'drainworks' ? 'PUMP' : 'CIRCUIT'} / ${String(i + 1).padStart(2, '0')}` }];
  });
}
export const siteFaceKey = (site: Landmark) => `${key(site.wall)}/${site.dx},${site.dz}`;
