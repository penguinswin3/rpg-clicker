/**
 * ════════════════════════════════════════════════════════════
 *   GAME BALANCE CONFIG
 *   Central location for every tunable value in the game.
 *   Adjust numbers here — no logic files need to change.
 * ════════════════════════════════════════════════════════════
 */

import { KOBOLD_VARIANTS } from './flavor-text';

// ── Game Version ─────────────────────────────────────────────
export const VERSION = 'Alpha 1.2.2';

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
  /** Hide until the Artisan character is unlocked. */
  readonly requiresArtisan?: boolean;
  /** Hide until the Necromancer character is unlocked. */
  readonly requiresNecromancer?: boolean;
  /** Hide until the Bubbling Brew minigame upgrade has been purchased. */
  readonly requiresBubblingBrew?: boolean;
  /** Hide until the Potion Dilution minigame upgrade has been purchased. */
  readonly requiresPotionDilution?: boolean;
  /** Hide until the Locked In minigame upgrade has been purchased. */
  readonly requiresLockedIn?: boolean;
  /** Hide until the Synaptical Potions minigame upgrade has been purchased. */
  readonly requiresSynapticalPotions?: boolean;
  /** Hide until the Double Dip minigame upgrade has been purchased. */
  readonly requiresDoubleDip?: boolean;
  /** Hide until the Find Familiar minigame upgrade has been purchased. */
  readonly requiresFindFamiliar?: boolean;
  /** Hide until the player has received at least one Relic. */
  readonly requiresRelic?: boolean;
  /** Hide until the player has obtained at least one Kobold Fang. */
  readonly requiresFang?: boolean;
  /** Hide until the player has obtained at least one Kobold Feather. */
  readonly requiresFeather?: boolean;
  /** Hide until the player has obtained at least one Dossier. */
  readonly requiresDossier?: boolean;
  /** Minimum XP required before the card is shown. */
  readonly xpMin?: number;
  /** Hide until Sharper Swords has at least this many levels purchased. */
  readonly requiresSharperSwordsMin?: number;
  /** Hide until the Treasure Chest upgrade has at least this many levels purchased. */
  readonly requiresTreasureChestMin?: number;
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
  /** When explicitly set to false, the upgrade is hidden from all UI lists. Omit or set true to show normally. */
  readonly enabled?:    boolean;
}

// ── Global Purchase System ────────────────────────────────────
//
// Single source of truth for every one-time or repeatable global purchase:
//   • 'jack'             — Jack of All Trades hire (repeatable, costs scale)
//   • 'character-unlock' — Character unlock (one-time flat cost)
//   • 'minigame-unlock'  — Sidequest system unlock (one-time flat cost)
//
// Adding a new character? Add an 'UNLOCK_<ID>' entry here and update
// character.service.ts — no other config files need to change.

export type GlobalPurchaseKind = 'jack' | 'character-unlock' | 'minigame-unlock' | 'jackdup-unlock';

export interface GlobalCostDef {
  readonly currency:    string;
  readonly base:        number;
  /**
   * Multiplicative scale applied per purchase count (jacksOwned for jacks).
   * Omit or set to 1.0 for a flat cost.
   */
  readonly scale?:      number;
  /** Only include this cost when the purchase count is >= fromCount (inclusive). */
  readonly fromCount?:  number;
  /** Only include this cost when the purchase count is <  untilCount (exclusive). */
  readonly untilCount?: number;
}

export interface GlobalPurchaseDef {
  readonly id:     string;
  readonly kind:   GlobalPurchaseKind;
  /** Minimum all-time XP before this entry becomes visible. Omit = no XP gate. */
  readonly xpMin?: number;
  readonly costs:  readonly GlobalCostDef[];
}

export const GLOBAL_PURCHASE_DEFS: readonly GlobalPurchaseDef[] = [

  // ── Jack of All Trades ────────────────────────────────────────
  // Gold scales with each Jack owned. Every Jack beyond the first adds ONE
  // secondary resource (fromCount/untilCount selects exactly one level each).
  {
    id: 'JACK', kind: 'jack', xpMin: 1000,
    costs: [
      { currency: 'gold',               base: 1500, scale: 1.5 },              // always (scales)
      { currency: 'herb',               base: 200,  fromCount: 1,  untilCount: 2  },  // Jack 2
      { currency: 'beast',              base: 200,  fromCount: 2,  untilCount: 3  },  // Jack 3
      { currency: 'potion',             base: 50,   fromCount: 3,  untilCount: 4  },  // Jack 4
      { currency: 'kobold-ear',         base: 25,   fromCount: 4,  untilCount: 5  },  // Jack 5
      { currency: 'pixie-dust',         base: 25,   fromCount: 5,  untilCount: 6  },  // Jack 6
      { currency: 'concentrated-potion',base: 10,   fromCount: 6,  untilCount: 7  },  // Jack 7
      { currency: 'kobold-tongue',      base: 25,   fromCount: 7,  untilCount: 8  },  // Jack 8
      { currency: 'spice',              base: 200,  fromCount: 8,  untilCount: 9  },  // Jack 9
      { currency: 'hearty-meal',        base: 5,    fromCount: 9,  untilCount: 10 },  // Jack 10
      { currency: 'kobold-hair',        base: 25,   fromCount: 10, untilCount: 11 },  // Jack 11
      { currency: 'dossier',            base: 150,  fromCount: 11, untilCount: 12 },  // Jack 12
      { currency: 'kobold-fang',        base: 25,   fromCount: 12, untilCount: 13 },  // Jack 13
      { currency: 'treasure',           base: 150,  fromCount: 13, untilCount: 14 },  // Jack 14
      { currency: 'relic',              base: 1,    fromCount: 14, untilCount: 15 },  // Jack 15
      { currency: 'precious-metal',     base: 100,  fromCount: 15, untilCount: 16 },  // Jack 16
      { currency: 'gemstone',           base: 50,   fromCount: 16, untilCount: 17 },  // Jack 17
      { currency: 'kobold-brain',       base: 25,   fromCount: 17, untilCount: 18 },  // Jack 18
      { currency: 'jewelry',            base: 10,   fromCount: 18, untilCount: 19 },  // Jack 19
      { currency: 'synaptical-potion',  base: 25,   fromCount: 19, untilCount: 20 },  // Jack 20
      { currency: 'kobold-feather',     base: 25,   fromCount: 20, untilCount: 21 },  // Jack 21
      { currency: 'bone',               base: 1000,   fromCount: 21, untilCount: 22 },  // Jack 22
      { currency: 'brimstone',          base: 1000,   fromCount: 22, untilCount: 23 },  // Jack 23
      { currency: 'xp',                 base: 150000,   fromCount: 23, untilCount: 24 },  // Jack 24
      { currency: 'soul-stone',         base: 250,   fromCount: 24, untilCount: 25 },  // Jack 25
    ],
  },

  // ── Character unlocks ─────────────────────────────────────────
  {
    id: 'UNLOCK_RANGER', kind: 'character-unlock', xpMin: 100,
    costs: [
      { currency: 'gold', base: 250 },
    ],
  },
  {
    id: 'UNLOCK_APOTHECARY', kind: 'character-unlock', xpMin: 2000,
    costs: [
      { currency: 'gold', base: 1_500 },
      { currency: 'herb', base: 250   },
    ],
  },
  {
    id: 'UNLOCK_CULINARIAN', kind: 'character-unlock', xpMin: 22_000,
    costs: [
      { currency: 'gold',  base: 15_000 },
      { currency: 'beast', base: 1_500  },
      { currency: 'herb',  base: 1_500  },
    ],
  },
  {
    id: 'UNLOCK_THIEF', kind: 'character-unlock', xpMin: 70_000,
    costs: [
      { currency: 'gold',                base: 50_000 },
      { currency: 'spice',               base: 10_000 },
      { currency: 'concentrated-potion', base: 50    },
    ],
  },
  {
    id: 'UNLOCK_ARTISAN', kind: 'character-unlock', xpMin: 250_000,
    costs: [
      { currency: 'gold',     base: 100_000 },
      { currency: 'dossier',  base: 10_000  },
      { currency: 'treasure', base: 1_000   },
    ],
  },
  {
    id: 'UNLOCK_NECROMANCER', kind: 'character-unlock', xpMin: 750_000,
    costs: [
      { currency: 'gold',           base: 400_000 },
      { currency: 'precious-metal', base: 2000     },
      { currency: 'gemstone',       base: 2000     },
    ],
  },

  // ── Global unlock ────────────────────────────────────────────
  {
    id: 'UNLOCK_MINIGAME', kind: 'minigame-unlock', xpMin: 4_000,
    costs: [
      { currency: 'gold',   base: 10_000 },
      { currency: 'potion', base: 100    },
      { currency: 'beast',  base: 100    },
    ],
  },

  // ── Jack'd Up (one-time upgrade) ──────────────────────────────
  {
    id: 'JACKD_UP', kind: 'jackdup-unlock', xpMin: 50_000,
    costs: [
      { currency: 'gold',  base: 20_000 },
      { currency: 'spice', base: 2_000  },
    ],
  },

] as const;

/**
 * Returns the active costs for a GlobalPurchaseDef at a given purchase count.
 *   • For jacks:            count = jacksOwned
 *   • For one-time unlocks: count = 0
 * Costs filtered by fromCount/untilCount; scale applied to the base amount.
 */
export function getActiveCosts(def: GlobalPurchaseDef, count: number): { currency: string; amount: number }[] {
  return (def.costs as readonly GlobalCostDef[])
    .filter(c =>
      (c.fromCount  === undefined || count >= c.fromCount)  &&
      (c.untilCount === undefined || count <  c.untilCount)
    )
    .map(c => ({
      currency: c.currency,
      amount:   Math.round(c.base * Math.pow(c.scale ?? 1, count)),
    }));
}

/** Look up a GlobalPurchaseDef by id. Returns undefined if not found. */
export function getGlobalDef(id: string): GlobalPurchaseDef | undefined {
  return GLOBAL_PURCHASE_DEFS.find(d => d.id === id);
}

// ── XP Unlock Thresholds ─────────────────────────────────────
// Derived from GLOBAL_PURCHASE_DEFS — edit xpMin there, not here.
// Keys are kept stable for backward-compatible save-game milestone tracking.
export const XP_THRESHOLDS = {
  RANGER_UNLOCK:     getGlobalDef('UNLOCK_RANGER')!.xpMin!,
  JACKS_UNLOCK:      getGlobalDef('JACK')!.xpMin!,
  APOTHECARY_UNLOCK: getGlobalDef('UNLOCK_APOTHECARY')!.xpMin!,
  MINIGAME_UNLOCK:   getGlobalDef('UNLOCK_MINIGAME')!.xpMin!,
  CULINARIAN_UNLOCK: getGlobalDef('UNLOCK_CULINARIAN')!.xpMin!,
  THIEF_UNLOCK:      getGlobalDef('UNLOCK_THIEF')!.xpMin!,
  ARTISAN_UNLOCK:    getGlobalDef('UNLOCK_ARTISAN')!.xpMin!,
  NECROMANCER_UNLOCK:getGlobalDef('UNLOCK_NECROMANCER')!.xpMin!,
  JACKD_UP_UNLOCK:   getGlobalDef('JACKD_UP')!.xpMin!,
} as const;

/** Speed multiplier applied to all jack auto-clicks when the Jack'd Up upgrade is purchased. */
export const JACKD_UP_SPEED_MULT = 1.5;

// ── Upgrade Definitions ──────────────────────────────────────
// Single source of truth for every upgrade in the game.
// Adding a new upgrade? Just append an entry here and add
// a matching flavor entry — no other config files need to change.
export const UPGRADE_DEFS: readonly UpgradeDef[] = [
  // ── Fighter — standard ───────────────────────────────────────
  { id: 'BETTER_BOUNTIES',      characterId: 'fighter', category: 'standard', max: 999,
    costs: [{ currency: 'gold', base: 10, scale: 1.12 }] },
  { id: 'CONTRACTED_HIRELINGS', characterId: 'fighter', category: 'standard', max: 999,
    costs: [{ currency: 'gold', base: 25, scale: 1.1 }] },
  { id: 'INSIGHTFUL_CONTRACTS', characterId: 'fighter', category: 'standard', max: 999,
    gates: { xpMin: 500 },
    costs: [{ currency: 'gold', base: 400, scale: 1.4 }] },
  { id: 'HIRELINGS_HIRELINGS', characterId: 'fighter', category: 'standard', max: 999,
    gates: { requiresCulinarian: true },
    costs: [
      { currency: 'gold',  base: 1000, scale: 1.25 },
      { currency: 'spice', base: 1000,    scale: 1.25 },
    ] },

  // ── Fighter — minigame ───────────────────────────────────────
  { id: 'SHARPER_SWORDS',   characterId: 'fighter', category: 'minigame', max: 999,
    costs: [{ currency: 'gold', base: 50, scale: 1.15 }] },
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
      { currency: 'kobold-ear',    base: 50, scale: 1.8 },                                        // always
      { currency: 'beast',         base: 500, scale: 1.0, fromLevel: 0, untilLevel: 1 },           // tier 1 only
      { currency: 'kobold-tongue', base: 50, scale: 1.0, fromLevel: 1, untilLevel: 2 },           // tier 2 only
      { currency: 'kobold-hair',   base: 50, scale: 1.0, fromLevel: 2, untilLevel: 3 },           // tier 3 only
      { currency: 'kobold-fang',   base: 50, scale: 1.0, fromLevel: 3, untilLevel: 4 },           // tier 4 only
      { currency: 'kobold-brain',  base: 50, scale: 1.0, fromLevel: 4, untilLevel: 5 },           // tier 5 only (Winged Kobold)
    ] },
  { id: 'FIRST_STRIKE', characterId: 'fighter', category: 'minigame', max: 1,
    gates: { requiresFang: true },
    costs: [
      { currency: 'dossier',     base: 1500, scale: 1.0 },
      { currency: 'kobold-fang', base: 33,   scale: 1.0 },
    ] },
  { id: 'GILDED_BLADE', characterId: 'fighter', category: 'minigame', max: 33,
    gates: { requiresArtisan: true },
    costs: [
      { currency: 'precious-metal', base: 10, scale: 1.3 },
    ] },
  { id: 'POTION_MIND_READING', characterId: 'fighter', category: 'minigame', max: 10,
    gates: { requiresSynapticalPotions: true },
    costs: [
      { currency: 'synaptical-potion', base: 2,  scale: 1.5 },
      { currency: 'kobold-brain',      base: 10, scale: 1.4 },
    ] },
  { id: 'CATS_SWIFTNESS', characterId: 'fighter', category: 'minigame', max: 10,
    gates: { requiresFeather: true },
    costs: [
      { currency: 'concentrated-potion', base: 5,  scale: 1.6 },
      { currency: 'kobold-feather',      base: 8,  scale: 1.6 },
    ] },
  { id: 'KOBOLD_BAIT', characterId: 'fighter', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',  base: 1000, scale: 1.0 },
      { currency: 'beast', base: 10,   scale: 1.0 },
    ] },

  // ── Ranger — standard ────────────────────────────────────────
  { id: 'MORE_HERBS',      characterId: 'ranger', category: 'standard', max: 100,
    costs: [{ currency: 'gold', base: 15, scale: 1.2 }] },
  { id: 'BETTER_TRACKING', characterId: 'ranger', category: 'standard', max: 16,
    costs: [{ currency: 'gold', base: 30, scale: 1.3 }] },
  { id: 'BAITED_TRAPS',    characterId: 'ranger', category: 'standard', max: 999,
    costs: [
      { currency: 'gold',  base: 200, scale: 1.2 },
      { currency: 'beast', base: 50,  scale: 1.1 },
    ] },
  { id: 'SPICED_BAIT',     characterId: 'ranger', category: 'standard', max: 999,
    gates: { requiresCulinarian: true },
    costs: [
      { currency: 'beast', base: 100, scale: 1.2 },
      { currency: 'spice', base: 50,  scale: 1.3 },
    ] },
  { id: 'HOVEL_GARDEN',    characterId: 'ranger', category: 'standard', max: 999,
    costs: [
      { currency: 'gold', base: 150, scale: 1.2 },
      { currency: 'herb', base: 50,  scale: 1.1 },
    ] },
  { id: 'ORNATE_HERB_POTS', characterId: 'ranger', category: 'standard', max: 999,
    gates: { requiresThief: true },
    costs: [
      { currency: 'pixie-dust', base: 5, scale: 1.4 },
      { currency: 'treasure',   base: 25, scale: 1.4 },
    ] },
  { id: 'BIGGER_GAME',     characterId: 'ranger', category: 'standard', max: 999,    // each level +1 max Raw Beast Meat from hero button
    costs: [{ currency: 'gold', base: 480, scale: 1.75 }], enabled: false },
  { id: 'POTION_CATS_EYE', characterId: 'ranger', category: 'standard', max: 20,    // 20 levels × +5% = 100% chance to roll both herb and beast
    gates: { requiresApothecary: true },
    costs: [
      { currency: 'concentrated-potion', base: 2,  scale: 1.3 },
      { currency: 'pixie-dust',          base: 2, scale: 1.3 },
    ] },

  // ── Ranger — minigame ────────────────────────────────────────
  { id: 'BOUNTIFUL_LANDS', characterId: 'ranger', category: 'minigame', max: 5,      // each level adds +1 guaranteed prize node
    costs: [
      { currency: 'kobold-ear',    base: 50, scale: 1.0, fromLevel: 0, untilLevel: 1 },  // level 1 only
      { currency: 'kobold-tongue', base: 50, scale: 1.0, fromLevel: 1, untilLevel: 2 },  // level 2 only
      { currency: 'kobold-hair',   base: 50, scale: 1.0, fromLevel: 2, untilLevel: 3 },  // level 3 only
      { currency: 'kobold-fang',   base: 50, scale: 1.0, fromLevel: 3, untilLevel: 4 },  // level 4 only
      { currency: 'kobold-brain',  base: 50, scale: 1.0, fromLevel: 4, untilLevel: 5 },  // level 4 only
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
  { id: 'TREASURE_CHEST', characterId: 'ranger', category: 'minigame', max: 10,
    gates: { requiresArtisan: true },
    costs: [
      { currency: 'treasure',  base: 50,  scale: 1.4 },
      { currency: 'gemstone',  base: 10,  scale: 1.4 },
    ] },
  { id: 'X_MARKS_THE_SPOT', characterId: 'ranger', category: 'minigame', max: 1,
    gates: { requiresTreasureChestMin: 1 },
    costs: [
      { currency: 'synaptical-potion', base: 100, scale: 1.0 },
      { currency: 'dossier',           base: 8500, scale: 1.0 },
      { currency: 'gemstone',          base: 100, scale: 1.0 },
    ] },

  // ── Apothecary — standard ────────────────────────────────────
  { id: 'POTION_TITRATION', characterId: 'apothecary', category: 'standard', max: 100,  // 100 × +4% save-chance
    costs: [{ currency: 'gold', base: 20, scale: 1.2 }] },
  { id: 'POTION_MARKETING', characterId: 'apothecary', category: 'standard', max: 999,
    costs: [{ currency: 'gold', base: 50, scale: 1.07 }] },
  { id: 'FERMENTATION_VATS', characterId: 'apothecary', category: 'standard', max: 999,
    costs: [
      { currency: 'gold',   base: 500,  scale: 1.2 },
      { currency: 'herb',   base: 100,  scale: 1.2 },
      { currency: 'potion', base: 25,   scale: 1.2 },
    ] },

  // ── Culinarian — standard ────────────────────────────────────
  { id: 'WHOLESALE_SPICES', characterId: 'culinarian', category: 'standard', max: 30, // +1 spice/click, +24g cost/click per level
    costs: [{ currency: 'gold', base: 200, scale: 1.3 }] },
  { id: 'POTION_GLIBNESS',  characterId: 'culinarian', category: 'standard', max: 85,   // 85 × -1% spice purchase cost
    costs: [
      { currency: 'concentrated-potion', base: 2,  scale: 1.1 },
      { currency: 'kobold-tongue',       base: 5,  scale: 1.1 },
    ] },

  // ── Culinarian — minigame ────────────────────────────────────
  { id: 'WASTE_NOT', characterId: 'culinarian', category: 'minigame', max: 5,
    costs: [
      { currency: 'spice',       base: 200, scale: 1.5 },
      { currency: 'hearty-meal', base: 5,  scale: 1.8 },
    ] },
  { id: 'LARGER_COOKBOOKS', characterId: 'culinarian', category: 'minigame', max: 1,
    gates: { requiresThief: true },
    costs: [
      { currency: 'gold',        base: 100_000, scale: 1.0 },
      { currency: 'hearty-meal', base: 15,      scale: 1.0 },
      { currency: 'dossier',     base: 2_500,   scale: 1.0 },
    ] },
  { id: 'COOKBOOK_ANNOTATIONS', characterId: 'culinarian', category: 'minigame', max: 1,
    gates: { requiresCulinarian: true, requiresFeather: true },
    costs: [
      { currency: 'dossier',         base: 100_000, scale: 1.0 },
      { currency: 'kobold-feather',  base: 50,      scale: 1.0 },
    ] },

  // ── Thief — standard ─────────────────────────────────────────
  { id: 'METICULOUS_PLANNING', characterId: 'thief', category: 'standard', max: 40,
    costs: [{ currency: 'gold', base: 1000,       scale: 1.1 },
            { currency: 'dossier', base: 15,     scale: 1.13 },] },
  { id: 'PLENTIFUL_PLUNDERING', characterId: 'thief', category: 'standard', max: 999,
    costs: [{ currency: 'gold',    base: 1000, scale: 1.15 },
            { currency: 'dossier', base: 10,  scale: 1.10 }] },
  { id: 'POTION_OF_STICKY_FINGERS', characterId: 'thief', category: 'standard', max: 25,
    costs: [
      { currency: 'concentrated-potion', base: 2, scale: 1.3 },
      { currency: 'kobold-fang',         base: 5, scale: 1.2 },
    ] },
  { id: 'RELIC_HUNTER', characterId: 'thief', category: 'standard', max: 99,
    gates: { requiresRelic: true },
    costs: [
      // Always: dossier scales steeply with each level
      { currency: 'dossier',             base: 2000,  scale: 1.6 },
      // Level 1 only: Fighter
      { currency: 'kobold-ear',          base: 200,  scale: 1.0, fromLevel: 0, untilLevel: 1 },
      { currency: 'kobold-tongue',       base: 200,  scale: 1.0, fromLevel: 0, untilLevel: 1 },
      { currency: 'kobold-hair',         base: 200,  scale: 1.0, fromLevel: 0, untilLevel: 1 },
      { currency: 'kobold-fang',         base: 200,  scale: 1.0, fromLevel: 0, untilLevel: 1 },
      // Level 2 only: Ranger
      { currency: 'herb',                base: 10000, scale: 1.0, fromLevel: 1, untilLevel: 2 },
      { currency: 'beast',               base: 10000, scale: 1.0, fromLevel: 1, untilLevel: 2 },
      { currency: 'pixie-dust',          base: 500,   scale: 1.0, fromLevel: 1, untilLevel: 2 },
      // Level 3 only: Apothecary
      { currency: 'potion',              base: 10000, scale: 1.0, fromLevel: 2, untilLevel: 3 },
      { currency: 'concentrated-potion', base: 500,   scale: 1.0, fromLevel: 2, untilLevel: 3 },
      { currency: 'synaptical-potion',   base: 250,   scale: 1.0, fromLevel: 2, untilLevel: 3 },

      // Level 4 only: Culinarian
      { currency: 'spice',               base: 50000, scale: 1.0, fromLevel: 3, untilLevel: 4 },
      { currency: 'hearty-meal',         base: 500,   scale: 1.0, fromLevel: 3, untilLevel: 4 },
      // Level 5 only: Thief - Dossier excluded cause thats coming from the base scaling
      { currency: 'treasure',            base: 2000,  scale: 1.0, fromLevel: 4, untilLevel: 5 },
      // Level 6 only: Artisan -
      { currency: 'precious-metal',      base: 2500,  scale: 1.0, fromLevel: 5, untilLevel: 6 },
      { currency: 'gemstone',            base: 2500,  scale: 1.0, fromLevel: 5, untilLevel: 6 },
      { currency: 'jewelry',             base: 250,   scale: 1.0, fromLevel: 5, untilLevel: 6 },
      // Level 7 only: Necromancer
      { currency: 'bone',                base: 15000,  scale: 1.0, fromLevel: 6, untilLevel: 7 },
      { currency: 'brimstone',           base: 15000,  scale: 1.0, fromLevel: 6, untilLevel: 7 },
      { currency: 'soul-stone',          base: 500,    scale: 1.0, fromLevel: 6, untilLevel: 7 },
      { currency: 'xp',                  base: 50000,  scale: 1.0, fromLevel: 6, untilLevel: 7 },
    ] },

  // ── Thief — minigame ─────────────────────────────────────────
  { id: 'VANISHING_POWDER', characterId: 'thief', category: 'minigame', max: 5,
    costs: [
      { currency: 'gold',       base: 60000, scale: 1.3  },
      { currency: 'pixie-dust', base: 80,  scale: 1.3  },
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
  { id: 'LOCKED_IN', characterId: 'thief', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',     base: 15_000, scale: 1.0 },
      { currency: 'dossier',  base: 250,   scale: 1.0 },
      { currency: 'treasure', base: 50,    scale: 1.0 },
    ] },
  { id: 'FLOW_STATE', characterId: 'thief', category: 'minigame', max: 1,
    gates: { requiresLockedIn: true },
    costs: [
      { currency: 'gold',     base: 50_000, scale: 1.0 },
      { currency: 'dossier',  base: 1_500,  scale: 1.0 },
      { currency: 'treasure', base: 250,    scale: 1.0 },
    ] },

  // ── Artisan — standard ───────────────────────────────────────
  { id: 'FASTER_APPRAISING', characterId: 'artisan', category: 'standard', max: 10,
    costs: [
      { currency: 'gold',        base: 18_000, scale: 1.3 },
      { currency: 'hearty-meal', base: 10,      scale: 1.4 },
    ] },
  { id: 'POTION_CATS_PAW', characterId: 'artisan', category: 'standard', max: 999,
    costs: [
      { currency: 'concentrated-potion', base: 3,   scale: 1.3 },
      { currency: 'treasure',               base: 100, scale: 1.3 },
    ] },

  // ── Artisan — minigame ───────────────────────────────────────
  { id: 'LUCKY_GEMS', characterId: 'artisan', category: 'minigame', max: 9,
    costs: [
      { currency: 'gold',       base: 50_000, scale: 1.4 },
      { currency: 'pixie-dust', base: 15,     scale: 1.3 },
    ] },
  { id: 'DOUBLE_DIP', characterId: 'artisan', category: 'minigame', max: 1,
    costs: [
      { currency: 'treasure', base: 500, scale: 1.0 },
      { currency: 'jewelry',  base: 5,   scale: 1.0 },
    ] },
  { id: 'GOOD_ENOUGH', characterId: 'artisan', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',  base: 75_000, scale: 1.0 },
      { currency: 'spice', base: 3_000,  scale: 1.0 },
    ] },
  { id: 'CLOSE_ENOUGH', characterId: 'artisan', category: 'minigame', max: 1,
    gates: { requiresDoubleDip: true },
    costs: [
      { currency: 'gold',           base: 150_000, scale: 1.0 },
      { currency: 'precious-metal', base: 500,     scale: 1.0 },
    ] },
  // Max is 1 for now — levels 2-3 will be enabled in a future update with different currencies.
  { id: 'STAND_OUT_SELECTION', characterId: 'artisan', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',         base: 50_000, scale: 1.0 },
      { currency: 'kobold-brain', base: 50,     scale: 1.0 },
    ] },

  // ── Necromancer — standard ──────────────────────────────────────
  { id: 'EXTENDED_RITUAL', characterId: 'necromancer', category: 'standard', max: 25,
    costs: [
      { currency: 'bone',      base: 12, scale: 1.3 },
      { currency: 'brimstone', base: 8,  scale: 1.3 },
    ] },
  { id: 'DARK_PACT', characterId: 'necromancer', category: 'standard', max: 12,
    costs: [
      { currency: 'xp',        base: 100,    scale: 2 },
      { currency: 'brimstone', base: 100,     scale: 1.6 },
    ] },
  { id: 'AUGURY', characterId: 'necromancer', category: 'standard', max: 1,
    costs: [
      { currency: 'kobold-brain',      base: 50, scale: 1.0 },
      { currency: 'brimstone',         base: 50, scale: 1.0 },
    ] },
  { id: 'SPEAK_WITH_DEAD', characterId: 'necromancer', category: 'standard', max: 20,
    costs: [
      { currency: 'synaptical-potion', base: 5,  scale: 1.4  },
      { currency: 'bone',              base: 50, scale: 1.35 },
    ] },
  { id: 'FORTIFIED_CHALK', characterId: 'necromancer', category: 'standard', max: 20,
    costs: [
      { currency: 'brimstone',  base: 20, scale: 1.35 },
      { currency: 'pixie-dust', base: 10, scale: 1.35 },
    ] },
  { id: 'GRAVE_LOOTING', characterId: 'necromancer', category: 'standard', max: 5,
    costs: [
      { currency: 'dossier',     base: 50000, scale: 1.5 },
      { currency: 'hearty-meal', base: 250,  scale: 1.5 },
    ] },

  // ── Necromancer — minigame ────────────────────────────────────
  { id: 'PERFECT_TRANSMUTATION', characterId: 'necromancer', category: 'minigame', max: 10,
    gates: { requiresNecromancer: true },
    costs: [
      { currency: 'gemstone',   base: 20, scale: 1.8 },
      { currency: 'brimstone',  base: 25, scale: 1.8 },
      { currency: 'soul-stone', base: 20, scale: 1.8 },
    ] },
  { id: 'DEMONIC_KNOWLEDGE', characterId: 'necromancer', category: 'minigame', max: 2,
    gates: { requiresNecromancer: true, requiresSynapticalPotions: true },
    costs: [
      { currency: 'soul-stone',        base: 75,  scale: 3.0 },
      { currency: 'synaptical-potion', base: 10,   scale: 2.0 },
      { currency: 'xp',                base: 500, scale: 2.0 },
    ] },
  { id: 'FIND_FAMILIAR', characterId: 'necromancer', category: 'minigame', max: 1,
    gates: { requiresNecromancer: true },
    costs: [
      { currency: 'soul-stone', base: 50,    scale: 1.0 },
      { currency: 'bone',       base: 200,   scale: 1.0 },
      { currency: 'brimstone',  base: 200,   scale: 1.0 },
      { currency: 'xp',         base: 100_000, scale: 1.0 },
    ] },
  { id: 'CONCENTRATED_SOULS', characterId: 'necromancer', category: 'minigame', max: 10,
    gates: { requiresFindFamiliar: true },
    costs: [
      { currency: 'xp',         base: 200,  scale: 1.5 },
      { currency: 'soul-stone', base: 5,    scale: 1.5 },
      { currency: 'brimstone',  base: 300,   scale: 1.5 },
    ] },
  { id: 'VAULT_OF_SOULS', characterId: 'necromancer', category: 'minigame', max: 15,
    gates: { requiresFindFamiliar: true },
    costs: [
      { currency: 'precious-metal', base: 150,   scale: 1.4 },
      { currency: 'brimstone',      base: 750,  scale: 1.4 },
      { currency: 'soul-stone',     base: 30,  scale: 1.4 },
    ] },

  // ── Apothecary — minigame ────────────────────────────────────
  { id: 'BUBBLING_BREW', characterId: 'apothecary', category: 'minigame', max: 1,
    costs: [
      { currency: 'gold',       base: 9000, scale: 1.0 },
      { currency: 'herb', base: 100,  scale: 1.0 },
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
  { id: 'PERFECT_POTIONS', characterId: 'apothecary', category: 'minigame', max: 1,
    gates: { requiresPotionDilution: true, requiresThief: true },
    costs: [
      { currency: 'gold',                base: 50000, scale: 1.0 },
      { currency: 'dossier',             base: 500,  scale: 1.0 },
    ] },
  { id: 'SYNAPTICAL_POTIONS', characterId: 'apothecary', category: 'minigame', max: 1,
    gates: { requiresArtisan: true },
    costs: [
      { currency: 'potion',          base: 5_000, scale: 1.0 },
      { currency: 'precious-metal',  base: 50,    scale: 1.0 },
      { currency: 'kobold-brain',    base: 25,    scale: 1.0 },
    ] },
  { id: 'SYNAPTIC_STATIC', characterId: 'apothecary', category: 'minigame', max: 3,
    gates: { requiresSynapticalPotions: true },
    costs: [
      { currency: 'precious-metal', base: 30,  scale: 1.5 },
      { currency: 'kobold-brain',   base: 15,  scale: 1.5 },
    ] },

  // ── Relic upgrades (one per character) ──────────────────────────
  // Each costs exactly 1 relic + a dynamically-computed jewelry amount
  // (see RELIC_COSTS and UpgradeService.syncRelicCosts).
  // The jewelry base here is just the initial placeholder value.
  { id: 'RELIC_FIGHTER',    characterId: 'fighter',    category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_RANGER',     characterId: 'ranger',     category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_APOTHECARY', characterId: 'apothecary', category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_CULINARIAN', characterId: 'culinarian', category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_THIEF',      characterId: 'thief',      category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_ARTISAN',    characterId: 'artisan',    category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_NECROMANCER', characterId: 'necromancer', category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
];

// ── Relic Upgrade Costs ───────────────────────────────────────
// Each relic upgrade costs exactly 1 relic PLUS a scaling amount of jewelry.
// The jewelry cost depends on how many relic upgrades have been purchased
// globally (regardless of order): jewelryCost = base × scale^(relicsOwned).
export const RELIC_COSTS = {
  /** Jewelry required for the first relic upgrade purchased (0 relics owned). */
  JEWELRY_BASE:  5,
  /** Multiplicative scale applied per relic already owned. */
  JEWELRY_SCALE: 2.5,
} as const;

// ── Resource Yields ───────────────────────────────────────────
export const YIELDS = {
  /** Gold awarded per Fighter adventure click (base, before upgrades) */
  FIGHTER_GOLD_PER_CLICK:    1,

  /** Herbs awarded per successful Ranger herb forage (base, before More Herbs upgrades) */
  RANGER_BASE_HERBS:         1,
  /** Base % chance the Ranger successfully brings down a beast */
  RANGER_BASE_BEAST_CHANCE:  50,
  /** Hard cap on beast-find chance regardless of Better Tracking level */
  RANGER_BEAST_CHANCE_CAP:   100,

  /** Herbs consumed per Apothecary brew action */
  APOTHECARY_BREW_HERB_COST: 5,

  /** Gold spent per Culinarian hero-button press to produce 1 Spice */
  CULINARIAN_SPICE_COST: 25,

  /** Base % chance the Thief successfully breaks & enters on a hero-button click */
  THIEF_BASE_SUCCESS_CHANCE: 60,
  /** Duration in ms the Thief is stunned on a failed break-in */
  THIEF_STUN_DURATION_MS: 3_000,

  /** Treasure consumed per Artisan appraisal action */
  ARTISAN_TREASURE_COST: 20,
  /** Duration in ms of the Artisan's appraisal timer */
  ARTISAN_TIMER_MS: 20_000,
  /** Minimum gemstones awarded per appraisal */
  ARTISAN_GEMSTONE_MIN: 1,
  /** Maximum gemstones awarded per appraisal */
  ARTISAN_GEMSTONE_MAX: 3,
  /** Minimum precious metals awarded per appraisal */
  ARTISAN_METAL_MIN: 5,
  /** Maximum precious metals awarded per appraisal */
  ARTISAN_METAL_MAX: 10,

  // ── Necromancer ─────────────────────────────────────────────
  /** Bones awarded per Defile click (base, before Speak With Dead) */
  NECROMANCER_BONE_PER_CLICK: 1,
  /** XP consumed per Ward click (base, reduced by Dark Pact) */
  NECROMANCER_WARD_XP_COST: 25,
  /** Brimstone awarded per Ward click (base, before Fortified Chalk) */
  NECROMANCER_BRIMSTONE_PER_WARD: 1,
  /** Minimum clicks before the active button switches (base, increased by Extended Ritual) */
  NECROMANCER_SWITCH_MIN: 5,
  /** Maximum clicks before the active button switches (base, increased by Extended Ritual) */
  NECROMANCER_SWITCH_MAX: 15,

  // Grave Looting — loot chance and distribution during Defile
  /** Base % chance per Grave Looting level to find bonus loot during Defile */
  GRAVE_LOOTING_CHANCE_PER_LEVEL: 5,
  /** Probability (0–1) that bonus loot is Gold */
  GRAVE_LOOTING_GOLD_WEIGHT:     0.50,
  /** Probability (0–1) that bonus loot is Gemstones */
  GRAVE_LOOTING_GEM_WEIGHT:      0.30,
  /** Probability (0–1) that bonus loot is Jewelry */
  GRAVE_LOOTING_JEWELRY_WEIGHT:  0.20,
  /** Amount of Gold awarded when Grave Looting triggers */
  GRAVE_LOOTING_GOLD_AMOUNT:     50,
  /** Amount of Gemstones awarded when Grave Looting triggers */
  GRAVE_LOOTING_GEM_AMOUNT:      1,
  /** Amount of Jewelry awarded when Grave Looting triggers */
  GRAVE_LOOTING_JEWELRY_AMOUNT:  1,

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

  /** Chance per level (0–1) to roll player attack damage twice and take the higher. */
  MIND_READING_CHANCE_PER_LEVEL: 0.10,

  KOBOLD_BAIT_BASE: 50,

  // ── Kobold level scaling (applied per level above 1) ──────
  /** Extra HP per kobold level above 1 */
  KOBOLD_HP_PER_LEVEL:       12,
  /** Extra enemy max damage per kobold level above 1 */
  KOBOLD_DMG_PER_LEVEL:       5,
  /** Extra gold min reward per kobold level above 1 */
  KOBOLD_GOLD_MIN_PER_LEVEL:  15,
  /** Extra gold max reward per kobold level above 1 */
  KOBOLD_GOLD_MAX_PER_LEVEL:  95,
  /** Extra XP reward per kobold level above 1 */
  KOBOLD_XP_PER_LEVEL:        3,
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
  /** Width of each Synaptic Static bonus zone in percentage units. */
  SYNAPTIC_ZONE_WIDTH: 8,
  /** Herbs consumed to begin brewing a Synaptical Potion */
  SYNAPTICAL_HERB_COST: 100,
  /** Concentrated Potions consumed to begin brewing a Synaptical Potion */
  SYNAPTICAL_CONCENTRATED_COST: 1,
  /** Kobold Brains consumed to begin brewing a Synaptical Potion */
  SYNAPTICAL_BRAIN_COST: 1,
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
  SCOUT_COST:   9,

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

  // ── Treasure Chest (Treasure Chest upgrade) ────────────────
  /** Chest chance increase per Treasure Chest upgrade level (percentage, 0–100). */
  CHEST_CHANCE_PER_LEVEL: 0.5,
  /** Herb chance reduction per Treasure Chest upgrade level (percentage). */
  CHEST_HERB_REDUCTION_PER_LEVEL: 0.25,
  /** Meat chance reduction per Treasure Chest upgrade level (percentage). */
  CHEST_MEAT_REDUCTION_PER_LEVEL: 0.25,
  /** Min gold awarded when a treasure chest is found. */
  CHEST_GOLD_MIN: 1200,
  /** Max gold awarded when a treasure chest is found. */
  CHEST_GOLD_MAX: 30000,
  /** Min treasure awarded when a treasure chest is found. */
  CHEST_TREASURE_MIN: 12,
  /** Max treasure awarded when a treasure chest is found. */
  CHEST_TREASURE_MAX: 50,
  /** Min gemstones awarded when a treasure chest is found. */
  CHEST_GEM_MIN: 1,
  /** Max gemstones awarded when a treasure chest is found. */
  CHEST_GEM_MAX: 12,
  /** XP awarded when a treasure chest is found. */
  CHEST_XP: 15,
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
  GOLD_PER_UNUSED: 100,
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

// ── Artisan Minigame ─────────────────────────────────────────
export const ARTISAN_MG = {
  /** Gemstones consumed to start a Faceting round. */
  GEMSTONE_COST: 6,
  /** Precious Metal consumed to start a Faceting round. */
  METAL_COST: 16,
  /** Number of gemstones presented to the player. */
  GEM_COUNT: 6,
  /** Number of gems the player may select (can be increased by upgrades later). */
  PICKS: 1,
  /** Jewelry awarded on a successful pick. */
  JEWELRY_REWARD: 1,
  /** XP awarded on a successful faceting. */
  XP_REWARD: 5,
  /** Base bonus added to the "Lucky Gem" attributes (before upgrades). */
  LUCKY_GEM_BONUS: 0.1,
  /** Additional bonus per Lucky Gems upgrade level. */
  LUCKY_GEM_BONUS_PER_LEVEL: 0.1,
  /** Milliseconds subtracted from the appraisal timer per Faster Appraising level. */
  FASTER_APPRAISING_MS_PER_LEVEL: 1000,
  /** Minimum appraisal timer duration in ms (hard floor). */
  FASTER_APPRAISING_MIN_MS: 1000,
  /** Bonus jewelry awarded for a successful Double Dip (picking 2nd-best gem). */
  DOUBLE_DIP_JEWELRY_BONUS: 1,
  /** Bonus XP awarded for a successful Double Dip. */
  DOUBLE_DIP_XP_BONUS: 3,
  /** Minimum gem score (0–1) qualifying for the Good Enough bonus jewelry. */
  GOOD_ENOUGH_THRESHOLD: 0.5,
  /** Bonus jewelry per qualifying gem when Good Enough is active. */
  GOOD_ENOUGH_JEWELRY_PER_GEM: 1,
} as const;

// ── Necromancer Minigame ─────────────────────────────────────
export const NECROMANCER_MG = {
  /** Gemstones consumed to start a ritual. */
  GEMSTONE_COST: 10,
  /** Bones consumed to start a ritual. */
  BONE_COST: 25,
  /** Brimstone consumed to start a ritual. */
  BRIMSTONE_COST: 25,
  /** Raw Beast Meat consumed to start a ritual. */
  BEAST_COST: 100,
  /** XP consumed to start a ritual. */
  XP_COST: 50,
  /** Number of resource nodes placed around the spell circle. */
  NODE_COUNT: 7,
  /** Radius of the node circle (percentage of the SVG viewBox half-width). */
  CIRCLE_RADIUS: 38,
  /** Base Soul Stone reward for a perfect path. */
  BASE_REWARD: 10,
  /** XP awarded per completed ritual. */
  XP_REWARD: 10,
} as const;

// ── Familiar (Find Familiar upgrade) ─────────────────────────
export const FAMILIAR = {
  /** Seconds of familiar time granted per Soul Stone spent (base). */
  TIME_PER_STONE_SEC: 30,
  /** Additional seconds per Soul Stone granted per level of Concentrated Souls. */
  CONCENTRATED_SOULS_BONUS_SEC: 15,
  /** Maximum accumulated familiar time in seconds (base = 10 minutes). */
  MAX_TIME_SEC: 600,
  /** Additional seconds of max cap granted per level of Vault of Souls (5 minutes). */
  VAULT_OF_SOULS_BONUS_SEC: 300,
  /** Effective jack count added by each active familiar. */
  JACKS_PER_FAMILIAR: 1,
} as const;

