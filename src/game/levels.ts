// Original v2 text layouts, not the Pac-Man arcade map. Symmetrical loops,
// four corner charges and a central hunter-only Lockup; no random topology.
import { parseMaze, type Level } from './maze';
export * from './maze';

const service = parseMaze({
  id: 'service', title: 'The Service Loop', subtitle: 'Arcade maintenance / sublevel 01', number: '01', chapter: 1,
  color: '#e4ae67', description: 'Follow the memory. Watch the Lockup. Four corners can turn the hunt.',
  relays: [{ x: 5, z: 3 }, { x: 15, z: 3 }], relic: { x: 10, z: 18 },
  spots: { encounter: { x: 1, z: 19 }, encounterHunter: { x: 1, z: 15 }, contact: { x: 5, z: 13 } },
  shortcuts: [{ relay: { x: 5, z: 3 }, cells: [{ x: 4, z: 3 }] }],
}, [
  '#####################',
  '#o.................o#',
  '#.###.###.#.###.###.#',
  '#...#.....#.....#...#',
  '###.#.###.#.###.#.###',
  '#...#...#...#...#...#',
  '#.#####.#####.#####.#',
  '#.......#...#.......#',
  '#.###.#.......#.###.#',
  '#...#.#.##-##.#.#...#',
  '###.#...#HHH#...#.###',
  'TT..#.#.#HHH#.#.#..TT',
  '###.#.#.#####.#.#.###',
  '#.....#.......#.....#',
  '#.###.###.#.###.###.#',
  '#...#.....#.....#...#',
  '#.#.#.###.#.###.#.#.#',
  '#.#...#.......#...#.#',
  '#.#####.##.##.#####.#',
  '#.........S.........#',
  '#.###.###.#.###.###.#',
  '#o........X........o#',
  '#####################',
]);
// Authored chapter variants change specific wall islands and add paired loops.
// They use the same dimensions during Phase 1; dressing belongs to later phases.
function variant(id: string, title: string, chapter: number, edits: [number, string][], color: string): Level {
  const grid = [...service.grid]; for (const [z, row] of edits) grid[z] = row;
  return parseMaze({ id, title, chapter, number: String(chapter).padStart(2, '0'), color,
    subtitle: chapter === 2 ? 'Flood control / sublevel 02' : 'Main distribution / sublevel 03',
    description: chapter === 2 ? 'Sound carries in the drains. The Weeper hears your sprint and radar.' : 'Every circuit is failing. Clear the maze, then reach the lift.',
    relays: [{ x: 5, z: 3 }, { x: 15, z: 3 }], relic: { x: 10, z: 18 },
    spots: { ...service.spots }, shortcuts: service.shortcuts,
  }, grid);
}
const drainworks = variant('drainworks', 'The Drainworks', 2, [
  [2, '#.###.#.#.#.#.#.###.#'], [4, '#.#.#.###.#.###.#.#.#'],
  [14, '#.#.#.###.#.###.#.#.#'],
], '#8bc8be');
const core = variant('core', 'The Core', 3, [
  [2, '#.#.#.###.#.###.#.#.#'], [6, '#.###.#.#####.#.###.#'],
  [16, '#...#.###.#.###.#...#'],
], '#d99571');
export const TRAINING = parseMaze({
  id: 'training', title: 'Service Entry', subtitle: 'Capture-free orientation', number: '00', training: true, chapter: 0,
  relays: [{ x: 5, z: 1 }], color: '#a1c7ab', description: 'Learn the map, follow the motes, try an overload, and reach the lift.',
  spots: { encounter: { x: 1, z: 7 }, encounterHunter: { x: 1, z: 3 }, contact: { x: 5, z: 3 } },
}, [
  '###########', '#....o...X#', '#.###.###.#', '#.#.....#.#',
  '#.#.###.#.#', '#.#.....#.#', '#.###.###.#', '#o...S....#', '###########',
]);
export const LEVELS: Level[] = [service, drainworks, core];
