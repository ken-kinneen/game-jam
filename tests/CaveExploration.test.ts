import { describe, expect, it } from 'vitest';
import {
  CaveExploration,
  lightRadiusToRevealRadius,
  type CaveMinimapMap,
} from '../src/engine/systems/CaveExploration';

function mapFromRows(rows: number[][], tileSize = 16): CaveMinimapMap {
  return {
    width: rows[0].length,
    height: rows.length,
    grid: rows,
    tileSize,
  };
}

describe('CaveExploration', () => {
  it('starts hidden and reveals only the nearby area', () => {
    const map = mapFromRows(Array.from({ length: 9 }, () => Array(9).fill(1)));
    const exploration = new CaveExploration(map, 2);

    expect(exploration.isRevealed(4, 4)).toBe(false);
    expect(exploration.revealAtCell(4, 4)).toBe(true);
    expect(exploration.isRevealed(4, 4)).toBe(true);
    expect(exploration.isRevealed(6, 4)).toBe(true);
    expect(exploration.isRevealed(7, 4)).toBe(false);
  });

  it('reveals a blocking wall but keeps cells behind it hidden', () => {
    const map = mapFromRows([
      [1, 1, 1, 1, 1],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1],
    ]);
    const exploration = new CaveExploration(map, 4);

    exploration.revealAtCell(0, 1);

    expect(exploration.isRevealed(2, 1)).toBe(true);
    expect(exploration.isRevealed(3, 1)).toBe(false);
    expect(exploration.isRevealed(4, 1)).toBe(false);
  });

  it('keeps discoveries while revealing from a new player cell', () => {
    const map = mapFromRows([Array(8).fill(1)]);
    const exploration = new CaveExploration(map, 1);

    exploration.revealAtWorld(1.5 * map.tileSize, map.tileSize / 2);
    expect(exploration.isRevealed(0, 0)).toBe(true);
    expect(exploration.isRevealed(5, 0)).toBe(false);

    exploration.revealAtWorld(5.5 * map.tileSize, map.tileSize / 2);
    expect(exploration.isRevealed(0, 0)).toBe(true);
    expect(exploration.isRevealed(5, 0)).toBe(true);
  });

  it('does no extra work while the player remains in the same cell', () => {
    const map = mapFromRows([Array(4).fill(1)]);
    const exploration = new CaveExploration(map, 1);

    expect(exploration.revealAtCell(1, 0)).toBe(true);
    expect(exploration.revealAtCell(1, 0)).toBe(false);
  });

  it('updates current visibility when fuel changes without forgetting explored cells', () => {
    const map = mapFromRows([Array(9).fill(1)]);
    const exploration = new CaveExploration(map);

    exploration.revealAtCell(4, 0, 4);
    expect(exploration.isVisible(0, 0)).toBe(true);

    expect(exploration.revealAtCell(4, 0, 1)).toBe(true);
    expect(exploration.isVisible(0, 0)).toBe(false);
    expect(exploration.isRevealed(0, 0)).toBe(true);
  });

  it('matches the player lamp radius in map tiles', () => {
    expect(lightRadiusToRevealRadius(0, 16)).toBe(1);
    expect(lightRadiusToRevealRadius(40, 16)).toBe(3);
    expect(lightRadiusToRevealRadius(200, 16)).toBe(13);
    expect(lightRadiusToRevealRadius(200, 32)).toBe(6);
  });
});
