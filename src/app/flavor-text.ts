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
  beast:                 { name: 'Beast Meat',                symbol: 'Ꮻ',  color: '#e8739a' },
  'pixie-dust':          { name: 'Pixie Dust',                symbol: '✦',  color: '#ffe066' },
  potion:                { name: 'Potion Base',               symbol: '⚗',  color: '#ceaedf' },
  'concentrated-potion': { name: 'Concentrated Potion Base',  symbol: '⚗',  color: '#ba70cf' },
  'kobold-ear':          { name: 'Kobold Left Ear',           symbol: '>',  color: '#e02020' },
  'kobold-tongue':       { name: 'Kobold Tongue',             symbol: 'γ',  color: '#c75050' },
  'kobold-hair':         { name: 'Kobold Hair',               symbol: 'Ҩ',  color: '#ac7c5a' },
  spice:                 { name: 'Spice',                     symbol: 'Δ',  color: '#f07b28' },
  'hearty-meal':         { name: 'Hearty Meal',               symbol: '♨',  color: '#683a0c' },
  dossier:               { name: 'Dossier',                   symbol: '⌸',  color: '#c0cedc' },
  treasure:              { name: 'Treasure',                  symbol: '⚱',  color: '#989c3a' },
  'kobold-fang':         { name: 'Kobold Fang',               symbol: '৲',  color: '#969790' },
  relic:                 { name: 'Relic',                     symbol: 'ᛝ',  color: '#a700ff' },

} as const;

// ꔮ 𐓑  ᛝ ᚕ
// ── Upgrade Colors ────────────────────────────────────────────
/** Shared accent colors for all upgrade cards. */
export const UPGRADE_COLORS = {
  /** Multi-level upgrades (standard color). */
  standard: '#00fff8',
  /** One-time / single-level upgrades (rare color). */
  rare:     '#ffcc00',
  /** Relic-category upgrades. */
  relic:    '#a700ff',
} as const;

// ── Upgrades ──────────────────────────────────────────────────
export const UPGRADE_FLAVOR = {
  // Fighter
  BETTER_BOUNTIES:      { name: 'Better Bounties',           desc: '+1 gold per bounty' },
  CONTRACTED_HIRELINGS: { name: 'Contracted Hirelings',      desc: '+1 gold/sec' },
  INSIGHTFUL_CONTRACTS: { name: 'Insightful Contracts',      desc: '+1 XP per bounty completed' },
  HIRELINGS_HIRELINGS:  { name: "Hireling's Hirelings",      desc: 'Each hireling gets this many hirelings, also generating +1 gold/sec' },
  POTION_CHUGGING:      { name: 'Potion of Fortitude',       desc: '+1 HP per potion heal' },
  SHORT_REST:           { name: 'Short Rest',                desc: 'Auto-heal to full HP with potions after each victory at a reduced efficiency' },
  SHARPER_SWORDS:       { name: 'Sharper Swords',            desc: '+1 max hit in combat' },
  SLOW_BLADE:           { name: 'The Slow Blade',            desc: '+1 minimum hit in combat' },
  STRONGER_KOBOLDS:     { name: 'Stronger Kobolds',          desc: 'They grow...' },
  FIRST_STRIKE:         { name: 'First Strike',              desc: 'The Fighter attacks before the enemy. Let the slaughter begin!' },

  // Ranger
  MORE_HERBS:           { name: 'More Herbs',                desc: '+3% chance to double base herbs' },
  BETTER_TRACKING:      { name: 'Better Tracking',           desc: '+3% beast hunt chance' },
  BAITED_TRAPS:         { name: 'Baited Traps',              desc: '+1 Raw Beast Meat every 5 seconds per level' },
  HOVEL_GARDEN:         { name: 'Hovel Garden',              desc: '+1 Herb every 5 seconds per level' },
  BOUNTIFUL_LANDS:      { name: 'Bountiful Lands',           desc: '+1 guaranteed prize node per level' },
  ABUNDANT_LANDS:       { name: 'Abundant Lands',            desc: 'Resource gain is multiplied by the number of successful finds' },
  FAIRY_HOSTAGE:        { name: 'Fairy Hostage',             desc: 'A pixie, if present, will call out to a friend for help...' },
  POTION_CATS_EYE:      { name: "Potion of Cat's Eye",       desc: "+1% chance to roll both herb AND beast" },
  BIGGER_GAME:          { name: 'Bigger Game',               desc: '+1 max Raw Beast Meat per hero button press' },

  // Apothecary
  POTION_TITRATION: { name: 'Potion Titration',           desc: '+1% chance to save herbs when brewing' },
  POTION_MARKETING: { name: 'Potion Marketing',           desc: '+1 gold per potion brewed' },
  FERMENTATION_VATS: { name: 'Fermentation Vats',         desc: 'Passively converts 1 herb into 1 potion base per level every 10 seconds (toggleable)' },
  POTION_GLIBNESS:      { name: 'Potion of Glibness',        desc: '-1% spice purchase cost per level' },
  BUBBLING_BREW:        { name: 'Bubbling Brew',             desc: 'Skilled brewing will award bonus progress' },
  BIGGER_BUBBLES:       { name: 'Bigger Bubbles',            desc: 'Increases the size of the Bubbling zone' },
  POTION_DILUTION:      { name: 'Potion Dilution',           desc: '2x concentrated potions, with a risk of failure' },
  SERIAL_DILUTION:      { name: 'Serial Dilution',           desc: '+1% dilution success chance per level' },
  PERFECT_POTIONS:      { name: 'Perfect Potions',           desc: '+1 concentrated potion per level on a flawless brew' },

  // Culinarian
  WHOLESALE_SPICES:     { name: 'Wholesale Spices',          desc: '+1 spice per click, purchased at a discount!' },
  WASTE_NOT:            { name: 'Waste Not',                 desc: '+1 hearty meal per unused guess on a successful recipe' },
  LARGER_COOKBOOKS:     { name: 'Ancient Cookbook',          desc: 'The first ingredient in the recipe is always revealed at the start' },

  // Thief
  METICULOUS_PLANNING:      { name: 'Meticulous Planning',       desc: '+1% thieving success chance per level' },
  PLENTIFUL_PLUNDERING:     { name: 'Plentiful Plundering',      desc: 'Each successful heist awards gold equal to dossiers collected, per level' },
  POTION_OF_STICKY_FINGERS: { name: 'Potion of Sticky Fingers',  desc: '+1 max dossier yield per level' },
  VANISHING_POWDER:         { name: 'Vanishing Powder',          desc: '+1 max detection tolerance per level' },
  POTION_CATS_EARS:         { name: "Potion of Cat's Ears",      desc: '+3° sweet spot size per level' },
  BAG_OF_HOLDING:           { name: 'Bag of Holding',            desc: 'Increases maximum gold and treasure yield' },
  RELIC_HUNTER:             { name: 'Relic Hunter',              desc: '+1% relic drop chance per level' },
  LOCKED_IN:                { name: 'Locked In',                 desc: 'Marks failed click positions on the dial with a red tick' },

  // ── Relic upgrades (one per character) ──────────────────────────
  RELIC_FIGHTER:    { name: 'Amulet of Glory',       desc: 'A powerful artifact that empowers the Fighter. (placeholder)' },
  RELIC_RANGER:     { name: 'Magic Secateurs',    desc: 'A powerful artifact that empowers the Ranger. (placeholder)' },
  RELIC_APOTHECARY: { name: 'Mask of the Greenman',     desc: 'A powerful artifact that empowers the Apothecary. (placeholder)' },
  RELIC_CULINARIAN: { name: 'Charming Perfume',  desc: 'A powerful artifact that empowers the Culinarian. (placeholder)' },
  RELIC_THIEF:      { name: 'Ring of Shadows',     desc: 'A powerful artifact that empowers the Thief. (placeholder)' },
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
      chance: 50,
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
  // Level 4 — Kobold Mountain Lion
  {
    name: 'Kobold Mountain Lion',
    ascii:
      ' _._     _,-\'""\`-._\n' +
      '(,-.`._,\'(       |\\`-/|\n' +
      '    `-.-\' \\ )-`( , o o)\n' +
      '          `-    \\`_ ৲"৲-',
    secondaryDrop: {
      currencyId: 'kobold-fang',
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
    desc: 'A perceptive folk, and a warden of the woods. Even if she hunts no prey, she manages to always bring something else home.',
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
  THIEF: {
    name: 'Thief',
    desc: "A Lady doesn't need to always lurk in the shadows.",
    questBtn: 'Break & Enter',
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
    name: 'Test Kitchen',
    desc: 'Master the art of spice and flame\nto craft legendary dishes.',
  },
  THIEF: {
    name: 'Big Heist',
    desc: 'Crack the safe before you\nare detected.',
  },
} as const;

// ── Global Upgrades ───────────────────────────────────────────
export const GLOBAL_UPGRADE_FLAVOR = {
  UNLOCK_MINIGAMES: {
    name: 'Unlock Minigames',
    desc: 'Unlocks character-specific minigames',
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
    PER_CLICK:    'Gold Per Bounty   :',
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
    HERBS_BREW:           'Herbs Per Brew   :',
    SAVE_CHANCE:          'Herb Save Chance :',
    GOLD_PER_BREW:        'Gold Per Brew    :',
    DILUTION_SUCCESS:     'Dilution Success :',
  },
  CULINARIAN: {
    SPICE_PER_CLICK:  'Spice Per Click  :',
    GOLD_COST:        'Wholesale Total  :',
    GOLD_DISCOUNT:    'Spice Discount   :',
    PRICE_PER_SPICE:  'Gold Per Spice   :',
  },
  THIEF: {
    SUCCESS_CHANCE: 'Success Chance :',
    DOSSIERS_PER_S: 'Dossiers/sec   :',
    DOSSIER_YIELD:  'Dossier Yield  :',
    GOLD_RANGE:     'Gold Yield     :',
    TREASURE_RANGE: 'Treasure Yield :',
    RELIC_CHANCE:   'Relic Chance   :',
  },
} as const;

// ── Minigame Messages ─────────────────────────────────────────
export const MINIGAME_MSG = {

  FIGHTER: {
    READY:      '-- Ready to fight --',
    RESUMED:    '-- Resumed --',
    NEW_ENEMY:  '-- New enemy! --',
    FLEEING:    'Fleeing...',
    ESCAPED:    '-- Escaped! --',
  },

  APOTHECARY: {
    IDLE:           'Click on beat to raise quality!',
    HIT_INNER:      (q: number, max: number) => `Bubbling hit! +2 quality (${q}/${max})`,
    HIT_ZONE:       (q: number, max: number) => `On beat! +1 quality (${q}/${max})`,
    MISS_ZONE:      (q: number, max: number) => `Off beat! \u22121 quality (${q}/${max})`,
    PERFECT:        'Potion concentrated',
    DILUTE_FULL:    '2x CONCENTRATED POTIONS',
    DILUTE_PARTIAL: '1x CONCENTRATED + 1x BASE',
    DILUTE_FAIL:    'Potion ruined!',
  },

  RANGER: {
    ROUND_START: (picks: number) => `Choose ${picks} boxes...`,
  },

  CULINARIAN: {
    ROUND_START:    (max: number) => `Guess the recipe! ${max} attempts.`,
    GUESS_FEEDBACK: (greens: number, yellows: number, remaining: number) =>
      `${greens} correct, ${yellows} misplaced. ${remaining} left.`,
    WIN:            '** RECIPE COMPLETE! **',
    WIN_BONUS:      (bonus: number) => `** RECIPE COMPLETE! ** (+${bonus} bonus)`,
    LOSE:           'Out of guesses!',
  },

  THIEF: {
    IDLE:     'Find the sweet spot on the dial!',
    MISS:     (det: number, max: number) => `Miss! Detection ${det}/${max}`,
    HIT:      'Sweet spot found!',
    BUSTED:   'DETECTED! Heist failed.',
    SUCCESS:  'Safe cracked!',
  },

};
