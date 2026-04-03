/**
 * ════════════════════════════════════════════════════════════
 *   GAME BALANCE CONFIG
 *   Central location for every tunable value in the game.
 *   Adjust numbers here — no logic files need to change.
 * ════════════════════════════════════════════════════════════
 */

import { KOBOLD_VARIANTS } from './flavor-text';

// ── Game Version ─────────────────────────────────────────────
export const VERSION = 'Alpha 1.2.0';

// ── Shared Upgrade Types ─────────────────────────────────────

export type UpgradeCategory = 'standard' | 'minigame' | 'relic';

/** Optional visibility gates — evaluated by the host component. */
export interface UpgradeGates {
  /** Hide until the Apothecary character is unlocked. */
  readonly requiresApothecary?: boolean;
  /** Hide until the Culinarian character is unlocked (i.e. spice is in play). */
  readonly requiresCulinarian?: boolean;
  /** Hide until the Thief character is unlocked. */
  readonly requiresThief?: boolean;
  /** Hide until the Bubbling Brew minigame upgrade has been purchased. */
  readonly requiresBubblingBrew?: boolean;
  /** Hide until the Potion Dilution minigame upgrade has been purchased. */
  readonly requiresPotionDilution?: boolean;
  /** Hide until the player has received at least one Relic. */
  readonly requiresRelic?: boolean;
  /** Hide until the player has obtained at least one Kobold Fang. */
  readonly requiresFang?: boolean;
  /** Hide until the player has obtained at least one Dossier. */
  readonly requiresDossier?: boolean;
  /** Minimum XP required before the card is shown. */
  readonly xpMin?: number;
  /** Hide until Sharper Swords has at least this many levels purchased. */
  readonly requiresSharperSwordsMin?: number;
}

export interface CostDef {
  readonly currency: string;
  readonly base:     number;
  readonly scale:    number;
  /** If set, this cost only applies when the upgrade's current level is ≥ fromLevel. */
  readonly fromLevel?:  number;
  /** If set, this cost only applies when the upgrade's current level is < untilLevel. */
  readonly untilLevel?: number;
}

/** Complete definition for a single upgrade — balance + structure in one place. */
export interface UpgradeDef {
  readonly id:          string;
  readonly characterId: string;
  readonly category:    UpgradeCategory;
  readonly max:         number;
  readonly costs:       readonly CostDef[];
  readonly gates?:      UpgradeGates;
}

// ── XP Unlock Thresholds ─────────────────────────────────────
export const XP_THRESHOLDS = {
  /** XP required before the Ranger unlock offer appears */
  RANGER_UNLOCK:     100,
  /** XP required before the Apothecary unlock offer appears */
  APOTHECARY_UNLOCK: 1000,
  /** XP required before the First Jack purchase appears */
  JACKS_UNLOCK: 1500,
  /** XP required to unlock all character minigame screens */
  MINIGAME_UNLOCK:   4000,
  /** XP required before the Culinarian unlock offer appears */
  CULINARIAN_UNLOCK: 18000,
  /** XP required before the Thief unlock offer appears */
  THIEF_UNLOCK:      70000,
} as const;

// ── Jack of All Trades ────────────────────────────────────────
/**
 * Jack hire pricing.
 * Every Jack costs scaled gold. Starting from the 2nd Jack, the hire
 * also requires an unscaled flat amount of ONE additional resource —
 * the next entry in JACK_RESOURCE_PROGRESSION (not all previous ones).
 */

/** Gold cost that scales with each Jack owned. */
export const JACK_GOLD_COST = { base: 1500, scale: 1.5 } as const;

/**
 * Ordered list of secondary resources introduced with each successive Jack.
 * Jack 1 = gold only. Jack 2 = gold + first entry. Jack 3 = gold + second entry, etc.
 * Re-order, adjust, or extend this array to change when each resource appears.
 */
export const JACK_RESOURCE_PROGRESSION: readonly { currency: string; base: number }[] = [
  { currency: 'herb',                 base: 200  },
  { currency: 'beast',                base: 200  },
  { currency: 'potion',               base: 50   },
  { currency: 'pixie-dust',           base: 25   },
  { currency: 'kobold-ear',           base: 50   },
  { currency: 'concentrated-potion',  base: 10   },
  { currency: 'kobold-tongue',        base: 15   },
  { currency: 'spice',                base: 200  },
  { currency: 'hearty-meal',          base: 5    },
  { currency: 'kobold-hair',          base: 10   },
  { currency: 'dossier',              base: 150  },
  { currency: 'treasure',             base: 150  },
  { currency: 'kobold-fang',          base: 10   },
  { currency: 'relic',                base: 1    },

];

// ── Character Unlock Costs ────────────────────────────────────
export const UNLOCK_COSTS = {
  RANGER_GOLD:       250,

  APOTHECARY_GOLD:   1500,
  APOTHECARY_HERBS:  250,

  CULINARIAN_GOLD:   15_000,
  CULINARIAN_BEAST:   1_500,
  CULINARIAN_HERBS:   1_500,

  THIEF_GOLD:        50_000,
  THIEF_SPICE:       10_000,
  THIEF_KOBOLD_HAIR: 100,

  /** Minigame system unlock — available once XP >= MINIGAME_UNLOCK threshold */
  MINIGAME_GOLD:    10000,
  MINIGAME_POTIONS: 100,
  MINIGAME_BEAST:   100,
} as const;

// ── Upgrade Definitions ──────────────────────────────────────
// Single source of truth for every upgrade in the game.
// Adding a new upgrade? Just append an entry here and add
// a matching flavor entry — no other config files need to change.
export const UPGRADE_DEFS: readonly UpgradeDef[] = [
  // ── Fighter — standard ───────────────────────────────────────
  { id: 'BETTER_BOUNTIES',      characterId: 'fighter', category: 'standard', max: 999,
    costs: [{ currency: 'gold', base: 10, scale: 1.35 }] },
  { id: 'CONTRACTED_HIRELINGS', characterId: 'fighter', category: 'standard', max: 999,
    costs: [{ currency: 'gold', base: 25, scale: 1.15 }] },
  { id: 'INSIGHTFUL_CONTRACTS', characterId: 'fighter', category: 'standard', max: 999,
    gates: { xpMin: 500 },
    costs: [{ currency: 'gold', base: 400, scale: 1.4 }] },
  { id: 'HIRELINGS_HIRELINGS', characterId: 'fighter', category: 'standard', max: 999,
    gates: { requiresCulinarian: true },
    costs: [
      { currency: 'gold',  base: 1000, scale: 1.5 },
      { currency: 'spice', base: 1000,    scale: 1.5 },
    ] },

  // ── Fighter — minigame ───────────────────────────────────────
  { id: 'SHARPER_SWORDS',   characterId: 'fighter', category: 'minigame', max: 999,
    costs: [{ currency: 'gold', base: 50, scale: 1.3 }] },
  { id: 'POTION_CHUGGING',  characterId: 'fighter', category: 'minigame', max: 999,
    gates: { requiresApothecary: true },
    costs: [
      { currency: 'concentrated-potion', base: 2, scale: 1.5 },
      { currency: 'beast',               base: 50, scale: 1.3 },
    ] },
  { id: 'SHORT_REST', characterId: 'fighter', category: 'minigame', max: 1,
    gates: { requiresCulinarian: true },
    costs: [
      { currency: 'gold',        base: 75_000, scale: 1.0 },
      { currency: 'kobold-ear',  base: 250,    scale: 1.0 },
      { currency: 'hearty-meal', base: 30,     scale: 1.0 },
    ] },
  // Dynamic max: (SHARPER_SWORDS level + 1) - 5 = SHARPER_SWORDS - 4.
  // The actual max is enforced via UpgradeService.setMaxOverride in app.component.
  { id: 'SLOW_BLADE', characterId: 'fighter', category: 'minigame', max: 999,
    gates: { requiresCulinarian: true, requiresSharperSwordsMin: 10 },
    costs: [
      { currency: 'gold',  base: 5_000, scale: 1.4 },
      { currency: 'spice', base: 500,   scale: 1.4 },
    ] },
  { id: 'STRONGER_KOBOLDS', characterId: 'fighter', category: 'minigame', max: KOBOLD_VARIANTS.length - 1,
    gates: { xpMin: 3000 },
    costs: [
      { currency: 'kobold-ear',    base: 66, scale: 2.0 },                                        // always
      { currency: 'beast',         base: 500, scale: 1.0, fromLevel: 0, untilLevel: 1 },           // tier 1 only
      { currency: 'kobold-tongue', base: 66, scale: 1.0, fromLevel: 1, untilLevel: 2 },           // tier 2 only
      { currency: 'kobold-hair',   base: 66, scale: 1.0, fromLevel: 2, untilLevel: 3 },           // tier 3 only
    ] },
  { id: 'FIRST_STRIKE', characterId: 'fighter', category: 'minigame', max: 1,
    gates: { requiresFang: true },
    costs: [
      { currency: 'dossier',     base: 1500, scale: 1.0 },
      { currency: 'kobold-fang', base: 33,   scale: 1.0 },
    ] },

  // ── Ranger — standard ────────────────────────────────────────
  { id: 'MORE_HERBS',      characterId: 'ranger', category: 'standard', max: 100,
    costs: [{ currency: 'gold', base: 15, scale: 1.2 }] },
  { id: 'BETTER_TRACKING', characterId: 'ranger', category: 'standard', max: 15,
    costs: [{ currency: 'gold', base: 30, scale: 1.3 }] },
  { id: 'BAITED_TRAPS',    characterId: 'ranger', category: 'standard', max: 999,
    costs: [
      { currency: 'gold',  base: 200, scale: 1.4 },
      { currency: 'beast', base: 50,  scale: 1.5 },
    ] },
  { id: 'HOVEL_GARDEN',    characterId: 'ranger', category: 'standard', max: 999,
    costs: [
      { currency: 'gold', base: 150, scale: 1.4 },
      { currency: 'herb', base: 50,  scale: 1.5 },
    ] },
  { id: 'BIGGER_GAME',     characterId: 'ranger', category: 'standard', max: 999,    // each level +1 max Raw Beast Meat from hero button
    costs: [{ currency: 'gold', base: 480, scale: 1.75 }] },
  { id: 'POTION_CATS_EYE', characterId: 'ranger', category: 'standard', max: 100,    // 100 levels × +1% = 100% chance to roll both herb and beast
    gates: { requiresApothecary: true },
    costs: [
      { currency: 'concentrated-potion', base: 2,  scale: 1.3 },
      { currency: 'pixie-dust',          base: 2, scale: 1.3 },
    ] },

  // ── Ranger — minigame ────────────────────────────────────────
  { id: 'BOUNTIFUL_LANDS', characterId: 'ranger', category: 'minigame', max: 4,      // each level adds +1 guaranteed prize node
    costs: [
      { currency: 'kobold-ear',    base: 50, scale: 1.0, fromLevel: 0, untilLevel: 1 },  // level 1 only
      { currency: 'kobold-tongue', base: 50, scale: 1.0, fromLevel: 1, untilLevel: 2 },  // level 2 only
      { currency: 'kobold-hair',   base: 50, scale: 1.0, fromLevel: 2, untilLevel: 3 },  // level 3 only
      { currency: 'kobold-fang',   base: 50, scale: 1.0, fromLevel: 3 },
    ] },
  { id: 'ABUNDANT_LANDS',  characterId: 'ranger', category: 'minigame', max: 1,      // binary unlock
    costs: [{ currency: 'pixie-dust', base: 5, scale: 1.0 }] },
  { id: 'FAIRY_HOSTAGE',   characterId: 'ranger', category: 'minigame', max: 1,      // binary unlock, requires thief
    gates: { requiresThief: true },
    costs: [
      { currency: 'pixie-dust', base: 25,  scale: 1.0 },
      { currency: 'spice',      base: 600, scale: 1.0 },
      { currency: 'dossier',    base: 600, scale: 1.0 },
    ] },

  // ── Apothecary — standard ────────────────────────────────────
  { id: 'POTION_TITRATION', characterId: 'apothecary', category: 'standard', max: 400,  // 400 × +1% save-chance
    costs: [{ currency: 'gold', base: 20, scale: 1.2 }] },
  { id: 'POTION_MARKETING', characterId: 'apothecary', category: 'standard', max: 999,
    costs: [{ currency: 'gold', base: 50, scale: 1.07 }] },
  { id: 'FERMENTATION_VATS', characterId: 'apothecary', category: 'standard', max: 999,
    costs: [
      { currency: 'gold',   base: 500,  scale: 1.4 },
      { currency: 'herb',   base: 100,  scale: 1.5 },
      { currency: 'potion', base: 25,   scale: 1.4 },
    ] },

  // ── Culinarian — standard ────────────────────────────────────
  { id: 'WHOLESALE_SPICES', characterId: 'culinarian', category: 'standard', max: 20, // +1 spice/click, +24g cost/click per level
    costs: [{ currency: 'gold', base: 200, scale: 1.3 }] },
  { id: 'POTION_GLIBNESS',  characterId: 'culinarian', category: 'standard', max: 85,   // 85 × -1% spice purchase cost
    costs: [
      { currency: 'concentrated-potion', base: 2,  scale: 1.5 },
      { currency: 'kobold-tongue',       base: 5,  scale: 1.5 },
    ] },

  // ── Culinarian — minigame ────────────────────────────────────
  { id: 'WASTE_NOT', characterId: 'culinarian', category: 'minigame', max: 5,
    costs: [
      { currency: 'spice',       base: 200, scale: 1.5 },
      { currency: 'hearty-meal', base: 5,  scale: 1.4 },
    ] },
  { id: 'LARGER_COOKBOOKS', characterId: 'culinarian', category: 'minigame', max: 1,
    gates: { requiresThief: true },
    costs: [
      { currency: 'gold',        base: 100_000, scale: 1.0 },
      { currency: 'hearty-meal', base: 15,      scale: 1.0 },
      { currency: 'dossier',     base: 2_500,   scale: 1.0 },
    ] },

  // ── Thief — standard ─────────────────────────────────────────
  { id: 'METICULOUS_PLANNING', characterId: 'thief', category: 'standard', max: 50,
    costs: [{ currency: 'gold', base: 1000,       scale: 1.12 },
            { currency: 'dossier', base: 5,     scale: 1.08 },] },
  { id: 'PLENTIFUL_PLUNDERING', characterId: 'thief', category: 'standard', max: 999,
    costs: [{ currency: 'gold',    base: 1000, scale: 1.15 },
            { currency: 'dossier', base: 10,  scale: 1.10 }] },
  { id: 'POTION_OF_STICKY_FINGERS', characterId: 'thief', category: 'standard', max: 25,
    costs: [
      { currency: 'concentrated-potion', base: 2, scale: 1.3 },
      { currency: 'kobold-hair',         base: 5, scale: 1.2 },
    ] },

  // ── Thief — minigame ─────────────────────────────────────────
  { id: 'VANISHING_POWDER', characterId: 'thief', category: 'minigame', max: 5,
    costs: [
      { currency: 'gold',       base: 85000, scale: 1.3  },
      { currency: 'pixie-dust', base: 100,  scale: 1.3  },
    ] },
  { id: 'POTION_CATS_EARS', characterId: 'thief', category: 'minigame', max: 20,
    costs: [
      { currency: 'concentrated-potion', base: 2,  scale: 1.3  },
      { currency: 'kobold-ear',          base: 25, scale: 1.3 },
    ] },
  { id: 'BAG_OF_HOLDING', characterId: 'thief', category: 'minigame', max: 50,
    costs: [
      { currency: 'gold',     base: 20_000, scale: 1.2 },
      { currency: 'treasure', base: 20,     scale: 1.25 },
    ] },
  { id: 'RELIC_HUNTER', characterId: 'thief', category: 'minigame', max: 4,
    gates: { requiresRelic: true },
    costs: [
      { currency: 'hearty-meal', base: 35,  scale: 2.0 },
      { currency: 'dossier',     base: 500, scale: 2.0 },
    ] },
  { id: 'LOCKED_IN', characterId: 'thief', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',     base: 15_000, scale: 1.0 },
      { currency: 'dossier',  base: 250,   scale: 1.0 },
      { currency: 'treasure', base: 50,    scale: 1.0 },
    ] },

  // ── Apothecary — minigame ────────────────────────────────────
  { id: 'BUBBLING_BREW', characterId: 'apothecary', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',       base: 9000, scale: 1.0 },
      { currency: 'kobold-ear', base: 100,  scale: 1.0 },
    ] },
  { id: 'BIGGER_BUBBLES', characterId: 'apothecary', category: 'minigame', max: 6,
    gates: { requiresBubblingBrew: true },
    costs: [
      { currency: 'concentrated-potion', base: 5, scale: 1.2 },
      { currency: 'kobold-ear',          base: 30, scale: 1.2 },
    ] },
  { id: 'POTION_DILUTION', characterId: 'apothecary', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',                base: 10_000, scale: 1.0 },
      { currency: 'potion',              base: 1_000,  scale: 1.0 },
      { currency: 'concentrated-potion', base: 10,    scale: 1.0 },
    ] },
  { id: 'SERIAL_DILUTION', characterId: 'apothecary', category: 'minigame', max: 30,
    gates: { requiresPotionDilution: true },
    costs: [
      { currency: 'gold',                base: 5_000, scale: 1.3 },
      { currency: 'concentrated-potion', base: 2,    scale: 1.3 },
      { currency: 'kobold-hair',         base: 5,     scale: 1.3 },
    ] },
  { id: 'PERFECT_POTIONS', characterId: 'apothecary', category: 'minigame', max: 100,
    gates: { requiresDossier: true },
    costs: [
      { currency: 'gold',    base: 500, scale: 1.4 },
      { currency: 'dossier', base: 50,  scale: 1.1 },
    ] },

  // ── Relic upgrades (one per character) ──────────────────────────
  { id: 'RELIC_FIGHTER',    characterId: 'fighter',    category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic', base: 1, scale: 1.0 }] },
  { id: 'RELIC_RANGER',     characterId: 'ranger',     category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic', base: 1, scale: 1.0 }] },
  { id: 'RELIC_APOTHECARY', characterId: 'apothecary', category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic', base: 1, scale: 1.0 }] },
  { id: 'RELIC_CULINARIAN', characterId: 'culinarian', category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic', base: 1, scale: 1.0 }] },
  { id: 'RELIC_THIEF',      characterId: 'thief',      category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic', base: 1, scale: 1.0 }] },
];

// ── Resource Yields ───────────────────────────────────────────
export const YIELDS = {
  /** Gold awarded per Fighter adventure click (base, before upgrades) */
  FIGHTER_GOLD_PER_CLICK:    1,

  /** Herbs awarded per successful Ranger herb forage (base, before More Herbs upgrades) */
  RANGER_BASE_HERBS:         1,
  /** Base % chance the Ranger successfully brings down a beast */
  RANGER_BASE_BEAST_CHANCE:  50,
  /** Hard cap on beast-find chance regardless of Better Tracking level */
  RANGER_BEAST_CHANCE_CAP:   95,

  /** Herbs consumed per Apothecary brew action */
  APOTHECARY_BREW_HERB_COST: 5,

  /** Gold spent per Culinarian hero-button press to produce 1 Spice */
  CULINARIAN_SPICE_COST: 25,

  /** Base % chance the Thief successfully breaks & enters on a hero-button click */
  THIEF_BASE_SUCCESS_CHANCE: 50,
  /** Duration in ms the Thief is stunned on a failed break-in */
  THIEF_STUN_DURATION_MS: 3_000,

} as const;

// ── Fighter Minigame ──────────────────────────────────────────
export const FIGHTER_MG = {
  /** Fighter's starting and maximum HP */
  MAX_HP:            100,
  /** Flat damage reduction subtracted from every enemy hit */
  DEFENSE:           0,
  /** HP restored when the Fighter consumes one Potion */
  POTION_HEAL:       10,
  /** Short Rest Potion Healing Percent **/
  BASE_SR_POTION_HEAL: .5,

  // Kobold — the current (and only) enemy
  KOBOLD_HP:         20,
  KOBOLD_GOLD_MIN:   5,
  KOBOLD_GOLD_MAX:   10,
  KOBOLD_XP_REWARD:  3,
  KOBOLD_EAR_REWARD: 1,

  /** Enemy damage roll: random value from 1 to ENEMY_DMG_MAX, then minus DEFENSE */
  ENEMY_DMG_MAX:     8,
  /** Milliseconds between a kill and the next enemy spawning */
  SPAWN_DELAY_MS:    900,
  /** Base long-rest lockout in ms after the Fighter is defeated (future upgrades reduce this) */
  RECOVERY_TIME_MS:  60_000,

  // ── Kobold level scaling (applied per level above 1) ──────
  /** Extra HP per kobold level above 1 */
  KOBOLD_HP_PER_LEVEL:       20,
  /** Extra enemy max damage per kobold level above 1 */
  KOBOLD_DMG_PER_LEVEL:       2,
  /** Extra gold min reward per kobold level above 1 */
  KOBOLD_GOLD_MIN_PER_LEVEL:  3,
  /** Extra gold max reward per kobold level above 1 */
  KOBOLD_GOLD_MAX_PER_LEVEL:  9,
  /** Extra XP reward per kobold level above 1 */
  KOBOLD_XP_PER_LEVEL:        2,
  /** Extra Kobold Ear reward per kobold level above 1 */
  KOBOLD_EAR_PER_LEVEL:       0,
} as const;

// ── Apothecary Minigame ───────────────────────────────────────
export const APOTH_MG = {
  /** On-beat clicks required to complete a Concentrated Potion */
  MAX_QUALITY:  10,
  /** Herbs consumed to begin brewing a new potion */
  HERB_COST:    50,
  /** Potion bases consumed to begin brewing a new concentrated potion */
  POTION_COST:  1,
  /** Cursor speed: units per millisecond (100 units = full bar width) */
  BAR_SPEED:    0.05,
  /** Left edge of the on-beat target zone (percentage 0–100) */
  ZONE_MIN:     35,
  /** Right edge of the on-beat target zone (percentage 0–100) */
  ZONE_MAX:     65,
  /** Left edge of the Bubbling Brew inner zone (must be inside ZONE_MIN/MAX) */
  INNER_ZONE_MIN: 47,
  /** Right edge of the Bubbling Brew inner zone (must be inside ZONE_MIN/MAX) */
  INNER_ZONE_MAX: 53,
  /** How many percentage points each Bigger Bubbles level expands the inner zone on each side */
  BIGGER_BUBBLES_ZONE_EXPANSION_PER_LEVEL: 2,
  /** The base success chance of getting a successful potion dilution, rolled independently */
  DILUTION_BASE_CHANCE: 70,
  /** How many percentage points each miss deducts from the dilution success chance (when dilution is active) */
  DILUTION_MISS_PENALTY: 10,
} as const;

// ── Ranger Minigame ───────────────────────────────────────────
export const RANGER_MG = {
  /** Number of boxes the player may reveal per scouting round */
  PICKS:        3,
  /** Total cells in the grid */
  GRID_SIZE:    9,
  /** How many of those cells are blank (no reward) */
  BLANK_CELLS:  5,
  /** Raw Beast Meat cost to begin a scouting round */
  SCOUT_COST:   18,

  /** Probability a prize cell contains Pixie Dust (0–1) */
  PIXIE_CHANCE: 0.10,
  /** Probability a prize cell contains a Herb (0–1; evaluated after Pixie roll) */
  HERB_CHANCE:  0.35,
  // Remaining probability → Raw Beast Meat

  /** XP awarded when the player uncovers a Raw Beast Meat cell */
  MEAT_XP:  3,
  /** XP awarded when the player uncovers a Herb cell */
  HERB_XP:  3,
  /** XP awarded when the player uncovers a Pixie Dust cell */
  PIXIE_XP: 9,
} as const;

// ── Thief Minigame ────────────────────────────────────────────
export const THIEF_MG = {
  /** Dossier cost to start a heist. */
  DOSSIER_COST: 50,

  // ── Dial ────────────────────────────────────────────────────
  /** Degrees per second the pointer rotates (clockwise). */
  DIAL_SPEED: 120,
  /** Size of the sweet spot in degrees (centered on a random angle). */
  SWEET_SPOT_SIZE: 25,

  // ── Detection ───────────────────────────────────────────────
  /** Maximum detection level (progress bar fills to this). */
  MAX_DETECTION: 5,
  /** Detection added per missed click. */
  DETECTION_PER_MISS: 1,

  // ── Rewards ─────────────────────────────────────────────────
  /** Base treasure awarded on success. */
  TREASURE_BASE: 2,
  /** Bonus treasure per unused detection point. */
  TREASURE_PER_UNUSED: 1,
  /** Base gold awarded on success. */
  GOLD_BASE: 50,
  /** Bonus gold per unused detection point. */
  GOLD_PER_UNUSED: 25,
  /** Percent chance of receiving a relic on a successful heist (0–100). */
  RELIC_CHANCE: 1,
  /** Number of relics awarded when the relic roll succeeds. */
  RELIC_AMOUNT: 1,
  /** XP awarded on a successful heist. */
  XP_REWARD: 10,

  // ── Upgrade per-level effects ────────────────────────────────
  /** Extra max detection per Vanishing Powder level */
  VANISHING_POWDER_DETECT_PER_LEVEL: 1,
  /** Degrees added to the sweet spot per Potion of Cat's Ears level */
  CATS_EARS_SPOT_PER_LEVEL: 3,
  /** Extra base gold AND treasure yield per Bag of Holding level */
  BAG_OF_HOLDING_GOLD_YIELD_PER_LEVEL: 10,
  BAG_OF_HOLDING_TREASURE_YIELD_PER_LEVEL: 1,
  /** Extra relic drop % per Relic Hunter level */
  RELIC_HUNTER_CHANCE_PER_LEVEL: 1,
} as const;

// ── Culinarian Minigame ──────────────────────────────────────
export const CULINARIAN_MG = {
  /** The pool of ingredient currency IDs the solution is drawn from. */
  INGREDIENTS: ['herb', 'beast', 'kobold-tongue', 'spice'] as readonly string[],
  /** Number of ingredient slots in the solution. */
  SOLUTION_LENGTH: 4,
  /** Base number of guesses allowed per round. */
  MAX_GUESSES: 4,
  /** Amount of each ingredient consumed to begin a new round. */
  INGREDIENT_COST: 4,
  /** Hearty Meals awarded on a correct guess. */
  MEAL_REWARD: 1,
} as const;
