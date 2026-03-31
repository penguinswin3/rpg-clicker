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
  'kobold-tongue':       { name: 'Kobold Tongue',             symbol: 'γ',  color: '#c75050' },
  'kobold-hair':         { name: 'Kobold Hair',              symbol: 'Ҩ',  color: '#8a4b40' },
  spice:                 { name: 'Spice',                     symbol: 'Δ',  color: '#f07b28' },
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
  HIRELINGS_HIRELINGS: {
    name: "Hireling's Hirelings",
    desc: 'Each hireling gets this many hirelings, also generating +1 gold/sec',
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
    desc: '+1 gold every time you brew a potion base',
  },
  POTION_GLIBNESS: {
    name: 'Potion of Glibness',
    desc: '-1% spice purchase cost per level',
  },
  BUBBLING_BREW: {
    name: 'Bubbling Brew',
    desc: 'Skilled brewing will award bonus progress',
  },
  BIGGER_BUBBLES: {
    name: 'Bigger Bubbles',
    desc: 'Increases the size of the Bubbling zone',
  },
  POTION_DILUTION: {
    name: 'Potion Dilution',
    desc: '2x concentrated potions, 50% chance to downgrade to potion base',
  },
  SERIAL_DILUTION: {
    name: 'Serial Dilution',
    desc: '-1% dilution failure chance per level',
  },

  // Culinarian
  WHOLESALE_SPICES: {
    name: 'Wholesale Spices',
    desc: '+1 spice per click, purchased at a discount!',
  },
} as const;

// ── Kobold Variants (per fighter-minigame level) ──────────────
/**
 * Each entry defines the look and secondary loot for a kobold tier.
 * Index 0 = base kobold (level 1). Index 1 = level 2, etc.
 * Entries beyond the array length fall back to the last defined variant.
 */
export interface KoboldVariant {
  /** Display name for this kobold tier. */
  readonly name: string;
  /** Multi-line ASCII art shown in the minigame. */
  readonly ascii: string;
  /**
   * Optional secondary drop (in addition to the standard Kobold Ear).
   * `null` means this level only drops ears.
   */
  readonly secondaryDrop: {
    readonly currencyId: string;
    readonly amount:     number;
    /** Base percent chance to drop (0–100). */
    readonly chance:     number;
  } | null;
}

export const KOBOLD_VARIANTS: readonly KoboldVariant[] = [
  // Level 1 — basic Kobold
  {
    name: 'Kobold',
    ascii:
      '  <(>_<)>↟  \n' +
      '   /||-- |   \n' +
      '   d  b  |   ',
    secondaryDrop: null,
  },
  // Level 2 — Snake Kobold
  {
    name: 'Snake Kobold',
    ascii:
      '(\\     <(\'w\')>\n' +
      ' \\\\/‾‾\\_/ /\n' +
      '  \\_/\\___/',
    secondaryDrop: {
      currencyId: 'kobold-tongue',
      amount: 1,
      chance: 33,
    },
  },
  // Level 3 — Spider Kobold
  {
    name: 'Spider Kobold',
    ascii:
      '|| ^ ^ ||  \n' +
      '\\\\(-.-)// \n' +
      '//(   )\\\\\n' +
      '|| ‾‾‾ ||',
    secondaryDrop: {
      currencyId: 'kobold-hair',
      amount: 1,
      chance: 33,
    },
  },
];

// ── Characters ────────────────────────────────────────────────
export const CHARACTER_FLAVOR = {
  FIGHTER: {
    name: 'Fighter',
    desc: 'A mercenary looking to get by, completing odd jobs and learning about the world around him.',
    questBtn: 'Complete Bounty',
  },
  RANGER: {
    name: 'Ranger',
    desc: 'A perceptive folk, and a warden of the woods. Even when her prey escapes, she manages to always bring something home.',
    questBtn: 'Hunt & Gather',
  },
  APOTHECARY: {
    name: 'Apothecary',
    desc: 'The proud owner of a small potion shop. He is quite good at his craft, and specializes in versatile potion bases.',
    questBtn: 'Alchemize',
  },
  CULINARIAN: {
    name: 'Culinarian',
    desc: 'A seasoned chef who sources only the finest ingredients. Can craft never before tasted dishes with peculiar potency...',
    questBtn: 'Source Ingredients',
  },
} as const;

// ── Minigames ─────────────────────────────────────────────────
export const MINIGAME_FLAVOR = {
  FIGHTER: {
    name: 'Wild Wilderness',
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
  CULINARIAN: {
    name: 'The Kitchen',
    desc: 'Master the art of spice and flame\nto craft legendary dishes.',
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
    PER_CLICK:    'Gold Per Click   :',
    PER_SECOND:   'Gold Per Second  :',
    XP_PER_CLICK: 'XP Per Bounty    :',
    DAMAGE_RANGE: 'Attack Damage    :',
  },
  RANGER: {
    BEAST_CHANCE: 'Beast Success :',
    HERB_DOUBLE:  'Herb Double   :',
    CATS_EYE:     "Cat's Eye     :",
    MAX_MEAT:     'Max Meat      :',
  },
  APOTHECARY: {
    HERBS_BREW:      'Herbs Per Brew   :',
    SAVE_CHANCE:     'Herb Save Chance :',
    GOLD_PER_BREW:   'Gold Per Brew    :',
    DILUTION_SUCCESS:'Dilution Success :',
  },
  CULINARIAN: {
    SPICE_PER_CLICK: 'Spice Per Click  :',
    GOLD_COST:       'Price Per Spice  :',
    GOLD_DISCOUNT:   'Spice Discount   :',
  },
} as const;

