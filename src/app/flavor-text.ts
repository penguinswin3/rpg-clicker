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
  'kobold-brain':        { name: 'Kobold Brain',              symbol: 'ↀ',  color: '#d6339d' },
  'precious-metal':      { name: 'Precious Metal',            symbol: '🜛',  color: '#accccb' },
  gemstone:              { name: 'Gemstone',                  symbol: '💎︎',  color: '#54d6ac' },
  jewelry:               { name: 'Jewelry',                   symbol: 'Ő',  color: '#97dfc8' },
  'synaptical-potion':   { name: 'Synaptical Potion Base',    symbol: '⚗',  color: '#5b67eb' },
  'kobold-feather':      { name: 'Kobold Feather',            symbol: '⸙',  color: '#c5b3aa' },
  'bone':                { name: 'Bones',                     symbol: '🕱',  color: '#d7d8e6' },
  'brimstone':           { name: 'Brimstone',                 symbol: '🜏',  color: '#ffbd2b' },
  'soul-stone':          { name: 'Soul Stone',                symbol: '◈',  color: '#8f4fff' },
  'mana':                { name: 'Mana',                      symbol: 'ᳱ',  color: '#40a3e1' },

  /**
  Ideas for new Symbols
   - Relics: ᛤ  ᛥ  ᛯ ᛰ ᛗ ᛃ ᚸ ⸎
   - Kobold Nose: ᴥ
   - scroll: ⍯ ⌺ ꖸ

   */

} as const;

// ── Currency log helper ───────────────────────────────────────
/**
 * Format a currency amount for rich display in the activity log.
 * Returns a tagged token `{{currencyId|displayText}}` that the
 * activity-log component parses into a colored `<span>`.
 *
 * @param id     Currency key from CURRENCY_FLAVOR (e.g. 'gold').
 * @param amount Numeric amount to display.
 * @param sign   Prefix sign: '+' (default), '-', or '' (none).
 */
export function cur(id: string, amount: number | string, sign: '+' | '-' | '' = '+'): string {
  const flavor = (CURRENCY_FLAVOR as Record<string, { symbol: string }>)[id];
  const symbol = flavor?.symbol ?? '?';
  return `{{${id}|${sign}${amount}${symbol}}}`;
}

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
  STRONGER_KOBOLDS:     { name: 'Stronger Kobolds',          desc: 'You can seek out stronger kobolds. They grow...' },
  FIRST_STRIKE:         { name: 'First Strike',              desc: 'The Fighter attacks before the enemy. Let the slaughter begin!' },
  GILDED_BLADE:         { name: 'Gilded Blade',              desc: '+1% secondary drop chance and +1% gold per kill per level' },
  POTION_MIND_READING:  { name: 'Potion of Foresight',          desc: '+10% chance per level to roll attack damage twice and take the higher result' },
  CATS_SWIFTNESS:    { name: "Potion of Cat's Swiftness",    desc: '-5% kobold respawn delay per level (up to -50% at max)' },
  KOBOLD_BAIT:       { name: 'Kobold Bait',                  desc: 'Kobolds drop more parts when baited with meat' },

  // Ranger
  MORE_HERBS:           { name: 'More Herbs',                desc: '+3% chance to double base herbs' },
  BETTER_TRACKING:      { name: 'Better Tracking',           desc: '+3% beast hunt chance' },
  BAITED_TRAPS:         { name: 'Baited Traps',              desc: '+1 Raw Beast Meat every 5 seconds per level' },
  SPICED_BAIT:          { name: 'Spiced Bait',               desc: 'Each Baited Trap produces +1 raw beast meat per level of Spiced Bait' },
  HOVEL_GARDEN:         { name: 'Hovel Garden',              desc: '+1 Herb every 5 seconds per level' },
  ORNATE_HERB_POTS:     { name: 'Ornate Herb Pots',          desc: 'Each Hovel Garden produces +1 herb per level of Ornate Herb Pots' },
  BOUNTIFUL_LANDS:      { name: 'Bountiful Lands',           desc: '+1 guaranteed prize node per level' },
  ABUNDANT_LANDS:       { name: 'Abundant Lands',            desc: 'Resource gain is multiplied by the number of successful finds' },
  FAIRY_HOSTAGE:        { name: 'Fairy Hostage',             desc: 'A pixie, if present, will call out to a friend for help...' },
  TREASURE_CHEST:       { name: 'Treasure Chest',            desc: '+2% chance per level to find a treasure chest while scouting' },
  X_MARKS_THE_SPOT:    { name: 'X Marks the Spot',           desc: 'Treasure chest cells are marked with a red X ' },
  POTION_CATS_EYE:      { name: "Potion of Cat's Eye",       desc: "+5% chance to roll both herb AND beast" },
  BIGGER_GAME:          { name: 'Bigger Game',               desc: '+1 max Raw Beast Meat per hero button press' },

  // Apothecary
  POTION_TITRATION: { name: 'Potion Titration',           desc: '+4% chance to save herbs when brewing' },
  POTION_MARKETING: { name: 'Potion Marketing',           desc: '+1 gold per potion brewed' },
  FERMENTATION_VATS: { name: 'Fermentation Vats',         desc: 'Passively converts 1 herb into 1 potion base per level every 10 seconds (toggleable)' },
  POTION_GLIBNESS:      { name: 'Potion of Glibness',        desc: '-1% spice purchase cost per level' },
  BUBBLING_BREW:        { name: 'Bubbling Brew',             desc: 'Skilled brewing will award bonus progress' },
  BIGGER_BUBBLES:       { name: 'Bigger Bubbles',            desc: 'Increases the size of the Bubbling zone' },
  POTION_DILUTION:      { name: 'Potion Dilution',           desc: '2x concentrated potions, with a risk of failure' },
  SERIAL_DILUTION:      { name: 'Serial Dilution',           desc: '+1 additional independent potion roll per level when diluting' },
  PERFECT_POTIONS:      { name: 'Perfect Potions',           desc: 'Each perfect click adds +5% dilution success chance for that brew' },
  SYNAPTICAL_POTIONS:   { name: 'Synaptical Potions',        desc: 'Unlocks a new recipe for brewing synaptical potions — a cerebral elixir' },
  SYNAPTIC_STATIC:      { name: 'Synaptic Static',           desc: '+1 randomly placed bonus zone when brewing synaptical potions' },

  // Culinarian
  WHOLESALE_SPICES:     { name: 'Wholesale Spices',          desc: '+1 spice per click, purchased at a discount!' },
  WASTE_NOT:            { name: 'Waste Not',                 desc: '+1 hearty meal per unused guess on a successful recipe' },
  LARGER_COOKBOOKS:     { name: 'Ancient Cookbook',          desc: 'The first ingredient in the recipe is always revealed at the start' },
  COOKBOOK_ANNOTATIONS: { name: 'Cookbook Annotations',      desc: 'Each round begins with a free guess of one of every ingredient in order (Herb → Meat → Tongue → Spice)' },

  // Thief
  METICULOUS_PLANNING:      { name: 'Meticulous Planning',       desc: '+1% thieving success chance per level' },
  PLENTIFUL_PLUNDERING:     { name: 'Plentiful Plundering',      desc: 'Each successful robbery awards bonus gold equal to dossiers collected, per level' },
  POTION_OF_STICKY_FINGERS: { name: 'Potion of Sticky Fingers',  desc: '+1 max dossier yield per level' },
  VANISHING_POWDER:         { name: 'Vanishing Powder',          desc: '+1 max detection tolerance per level' },
  POTION_CATS_EARS:         { name: "Potion of Cat's Ears",      desc: '+3° sweet spot size per level' },
  BAG_OF_HOLDING:           { name: 'Bag of Holding',            desc: 'Increases maximum gold and treasure yield' },
  RELIC_HUNTER:             { name: 'Relic Hunter',              desc: 'Allows the discovery of one additional relic!' },
  GEM_HUNTER:               { name: 'Gem Hunter',                desc: 'Reveals cryptic progress messages when completing steps toward unclaimed golden bead challenges' },
  LOCKED_IN:                { name: 'Locked In',                 desc: 'Marks failed click positions on the dial with a red tick' },
  FLOW_STATE:               { name: 'Flow State',                desc: 'Dial ticks now give hints as to where the sweet spot is' },

  // Artisan
  FASTER_APPRAISING:        { name: 'Faster Appraising',         desc: '-1 second appraisal timer per level' },
  POTION_CATS_PAW:          { name: "Potion of the Cat's Paw",   desc: '+1 max gemstone and precious metal yield per level' },
  LUCKY_GEMS:               { name: 'Lucky Gems',                desc: '+10% lucky gem bonus per level' },
  DOUBLE_DIP:               { name: 'Double Dip',                desc: 'Select the second best gem as well, but only if you find the best first!' },
  GOOD_ENOUGH:              { name: 'Good Enough',               desc: '+1 jewelry for each gem in the round with a quality above 50%' },
  CLOSE_ENOUGH:             { name: 'Close Enough',              desc: 'Selecting the runner-up gem also counts as a successful pick' },
  STAND_OUT_SELECTION:      { name: 'Stand Out Selection',       desc: 'The Best gemstone is even better' },

  // Necromancer
  EXTENDED_RITUAL:          { name: 'Extended Ritual',           desc: '+2 clicks before switching abilities per level' },
  DARK_PACT:                { name: 'Dark Pact',                 desc: '-2 XP cost per Ward click per level (min 1)' },
  AUGURY:                   { name: 'Augury',                    desc: 'Reveals how many clicks remain before the active ability switches' },
  SPEAK_WITH_DEAD:          { name: 'Potion of Speak With Dead', desc: '+1 max bone yield per Defile per level' },
  FORTIFIED_CHALK:          { name: 'Fortified Chalk',           desc: '+1 max brimstone yield per Ward per level' },
  GRAVE_LOOTING:            { name: 'Grave Looting',             desc: '+5% chance per level to find bonus loot (Gold, Gems, or Jewelry) while exhuming' },
  PERFECT_TRANSMUTATION:    { name: 'Perfect Transmutation',     desc: '+2 Soul Stones per level when completing a ritual with 100% path efficiency' },
  DEMONIC_KNOWLEDGE:        { name: 'Demonic Knowledge',         desc: 'Reveals a random hint line from the optimal path at the start of each ritual' },
  FIND_FAMILIAR:            { name: 'Find Familiar',             desc: 'Summon a spectral familiar for each hero button. Feed it Soul Stones for temporary +1 jack power' },
  CONCENTRATED_SOULS:       { name: 'Concentrated Souls',        desc: 'Each Soul Stone fed to a familiar grants an additional +15s of familiar time per level' },
  VAULT_OF_SOULS:           { name: 'Vault of Souls',            desc: 'Increases the maximum familiar time cap by 5 minutes per level' },

  // ── Relic upgrades (one per character) ──────────────────────────
  RELIC_FIGHTER:    { name: 'Crown of Hireling Command',          desc: 'Each Jack hires hirelings, who in turn hire hirelings' },
  RELIC_RANGER:     { name: 'Belt of the Woodlands',              desc: 'Each assigned Jack adds +1 to the base herb yield (before doubling) and +1 bonus beast meat per hunt' },
  RELIC_APOTHECARY: { name: 'Monocle of Perfect Theurgy',        desc: 'Jacks consume 1 fewer herb per brew (min 0) and automatically dilute each brew into 2 potions' },
  RELIC_CULINARIAN: { name: 'Clasp of Exquisite Taste',          desc: 'Jacks double their effective spice yield per purchase at no additional cost' },
  RELIC_THIEF:      { name: 'Ring of Shadows',                    desc: 'Jacks double their dossier yield range and steal 2 bonus treasure per successful action' },
  RELIC_ARTISAN:    { name: 'Masterwork Monocle of Perfection',   desc: 'Jacks always salvage maximum metal and double the minimum gemstone yield' },
  RELIC_NECROMANCER:{ name: 'Jeweled Hand of the Night',         desc: 'Defile and Ward Jacks each act regardless of which button is active, and produce double the yield' },
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
  // Level 5 — Kobold Sorcerer
  {
    name: 'Kobold Sorcerer',
    ascii:
      '     *       \n' +
      '    / \\  o   \n' +
      '  <(^u^)>|   \n' +
      '   /||-- |   \n' +
      '   d  b  |   ',
    secondaryDrop: {
      currencyId: 'kobold-brain',
      amount: 1,
      chance: 33,
    },
  },
  // Level 6 — Winged Kobold
  {
    name: 'Winged Kobold',
    ascii:
      '        _\\|     ___     |/_    \n' +
      '      _-  \\_   <\'v\'>   _/  -_ \n' +
      '      -_    `-\'(   )`-\'    _-   \n' +
      '       `=.__.=-(   )-=.__.=\'    \n' +
      '               |/-\\|                 \n' +
      '               Y   Y       ',
    secondaryDrop: {
      currencyId: 'kobold-feather',
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
    questBtn: 'Distill',
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
  ARTISAN: {
    name: 'Artisan',
    desc: 'A meticulous craftsman who sees value where others see junk. Give him any trinket and he will find the gems within.',
    questBtn: 'Appraisal',
  },
  NECROMANCER: {
    name: 'Necromancer',
    desc: 'A scholar of the forbidden arts. He commands the boundary between life and death, cycling between desecration and warding.',
    questBtnExhume: 'Exhume',
    questBtnWard: 'Ward',
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
    desc: 'Crack the safe before you\nare detected. Perhaps you may find an epic relic...',
  },
  ARTISAN: {
    name: 'Faceting',
    desc: 'Appraise raw gemstones and\npick the finest jewel.',
  },
  NECROMANCER: {
    name: 'Well of Souls',
    desc: 'Draw the binding circle.\nShortest path wins.',
  },
} as const;

// ── Global Upgrades ───────────────────────────────────────────
export const GLOBAL_UPGRADE_FLAVOR = {
  UNLOCK_MINIGAMES: {
    name: 'Unlock Sidequests',
    desc: 'Unlocks character-specific sidequests',
  },
  JACKD_UP: {
    name: "Jack'd Up",
    desc: 'Jacks (and familiars) click 50% faster',
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
/** The color used for the hero button border pulse on click. */
export const HERO_PRESS_PULSE_COLOR = '#000';

export const HERO_STATS_FLAVOR = {
  BOX_TITLE: '[ CHARACTER STATS ]',

  FIGHTER: {
    PER_CLICK:    'Gold Per Bounty   :',
    PER_SECOND:   'Gold Per Second  :',
    XP_PER_CLICK: 'XP Per Bounty    :',
    DAMAGE_RANGE: 'Attack Damage    :',
    GILDED_BLADE: 'Secondary Chance      :',
    MIND_READING: 'Foresight Chance :',
  },
  RANGER: {
    BEAST_CHANCE: 'Beast Success :',
    HERB_DOUBLE:  'Herb Double   :',
    CATS_EYE:     "Cat's Eye     :",
    MAX_MEAT:     'Max Meat      :',
    TRAP_RATE:    'Trap Beast/s  :',
    GARDEN_RATE:  'Garden Herb/s :',
    CHEST_CHANCE: 'Chest Chance  :',
  },
  APOTHECARY: {
    HERBS_BREW:           'Herbs Per Brew   :',
    SAVE_CHANCE:          'Herb Save Chance :',
    GOLD_PER_BREW:        'Gold Per Brew    :',
    DILUTION_SUCCESS:     'Dilution Chance  :',
    DILUTION_ROLLS:       'Dilution Rolls   :',
    PERFECT_BONUS:        'Perfect Bonus    :',
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
    RELIC_CAP:      'Relics Found   :',
  },
  ARTISAN: {
    TREASURE_COST:  'Treasure Cost  :',
    TIMER_DURATION: 'Appraisal Time :',
    GEMSTONE_RANGE: 'Gemstone Yield :',
    METAL_RANGE:    'Metal Yield    :',
    LUCKY_BONUS:    'Lucky Gem Bonus:',
  },
  NECROMANCER: {
    ACTIVE_BUTTON:    'Active Ability :',
    CLICKS_LEFT:      'Clicks Left    :',
    BONE_PER_CLICK:   'Bone Per Click :',
    BRIMSTONE_PER_W:  'Brimstone Per Ward :',
    WARD_XP_COST:     'Ward XP Cost   :',
    SWITCH_RANGE:     'Switch Range   :',
    GRAVE_LOOT_CHANCE:'Grave Loot     :',
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
    DILUTE_FULL:    (concentrated: number, total: number) => `${concentrated}/${total} CONCENTRATED!`,
    DILUTE_PARTIAL: (concentrated: number, downgraded: number, total: number) => `${concentrated}/${total} CONCENTRATED  (${downgraded} BASE)`,
    DILUTE_FAIL:    (downgraded: number) => `All ${downgraded} failed — ${downgraded}x BASE`,
  },

  RANGER: {
    ROUND_START: (picks: number) => `Choose ${picks} boxes...`,
    CHEST_FOUND: 'A treasure chest! Riches abound!',
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
    IDLE:     'Find the sweet spot on the dial!\nMaybe you will find a rare relic...',
    MISS:     'Miss!',
    HIT:      'Sweet spot found!',
    BUSTED:   'DETECTED! Heist failed.',
    SUCCESS:  'Safe cracked!',
  },

  ARTISAN: {
    IDLE:          'Select the highest quality gemstone.',
    CORRECT:       'Correct! A fine jewel indeed.',
    WRONG:         'Wrong — not the finest gem.',
    ROUND_START:   (count: number) => `${count} gems presented. Choose wisely!`,
    DOUBLE_DIP_HIT:  'Double Dip! The runner-up was found too!',
    DOUBLE_DIP_MISS: 'Fine eye for the best, but the runner-up slipped away.',
    CLOSE_ENOUGH_WIN: 'Close enough! The runner-up gem will do.',
  },

  NECROMANCER: {
    IDLE:         'Connect the nodes to complete the binding circle.',
    ROUND_START:  (nodes: number) => `${nodes} soul anchors placed. Draw the shortest path. Do not repeat yourself.`,
    COMPLETE:     (pct: number) => `Path efficiency: ${pct}%`,
    PERFECT:      'Perfect binding! The spirits are yours!',
  },

};

// ── Bead System ───────────────────────────────────────────────
export const BEAD_COLORS = {
  blue: { primary: '#00fff8', dim: '#004d4b', glow: 'rgba(0, 255, 248, 0.4)' },
  gold: { primary: '#ffcc00', dim: '#4d3d00', glow: 'rgba(255, 204, 0, 0.4)' },
} as const;

/** Display symbol used for all bead sockets. */
export const BEAD_SYMBOL = 'Ф';

/** Per-character, per-slot lore for each bead. */
export interface BeadSlotFlavor {
  name: string;
  lore: string;
  effect: string;
}

export const BEAD_FLAVOR: Record<string, Record<string, BeadSlotFlavor>> = {
  fighter: {
    'blue-1': { name: 'Bead of Valor',         lore: 'Forged in the heat of countless battles, this bead hums with the memory of every bounty completed.',               effect: '2× resource yields from this character.' },
    'gold-1': { name: 'Bead of the Vanguard',  lore: 'Carried by those who fight on behalf of others. It empowers the blade to swing on its own.',                        effect: 'Unlocks basic sidequest automation.' },
    'gold-2': { name: 'Bead of Supremacy',     lore: 'Awaits the ultimate proof of martial prowess.',                                                                     effect: 'Attacks faster and auto-heals below half HP.' },
    'blue-2': { name: 'Bead of the Mercenary', lore: 'Pulled from the coffers of a hired band, it resonates with the tireless work of loyal hirelings.',                   effect: '2× resource yields from this character (stacks).' },
  },
  ranger: {
    'blue-1': { name: 'Bead of the Wild',       lore: 'Grown from the heartwood of an ancient tree, it pulses with the rhythm of the forest.',                             effect: '2× resource yields from this character.' },
    'gold-1': { name: 'Bead of the Pathfinder', lore: 'Found in the deepest thicket, where only the most tireless scouts dare to tread.',                                  effect: 'Unlocks basic sidequest automation.' },
    'gold-2': { name: 'Bead of Mastery',        lore: 'Only the most skilled tracker can reveal its secrets.',                                                              effect: 'Prioritizes pixies and treasure chests when auto-solving.' },
    'blue-2': { name: 'Bead of the Pack',       lore: 'Formed from the ambient magic of a hundred tireless hunts, it hums with the rhythm of the pack.',                   effect: '2× resource yields from this character (stacks).' },
  },
  apothecary: {
    'blue-1': { name: 'Bead of Distillation',   lore: 'Crystallized from a thousand perfect brews, it amplifies the potency of every concoction.',                         effect: '2× resource yields from this character.' },
    'gold-1': { name: 'Bead of the Alembic',    lore: 'Formed in the residue of a master\'s cauldron. It stirs the brew without a hand.',                                  effect: 'Unlocks basic sidequest automation.' },
    'gold-2': { name: 'Bead of Perfection',     lore: 'Whispers of an impeccable brew echo within.',                                                                       effect: 'Ultra-fast auto-brew at 20 ms tick speed.' },
    'blue-2': { name: 'Bead of Automation',     lore: 'Crystallized in an unattended cauldron, it carries the echo of a thousand mechanical stirs.',                        effect: '2× resource yields from this character (stacks).' },
  },
  culinarian: {
    'blue-1': { name: 'Bead of Seasoning',      lore: 'Imbued with the essence of rare spices from distant lands, it enriches every ingredient it touches.',               effect: '2× resource yields from this character.' },
    'gold-1': { name: 'Bead of the Hearth',     lore: 'Warmed by countless fires. It stokes the flame without tending.',                                                   effect: 'Unlocks basic sidequest automation.' },
    'gold-2': { name: 'Bead of the Epicure',    lore: 'Reserved for a chef who never wastes a single ingredient.',                                                          effect: 'Solves every recipe in exactly 2 guesses.' },
    'blue-2': { name: 'Bead of the Sous Chef',  lore: 'Warmed by dutiful hands that never tire, it doubles the bounty of every sous chef\'s contribution.',                 effect: '2× resource yields from this character (stacks).' },
  },
  thief: {
    'blue-1': { name: 'Bead of Shadows',        lore: 'Stolen from the vault of a legendary thief, it ensures every heist yields double the spoils.',                      effect: '2× resource yields from this character.' },
    'gold-1': { name: 'Bead of the Unseen Hand',lore: 'Passed between thieves in the dark. It picks the lock without a finger.',                                            effect: 'Unlocks basic sidequest automation.' },
    'gold-2': { name: 'Bead of the Ghost',      lore: 'Said to appear only to one who cracks the impossible.',                                                              effect: 'Deduces the sweet spot in two quick guesses, then cracks it.' },
    'blue-2': { name: 'Bead of the Fence',      lore: 'Exchanged in back alleys between middlemen, it amplifies the yield of every clandestine operation.',                 effect: '2× resource yields from this character (stacks).' },
  },
  artisan: {
    'blue-1': { name: 'Bead of Precision',      lore: 'Cut by the steadiest hand, it doubles the value found in every raw material.',                                      effect: '2× resource yields from this character.' },
    'gold-1': { name: 'Bead of the Masterwork', lore: 'Embedded in a workbench for generations. It guides the chisel with phantom hands.',                                  effect: 'Unlocks basic sidequest automation.' },
    'gold-2': { name: 'Bead of the Prodigy',    lore: 'Hidden within a flawless gem, waiting to be found.',                                                                 effect: 'Always selects the top two gems each game.' },
    'blue-2': { name: 'Bead of Industry',       lore: 'Polished by the relentless grind of a workshop that never sleeps, it doubles every yield.',                           effect: '2× resource yields from this character (stacks).' },
  },
  necromancer: {
    'blue-1': { name: 'Bead of the Veil',       lore: 'Harvested from the space between worlds, it amplifies the yield of every dark ritual.',                              effect: '2× resource yields from this character.' },
    'gold-1': { name: 'Bead of Binding',        lore: 'Chains the familiar realm to this one. It traces the circle without mortal hands.',                                   effect: 'Unlocks basic sidequest automation.' },
    'gold-2': { name: 'Bead of Dominion',       lore: 'Pulses with the promise of absolute control.',                                                                       effect: 'Always follows the optimal ritual path.' },
    'blue-2': { name: 'Bead of the Thrall',     lore: 'Bound to an undying servant, it channels the tireless labor of those who cannot rest.',                               effect: '2× resource yields from this character (stacks).' },
  },
};

/**
 * Cryptic messages shown (as 'rare' log entries) when the player completes
 * one step of a multi-step gold-2 bead unlock sequence.
 * Each array entry is picked based on step index (wrapping if needed).
 */
export const GOLD2_STEP_MESSAGES: Record<string, string[]> = {
  fighter:     ['The blade remembers…',          'A familiar rhythm echoes.',     'The pattern deepens.',               'Something stirs in the steel.',  'Almost there — the final strike awaits.'],
  ranger:      ['The forest acknowledges you.',   'Footprints align.',             'The path reveals itself.',           'Nature bends to your will.',     'One final trace remains.'],
  apothecary:  ['The cauldron hums in recognition.', 'The brew senses your intent.'],
  culinarian:  ['The hearth remembers this taste.', 'Ingredients align.',           'The recipe whispers its name.'],
  thief:       ['The tumblers shift…',            'A click in the dark.',          'The mechanism yields.',              'Pins fall into place.',          'The vault trembles.',        'Almost free…',        'One final turn.'],
  artisan:     ['The gem glimmers knowingly.',    'A facet catches the light.',    'The jewel responds to your touch.',  'Crystalline whispers grow.',     'The pattern sharpens.',      'Cut after cut, the gem obeys.', 'Brilliance takes shape.', 'The stone sings.', 'One final selection.'],
  necromancer: ['The spirits fall silent.',        'The circle holds.',             'Dominion approaches.'],
};


// ── Activity Log Messages ─────────────────────────────────────
/**
 * All activity-log messages in one place.
 * Static messages are plain strings; messages with dynamic
 * values are arrow functions that accept pre-formatted `cur()`
 * tokens or computed numbers.
 */
export const LOG_MSG = {

  // ── Hero-button click messages ────────────────────────────────

  HERO: {
    FIGHTER: {
      BOUNTY:                (gold: string, xp: string) => `You ventured forth and found gold. (${gold}, ${xp})`,
    },
    RANGER: {
      CATS_EYE_BOTH:         (herb: string, beast: string, xp: string) => `Cat's Eye! You foraged herbs AND hunted a beast! (${herb}, ${beast}, ${xp})`,
      CATS_EYE_HERB_ONLY:    (herb: string, xp: string) => `Cat's Eye! You foraged herbs, but the beast escaped. (${herb}, ${xp})`,
      FORAGE_HERB:           (herb: string, xp: string) => `You targeted herbs and foraged some. (${herb}, ${xp})`,
      HUNT_BEAST:            (beast: string, xp: string) => `You tracked a beast and claimed its meat. (${beast}, ${xp})`,
      BEAST_ESCAPED:         (xp: string) => `You targeted a beast but it escaped. (${xp})`,
    },
    APOTHECARY: {
      NOT_ENOUGH_HERBS:      (need: string, have: string) => `Not enough herbs to brew. Need ${need}, have ${have}.`,
      BREW_RECOVERED:        (potion: string, herb: string, xp: string) => `You brewed a potion and recovered herbs! (${potion}, ${herb}, ${xp})`,
      BREW:                  (potion: string, xp: string) => `You brewed a potion. (${potion}, ${xp})`,
    },
    CULINARIAN: {
      NOT_ENOUGH_GOLD:       (need: string, have: string) => `Not enough gold to gather spices. Need ${need}, have ${have}.`,
      SOURCED:               (gold: string, spice: string, xp: string) => `You sourced exotic spices. (${gold}, ${spice}, ${xp})`,
    },
    THIEF: {
      SUCCESS_WITH_GOLD:     (dossier: string, xp: string, gold: string) => `You slipped in undetected and secured some dossier. (${dossier}, ${xp}, ${gold})`,
      SUCCESS:               (dossier: string, xp: string) => `You slipped in undetected and secured some dossier. (${dossier}, ${xp})`,
      SPOTTED:               (seconds: number) => `You were spotted! Retreating for ${seconds} seconds...`,
    },
    ARTISAN: {
      NOT_ENOUGH_TREASURE:   (need: string, have: string) => `Not enough treasure to appraise. Need ${need}, have ${have}.`,
      APPRAISAL_STARTED:     (cost: string) => `Appraisal started... (${cost})`,
    },
    NECROMANCER: {
      DEFILE_GOLD:           (bone: string, gold: string, xp: string) => `You defiled the earth and unearthed bones — and found buried gold! (${bone}, ${gold}, ${xp})`,
      DEFILE_GEM:            (bone: string, gem: string, xp: string) => `You defiled the earth and unearthed bones — adorned with gemstones! (${bone}, ${gem}, ${xp})`,
      DEFILE_JEWELRY:        (bone: string, jewelry: string, xp: string) => `You defiled the earth and unearthed bones — and uncovered jewelry! (${bone}, ${jewelry}, ${xp})`,
      DEFILE:                (bone: string, xp: string) => `You defiled the earth and unearthed bones. (${bone}, ${xp})`,
      NOT_ENOUGH_XP:         (need: string, have: string) => `Not enough XP to ward. Need ${need}, have ${have}.`,
      WARD:                  (xp: string, brimstone: string) => `You warded the veil and conjured brimstone. (${xp}, ${brimstone})`,
    },
  },

  // ── Sidequest (minigame) activity-log messages ────────────────

  MG_FIGHTER: {
    SLAIN:                   (enemy: string) => `The Fighter was slain by a ${enemy}!`,
    FLED:                    'The Fighter fled from combat.',
    SHORT_REST:              (potions: string) => `Chugged some potions during a short rest. (${potions})`,
    NEW_TROPHY:              (enemy: string, drop: string) => `The ${enemy} drops a ${drop}! A new trophy!`,
    FIRST_EAR:               (mutual: boolean, enemy: string, drops: string) => `${mutual ? 'Mutual kill!' : 'Victory!'} The ${enemy} drops a Kobold Ear! (${drops})`,
    MUTUAL_KILL:             (drops: string) => `Mutual kill! Loot still collected. (${drops})`,
    VICTORY:                 (enemy: string, drops: string) => `Victory! ${enemy} defeated. (${drops})`,
  },

  MG_RANGER: {
    SCOUT_START:             (cost: string) => `Ranger sets out to scout the area. (${cost})`,
    PIXIE_UNLOCKED:          'A Pixie emerged from the undergrowth! Pixie Dust unlocked!',
    TREASURE_UNLOCKED:       'A treasure chest! Treasure unlocked!',
    SCOUT_RESULT:            (multiplier: string, parts: string) => `${multiplier} Ranger scouted the area. (${parts})`,
    SCOUT_NOTHING:           'Ranger scouted the area: found nothing useful.',
  },

  MG_APOTHECARY: {
    BREW_START:              (costs: string) => `Apothecary begins brewing. (${costs})`,
    SYNAPTICAL_UNLOCKED:     'A Synaptical Potion has been crafted! New currency unlocked!',
    SYNAPTICAL_SUCCESS:      (potion: string) => `Synaptical dilution success! (${potion})`,
    SYNAPTICAL_PARTIAL:      (potion: string, base: string) => `Synaptical dilution partial! (${potion}, ${base})`,
    SYNAPTICAL_FAIL:         (base: string) => `Synaptical dilution failed! (${base})`,
    SYNAPTICAL_CRAFTED:      (potion: string) => `Synaptical Potion crafted! (${potion})`,
    CONCENTRATED_UNLOCKED:   'A Concentrated Potion has been crafted! New currency unlocked!',
    DILUTION_SUCCESS:        (potion: string) => `Dilution success! (${potion})`,
    DILUTION_PARTIAL:        (potion: string, base: string) => `Dilution partial! (${potion}, ${base})`,
    DILUTION_FAIL:           (base: string) => `Dilution failed! (${base})`,
    CONCENTRATED_CRAFTED:    (potion: string) => `Concentrated Potion crafted! (${potion})`,
  },

  MG_CULINARIAN: {
    ANNOTATION_MATCH:        'Cookbook Annotations: the annotated guess was a perfect match!',
    EXPERIMENT_START:        (costs: string) => `Culinarian begins experimenting. (${costs})`,
    MEAL_UNLOCKED:           'The Culinarian perfects a Hearty Meal! New currency unlocked!',
    MEAL_WITH_WASTE_NOT:     (base: string, bonus: string) => `Hearty Meal crafted! (${base} base ${bonus} Waste Not!)`,
    MEAL_CRAFTED:            (meal: string) => `Hearty Meal crafted! (${meal})`,
    RECIPE_FAILED:           'The Culinarian failed to find the recipe.',
  },

  MG_THIEF: {
    HEIST_START:             (cost: string) => `Heist started! (${cost})`,
    HEIST_DETECTED:          'Heist failed — you were detected!',
    TREASURE_UNLOCKED:       'Treasure discovered! New currency unlocked!',
    RELIC_FOUND:             'A Relic has been unearthed! Incredibly rare!',
    SAFE_CRACKED_RELIC:      (treasure: string, gold: string, relic: string, xp: string) => `Safe cracked! (${treasure}, ${gold}, ${relic}, ${xp})`,
    SAFE_CRACKED:            (treasure: string, gold: string, xp: string) => `Safe cracked! (${treasure}, ${gold}, ${xp})`,
  },

  MG_ARTISAN: {
    JEWELRY_UNLOCKED:        (jewelry: string) => `A perfect jewel! ${jewelry} Jewelry unlocked!`,
    FACET_CLOSE_ENOUGH:      (jewelry: string, xp: string) => `Faceting success (Close Enough)! (${jewelry}, ${xp})`,
    FACET_DOUBLE_DIP:        (jewelry: string, xp: string) => `Faceting success + Double Dip! (${jewelry}, ${xp})`,
    FACET_SUCCESS:           (jewelry: string, xp: string) => `Faceting success! (${jewelry}, ${xp})`,
    FACET_FAILED:            'Faceting failed — wrong gemstone selected.',
  },

  MG_NECROMANCER: {
    RITUAL_START:            (costs: string) => `Well of Souls begun! (${costs})`,
    SOUL_STONE_UNLOCKED:     'Soul Stones discovered! A new currency!',
    RITUAL_PERFECT:          (bonus: string, stones: string, xp: string) => `Ritual complete — PERFECT!${bonus} (${stones}, ${xp})`,
    RITUAL_COMPLETE:         (pct: number, stones: string, xp: string) => `Ritual complete — ${pct}% efficiency. (${stones}, ${xp})`,
  },

  // ── System messages ───────────────────────────────────────────

  SYSTEM: {
    // Upgrades
    UPGRADE_CANT_AFFORD:     (name: string, needs: string) => `Not enough resources for ${name}. Need: ${needs}.`,
    UPGRADE_SUCCESS:         (name: string, level: number) => `${name} upgraded to Lv.${level}.`,

    // Jacks
    JACK_CANT_AFFORD:        'Not enough resources to hire a Jack.',
    JACK_HIRED:              (total: number) => `A Jack of All Trades has been hired! (Total: ${total})`,

    // Minigame / global unlocks
    MINIGAME_CANT_AFFORD:    (missing: string) => `Not enough resources to unlock Sidequests. Need ${missing}.`,
    MINIGAME_UNLOCKED:       '★ SIDEQUESTS UNLOCKED! Character-specific challenges are now available.',
    JACKDUP_CANT_AFFORD:     (missing: string) => `Not enough resources for Jack'd Up. Need ${missing}.`,
    JACKDUP_UNLOCKED:        "★ JACK'D UP! Your Jacks now click 50% faster!",

    // Artisan appraisal timer
    APPRAISAL_COMPLETE:      (gems: string, metal: string, xp: string) => `Appraisal complete! (${gems}, ${metal}, ${xp})`,

    // Character unlock
    CHAR_CANT_AFFORD:        (name: string, missing: string) => `Can't unlock ${name} — still need: ${missing}.`,
    CHAR_UNLOCKED:           (name: string) => `${name} has been unlocked! Welcome to the party.`,

    // Beads
    BEAD_GOLD_MG:            (charName: string) => `★ ${charName} discovered a golden bead from their sidequest! Check the crown above.`,
    BEAD_GOLD2:              (charName: string) => `★ ${charName} unlocked a golden bead of mastery! Check the crown above.`,
    BEAD_BLUE:               (charName: string) => `★ ${charName} discovered a mysterious bead! Check the crown above.`,
    BEAD_JACK:               (charName: string) => `★ ${charName}'s Jacks discovered a mysterious bead! Check the crown above.`,
    BEAD_SOCKETED:           (beadName: string, charName: string, isBlue: boolean) => `★ ${beadName} socketed for ${charName}!${isBlue ? ' Resource yields doubled!' : ''}`,
  },

  // ── Save / Options ────────────────────────────────────────────

  SAVE: {
    AUTO_SAVED:              '[AUTO-SAVE] Game state saved to browser cache.',
    MANUAL_SAVED:            '[SAVE] Game saved to browser cache.',
    COPIED:                  '[SAVE] Save data copied to clipboard.',
    COPY_FAILED:             'Failed to copy save data — check browser permissions.',
    EXPORTED:                '[SAVE] Save file exported.',
    IMPORT_EMPTY:            'Paste a save string into the import box first.',
    IMPORTED:                '[SAVE] Save data imported and applied.',
    IMPORT_INVALID:          'Invalid save data — could not import.',
    CLEARED:                 '[SAVE] Browser save data erased. Reloading…',
  },

  // ── Dev tools ─────────────────────────────────────────────────

  DEV: {
    GRANT:                   '[DEV] +1M granted to all resources.',
    ZERO:                    '[DEV] All resources set to 0.',
    MAX_XP:                  '[DEV] XP set to 2,000,000,000.',
    HALF_MAX:                '[DEV] All upgrades set to half of their maximum level.',
    ZERO_UPGRADES:           '[DEV] All upgrades set to level 0. All beads unsocketed.',
    MAX_UPGRADES:            '[DEV] All upgrades set to maximum level.',
    UNLOCK_ALL:              '[DEV] Everything unlocked.',
  },

} as const;

