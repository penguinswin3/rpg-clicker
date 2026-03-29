/**
 * ════════════════════════════════════════════════════════════
 *   FLAVOR TEXT CONFIG
 *   All display names and descriptions in one place.
 *   Update strings here — no logic files need to change.
 * ════════════════════════════════════════════════════════════
 */

// ── Upgrades ──────────────────────────────────────────────────
export const UPGRADE_FLAVOR = {
  // Fighter
  BETTER_BOUNTIES: {
    name: 'Better Bounties',
    desc: '+1 gold per click',
  },
  CONTRACTED_HIRELINGS: {
    name: 'Contracted Hirelings',
    desc: '+1 gold/sec',
  },
  POTION_CHUGGING: {
    name: 'Potion Chugging',
    desc: '+1 HP per potion heal',
  },
  SHARPER_SWORDS: {
    name: 'Sharper Swords',
    desc: '+1 attack damage in combat',
  },

  // Ranger
  MORE_HERBS: {
    name: 'More Herbs',
    desc: '+1% chance to double base herbs',
  },
  BETTER_TRACKING: {
    name: 'Better Tracking',
    /** Static prefix — template appends the live "(now X%)" suffix. */
    desc: '+1% beast find chance',
  },

  // Apothecary
  POTION_TITRATION: {
    name: 'Potion Titration',
    desc: '+1% herb save chance on brew',
  },
  POTION_MARKETING: {
    name: 'Potion Marketing',
    desc: '+1 gold/sec from passive sales',
  },
} as const;

// ── Characters ────────────────────────────────────────────────
export const CHARACTER_FLAVOR = {
  FIGHTER: {
    name: 'Fighter',
    desc: 'A seasoned warrior armed with blade and shield.',
    questBtn: 'Complete Bounty',
  },
  RANGER: {
    name: 'Ranger',
    desc: 'A swift archer who strikes from the shadows.',
    questBtn: 'Hunt & Gather',
  },
  APOTHECARY: {
    name: 'Apothecary',
    desc: 'A skilled brewer who turns rare ingredients into powerful potions.',
    questBtn: 'Alchemize',
  },
} as const;

// ── Minigames ─────────────────────────────────────────────────
export const MINIGAME_FLAVOR = {
  FIGHTER: {
    name: 'Open Wilderness',
    desc: 'Face waves of enemies in gladiatorial combat.\nSurvive as long as you can.',
  },
  RANGER: {
    name: 'Hunting Grounds',
    desc: 'Track and pursue elusive prey\nthrough the ancient forest.',
  },
  APOTHECARY: {
    name: 'Alchemy Tablet',
    desc: 'Combine rare ingredients to brew\npowerful concoctions.',
  },
} as const;

// ── Global Upgrades ───────────────────────────────────────────
export const GLOBAL_UPGRADE_FLAVOR = {
  UNLOCK_MINIGAMES: {
    name: 'Unlock Minigames',
    desc: 'Unlocks character-specific minigame challenges',
  },
} as const;

// ── Hero Stats Box ────────────────────────────────────────────
export const HERO_STATS_FLAVOR = {
  BOX_TITLE: '[ CHARACTER STATS ]',

  FIGHTER: {
    PER_CLICK:  'Per Click   :',
    PER_SECOND: 'Per Second  :',
  },
  RANGER: {
    HERB_CHANCE:  'Herb Chance  :',
    BEAST_CHANCE: 'Beast Chance :',
    HERB_DOUBLE:  'Herb Double  :',
  },
  APOTHECARY: {
    HERBS_BREW:  'Herbs/Brew   :',
    SAVE_CHANCE: 'Save Chance  :',
    SELL_RATE:   'Sell Rate    :',
  },
} as const;

