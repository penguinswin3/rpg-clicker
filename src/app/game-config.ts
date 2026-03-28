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
  /** XP required before the Apothecary unlock offer appears */
  APOTHECARY_UNLOCK: 1000,
  /** XP required to unlock all character minigame screens */
  MINIGAME_UNLOCK:   2500,
} as const;

// ── Character Unlock Costs ────────────────────────────────────
export const UNLOCK_COSTS = {
  RANGER_GOLD:       250,

  APOTHECARY_GOLD:   1500,
  APOTHECARY_HERBS:  250,
} as const;

// ── Upgrade Maximum Levels ───────────────────────────────────
// Once an upgrade reaches its max level, the buy button is disabled.
export const UPGRADE_MAX = {
  // Fighter
  SHARPER_SWORD:    999,
  CONTRACT_KILLING: 999,
  POTION_CHUGGING:  999,

  // Ranger
  MORE_HERBS:       999,
  /** At level 45 the beast-find chance already hits the 95% hard cap,
   *  but the level counter itself is allowed to run to 999. */
  BETTER_TRACKING:  999,

  // Apothecary
  /** 400 levels × +1% each = 400% save-chance.
   *  At 400% you can save all 4 out of 5 herbs consumed per brew. */
  POTION_TITRATION: 400,
  POTION_MARKETING: 999,
} as const;

// ── Upgrade Base Costs (gold unless noted) ────────────────────
export const BASE_COSTS = {
  // Fighter
  SHARPER_SWORD:    10,
  CONTRACT_KILLING: 25,
  POTION_CHUGGING:  5,   // paid in potions

  // Ranger
  MORE_HERBS:       15,
  BETTER_TRACKING:  20,

  // Apothecary
  POTION_TITRATION: 20,
  POTION_MARKETING: 30,
} as const;

// ── Upgrade Cost Scaling ──────────────────────────────────────
// next_cost = floor(current_cost × SCALE)
export const COST_SCALE = {
  SHARPER_SWORD:    1.5,
  CONTRACT_KILLING: 1.5,
  POTION_CHUGGING:  1.5,

  MORE_HERBS:       1.5,
  BETTER_TRACKING:  1.5,

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
} as const;

// ── Apothecary Minigame ───────────────────────────────────────
export const APOTH_MG = {
  /** On-beat clicks required to complete a Perfect Potion */
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
  /** Cooked Meat cost to begin a scouting round */
  SCOUT_COST:   25,

  /** Probability a prize cell contains Pixie Dust (0–1) */
  PIXIE_CHANCE: 0.10,
  /** Probability a prize cell contains a Herb (0–1; evaluated after Pixie roll) */
  HERB_CHANCE:  0.35,
  // Remaining probability → Raw Beast Meat
} as const;

