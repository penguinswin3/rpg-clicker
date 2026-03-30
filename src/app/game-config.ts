/**
 * ════════════════════════════════════════════════════════════
 *   GAME BALANCE CONFIG
 *   Central location for every tunable value in the game.
 *   Adjust numbers here — no logic files need to change.
 * ════════════════════════════════════════════════════════════
 */

// ── XP Unlock Thresholds ─────────────────────────────────────
export const XP_THRESHOLDS = {
  /** XP required before the Ranger unlock offer appears */
  RANGER_UNLOCK:     100,
  /** XP required before the Insightful Contracts upgrade appears */
  INSIGHTFUL_CONTRACTS_UNLOCK: 500,
  /** XP required before the Apothecary unlock offer appears */
  APOTHECARY_UNLOCK: 1000,
  /** XP required before the First Jack purchase appears */
  JACKS_UNLOCK: 1500,
  /** XP required to unlock all character minigame screens */
  MINIGAME_UNLOCK:   2500,
  /** XP required before the Stronger Kobolds minigame upgrade appears */
  STRONGER_KOBOLDS_UNLOCK: 3000,
} as const;

// ── Jack of All Trades ────────────────────────────────────────
/** XP thresholds at which one additional Jack can be hired (in order). */
export const JACK_XP_THRESHOLDS: readonly number[] = [
  1500, 3000, 5000, 7500, 10_000,
  15_000, 20_000, 30_000, 50_000,
];

/** One-time cost to hire a single Jack. Costs scale per Jack purchased. */
export const JACK_COSTS = {
  // Base costs (for the first Jack)
  GOLD:    1000,
  BEAST:   200,
  POTIONS: 50,
  /** Multiplier applied to every cost for each Jack already owned. */
  SCALE: 1.5,
  /** After this many Jacks are owned, Kobold Ears and Pixie Dust are also required. */
  RARE_THRESHOLD: 4,
  /** Base Kobold Ears cost when rare costs kick in. */
  KOBOLD_EARS_BASE: 50,
  /** Base Pixie Dust cost when rare costs kick in. */
  PIXIE_DUST_BASE: 10,
} as const;

// ── Character Unlock Costs ────────────────────────────────────
export const UNLOCK_COSTS = {
  RANGER_GOLD:       250,

  APOTHECARY_GOLD:   1500,
  APOTHECARY_HERBS:  250,

  /** Minigame system unlock — available once XP >= MINIGAME_UNLOCK threshold */
  MINIGAME_GOLD:    2500,
  MINIGAME_POTIONS: 250,
  MINIGAME_BEAST:   250,
} as const;

// ── Upgrade Maximum Levels ───────────────────────────────────
// Once an upgrade reaches its max level, the buy button is disabled.
export const UPGRADE_MAX = {
  // Fighter
  BETTER_BOUNTIES:           999,
  CONTRACTED_HIRELINGS:      999,
  INSIGHTFUL_CONTRACTS:      999,
  POTION_CHUGGING:           999,
  SHARPER_SWORDS:            999,
  STRONGER_KOBOLDS:          10,   // 10 tiers; each unlocks one higher kobold level

  // Ranger
  MORE_HERBS:           999,
  BETTER_TRACKING:      999,
  BOUNTIFUL_LANDS:      100,  // 100% = every blank cell guaranteed a prize
  ABUNDANT_LANDS:       1,    // binary unlock — multiply yield by successful cell count
  POTION_CATS_EYE:      100,  // 100 levels × +1% = 100% chance to roll both herb and beast

  // Apothecary
  /** 400 levels × +1% each = 400% save-chance.
   *  At 400% you can save all 4 out of 5 herbs consumed per brew. */
  POTION_TITRATION: 400,
  POTION_MARKETING: 999,
} as const;

// ── Upgrade Base Costs (gold unless noted) ────────────────────
export const BASE_COSTS = {
  // Fighter
  BETTER_BOUNTIES:      10,
  CONTRACTED_HIRELINGS: 25,
  INSIGHTFUL_CONTRACTS: 75,  // gold; unlocked at 500 XP
  POTION_CHUGGING:      5,   // paid in potions
  SHARPER_SWORDS:       50,  // gold; minigame upgrade
  /** Kobold Ears base cost for Stronger Kobolds */
  STRONGER_KOBOLDS_EARS: 10,
  /** Raw Beast Meat base cost for Stronger Kobolds */
  STRONGER_KOBOLDS_MEAT: 25,

  // Ranger
  MORE_HERBS:       15,
  BETTER_TRACKING:  20,
  BOUNTIFUL_LANDS:  10,  // kobold ears; ranger minigame upgrade
  ABUNDANT_LANDS:   5,   // pixie dust; ranger minigame upgrade
  /** Concentrated Potion base cost for Potion of Cat's Eye */
  POTION_CATS_EYE_CONC:  5,
  /** Pixie Dust base cost for Potion of Cat's Eye */
  POTION_CATS_EYE_PIXIE: 15,

  // Apothecary
  POTION_TITRATION: 20,
  POTION_MARKETING: 30,
} as const;

// ── Upgrade Cost Scaling ──────────────────────────────────────
// next_cost = floor(current_cost × SCALE)
export const COST_SCALE = {
  BETTER_BOUNTIES:      1.5,
  CONTRACTED_HIRELINGS: 1.5,
  INSIGHTFUL_CONTRACTS: 2.0,
  POTION_CHUGGING:      1.5,
  SHARPER_SWORDS:       1.5,
  STRONGER_KOBOLDS:     1.8,

  MORE_HERBS:       1.5,
  BETTER_TRACKING:  1.5,
  BOUNTIFUL_LANDS:  1.5,
  POTION_CATS_EYE:  1.5,

  POTION_TITRATION: 1.5,
  POTION_MARKETING: 1.5,
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
  RANGER_BEAST_CHANCE_CAP:   95,

  /** Herbs consumed per Apothecary brew action */
  APOTHECARY_BREW_HERB_COST: 5,
} as const;

// ── Fighter Minigame ──────────────────────────────────────────
export const FIGHTER_MG = {
  /** Fighter's starting and maximum HP */
  MAX_HP:            100,
  /** Flat damage reduction subtracted from every enemy hit */
  DEFENSE:           0,
  /** HP restored when the Fighter consumes one Potion */
  POTION_HEAL:       10,

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
  KOBOLD_GOLD_MAX_PER_LEVEL:  5,
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
  HERB_COST:    100,
  /** Cursor speed: units per millisecond (100 units = full bar width) */
  BAR_SPEED:    0.05,
  /** Left edge of the on-beat target zone (percentage 0–100) */
  ZONE_MIN:     35,
  /** Right edge of the on-beat target zone (percentage 0–100) */
  ZONE_MAX:     65,
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
} as const;

