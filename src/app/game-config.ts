/**
 * ════════════════════════════════════════════════════════════
 *   GAME BALANCE CONFIG
 *   Central location for every tunable value in the game.
 *   Adjust numbers here — no logic files need to change.
 * ════════════════════════════════════════════════════════════
 */

import { KOBOLD_VARIANTS } from './flavor-text';

// ── Game Version ─────────────────────────────────────────────
export const VERSION = '1.0.1';

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
  /** Hide until the Artificer character is unlocked. */
  readonly requiresArtificer?: boolean;
  /** Hide until the Chimeramancer character is unlocked. */
  readonly requiresChimeramancer?: boolean;
  /** Hide until the Merchant character is unlocked. */
  readonly requiresMerchant?: boolean;
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
  /** Hide until Bigger Threads has at least one level purchased. */
  readonly requiresBiggerThreads?: boolean;
  /** Hide until Sharper Needles has at least one level purchased. */
  readonly requiresSharperNeedles?: boolean;
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
  /** Hide until: slayerMode is active (chimera 100% + boss fight started), ≥50 damage dealt, and ≥50 ichor received. */
  readonly requiresSlayerDamage?: boolean;
  /** Hide until both Slayer Gold Bead upgrades (SLAYER_GOLD_BEAD_1 and SLAYER_GOLD_BEAD_2) are purchased. */
  readonly requiresSlayerGoldBeads?: boolean;
  /** Hide until the first Slayer Gold Bead upgrade (SLAYER_GOLD_BEAD_1) is purchased. */
  readonly requiresSlayerGoldBead1?: boolean;
  /** Hide until the Windfury upgrade has at least one level purchased. */
  readonly requiresWindfury?: boolean;
  /** Hide until the Thunderfury upgrade has been purchased. */
  readonly requiresThunderfury?: boolean;
  /** Hide until the chimera has been slain (slayerHp ≤ 0 and slayerMode is active). */
  readonly requiresChimeraSlain?: boolean;
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
      { currency: 'illicit-goods',      base: 500,   fromCount: 25, untilCount: 26 },  // Jack 26
      { currency: 'kobold-pebble',      base: 25,    fromCount: 26, untilCount: 27 },  // Jack 27
      { currency: 'monster-trophy',     base: 50,    fromCount: 27, untilCount: 28 },  // Jack 28
      { currency: 'forbidden-tome',     base: 50,    fromCount: 28, untilCount: 29 },  // Jack 29
      { currency: 'magical-implement',  base: 50,    fromCount: 29, untilCount: 30 },  // Jack 30
      { currency: 'mana',               base: 500,    fromCount: 30, untilCount: 31 },  // Jack 31
      { currency: 'construct',          base: 50,    fromCount: 31, untilCount: 32 },  // Jack 32
      { currency: 'kobold-heart',       base: 25,    fromCount: 32, untilCount: 33 },  // Jack 33
      { currency: 'life-thread',        base: 50,    fromCount: 33, untilCount: 34 },  // Jack 34
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
    id: 'UNLOCK_ARTISAN', kind: 'character-unlock', xpMin: 400_000,
    costs: [
      { currency: 'gold',     base: 100_000 },
      { currency: 'dossier',  base: 10_000  },
      { currency: 'treasure', base: 1_000   },
    ],
  },
  {
    id: 'UNLOCK_NECROMANCER', kind: 'character-unlock', xpMin: 1_000_000,
    costs: [
      { currency: 'gold',           base: 400_000 },
      { currency: 'precious-metal', base: 2000     },
      { currency: 'gemstone',       base: 2000     },
    ],
  },
  {
    id: 'UNLOCK_MERCHANT', kind: 'character-unlock', xpMin: 2_000_000,
    costs: [
      { currency: 'gold',        base: 1_500_000 },
      { currency: 'soul-stone',  base: 500     },
      { currency: 'jewelry',     base: 500     },
      { currency: 'spice',       base: 50000    },
    ],
  },
  {
    id: 'UNLOCK_ARTIFICER', kind: 'character-unlock', xpMin: 5_000_000,
    costs: [
      { currency: 'gold',              base: 5_000_000 },
      { currency: 'precious-metal',    base: 5000       },
      { currency: 'magical-implement', base: 3000       },
      { currency: 'forbidden-tome',    base: 3000       },
    ],
  },
  {
    id: 'UNLOCK_CHIMERAMANCER', kind: 'character-unlock', xpMin: 10_000_000,
    costs: [
      { currency: 'gold',        base: 10_000_000 },
      { currency: 'construct',   base: 500        },
      { currency: 'mana',        base: 500_000       },
      { currency: 'soul-stone',  base: 1000       },
      { currency: 'monster-trophy',    base: 3000       },
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
  MERCHANT_UNLOCK:   getGlobalDef('UNLOCK_MERCHANT')!.xpMin!,
  ARTIFICER_UNLOCK:  getGlobalDef('UNLOCK_ARTIFICER')!.xpMin!,
  CHIMERAMANCER_UNLOCK: getGlobalDef('UNLOCK_CHIMERAMANCER')!.xpMin!,
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
      { currency: 'gold',                 base: 75_000, scale: 1.0 },
      { currency: 'concentrated-potion',  base: 250,    scale: 1.0 },
      { currency: 'hearty-meal',          base: 30,     scale: 1.0 },
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
      { currency: 'kobold-ear',    base: 50, scale: 1.4 },                                        // always
      { currency: 'beast',         base: 500, scale: 1.0, fromLevel: 0, untilLevel: 1 },           // tier 1 only
      { currency: 'kobold-tongue', base: 50, scale: 1.0, fromLevel: 1, untilLevel: 2 },           // tier 2 only
      { currency: 'kobold-hair',   base: 50, scale: 1.0, fromLevel: 2, untilLevel: 3 },           // tier 3 only
      { currency: 'kobold-fang',   base: 50, scale: 1.0, fromLevel: 3, untilLevel: 4 },           // tier 4 only
      { currency: 'kobold-brain',  base: 50, scale: 1.0, fromLevel: 4, untilLevel: 5 },           // tier 5 only (Winged Kobold)
      { currency: 'kobold-feather',base: 50, scale: 1.0, fromLevel: 5, untilLevel: 6 },           // tier 6 only (Kobold Grotesque)
      { currency: 'kobold-pebble', base: 50, scale: 1.0, fromLevel: 6, untilLevel: 7 },           // tier 7 only (Kobold Leader)
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
      // Level 8 only: Merchant
      { currency: 'illicit-goods',       base: 5000,   scale: 1.0, fromLevel: 7, untilLevel: 8 },
      { currency: 'monster-trophy',      base: 500,    scale: 1.0, fromLevel: 7, untilLevel: 8 },
      { currency: 'forbidden-tome',      base: 500,    scale: 1.0, fromLevel: 7, untilLevel: 8 },
      { currency: 'magical-implement',   base: 500,    scale: 1.0, fromLevel: 7, untilLevel: 8 },
      // Level 9 only: Artificer
      { currency: 'mana',               base: 100000,  scale: 1.0, fromLevel: 8, untilLevel: 9 },
      { currency: 'construct',           base: 500,    scale: 1.0, fromLevel: 8, untilLevel: 9 },
      { currency: 'magical-implement',   base: 500,    scale: 1.0, fromLevel: 8, untilLevel: 9 },
    ] },
  { id: 'GEM_HUNTER', characterId: 'thief', category: 'standard', max: 1,
    costs: [
      { currency: 'dossier', base: 500_000, scale: 1.0 },
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
  { id: 'SPREADING_SOUL', characterId: 'necromancer', category: 'minigame', max: 1,
    gates: { requiresFindFamiliar: true, requiresMerchant: true },
    costs: [
      { currency: 'magical-implement', base: 50, scale: 1.0 },
      { currency: 'forbidden-tome',    base: 50, scale: 1.0 },
    ] },
  { id: 'MIND_AND_SOUL', characterId: 'necromancer', category: 'minigame', max: 20,
    gates: { requiresFindFamiliar: true, requiresArtificer: true },
    costs: [
      { currency: 'construct',   base: 10,  scale: 1.4 },
      { currency: 'soul-stone',  base: 250,  scale: 1.4 },
      { currency: 'mana',        base: 10000, scale: 1.4 },
    ] },

  // ── Merchant — standard ──────────────────────────────────────
  { id: 'BOXING_DAY', characterId: 'merchant', category: 'standard', max: 50,
    costs: [{ currency: 'gold', base: 500_000, scale: 1.12 }] },
  { id: 'SHADY_CONNECTIONS', characterId: 'merchant', category: 'standard', max: 20,
    costs: [
      { currency: 'spice', base: 5000,  scale: 1.3 },
      { currency: 'dossier',      base: 5000, scale: 1.3 },
    ] },
  { id: 'BLACK_MARKET_CONNECTIONS', characterId: 'merchant', category: 'standard', max: 10,
    costs: [
      { currency: 'gold',          base: 1_000_000, scale: 1.5 },
      { currency: 'treasure', base: 200,       scale: 1.5 },
      { currency: 'gemstone', base: 200,       scale: 1.5 },
    ] },
  { id: 'SMUGGLER_NETWORK', characterId: 'merchant', category: 'standard', max: 25,
    costs: [
      { currency: 'dossier',   base: 10000, scale: 1.3 },
      { currency: 'monster-trophy',  base: 10,  scale: 1.3 },
    ] },

  // ── Merchant — minigame ──────────────────────────────────────
  { id: 'RIGGED_GAME', characterId: 'merchant', category: 'minigame', max: 25,
    costs: [
      { currency: 'magical-implement',         base: 25, scale: 1.3 },
      { currency: 'bone',         base: 10_000, scale: 1.2 },
    ] },
  { id: 'DIVERSIFIED_PORTFOLIO', characterId: 'merchant', category: 'minigame', max: 6,
    costs: [
      { currency: 'gold',         base: 2_900,  scale: 1.5 },
      { currency: 'dossier',      base: 5_000, scale: 1.5 },
    ] },
  { id: 'STABLE_MARKET', characterId: 'merchant', category: 'minigame', max: 20,
    costs: [
      { currency: 'gold',          base: 200_000, scale: 1.3 },
      { currency: 'precious-metal', base: 100,     scale: 1.3 },
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

  // ── Artificer — standard ──────────────────────────────────────
  { id: 'DEEP_STUDY', characterId: 'artificer', category: 'standard', max: 1,
    costs: [
      { currency: 'forbidden-tome',      base: 50000,  scale: 1.0 },
      { currency: 'gemstone', base: 25000,   scale: 1.0 },
    ] },
  { id: 'FOCUSED_REFLECTION', characterId: 'artificer', category: 'standard', max: 7,
    costs: [
      { currency: 'precious-metal',      base: 2000,  scale: 1.3 },
      { currency: 'magical-implement', base: 200,   scale: 1.3 },
    ] },
  { id: 'AMPLIFIED_INSIGHT', characterId: 'artificer', category: 'standard', max: 24,
    costs: [
      { currency: 'mana',      base: 30000,  scale: 1.25 },
      { currency: 'construct', base: 15,   scale: 1.25 },
    ] },
  { id: 'POTION_ARCANE_INTELLECT', characterId: 'artificer', category: 'standard', max: 3,
    costs: [
      { currency: 'mana',               base: 100000,  scale: 2.0 },
      { currency: 'monster-trophy',           base: 100,   scale: 2.0 },
      { currency: 'synaptical-potion',   base: 15,    scale: 1.5 },
    ] },

  // ── Artificer — minigame ──────────────────────────────────────
  { id: 'EXTENDED_ETCHING', characterId: 'artificer', category: 'minigame', max: 5,
    costs: [
      { currency: 'construct', base: 5,  scale: 1.4 },
      { currency: 'mana',     base: 50000, scale: 1.5 },
    ] },
  { id: 'SECOND_CHANCE', characterId: 'artificer', category: 'minigame', max: 1,
    costs: [
      { currency: 'construct', base: 35,  scale: 1.0 },
      { currency: 'mana',     base: 100000, scale: 1.0 },
      { currency: 'synaptical-potion',     base: 1000, scale: 1.0 },
    ] },

  // ── Chimeramancer — standard ──────────────────────────────────
  { id: 'BIGGER_THREADS', characterId: 'chimeramancer', category: 'standard', max: 999,
    costs: [
      { currency: 'life-thread', base: 50,  scale: 1.15 },
      { currency: 'mana',        base: 10000, scale: 1.15 },
    ] },
  { id: 'SHARPER_NEEDLES', characterId: 'chimeramancer', category: 'standard', max: 999,
    gates: { requiresBiggerThreads: true },
    costs: [
      { currency: 'gold',      base: 100_000, scale: 1.15 },
      { currency: 'brimstone', base: 650,     scale: 1.15 },
    ] },
  { id: 'LOOM_OF_LIFE', characterId: 'chimeramancer', category: 'standard', max: 999,
    gates: { requiresSharperNeedles: true },
    costs: [
      { currency: 'magical-implement', base: 20,  scale: 1.2 },
      { currency: 'monster-trophy',    base: 10,  scale: 1.2 },
      { currency: 'kobold-pebble',     base: 50,  scale: 1.2 },
    ] },

  // ── Chimeramancer — minigame ──────────────────────────────────
  { id: 'QUICK_STITCHING', characterId: 'chimeramancer', category: 'minigame', max: 16,
    costs: [
      { currency: 'construct',     base: 20,  scale: 2.0 },
      { currency: 'life-thread',   base: 100, scale: 2.0 },
      { currency: 'kobold-pebble', base: 200, scale: 1.8 },
    ] },
  { id: 'MINOR_TOUCH_UP', characterId: 'chimeramancer', category: 'minigame', max: 20,
    costs: [
      { currency: 'gold',  base: 100_000, scale: 1.6 },
      { currency: 'herb',  base: 1_000,   scale: 1.6 },
      { currency: 'spice', base: 500,     scale: 1.6 },
    ] },

  // ── Slayer — standard ──────────────────────────────────────────
  { id: 'KNOW_NO_FEAR', characterId: 'slayer', category: 'standard', max: 64,
    gates: { requiresSlayerDamage: true },
    costs: [{ currency: 'ichor', base: 10, scale: 1.1 }] },
  { id: 'BLOODLUST', characterId: 'slayer', category: 'standard', max: 25,
    gates: { requiresSlayerDamage: true },
    costs: [{ currency: 'ichor', base: 20, scale: 1.3 }] },
  { id: 'CONDEMN', characterId: 'slayer', category: 'standard', max: 7,
    gates: { requiresSlayerDamage: true },
    costs: [{ currency: 'ichor', base: 77, scale: 1.15 }] },
  { id: 'CONSECRATE', characterId: 'slayer', category: 'standard', max: 50,
    gates: { requiresSlayerGoldBead1: true },
    costs: [{ currency: 'ichor', base: 25_000, scale: 1.2 }] },
  { id: 'BANISHMENT', characterId: 'slayer', category: 'standard', max: 1,
    gates: { requiresSlayerGoldBead1: true },
    costs: [{ currency: 'ichor', base: 100_000, scale: 1.0 }] },
  { id: 'WINDFURY', characterId: 'slayer', category: 'standard', max: 9,
    gates: { requiresSlayerDamage: true },
    costs: [{ currency: 'ichor', base: 1_000_000, scale: 1.1 }] },
  { id: 'THUNDERFURY', characterId: 'slayer', category: 'standard', max: 1,
    gates: { requiresWindfury: true },
    costs: [{ currency: 'ichor', base: 3_000_000, scale: 1.0 }] },
  { id: 'SUNFURY', characterId: 'slayer', category: 'standard', max: 1,
    gates: { requiresThunderfury: true },
    costs: [{ currency: 'ichor', base: 20_000_000, scale: 1.0 }] },
  { id: 'SUNDER_ARMOR', characterId: 'slayer', category: 'standard', max: 6,
    gates: { requiresSlayerDamage: true },
    costs: [{ currency: 'ichor', base: 50000, scale: 1.4 }] },

  // ── Slayer — sidequest (minigame) ─────────────────────────────
  { id: 'SLAYER_GOLD_BEAD_1', characterId: 'slayer', category: 'minigame', max: 1,
    gates: { requiresSlayerDamage: true },
    costs: [{ currency: 'ichor', base: 25_000, scale: 1.0 }] },
  { id: 'SLAYER_GOLD_BEAD_2', characterId: 'slayer', category: 'minigame', max: 1,
    gates: { requiresSlayerDamage: true },
    costs: [{ currency: 'ichor', base: 250_000, scale: 1.0 }] },
  { id: 'RELIC_SLAYER', characterId: 'slayer', category: 'minigame', max: 1,
    gates: { requiresSlayerDamage: true, requiresSlayerGoldBeads: true },
    costs: [{ currency: 'ichor', base: 1_000_000_000, scale: 1.0 }] },

  // ── Scroll of True Resurrection — post-victory upgrade ────────
  // Cost is dynamically set to the player's current ichor balance by AppComponent.
  { id: 'SCROLL_OF_TRUE_RESURRECTION', characterId: 'slayer', category: 'standard', max: 1,
    gates: { requiresChimeraSlain: true },
    costs: [{ currency: 'ichor', base: 1, scale: 1.0 }] },

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
  { id: 'RELIC_MERCHANT', characterId: 'merchant', category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_ARTIFICER', characterId: 'artificer', category: 'relic', max: 1,
    gates: { requiresRelic: true },
    costs: [{ currency: 'relic',   base: 1,  scale: 1.0 },
            { currency: 'jewelry', base: 10, scale: 1.0 }] },
  { id: 'RELIC_CHIMERAMANCER', characterId: 'chimeramancer', category: 'relic', max: 1,
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

  // ── Artificer ─────────────────────────────────────────────
  /** Base insight steps gained per Study click (before Deep Study). */
  ARTIFICER_INSIGHT_PER_CLICK: 1,
  /** Maximum insight bar level. */
  ARTIFICER_MAX_INSIGHT: 8,
  /** Additional insight levels from Amplified Insight (added before squaring). */
  ARTIFICER_AMPLIFIED_INSIGHT_PER_LEVEL: 1,
  /** Additional max insight per Potion of Arcane Intellect level. */
  ARTIFICER_ARCANE_INTELLECT_PER_LEVEL: 8,
  /** Maximum insight that can be consumed per single Reflect action. */
  ARTIFICER_MAX_CONSUME_PER_REFLECT: 8,

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
  CHEST_GOLD_MIN: 4000,
  /** Max gold awarded when a treasure chest is found. */
  CHEST_GOLD_MAX: 16000,
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
  BAG_OF_HOLDING_GOLD_YIELD_PER_LEVEL: 350,
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
  METAL_COST: 24,
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

// ── Artificer Minigame ───────────────────────────────────────
export const ARTIFICER_MG = {
  /** Symbols used for the Etching Simon Says sequence. */
  SYMBOLS: ['potion', 'mana', 'relic', 'magical-implement', 'soul-stone'] as readonly string[],
  /** Base sequence length (before Extended Etching). */
  BASE_SEQUENCE_LENGTH: 5,
  /** Flash duration per symbol in ms. */
  FLASH_DURATION_MS: 400,
  /** Pause between flashes in ms. */
  FLASH_PAUSE_MS: 150,
  /** Base constructs awarded on success. */
  BASE_CONSTRUCT_REWARD: 1,
  /** Multiplier per Extended Etching symbol added. */
  EXTENDED_ETCHING_REWARD_MULTIPLIER: 2,
  /** Constructs consumed to start an Etching round. */
  MANA_COST: 250,
  /** XP awarded on a successful etching. */
  XP_REWARD: 5,
} as const;

// ── Chimeramancer ─────────────────────────────────────────────
/** Base Life Thread per hero-button "Stitch" click. */
export const CHIMERAMANCER_YIELDS = {
  THREAD_PER_CLICK: 1,
} as const;

/**
 * ═══════════════════════════════════════════════════════════════
 *  CHIMERIC ANIMATION (Chimeramancer Minigame)
 *  Configurable resource requirements to build the chimera.
 *  Each entry defines a currency and how many units are needed.
 * ═══════════════════════════════════════════════════════════════
 */
export interface ChimeraResourceReq {
  readonly currencyId: string;
  readonly required: number;
}

export const CHIMERAMANCER_MG = {
  /**
   * Resources required to complete the chimera.
   * Order determines display order.  Quantities are fully configurable.
   */
  RESOURCE_REQUIREMENTS: [
    { currencyId: 'beast',              required: 25_000   },
    { currencyId: 'pixie-dust',         required: 10_000   },
    { currencyId: 'synaptical-potion',  required: 10_000   },
    { currencyId: 'kobold-ear',         required: 30_000   },
    { currencyId: 'kobold-tongue',      required: 20_000   },
    { currencyId: 'kobold-hair',        required: 20_000   },
    { currencyId: 'hearty-meal',        required: 15_000   },
    { currencyId: 'kobold-fang',        required: 15_000  },
    { currencyId: 'kobold-feather',     required: 10_000   },
    { currencyId: 'kobold-pebble',      required: 10_000   },
    { currencyId: 'kobold-heart',       required: 5_000    },
    { currencyId: 'bone',               required: 200_000  },
    { currencyId: 'soul-stone',         required: 100_000   },
    { currencyId: 'mana',               required: 200_000  },
    { currencyId: 'construct',          required: 20_000   },
    { currencyId: 'life-thread',        required: 1_000_000   },
    { currencyId: 'xp',                 required: 2_500_000 },
  ] as readonly ChimeraResourceReq[],

  /** Amount of a resource contributed per click. */
  CONTRIBUTE_AMOUNT: 1,
} as const;

// ── Merchant Minigame ────────────────────────────────────────
/** Loot table entry for opening Illicit Goods. */
export interface IllicitLootEntry {
  /** Currency ID awarded when this row is selected. */
  readonly currencyId: string;
  /** Relative weight — higher = more likely to be picked. */
  readonly weight: number;
  /** Minimum amount rolled (inclusive). */
  readonly min: number;
  /** Maximum amount rolled (inclusive). */
  readonly max: number;
}

export const MERCHANT_MG = {
  /** Illicit Goods consumed per single "open" action (hero button base). */
  GOODS_COST: 1,
  /** XP awarded per successful opening. */
  XP_REWARD: 1,
  /** Number of loot rolls per opening (base). */
  BASE_ROLLS: 1,

  /**
   * ═══════════════════════════════════════════════════════════════
   *  ILLICIT GOODS LOOT TABLE
   *  Configurable — add/remove/reweight entries here.
   *  The roll picks one entry by weight, then awards a random
   *  amount in [min, max].
   * ═══════════════════════════════════════════════════════════════
   */
  LOOT_TABLE: [
    // ── Common (previous currencies) ────────────────────────────
    { currencyId: 'gold',                weight: 25,  min: 100,   max: 500   },
    { currencyId: 'herb',                weight: 15,  min: 5,    max: 20    },
    { currencyId: 'beast',               weight: 15,  min: 5,    max: 20    },
    { currencyId: 'potion',              weight: 12,  min: 2,    max: 10    },
    { currencyId: 'spice',               weight: 12,  min: 5,    max: 30    },
    { currencyId: 'dossier',             weight: 10,  min: 5,    max: 30    },
    { currencyId: 'treasure',            weight: 8,   min: 1,    max: 5     },
    { currencyId: 'precious-metal',      weight: 6,   min: 1,    max: 5     },
    { currencyId: 'gemstone',            weight: 5,   min: 5,     max: 10     },
    { currencyId: 'bone',                weight: 8,   min: 5,    max: 30    },
    { currencyId: 'brimstone',           weight: 8,   min: 5,    max: 30    },
    { currencyId: 'concentrated-potion', weight: 5,   min: 2,     max: 10     },
    { currencyId: 'xp',                  weight: 10,  min: 1,   max: 100   },

    // ── Kobold parts ────────────────────────────────────────────
    { currencyId: 'kobold-ear',          weight: 5,   min: 1,     max: 5      },
    { currencyId: 'kobold-tongue',       weight: 3,   min: 1,     max: 3      },
    { currencyId: 'kobold-hair',         weight: 3,   min: 1,     max: 3      },
    { currencyId: 'kobold-fang',         weight: 2,   min: 1,     max: 2      },
    { currencyId: 'kobold-brain',        weight: 2,   min: 1,     max: 2      },
    { currencyId: 'kobold-feather',      weight: 2,   min: 1,     max: 2      },
    { currencyId: 'kobold-pebble',       weight: 2,   min: 1,     max: 2      },
    { currencyId: 'kobold-heart',        weight: 1,   min: 1,     max: 1      },

    // ── Uncommon ────────────────────────────────────────────────
    { currencyId: 'pixie-dust',          weight: 3,   min: 5,     max: 20     },
    { currencyId: 'hearty-meal',         weight: 3,   min: 2,     max: 10     },
    { currencyId: 'jewelry',             weight: 2,   min: 1,     max: 5      },
    { currencyId: 'synaptical-potion',   weight: 2,   min: 1,     max: 5      },
    { currencyId: 'soul-stone',          weight: 2,   min: 5,     max: 25     },

    // ── Rare (new Merchant currencies) ──────────────────────────
    { currencyId: 'monster-trophy',      weight: 4,   min: 1,     max: 3      },
    { currencyId: 'forbidden-tome',      weight: 3,   min: 1,     max: 2      },
    { currencyId: 'magical-implement',   weight: 2,   min: 1,     max: 2      },
  ] as readonly IllicitLootEntry[],

  /** Extra % chance per Shady Connections level to roll an additional loot entry. */
  SHADY_CONNECTIONS_BONUS_PER_LEVEL: 3,
  /** Extra % chance per Black Market Connections level to shift weight toward rare rows. */
  BLACK_MARKET_RARE_BONUS_PER_LEVEL: 1,
  /** Percent chance per Smuggler's Network level to double the number of opens per click. */
  SMUGGLER_NETWORK_CHANCE_PER_LEVEL: 4,
  /** Discount per Rigged Game level applied to all stock market prices (0.01 = 1%). */
  RIGGED_GAME_DISCOUNT_PER_LEVEL: 0.01,
  /** Max price reduction per Stable Market level (0.01 = 1%). */
  STABLE_MARKET_REDUCTION_PER_LEVEL: 0.01,

  /**
   * Maps each stock market currency to its Diversified Portfolio unlock tier.
   * Tier 0 = always visible. Each DIVERSIFIED_PORTFOLIO level unlocks the next tier.
   */
  PORTFOLIO_TIER_MAP: {
    'illicit-goods': 0,
    'herb': 1, 'beast': 1, 'pixie-dust': 1, 'kobold-ear': 1,
    'potion': 2, 'concentrated-potion': 2, 'kobold-tongue': 2,
    'spice': 3, 'hearty-meal': 3, 'kobold-hair': 3,
    'dossier': 4, 'treasure': 4, 'kobold-fang': 4,
    'precious-metal': 5, 'gemstone': 5, 'jewelry': 5, 'kobold-brain': 5,
    'bone': 6, 'brimstone': 6, 'soul-stone': 6, 'kobold-feather': 6, 'kobold-pebble': 6, 'kobold-heart': 6,
  } as Record<string, number>,

  // ── Stock Market (minigame) ─────────────────────────────────
  /** How often prices re-roll (ms). */
  STOCK_MARKET_TICK_MS: 5000,
  /** Purchase increment options. */
  STOCK_MARKET_INCREMENTS: [1, 5, 10, 100] as readonly number[],
  /** Auto-buyer purchases this many items per tick. */
  AUTO_BUY_AMOUNT: 100,
  /** Quantity of a random stock-market resource awarded free per jack click by the Merchant relic. */
  RELIC_FREE_PURCHASE_QTY: 1,
  /**
   * Pool of currency IDs the Merchant relic can randomly award.
   * Includes the full stock-market table plus uncommon resources.
   */
  RELIC_PURCHASE_POOL: [
    'illicit-goods', 'herb', 'beast', 'potion', 'spice', 'dossier',
    'treasure', 'precious-metal', 'gemstone', 'bone', 'brimstone',
    'concentrated-potion', 'pixie-dust', 'hearty-meal', 'jewelry',
    'soul-stone', 'synaptical-potion',
    'kobold-ear', 'kobold-tongue', 'kobold-hair', 'kobold-fang', 'kobold-brain', 'kobold-feather', 'kobold-pebble', 'kobold-heart',
  ] as readonly string[],
  /** Auto-buyer tick interval (ms). */
  AUTO_BUY_INTERVAL_MS: 1000,
  /**
   * Stock market price table — each entry maps to a currency that can
   * be purchased with gold.  Prices randomly fluctuate within [min, max].
   */
  STOCK_MARKET_TABLE: [
    { currencyId: 'illicit-goods',       basePrice: 5000,   minPrice: 3000,   maxPrice: 10000   },
    { currencyId: 'herb',                basePrice: 500,    minPrice: 200,    maxPrice: 1900    },
    { currencyId: 'beast',               basePrice: 800,    minPrice: 300,    maxPrice: 1500    },
    { currencyId: 'potion',              basePrice: 1500,   minPrice: 500,    maxPrice: 3000    },
    { currencyId: 'spice',               basePrice: 600,    minPrice: 200,    maxPrice: 1400    },
    { currencyId: 'dossier',             basePrice: 600,    minPrice: 200,    maxPrice: 1400    },
    { currencyId: 'treasure',            basePrice: 4000,   minPrice: 1500,   maxPrice: 8000    },
    { currencyId: 'precious-metal',      basePrice: 5000,   minPrice: 2000,   maxPrice: 10000   },
    { currencyId: 'gemstone',            basePrice: 8000,   minPrice: 3000,   maxPrice: 15000   },
    { currencyId: 'bone',                basePrice: 900,    minPrice: 600,    maxPrice: 1400    },
    { currencyId: 'brimstone',           basePrice: 900,    minPrice: 600,    maxPrice: 1400    },
    { currencyId: 'concentrated-potion', basePrice: 6000,   minPrice: 2500,   maxPrice: 12000   },
    { currencyId: 'pixie-dust',          basePrice: 10000,  minPrice: 4000,   maxPrice: 20000   },
    { currencyId: 'hearty-meal',         basePrice: 15000,  minPrice: 6000,   maxPrice: 30000   },
    { currencyId: 'jewelry',             basePrice: 3000,  minPrice: 10000,  maxPrice: 60000   },
    { currencyId: 'soul-stone',          basePrice: 5000,   minPrice: 2000,   maxPrice: 16000   },
    // ── Kobold parts ────────────────────────────────────────────
    { currencyId: 'kobold-ear',          basePrice: 15000,   minPrice: 6000,    maxPrice: 30000    },
    { currencyId: 'kobold-tongue',       basePrice: 20000,   minPrice: 8000,    maxPrice: 40000    },
    { currencyId: 'kobold-hair',         basePrice: 20000,   minPrice: 8000,    maxPrice: 40000    },
    { currencyId: 'kobold-fang',         basePrice: 25000,   minPrice: 10000,   maxPrice: 50000    },
    { currencyId: 'kobold-brain',        basePrice: 60000,   minPrice: 25000,   maxPrice: 70000   },
    { currencyId: 'kobold-feather',      basePrice: 30000,   minPrice: 12000,   maxPrice: 80000    },
    { currencyId: 'kobold-pebble',       basePrice: 35000,   minPrice: 14000,   maxPrice: 90000    },
    { currencyId: 'kobold-heart',        basePrice: 50000,   minPrice: 20000,   maxPrice: 100000   },
  ] as const,
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
  /** Effective jack count added by each active familiar (base, before Mind and Soul). */
  JACKS_PER_FAMILIAR: 1,
  /** Additional effective familiars per Mind and Soul level. */
  MIND_AND_SOUL_PER_LEVEL: 1,
} as const;

// ── Bead System ──────────────────────────────────────────────
export const BEADS = {
  /** Chance (0–1) per manual hero click to discover a blue bead. */
  BLUE_CHANCE: 1 / 1500,
  /** Chance (0–1) per jack/familiar auto-click to discover a gold bead. */
  GOLD_CHANCE: 1 / 10000,
  /** Resource yield multiplier per socketed blue bead. */
  BLUE_YIELD_MULT: 2,
  /** Chance (0–1) per successful minigame completion to discover a gold bead. */
  MINIGAME_GOLD_BEAD_CHANCE: 1 / 100,
  /** Minimum manual (non-auto-solve) sidequest clears before gold-1 bead can drop. */
  GOLD_BEAD_MIN_MANUAL_CLEARS: 50,
} as const;

// ── Auto-Solve Timings ──────────────────────────────────────
export const AUTO_SOLVE = {
  /** Fighter: one attack per this many ms. */
  FIGHTER_TICK_MS:      1000,
  /** Ranger: one cell pick per this many ms. */
  RANGER_TICK_MS:       1000,
  /** Apothecary: one brew click per this many ms. */
  APOTHECARY_TICK_MS:   280,
  /** Culinarian: one guess action per this many ms. */
  CULINARIAN_TICK_MS:   1500,
  /** Thief: one crack attempt per this many ms. */
  THIEF_TICK_MS:        1000,
  /** Artisan: one gem selection per this many ms. */
  ARTISAN_TICK_MS:      1000,
  /** Necromancer: one node selection per this many ms. */
  NECROMANCER_TICK_MS:  750,
  /** Merchant: one goods opening per this many ms. */
  MERCHANT_TICK_MS:     1200,
  /** Artificer: one etching step per this many ms. */
  ARTIFICER_TICK_MS:    800,
  /** Chimeramancer: one auto-stitch per this many ms. */
  CHIMERAMANCER_TICK_MS: 1000,
} as const;

/** Ordered bead slot IDs as displayed left-to-right around the relic socket. */
export const BEAD_SLOT_ORDER = ['blue-1', 'gold-1', 'gold-2', 'blue-2'] as const;
export type BeadSlotId = typeof BEAD_SLOT_ORDER[number];
export type BeadType = 'blue' | 'gold';

export interface BeadSlotState {
  found: boolean;
  socketed: boolean;
}

// ── Gold-2 bead unlock conditions ────────────────────────────────
/**
 * Each character has a deterministic unlock condition for the gold-2 bead.
 * These are multi-game patterns that must be completed without breaking the streak.
 */
export const GOLD2_CONDITIONS = {
  /** When true, log a 'rare' message each time a gold-2 sequence step is completed. */
  LOG_PROGRESS: true,

  /** Fighter: kill kobolds at selected levels 1, 1, 2, 3, 5 in sequence. */
  FIGHTER_KILL_LEVELS: [1, 1, 2, 3, 5] as readonly number[],

  /**
   * Ranger: click cells in a specific pattern across 5 consecutive games.
   * Grid indices: TL=0  TM=1  TR=2  / ML=3  MM=4  MR=5  / BL=6  BM=7  BR=8
   */
  RANGER_CLICK_PATTERNS: [
    [0, 2, 7],     // Game 1: TL, TR, BM
    [1, 6, 8],     // Game 2: TM, BL, BR
    [5, 4, 3],     // Game 3: MR, MM, ML
    [0, 1, 2],     // Game 4: TL, TM, TR
    [6, 7, 8],     // Game 5: BL, BM, BR
  ] as readonly (readonly number[])[],

  /** Apothecary: brew up to 8/10, miss down to 0/10, then finish using only inner zone. */
  APOTHECARY_PEAK_QUALITY: 8,

  /**
   * Culinarian: submit these first guesses across 3 consecutive games.
   * Ingredients: herb, beast (meat), kobold-tongue (tongue), spice
   */
  CULINARIAN_FIRST_GUESSES: [
    ['spice', 'spice', 'herb', 'herb'],
    ['kobold-tongue', 'kobold-tongue', 'beast', 'beast'],
    ['kobold-tongue', 'herb', 'beast', 'spice'],
  ] as readonly (readonly string[])[],

  /**
   * Thief: guess these clock-face angles in order within 10° tolerance.
   * 12=0°, 3=90°, 6=180°, 9=270°
   */
  THIEF_ANGLE_SEQUENCE: [270, 90, 270, 0, 180, 270, 90] as readonly number[],
  THIEF_ANGLE_TOLERANCE: 20,

  /**
   * Artisan: first gem selected across 10 games.
   * Grid: TL=0  TM=1  TR=2  / BL=3  BM=4  BR=5
   */
  ARTISAN_FIRST_GEM_SEQUENCE: [0, 2, 3, 5, 2, 0, 3, 5, 1, 4] as readonly number[],

  /** Necromancer: complete 3 consecutive games without ever selecting an adjacent node. */
  NECROMANCER_NO_ADJACENT_STREAK: 3,

  /**
   * Merchant: purchase specific resources in this exact sequence on the stock market.
   * Each step requires buying exactly the listed quantity of the listed resource.
   * Any other purchase resets the sequence. Steps are matched in order.
   */
  MERCHANT_PURCHASE_SEQUENCE: [
    { currencyId: 'herb',           qty: 10 }, // tier 1
    { currencyId: 'beast',          qty: 10 }, // tier 1
    { currencyId: 'potion',         qty: 5  }, // tier 2
    { currencyId: 'spice',          qty: 10 }, // tier 3
    { currencyId: 'dossier',        qty: 10 }, // tier 4
    { currencyId: 'precious-metal', qty: 5  }, // tier 5
    { currencyId: 'gemstone',       qty: 5  }, // tier 5
    { currencyId: 'bone',           qty: 10 }, // tier 6
    { currencyId: 'brimstone',      qty: 10 }, // tier 6
    { currencyId: 'soul-stone',     qty: 5  }, // tier 6
  ] as readonly { currencyId: string; qty: number }[],

  /**
   * Artificer: intentionally fail the Etching minigame 10 times in a row,
   * selecting tile indices in this alternating pattern (0-based from the 5 symbols).
   */
  ARTIFICER_FAIL_SEQUENCE: [0, 2] as readonly number[],
  ARTIFICER_FAIL_STREAK: 10,
} as const;

/**
 * Good auto-solve tuning — used when both gold beads are socketed.
 */
export const GOOD_AUTO_SOLVE = {
  /** Fighter: faster tick (ms) when upgraded. */
  FIGHTER_TICK_MS:     500,
  /** Apothecary: ultra-fast tick (ms) when upgraded. */
  APOTHECARY_TICK_MS:  120,
  /** Merchant: faster goods opening (ms) when upgraded. */
  MERCHANT_TICK_MS:    600,
} as const;

// ── Slayer (Endgame Boss Fight) ──────────────────────────────
export const SLAYER = {
  /** Total Chimera HP for the boss fight. */
  MAX_HP:            666_666_666,
  /** Damage dealt per successful click on an active button. */
  DAMAGE_PER_CLICK:  1,
  /** Number of circular buttons in the boss fight. */
  BUTTON_COUNT:      9,
  /** How often (ms) each button toggles on/off. */
  BUTTON_CYCLE_MS:   500,
  /** How long (ms) a button stays active before cycling. */
  BUTTON_ACTIVE_MS:  1000,
  /** Damage threshold after which the Slayer upgrade appears. */
  UPGRADE_THRESHOLD: 50,
  /** Delay (ms) between each character dying in the death sequence. */
  DEATH_DELAY_MS:    6660,

  // ── Auto-attack ─────────────────────────────────────────────
  /** Base auto-attack interval in ms (one hit every 3 seconds). */
  AUTO_ATTACK_BASE_MS:    3000,
  /** Minimum auto-attack interval (floor) in ms. */
  AUTO_ATTACK_MIN_MS:     500,
  /** Milliseconds subtracted per Bloodlust level. */
  /** Milliseconds subtracted per Bloodlust level. */
  BLOODLUST_REDUCTION_MS: 100,
  /** Additional damage per Know No Fear level. */
  KNOW_NO_FEAR_DAMAGE:    5,
  /** Duration (ms) of each Condemn stack. */
  CONDEMN_DURATION_MS:    7000,
  /** Maximum number of simultaneous Condemn stacks. */
  CONDEMN_MAX_STACKS:     7,
  /** Bonus damage per Condemn level per stack. */
  CONDEMN_DAMAGE_PER_LEVEL: 1,

  // ── Consecrate ──────────────────────────────────────────────
  /** Extra milliseconds added to Condemn stack duration per Consecrate level (+5 s each). */
  CONSECRATE_DURATION_BONUS_MS: 5_000,

  // ── Banishment ──────────────────────────────────────────────
  /** Damage multiplier applied when Banishment is purchased and all Condemn stacks are active. */
  BANISHMENT_DAMAGE_MULTIPLIER: 2,

  // ── Windfury ────────────────────────────────────────────────
  /** Chance to trigger an extra attack per Windfury level (0.10 = 10%). */
  WINDFURY_CHANCE_PER_LEVEL: 0.10,
  /** Maximum number of chained Windfury procs allowed when Thunderfury is purchased. */
  THUNDERFURY_MAX_CHAIN: 10,

  // ── Sunder Armor ──────────────────────────────────────────
  /** Base number of active weak spots (before Sunder Armor). */
  BASE_ACTIVE_SPOTS:            3,
  /** Extra weak spots exposed per Sunder Armor level. */
  SUNDER_ARMOR_SPOTS_PER_LEVEL: 1,

  // ── Blue Bead Drop Rates ───────────────────────────────────
  /** Chance (0–1) per manual weak-spot click to discover the blue-1 bead. */
  BLUE_BEAD_CLICK_CHANCE: 1 / 50,
  /** Chance (0–1) per auto-attack hit to discover the blue-2 bead. */
  BLUE_BEAD_AUTO_CHANCE:  1 / 200,
} as const;

