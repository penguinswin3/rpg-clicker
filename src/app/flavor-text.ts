/**
 * ════════════════════════════════════════════════════════════
 *   FLAVOR TEXT CONFIG
 *   All display names and descriptions in one place.
 *   Update strings here — no logic files need to change.
 * ════════════════════════════════════════════════════════════
 */

// ── Currencies ────────────────────────────────────────────────
export const CURRENCY_FLAVOR = {
  gold:                  { name: 'Gold',                      symbol: '$',  color: '#ffcc00' },
  xp:                    { name: 'Experience',                symbol: '֍',  color: '#53d394' },
  herb:                  { name: 'Herb',                      symbol: '♣',  color: '#247a24' },
  beast:                 { name: 'Raw Beast Meat',            symbol: 'Ꮻ',  color: '#e8739a' },
  'cooked-meat':         { name: 'Cooked Meat',               symbol: 'Ꮻ',  color: '#683a0c' },
  'pixie-dust':          { name: 'Pixie Dust',                symbol: '✦',  color: '#ffe066' },
  potion:                { name: 'Potion Base',               symbol: '⚗',  color: '#ceaedf' },
  'concentrated-potion': { name: 'Concentrated Potion Base',  symbol: '⚗',  color: '#ba70cf' },
  'kobold-ear':          { name: 'Kobold Left Ear',           symbol: '>',  color: '#e02020' },
} as const;

// ── Upgrades ──────────────────────────────────────────────────
export const UPGRADE_FLAVOR = {
  // Fighter
  BETTER_BOUNTIES: {
    name: 'Better Bounties',
    desc: '+1 gold per bounty',
  },
  CONTRACTED_HIRELINGS: {
    name: 'Contracted Hirelings',
    desc: '+1 gold/sec',
  },
  INSIGHTFUL_CONTRACTS: {
    name: 'Insightful Contracts',
    desc: '+1 XP per bounty completed',
  },
  POTION_CHUGGING: {
    name: 'Potion of Fortitude',
    desc: '+1 HP per potion heal',
  },
  SHARPER_SWORDS: {
    name: 'Sharper Swords',
    desc: '+1 max hit in combat',
  },
  STRONGER_KOBOLDS: {
    name: 'Stronger Kobolds',
    desc: 'They grow...',
  },

  // Ranger
  MORE_HERBS: {
    name: 'More Herbs',
    desc: '+1% chance to double base herbs',
  },
  BETTER_TRACKING: {
    name: 'Better Tracking',
    /** Static prefix — template appends the live "(now X%)" suffix. */
    desc: '+1% beast hunt chance',
  },
  BOUNTIFUL_LANDS: {
    name: 'Bountiful Lands',
    desc: '+1% chance to get an additional resource cell',
  },
  ABUNDANT_LANDS: {
    name: 'Abundant Lands',
    desc: 'Resource gain is multiplied by the number of successful finds',
  },
  POTION_CATS_EYE: {
    name: "Potion of Cat's Eye",
    desc: "+1% chance to roll both herb AND beast",
  },
  BIGGER_GAME: {
    name: 'Bigger Game',
    desc: '+1 max Raw Beast Meat per hero button press',
  },

  // Apothecary
  POTION_TITRATION: {
    name: 'Potion Titration',
    desc: '+1% herb save chance on brew',
  },
  POTION_MARKETING: {
    name: 'Potion Marketing',
    desc: '+1 gold/sec',
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

// ── Jack of All Trades ────────────────────────────────────────
export const JACK_FLAVOR = {
  PANEL_TITLE:    '[ JACKS OF ALL TRADES ]',
  AVAILABLE:      'Available',
  NEXT_UNLOCK:    'Next Jack at',
  ALL_UNLOCKED:   'All Jacks unlocked!',
  HIRE_BTN:       'Hire a Jack of All Trades',
  ASSIGN_LABEL:   'Assign Jacks',
} as const;

// ── Hero Stats Box ────────────────────────────────────────────
export const HERO_STATS_FLAVOR = {
  BOX_TITLE: '[ CHARACTER STATS ]',

  FIGHTER: {
    PER_CLICK:   'Per Click   :',
    PER_SECOND:  'Per Second  :',
    XP_PER_CLICK: 'XP / Bounty :',
  },
  RANGER: {
    HERB_CHANCE:  'Herb Chance  :',
    BEAST_CHANCE: 'Beast Chance :',
    HERB_DOUBLE:  'Herb Double  :',
    CATS_EYE:     "Cat's Eye    :",
    MAX_MEAT:     'Max Meat     :',
  },
  APOTHECARY: {
    HERBS_BREW:  'Herbs/Brew   :',
    SAVE_CHANCE: 'Save Chance  :',
    SELL_RATE:   'Sell Rate    :',
  },
} as const;

