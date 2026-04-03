# TODO List
## Systems

### Lore Pages
- Lore Pages that give context about the character or the world they live in. Can be unlocked by doing certain things in minigames...
- Statistics tracking


### More characters
  - Artisan
    - Odd One Out Gems
    - uses gems from the Thief
    - can provide temporary bonuses to random gathering targets?
  - Warlock
    - Connect the dots spellcasting
    - Generates Brimstone
    - Minigame creates Soul Stones
      - It consumes XP!
    - Enables the fighter to harvest bones from the monsters (that have them lol)
    - Soul Stones can be used to conjure temporary Jacks? familiars?
  - Mage
    - Memory matching / Simon Says
    - Reads pages from the intel
    - Generates Mana
    - Minigame creates Spell Scrolls
    - Spell Scrolls can be used to buff familiars? 

  - Chimeramancer
    - Animal parts combination mix and match synergy?
      - kobold ear, kobold tongue, kobold hair, beast meat, bones, other things from the fighter 
  - Party Face
    - Card game Blackjack?
  - Merchant
    - Stock market game where you can sell your materials for gp, and buy other materials for gp
  - Slayer
    - Last party member, unlocks the Campaign mode. Wayyyy down the line. Total game conversion.


  
### Easter Eggs
- Fairy Ring codes in the ranger minigame
- Kobold Killing... The numbers... What do they mean? Numbers Station... s: 0–2–5–8–8

## Upgrade Ideas

### Fighter
- "Clean Kills" upgrade that makes uncommon drops from the fighter minigame more likely to be dropped
- Make enemies drop more gold. Maybe combine this with the above and make it "more loot"
- "Advantage!" Rolls damage twice and takes the higher

### Ranger 
- Buried Treasure upgrade on ranger minigame that gives a big bonus of gold
- "Divide and Conquer" Jacks are more effective when hunting and gathering
- Dense Woodlands upgrade that gives a base +1 resource yield on herbs and meat in the ranger minigame


### Apothecary


### Culinarian

## UI Tweaks
- Once a xp threshold is passed, anything unlocked by that threshold should remain, and the threshold should not be tracked again in the currency menu
- Some sort of "new upgrade unlocked here" notif? maybe flash the character menu till its selected? 
- Hovering over or clicking on a per second should show you all fo the factors adding or subtracting to that value 
- ? Should the "1.5k" type displays always floor so it never rounds up and misrepresents how much currency you actually have?
- In game Changelog? 
- Add an "effective price per spice" display in the character stats menu 
- Gold and Exp can be "pinned" to the top of the currency menu 

## Balancing
- Add some more one off big upgrades shortly after minigame unlocks?
- Some of the upgrades maybe don't need to go to 999 and can instead just progress multiple % per level, and scale a little harder in return?
  - Or some could just be more Chunky and give discrete values, like Bountiful Lands
    - Bubbling Brew adds a new randomly placed bonus area, up to 5 at max level
- Bigger game is kinda whatever and not super interesting

## Bug Fixes
- 200% herb save isn't saving 2 herbs



## Code Refactors
- extract log text to flavor file, might need to implement string replacement here idk
  - Make sure the logs use the symbols not the names 
  - Make it so default info logs are ignored if filtered out. Other messages should persist 
- Fighter minigame combat log is a mess lmao 
- Add a "Start Time" in the save file upon first navigating to the page, only on fresh saves
- Extract monster info into the game config 

