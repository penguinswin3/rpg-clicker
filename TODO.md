# TODO List
## Systems
- kobold paw
- - potion of the collosus, +1hp per level in potion of fortitude

### Lore Pages
- Lore Pages that give context about the character or the world they live in. Can be unlocked by doing certain things in minigames...
- Each lore page gives a static resource multiplier for some of that characters resources from ALL sources
- One can be gotten from randomly clicking the button
  - Gives lore on the character's Bagkground
- one can be gotten from doing a particular action in the minigame
  - A small vignette on the character's interaction with the doomsayer
  - Fighter: Killing kobolds in a certain pattern
  - Ranger: Selecting a particular set of 3 in a few games in a row 
  - Apothecary: clicking the synapse zones in a particular order, maybe doing it at 0% dilution
  - Culinarian: guess a certain pattern of 4 in a row
  - Thief: lockpicking times at a certain time (across multiple games cause you can get it first try)
  - Artisan: Selecting some assortment of gems, or intentionally throwing too much in a certain way 
  - Necromancer:drawing a certain pattern (cross through the gem 3 times?)

-Collecting one allows you to autoplay their minigame, slower than you might be able to. 
- Collecting doubles all resource gains from that character
- collecting 3 upgrades the minigame to the optimal strategy
  Can this be done while not on the page? 
  - Maybe add a secret third note that gives them an optimal strategy? 
  - Fighter: Spam attack -> spam attack and heal when under half
  - Ranger: 3 random squares -> star square, two treasure squares, then random
  - Apothecary: one click per box pass through -> spam click in boxes
  - Culinarian: "All one suit" guesses to force it -> actually use the info available
  - Thief: Click on cadence -> Use the colored info to guess better
  - Artisan: Factors in color and size -> Just reads the game data lol, maybe just factors in blur too
  - Necromancer: Clicks the next available clockwise -> Just reads the game data 

- These tier show up above the hero button, once the minigames are unlocked. THIS NEEDS TO INTEGRATE WITH THE RELIC, BEFORE THE RELIC SHOWS UP SO THAT WHEN THE RELIC SHOWS UP, IT INTEGRATES IN THE UI NICELY 
-Add a fourth lore tier, post relics, that give another 2x resource yield. Earned from jacks (or familiar) presses only

### Beads System (Implemented ✓)
- 4 bead slots per character: 2 blue (outer), 2 gold (inner), surrounding the relic socket
- Blue beads: 1/500 chance per manual hero press. Doubles all resource yields when socketed.
- Gold beads: 1/10000 chance per jack/familiar press. Placeholder for sidequest automation.
- Found beads pulse with visual indicator; click to open modal and socket them.
- Bead multiplier applied to hero clicks, jack clicks, passive income, and per-second display.
- TODO: Apply bead multiplier to minigame reward outputs
- TODO: Gold bead sidequest automation functionality
### More characters
- Party Face
  - Card game Blackjack?
- Merchant
  - Stock market game where you can sell your materials for gp, and buy other materials for gp
- Artificer
  - Memory matching / Simon Says
  - Reads pages from the intel
  - Generates Mana
  - Minigame creates Spell Scrolls
  - Spell Scrolls can be used to buff familiars?
- Chimeramancer
  - Animal parts combination mix and match synergy?
    - kobold ear, kobold tongue, kobold hair, beast meat, bones, other things from the fighter 
  - Makes a horror beyond our comprehension
  - Something else?

  - Slayer
    - Last party member, unlocks the Campaign mode. Wayyyy down the line. Total game conversion.
    - Has to slay the horror 
  
### Easter Eggs
- Fairy Ring codes in the ranger minigame
- Kobold Killing... The numbers... What do they mean? Numbers Station... s: 0–2–5–8–8
- killstreak

## Upgrade Ideas
- Master of All - An upgrade for jacks that auto play minigames. Might be a good relic upgrade? 

### Fighter
- Swarm Killing. Kobolds might have more HP, but you might get some bonus parts of a lower tier 

### Ranger 
- Once better tracing is maxed open a new upgrade (Bigger beasts? Maybe add a new level select button or something?)
- Eye for glint upgrade, costs gems, reveals all pixies. requires pixie trap

### Apothecary


### Culinarian
- Spice reselling, but it at wholesale and then sell it individually

### Thief
- Percision lockpicking, bonus treasure based on how close to the center of the bar you were 

### Artisan 
- Out of Fashion upgrade for Artisan (increase good gem threshold to 50%)


### Necromancer

## UI Tweaks
- Some sort of "new upgrade unlocked here" notif? maybe flash the character menu till its selected? 
- In game Changelog?
- Little "shine" on the character select button every time something new shows up there till you click it. 
- Rename Alchemize to Concoct
- make a lot of things not highlightable 
- Add some sort of reference to relics that the thief can get from the minigame 

## Statistics
- Statistics culinarian minigame histogram or count %s


## Balancing
- A "Balance Report" that shows gaps in the cost progression
  - Makes grap-hs of time to recoup costs for an upgrade. number of seconds or clicks
- Add another jacks speed upgrade at Artisan Tier 
- Each level of relic hunter should give +1% of finding a relic 
- Ranger, apoth, and culi relic rewards are bad
- thieving relic might be too good 

## Bug Fixes

## Code Refactors

