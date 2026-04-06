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
  'kobold-feather':      { name: 'Kobold Feather',           symbol: 'ϡ',  color: '#c5b3aa' },
  'bone':                { name: 'Bones',                     symbol: '🕱',  color: '#d7d8e6' },
  'brimstone':           { name: 'Brimstone',                 symbol: '🜏',  color: '#ffbd2b' },
  'soul-stone':          { name: 'Soul Stone',                symbol: '◈',  color: '#8f4fff' },

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
  POTION_FORESIGHT:  { name: 'Potion of Foresight',          desc: '+10% chance per level to roll attack damage twice and take the higher result' },
  CATS_SWIFTNESS:    { name: "Potion of Cat's Swiftness",    desc: '-5% kobold respawn delay per level (up to -50% at max)' },

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
  LOCKED_IN:                { name: 'Locked In',                 desc: 'Marks failed click positions on the dial with a red tick' },
  FLOW_STATE:               { name: 'Flow State',                desc: 'Dial ticks now give hints as to where the sweet spot is' },

  // Artisan
  FASTER_APPRAISING:        { name: 'Faster Appraising',         desc: '-1 second appraisal timer per level' },
  POTION_CATS_PAW:          { name: "Potion of the Cat's Paw",   desc: '+1 max gemstone and precious metal yield per level' },
  LUCKY_GEMS:               { name: 'Lucky Gems',                desc: '+10% lucky gem bonus per level' },
  DOUBLE_DIP:               { name: 'Double Dip',                desc: 'Select the second best jem as well, but only if you find the best first!' },
  GOOD_ENOUGH:              { name: 'Good Enough',               desc: '+1 jewelry for each gem in the round with a quality above 75%' },
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
      '      _-  \\_   <\'-\'>   _/  -_ \n' +
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
    desc: 'Crack the safe before you\nare detected.',
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
    GILDED_BLADE: 'Secondary Chance      :',
    MIND_READING: 'Advantage Chance :',
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
    IDLE:     'Find the sweet spot on the dial!',
    MISS:     (det: number, max: number) => `Miss! Detection ${det}/${max}`,
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
