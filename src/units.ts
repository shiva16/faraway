import type { Unit, UnitKind, SaveState } from './types';
import { RESOURCE_NODES, canAfford, deductCost } from './building';

// ── Unit factory ──────────────────────────────────────────────────────────────

let _unitCounter = 0;

export function createUnit(kind: UnitKind, x: number, y: number): Unit {
  const maxHp = kind === 'soldier' ? 80 : 50;
  return {
    id: `unit_${_unitCounter++}`,
    kind,
    x, y,
    targetX: x, targetY: y,
    hp: maxHp, maxHp,
    task: 'idle',
    taskTarget: null,
    selected: false,
    frame: 0, frameTimer: 0,
    attackCooldown: 0,
    carryKind: null,
    carryAmount: 0,
    alive: true,
  };
}

// ── Training queues ───────────────────────────────────────────────────────────

export interface TrainEntry {
  kind: UnitKind;
  timeLeft: number;  // real seconds
  spawnX: number;
  spawnY: number;
}

export const trainQueue: TrainEntry[] = [];

export function queueTrain(
  kind: UnitKind,
  save: SaveState,
  spawnX: number,
  spawnY: number,
): boolean {
  const cost: import('./types').Resources = kind === 'villager'
    ? { wood: 0, stone: 0, food: 10, coin: 0 }
    : { wood: 20, stone: 0, food: 0, coin: 10 };
  if (!canAfford(save.resources, cost)) return false;
  deductCost(save.resources, cost);
  trainQueue.push({ kind, timeLeft: kind === 'villager' ? 20 : 30, spawnX, spawnY });
  return true;
}

export function tickTrainQueue(dt: number, units: Unit[], _save: SaveState): void {
  const secs = dt / 1000;
  for (let i = trainQueue.length - 1; i >= 0; i--) {
    trainQueue[i].timeLeft -= secs;
    if (trainQueue[i].timeLeft <= 0) {
      const { kind, spawnX, spawnY } = trainQueue[i];
      units.push(createUnit(kind, spawnX + (Math.random() - 0.5) * 1.5, spawnY + 1.5));
      trainQueue.splice(i, 1);
    }
  }
}

// ── Unit AI ───────────────────────────────────────────────────────────────────

const VILLAGER_SPEED = 0.035;
const SOLDIER_SPEED  = 0.045;
const GATHER_RANGE   = 1.2;
const ATTACK_RANGE   = 1.5;
const DEPOSIT_RANGE  = 2.0;

export function updateUnits(
  units: Unit[],
  save: SaveState,
  dt: number,
  enemies: Array<{ id: string; x: number; y: number; alive: boolean; hp?: number }>,
  passable: (x: number, y: number) => boolean,
): void {
  const spd = dt / 16.67;

  for (const u of units) {
    if (!u.alive) continue;

    if (u.attackCooldown > 0) u.attackCooldown -= spd;

    const speed = (u.kind === 'soldier' ? SOLDIER_SPEED : VILLAGER_SPEED) * spd;

    // ── Soldier: auto-detect nearby enemies ──────────────────────────────────
    if (u.kind === 'soldier' && u.task !== 'attacking') {
      const nearest = nearestEnemy(u, enemies, 6);
      if (nearest) {
        u.task = 'attacking';
        u.taskTarget = nearest.id;
        u.targetX = nearest.x;
        u.targetY = nearest.y;
      }
    }

    // ── Task-based behaviour ─────────────────────────────────────────────────
    switch (u.task) {
      case 'idle': {
        // Gentle wander
        if (Math.random() < 0.005) {
          u.targetX = u.x + (Math.random() - 0.5) * 4;
          u.targetY = u.y + (Math.random() - 0.5) * 4;
        }
        moveToward(u, u.targetX, u.targetY, speed * 0.4, passable);
        break;
      }

      case 'gathering': {
        if (!u.taskTarget) { u.task = 'idle'; break; }
        const node = RESOURCE_NODES.find(n => n.id === u.taskTarget);
        if (!node) { u.task = 'idle'; break; }

        const depletedUntil = save.flags[`dep_${node.id}`] as number | undefined;
        if (depletedUntil && depletedUntil > Date.now()) {
          // Node depleted — go to next one of same kind
          const alt = RESOURCE_NODES.find(
            n => n.kind === node.kind && !(save.flags[`dep_${n.id}`] as number > Date.now()),
          );
          if (alt) u.taskTarget = alt.id; else { u.task = 'idle'; }
          break;
        }

        const dist = dist2(u, { x: node.tx, y: node.ty });
        if (dist > GATHER_RANGE) {
          moveToward(u, node.tx, node.ty, speed, passable);
        } else {
          // Gather
          const forgeBonus = save.buildings.some(b => b.kind === 'forge') ? 1.5 : 1;
          const techBonus  = save.researched.includes('better_tools') ? 1.5 : 1;
          const amount = Math.round(node.yield * forgeBonus * techBonus / 3); // villagers gather slower
          save.resources[node.kind] += amount;
          save.flags[`dep_${node.id}`] = Date.now() + node.respawnSecs * 800; // faster respawn for villagers
          u.carryKind   = node.kind;
          u.carryAmount = amount;
          u.task = 'returning';
          // Find nearest building to deposit
          const bld = nearestBuilding(u, save);
          if (bld) { u.targetX = bld.tx; u.targetY = bld.ty; }
        }
        break;
      }

      case 'returning': {
        const bld = nearestBuilding(u, save);
        if (!bld) { u.task = 'idle'; break; }
        const dist = dist2(u, { x: bld.tx, y: bld.ty });
        if (dist > DEPOSIT_RANGE) {
          moveToward(u, bld.tx, bld.ty, speed, passable);
        } else {
          // Deposit
          u.carryKind = null; u.carryAmount = 0;
          // Go back to gathering if task was set
          u.task = u.taskTarget ? 'gathering' : 'idle';
        }
        break;
      }

      case 'moving': {
        const d = dist2(u, { x: u.targetX, y: u.targetY });
        if (d < 0.3) { u.task = 'idle'; break; }
        moveToward(u, u.targetX, u.targetY, speed, passable);
        break;
      }

      case 'attacking': {
        if (!u.taskTarget) { u.task = 'idle'; break; }
        const enemy = enemies.find(e => e.id === u.taskTarget);
        if (!enemy || !enemy.alive) { u.task = 'idle'; u.taskTarget = null; break; }

        // Keep tracking enemy position
        u.targetX = enemy.x; u.targetY = enemy.y;

        const effectiveRange = u.kind === 'soldier' && save.researched.includes('archery') ? 4.0 : ATTACK_RANGE;
        const dist = dist2(u, enemy);
        if (dist > effectiveRange) {
          moveToward(u, enemy.x, enemy.y, speed, passable);
        } else if (u.attackCooldown <= 0) {
          // Attack
          if (enemy.hp !== undefined) enemy.hp -= 20;
          u.attackCooldown = 60; // 1s at 60fps
          if (enemy.hp !== undefined && enemy.hp <= 0) {
            (enemy as { alive: boolean }).alive = false;
            u.task = 'idle'; u.taskTarget = null;
          }
        }
        break;
      }

      case 'patrolling': {
        // Soldiers patrol between buildings
        const bld = nearestBuilding(u, save);
        if (!bld) { u.task = 'idle'; break; }
        const dist = dist2(u, { x: bld.tx, y: bld.ty });
        if (dist < 1) {
          u.targetX = bld.tx + (Math.random() - 0.5) * 5;
          u.targetY = bld.ty + (Math.random() - 0.5) * 5;
        }
        moveToward(u, u.targetX, u.targetY, speed * 0.6, passable);
        break;
      }
    }

    // Walk animation
    const moving = dist2(u, { x: u.targetX, y: u.targetY }) > 0.05 && u.task !== 'idle';
    if (moving) {
      u.frameTimer += dt;
      if (u.frameTimer > 200) { u.frame = (u.frame + 1) % 4; u.frameTimer = 0; }
    } else {
      u.frame = 0;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function moveToward(
  u: Unit,
  tx: number, ty: number,
  speed: number,
  passable: (x: number, y: number) => boolean,
): void {
  const dx = tx - u.x, dy = ty - u.y;
  const d  = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = u.x + (dx / d) * speed;
  const ny = u.y + (dy / d) * speed;
  const foot = 0.3;
  if (passable(nx + Math.sign(dx / d) * foot, u.y)) u.x = nx;
  if (passable(u.x, ny + Math.sign(dy / d) * foot)) u.y = ny;
}

function nearestEnemy(
  u: Unit,
  enemies: Array<{ id: string; x: number; y: number; alive: boolean }>,
  range: number,
): { id: string; x: number; y: number; alive: boolean } | null {
  let best: typeof enemies[0] | null = null;
  let bestD = range;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist2(u, e);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function nearestBuilding(
  u: Unit,
  save: SaveState,
): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (const b of save.buildings) {
    const d = dist2(u, { x: b.tx, y: b.ty });
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}
