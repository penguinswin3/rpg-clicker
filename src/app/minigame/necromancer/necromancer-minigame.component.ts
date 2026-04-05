import {
  Component, OnInit, OnDestroy, inject,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WalletService } from '../../wallet/wallet.service';
import { ActivityLogService } from '../../activity-log/activity-log.service';
import { StatisticsService } from '../../statistics/statistics.service';
import { UpgradeService } from '../../upgrade/upgrade.service';
import { NECROMANCER_MG } from '../../game-config';
import { CURRENCY_FLAVOR, MINIGAME_MSG, cur } from '../../flavor-text';

// ── Helpers ─────────────────────────────────────────────────

/** 2-D point inside the SVG coordinate space. */
interface Point { x: number; y: number; }

/** A ritual node placed around the spell circle. */
interface RitualNode {
  /** Position in SVG coordinates. */
  pos: Point;
  /** Resource category (e.g. 'bone', 'brimstone', 'beast'). Used for adjacency enforcement. */
  type: string;
  /** Currency icon to display on this node. */
  symbol: string;
  /** Display colour for the symbol. */
  color: string;
  /** Whether this node has been selected by the player. */
  selected: boolean;
  /** Selection order index (1-based). -1 = not yet selected. */
  order: number;
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ── TSP brute-force solver (6 nodes → 720 permutations, instant) ──

/**
 * Given a list of typed nodes, compute the shortest Hamiltonian cycle
 * that visits every node exactly once, returns to the start, AND never
 * places two nodes of the same type consecutively (including the closing
 * edge from the last node back to the first).
 *
 * Returns the total cycle length and the winning node-index order.
 * Uses brute force with early pruning — only feasible for small N (≤ 8).
 */
function shortestCycle(
  nodes: { pos: Point; type: string }[],
): { length: number; order: number[] } {
  const n = nodes.length;
  if (n <= 1) return { length: 0, order: [0] };
  if (n === 2) {
    if (nodes[0].type === nodes[1].type) return { length: Infinity, order: [0, 1] };
    return { length: 2 * dist(nodes[0].pos, nodes[1].pos), order: [0, 1] };
  }

  // Fix node 0 as the start to avoid counting rotational duplicates.
  // Permute the remaining indices and track the type of the previous node
  // so we can prune same-type branches before computing any distances.
  const restIdx = nodes.slice(1).map((_, i) => i + 1);
  let best      = Infinity;
  let bestOrder = restIdx.slice();

  const permute = (arr: number[], depth: number, prevType: string): void => {
    if (depth === arr.length) {
      // Closing-edge constraint: last node → node 0 must differ in type
      if (nodes[arr[arr.length - 1]].type === nodes[0].type) return;

      // All type constraints satisfied — compute path length
      let total = dist(nodes[0].pos, nodes[arr[0]].pos);
      for (let i = 1; i < arr.length; i++) {
        total += dist(nodes[arr[i - 1]].pos, nodes[arr[i]].pos);
      }
      total += dist(nodes[arr[arr.length - 1]].pos, nodes[0].pos);
      if (total < best) { best = total; bestOrder = arr.slice(); }
      return;
    }
    for (let i = depth; i < arr.length; i++) {
      // Early prune: skip this candidate if it shares a type with the previous node
      if (nodes[arr[i]].type === prevType) continue;
      [arr[depth], arr[i]] = [arr[i], arr[depth]];
      permute(arr, depth + 1, nodes[arr[depth]].type);
      [arr[depth], arr[i]] = [arr[i], arr[depth]];
    }
  };

  permute(restIdx, 0, nodes[0].type);
  return { length: best, order: [0, ...bestOrder] };
}

// ── Component ───────────────────────────────────────────────

@Component({
  selector: 'app-necromancer-minigame',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './necromancer-minigame.component.html',
  styleUrls: ['./necromancer-minigame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NecromancerMinigameComponent implements OnInit, OnDestroy {
  private wallet   = inject(WalletService);
  private log      = inject(ActivityLogService);
  private stats    = inject(StatisticsService);
  private upgrades = inject(UpgradeService);
  private cdr      = inject(ChangeDetectorRef);
  private sub      = new Subscription();

  readonly currencyFlavor = CURRENCY_FLAVOR as Record<string, { name: string; symbol: string; color: string }>;
  readonly cfg = NECROMANCER_MG;

  /** SVG viewBox dimensions (square). */
  readonly VB = 120;
  /** Center of the SVG viewBox. */
  readonly CX = 60;
  readonly CY = 60;

  // ── Wallet-synced amounts ──────────────────
  gemstones  = 0;
  bones      = 0;
  brimstone  = 0;
  beast      = 0;
  xp         = 0;

  // ── State ──────────────────────────────────
  ritualActive = false;
  ritualDone   = false;
  nodes: RitualNode[] = [];
  /** Indices into `nodes` in the order the player clicked them. */
  selectedPath: number[] = [];
  /** Index of the node the player started from (-1 = none yet). */
  startNodeIdx = -1;

  // ── Result ─────────────────────────────────
  playerPathLength  = 0;
  optimalPathLength = 0;
  /** Node-index order of the optimal TSP solution (for post-round overlay). */
  optimalPath: number[] = [];
  /**
   * Randomly-selected edge(s) from the optimal cycle, shown as faint hint
   * lines during the active ritual when Demonic Knowledge is purchased.
   */
  hintLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  efficiencyPct     = 0;
  soulStonesAwarded = 0;
  xpAwarded         = 0;

  lastMsg  = '';
  msgClass = 'msg-neutral';

  // ── Costs ──────────────────────────────────
  readonly costs: { id: string; amount: number }[] = [
    { id: 'gemstone',   amount: NECROMANCER_MG.GEMSTONE_COST },
    { id: 'bone',       amount: NECROMANCER_MG.BONE_COST },
    { id: 'brimstone',  amount: NECROMANCER_MG.BRIMSTONE_COST },
    { id: 'beast',      amount: NECROMANCER_MG.BEAST_COST },
    { id: 'xp',         amount: NECROMANCER_MG.XP_COST },
  ];

  // ── Resource node types (2 of each for 6 total) ────────────
  private readonly nodeTypes: { id: string; symbol: string; color: string }[] = [
    { id: 'bone',      symbol: CURRENCY_FLAVOR['bone'].symbol,      color: CURRENCY_FLAVOR['bone'].color },
    { id: 'bone',      symbol: CURRENCY_FLAVOR['bone'].symbol,      color: CURRENCY_FLAVOR['bone'].color },
    { id: 'brimstone', symbol: CURRENCY_FLAVOR['brimstone'].symbol, color: CURRENCY_FLAVOR['brimstone'].color },
    { id: 'brimstone', symbol: CURRENCY_FLAVOR['brimstone'].symbol, color: CURRENCY_FLAVOR['brimstone'].color },
    { id: 'beast',     symbol: CURRENCY_FLAVOR['beast'].symbol,     color: CURRENCY_FLAVOR['beast'].color },
    { id: 'beast',     symbol: CURRENCY_FLAVOR['beast'].symbol,     color: CURRENCY_FLAVOR['beast'].color },
  ];

  // ── Computed ───────────────────────────────

  get canStart(): boolean {
    return !this.ritualActive
      && this.gemstones  >= this.cfg.GEMSTONE_COST
      && this.bones      >= this.cfg.BONE_COST
      && this.brimstone  >= this.cfg.BRIMSTONE_COST
      && this.beast      >= this.cfg.BEAST_COST
      && this.xp         >= this.cfg.XP_COST;
  }

  /** Whether the player has completed the full cycle back to start. */
  get pathComplete(): boolean {
    return this.selectedPath.length > this.nodes.length && this.ritualDone;
  }

  /** True when the player has selected at least one node. */
  get pathStarted(): boolean {
    return this.selectedPath.length > 0;
  }

  /** Number of remaining unvisited nodes. */
  get nodesRemaining(): number {
    // -1 because the start node appears at both ends
    return this.nodes.length - this.selectedPath.length + (this.startNodeIdx >= 0 ? 0 : 0);
  }

  // ── Lifecycle ──────────────────────────────

  ngOnInit(): void {
    this.sub.add(
      this.wallet.state$.subscribe(s => {
        this.gemstones = Math.floor(s['gemstone']?.amount ?? 0);
        this.bones     = Math.floor(s['bone']?.amount ?? 0);
        this.brimstone = Math.floor(s['brimstone']?.amount ?? 0);
        this.beast     = Math.floor(s['beast']?.amount ?? 0);
        this.xp        = Math.floor(s['xp']?.amount ?? 0);
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Actions ────────────────────────────────

  startRitual(): void {
    if (!this.canStart) return;

    // Pay costs
    this.wallet.remove('gemstone',  this.cfg.GEMSTONE_COST);
    this.wallet.remove('bone',      this.cfg.BONE_COST);
    this.wallet.remove('brimstone', this.cfg.BRIMSTONE_COST);
    this.wallet.remove('beast',     this.cfg.BEAST_COST);
    this.wallet.remove('xp',        this.cfg.XP_COST);

    // Reset state
    this.ritualActive     = true;
    this.ritualDone       = false;
    this.selectedPath     = [];
    this.startNodeIdx     = -1;
    this.soulStonesAwarded = 0;
    this.xpAwarded         = 0;
    this.optimalPath       = [];
    this.optimalPathLength = 0;
    this.hintLines         = [];
    this.lastMsg  = MINIGAME_MSG.NECROMANCER.ROUND_START(this.cfg.NODE_COUNT);
    this.msgClass = 'msg-neutral';

    // Generate nodes around the circle with cardinal bias
    this.generateNodes();

    // Compute the optimal path now so we can show Demonic Knowledge hints
    // during the active phase and re-use the length for scoring at completion.
    const optimal = shortestCycle(this.nodes);
    this.optimalPathLength = optimal.length;
    this.optimalPath       = optimal.order;
    this.buildHintLines();

    const costStr = this.costs.map(c => cur(c.id, c.amount, '-')).join(', ');
    this.log.log(`Well of Souls begun! (${costStr})`);
    this.cdr.markForCheck();
  }

  /** Player clicks on a node. */
  selectNode(idx: number): void {
    if (!this.ritualActive || this.ritualDone) return;
    if (!this.isNodeSelectable(idx)) return;

    const node = this.nodes[idx];

    // First click — set start
    if (this.selectedPath.length === 0) {
      this.startNodeIdx = idx;
      this.selectedPath.push(idx);
      node.selected = true;
      node.order = 1;
      this.lastMsg = MINIGAME_MSG.NECROMANCER.IDLE;
      this.msgClass = 'msg-neutral';
      this.cdr.markForCheck();
      return;
    }

    // Clicking the starting node again to close the loop
    if (idx === this.startNodeIdx && this.selectedPath.length === this.nodes.length) {
      // All nodes visited — close the circuit
      this.selectedPath.push(idx); // add start again to close
      this.completeRitual();
      return;
    }

    // Add to path
    this.selectedPath.push(idx);
    node.selected = true;
    node.order = this.selectedPath.length;
    this.cdr.markForCheck();
  }

  /**
   * Returns true if node `idx` is a legal next selection given the current path state.
   * Rules enforced:
   *  1. Node must not already be visited (unless it is the loop-closing start node).
   *  2. Node's type must differ from the currently-selected node's type.
   *  3. Selecting this node must not make it impossible to complete the path without
   *     ever placing two same-type nodes consecutively (lookahead).
   */
  isNodeSelectable(idx: number): boolean {
    if (!this.ritualActive || this.ritualDone) return false;

    const node = this.nodes[idx];

    // ── Case: closing the loop ────────────────────────────────────────────
    if (idx === this.startNodeIdx && this.selectedPath.length === this.nodes.length) {
      // The only edge left is last-selected → start. Types must differ.
      const lastType = this.nodes[this.selectedPath[this.selectedPath.length - 1]].type;
      return lastType !== node.type;
    }

    // ── Already visited ───────────────────────────────────────────────────
    if (node.selected) return false;

    // ── No path started: any node is a valid start ────────────────────────
    if (this.selectedPath.length === 0) {
      // Lookahead from this node as the start, checking full cycle feasibility
      const remaining = this.nodes.map((_, i) => i).filter(i => i !== idx);
      return this.canCompleteFromState(node.type, remaining, node.type);
    }

    // ── Standard mid-path selection ───────────────────────────────────────
    const currentType = this.nodes[this.selectedPath[this.selectedPath.length - 1]].type;

    // Rule 2: must differ from current node's type
    if (node.type === currentType) return false;

    // Rule 3: lookahead — make sure the remaining unvisited nodes can still be
    //         ordered without forcing consecutive same-type pairs
    const remaining = this.nodes
      .map((_, i) => i)
      .filter(i => i !== idx && !this.nodes[i].selected);
    const startType = this.nodes[this.startNodeIdx].type;
    return this.canCompleteFromState(node.type, remaining, startType);
  }

  /** Handle click on an already-complete or failed ritual to try again. */
  tryAgain(): void {
    if (this.canStart) {
      this.startRitual();
    } else {
      this.lastMsg = 'Insufficient resources to begin the ritual.';
      this.msgClass = 'msg-bad';
      this.cdr.markForCheck();
    }
  }

  // ── Private ────────────────────────────────

  /**
   * Picks a random subset of edges from the optimal cycle and stores them in
   * `hintLines` for display during the active ritual.
   *
   * Level 1 → 1 random edge hint.
   * Level 2 → 2 random edge hints (may or may not share a node).
   *
   * Must be called AFTER `optimalPath` has been populated by `startRitual()`.
   */
  private buildHintLines(): void {
    const level = this.upgrades.level('DEMONIC_KNOWLEDGE');
    if (level === 0 || this.optimalPath.length < 2) {
      this.hintLines = [];
      return;
    }

    // Build all cycle edges (close the loop with the first node appended)
    const path = [...this.optimalPath, this.optimalPath[0]];
    const allEdges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 1; i < path.length; i++) {
      const a = this.nodes[path[i - 1]].pos;
      const b = this.nodes[path[i]].pos;
      allEdges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }

    // Shuffle edges, then take the first `level` of them
    for (let i = allEdges.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allEdges[i], allEdges[j]] = [allEdges[j], allEdges[i]];
    }
    this.hintLines = allEdges.slice(0, level);
  }

  /**
   * Recursively checks whether the `remaining` node indices can be ordered
   * such that no two consecutive nodes share the same type, AND the last node
   * in the sequence can connect back to the start (different type from startType).
   *
   * @param currentType  Type of the most-recently-placed node.
   * @param remaining    Indices of unvisited nodes still to be placed.
   * @param startType    Type of the very first node (needed for the closing edge check).
   */
  private canCompleteFromState(currentType: string, remaining: number[], startType: string): boolean {
    if (remaining.length === 0) {
      // All nodes visited; closing edge must also differ in type
      return currentType !== startType;
    }
    for (let i = 0; i < remaining.length; i++) {
      const candidateType = this.nodes[remaining[i]].type;
      if (candidateType !== currentType) {
        const next = remaining.filter((_, j) => j !== i);
        if (this.canCompleteFromState(candidateType, next, startType)) return true;
      }
    }
    return false;
  }

  private generateNodes(): void {
    const r = this.cfg.CIRCLE_RADIUS;

    // ── Build 7-node type pool (2+2+2 base + 1 random extra) ──────────────
    const extraKeys = ['bone', 'brimstone', 'beast'] as const;
    const extraKey  = extraKeys[Math.floor(Math.random() * extraKeys.length)];
    const extra     = {
      id:     extraKey,
      symbol: CURRENCY_FLAVOR[extraKey].symbol,
      color:  CURRENCY_FLAVOR[extraKey].color,
    };
    const pool: { id: string; symbol: string; color: string }[] = [
      ...this.nodeTypes, // 6 base (2 bone, 2 brimstone, 2 beast)
      extra,             // 7th – same type as extraKey (now 3 of that type)
    ];

    // Shuffle the pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // ── Generate 7 angles: 4 cardinal-biased + 3 random ───────────────────
    const angles: number[] = [];
    for (const base of [-90, 0, 90, 180]) {
      angles.push(base + (Math.random() - 0.5) * 30);
    }
    for (let i = 4; i < 7; i++) {
      let angle = 0;
      let attempts = 0;
      do {
        angle = Math.random() * 360 - 180;
        attempts++;
      } while (attempts < 50 && angles.some(a => {
        let diff = Math.abs(angle - a) % 360;
        if (diff > 180) diff = 360 - diff;
        return diff < 30;
      }));
      angles.push(angle);
    }

    // Sort angles so that adjacent array indices ≡ adjacent positions on the
    // ring. This lets us check and enforce circular adjacency by simple index
    // arithmetic on the pool array.
    angles.sort((a, b) => a - b);

    // ── Ensure at least one adjacent pair (circular) shares the same type ──
    // This creates a visually obvious "forbidden connection" on the ring.
    this.forceAdjacentSamePair(pool);

    // ── Build nodes ────────────────────────────────────────────────────────
    this.nodes = angles.map((angleDeg, i) => {
      const rad = angleDeg * Math.PI / 180;
      return {
        pos:      { x: this.CX + r * Math.cos(rad), y: this.CY + r * Math.sin(rad) },
        type:     pool[i].id,
        symbol:   pool[i].symbol,
        color:    pool[i].color,
        selected: false,
        order:    -1,
      };
    });
  }

  /**
   * Guarantees that the circular arrangement described by `pool` contains at
   * least one pair of directly-neighbouring slots with the same `id`.
   *
   * If no such pair exists after shuffling, we locate the type that has the
   * most copies (the extra type, 3 copies) and swap one of its occurrences to
   * sit immediately after another, creating the required pair.
   *
   * The type *distribution* (counts) is unchanged by this swap, so valid
   * Hamiltonian cycles always continue to exist.
   */
  private forceAdjacentSamePair(pool: { id: string; symbol: string; color: string }[]): void {
    const n = pool.length;

    // Check if any circularly-adjacent pair already shares a type
    for (let i = 0; i < n; i++) {
      if (pool[i].id === pool[(i + 1) % n].id) return;
    }

    // No adjacent pair — find the type with the most entries
    const byType = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const arr = byType.get(pool[i].id) ?? [];
      arr.push(i);
      byType.set(pool[i].id, arr);
    }
    let targetIndices: number[] = [];
    for (const [, indices] of byType) {
      if (indices.length > targetIndices.length) targetIndices = indices;
    }

    // Move the second occurrence of that type to sit just after the first
    const src = targetIndices[1];
    const dst = (targetIndices[0] + 1) % n;
    [pool[src], pool[dst]] = [pool[dst], pool[src]];
  }

  private completeRitual(): void {
    this.ritualDone   = true;
    this.ritualActive = false;

    // Compute player's path length
    let playerLen = 0;
    for (let i = 1; i < this.selectedPath.length; i++) {
      playerLen += dist(
        this.nodes[this.selectedPath[i - 1]].pos,
        this.nodes[this.selectedPath[i]].pos,
      );
    }
    this.playerPathLength = playerLen;

    // optimalPathLength was computed at the start of the ritual in startRitual()

    // Efficiency: optimal / player (capped at 100%)
    if (playerLen <= 0) {
      this.efficiencyPct = 100;
    } else {
      this.efficiencyPct = Math.min(100, Math.round((this.optimalPathLength / playerLen) * 100));
    }

    // Base soul stone reward: 5% steps, floor at 50% (gives 0), ceiling at 100% (gives 10).
    // Formula: every 5 percentage-points above 50 earns 1 stone.
    //   91% → 8,  94% → 8,  95% → 9,  96% → 9,  100% → 10,  <50% → 0
    this.soulStonesAwarded = Math.max(0, Math.floor((this.efficiencyPct - 50) / 5));
    this.xpAwarded = this.cfg.XP_REWARD;

    // Perfect Transmutation bonus: +2 soul stones per upgrade level on a perfect run
    const transmutationBonus = this.efficiencyPct >= 100
      ? this.upgrades.level('PERFECT_TRANSMUTATION') * 2
      : 0;
    this.soulStonesAwarded += transmutationBonus;

    if (this.soulStonesAwarded > 0) {
      this.wallet.add('soul-stone', this.soulStonesAwarded);
      this.stats.trackCurrencyGain('soul-stone', this.soulStonesAwarded);
      if (!this.wallet.isCurrencyUnlocked('soul-stone')) {
        this.wallet.unlockCurrency('soul-stone');
        this.log.log('Soul Stones discovered! A new currency!', 'rare');
      }
    }
    this.wallet.add('xp', this.xpAwarded);
    this.stats.trackCurrencyGain('xp', this.xpAwarded);

    this.stats.trackNecromancerRitual(this.efficiencyPct);

    if (this.efficiencyPct >= 100) {
      this.lastMsg = MINIGAME_MSG.NECROMANCER.PERFECT;
      this.msgClass = 'msg-good';
      const bonusNote = transmutationBonus > 0 ? ` (+${transmutationBonus} transmutation)` : '';
      this.log.log(
        `Ritual complete — PERFECT!${bonusNote} (${cur('soul-stone', this.soulStonesAwarded)}, ${cur('xp', this.xpAwarded)})`,
        'success',
      );
    } else {
      this.lastMsg = MINIGAME_MSG.NECROMANCER.COMPLETE(this.efficiencyPct);
      this.msgClass = this.efficiencyPct >= 80 ? 'msg-good' : 'msg-neutral';
      this.log.log(
        `Ritual complete — ${this.efficiencyPct}% efficiency. (${cur('soul-stone', this.soulStonesAwarded)}, ${cur('xp', this.xpAwarded)})`,
        this.efficiencyPct >= 90 ? 'success' : 'default',
      );
    }
    this.cdr.markForCheck();
  }

  // ── SVG helpers ────────────────────────────

  /** Get the line segments that make up the player's drawn path. */
  get pathLines(): { x1: number; y1: number; x2: number; y2: number }[] {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 1; i < this.selectedPath.length; i++) {
      const a = this.nodes[this.selectedPath[i - 1]].pos;
      const b = this.nodes[this.selectedPath[i]].pos;
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return lines;
  }

  /**
   * Line segments for the optimal TSP path, shown as an overlay after the round ends
   * only when the player's path was not already perfect.
   */
  get optimalPathLines(): { x1: number; y1: number; x2: number; y2: number }[] {
    if (!this.ritualDone || this.efficiencyPct >= 100 || this.optimalPath.length < 2) return [];
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const path = [...this.optimalPath, this.optimalPath[0]]; // close the cycle
    for (let i = 1; i < path.length; i++) {
      const a = this.nodes[path[i - 1]].pos;
      const b = this.nodes[path[i]].pos;
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return lines;
  }

  /** Get the efficiency bar colour on a red–yellow–green gradient. */
  get efficiencyColor(): string {
    const t = this.efficiencyPct / 100; // 0 = worst, 1 = best
    // red(0%) → yellow(50%) → green(100%)
    const hue = Math.round(t * 120);
    return `hsl(${hue}, 85%, 50%)`;
  }

  /** Whether a node is the valid "close loop" target (the start node, when all others are visited). */
  isClosingTarget(idx: number): boolean {
    return this.ritualActive
      && !this.ritualDone
      && idx === this.startNodeIdx
      && this.selectedPath.length === this.nodes.length;
  }
}


