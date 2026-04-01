# TODO List
## Systems

### Lore Pages
- Lore Pages that give context about the character or the world they live in. Can be unlocked by doing certain things in minigames...
- Statistics tracking


### More characters
  - Thief
    - Lockpick minigame
    - Primary currency: Intel (papers)
    - Minigame Currency: Treasure (gemstones)
  - Artisan
    - Odd One Out Gems
    - uses gems from the Thief
    - can provide temporary bonuses to random gathering targets? 
  - Mage
    - Memory matching / Simon Says
    - Reads pages from the intel
    - Generates Mana
    - Minigame creates Spell Scrolls
    - Spell scrolls and hexes combine to make Dark Tomes
  - Warlock
    - Connect the dots spellcasting
    - Generates Brimstone
    - Minigame creates Soul Stones
      - It consumes XP! 
    - Enables the fighter to harvest bones from the monsters (that have them lol)
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
- Kobold Killing... The numbers... What do they meam? Numbers Station... s: 0–2–5–8–8

## Upgrade Ideas

  ### Fighter
- "Clean Kills" upgrade that makes uncommon drops from the fighter minigame more likely to be dropped
- Make enemies drop more gold. Maybe combine this with the above and make it "more loot"
- Auto attack type button? Maybe just click once to start a kill and then another later that auto restarts?
  - Maybe assign a jack to it idk If I like that 

    ### Ranger 
- Visions of pixies upgrade that gives a little sparkle effect where a pixie might me. A few tiers with varying accuracies, can scale to up to 3 sparkles
- Buried Treasure upgrade on ranger minigame that gives a big bonus of gold
- "Divide and Conquer" Jacks are more effective when hunting and gathering
- Dense Woodlands upgrade that gives a base +1 resource yield on herbs and meat in the ranger minigame


  ### Apothecary


  ## Culinarian

## UI Tweaks
- Once a xp threshold is passed, anything unlocked by that threshold should remain, and the threshold should not be tracked again in the currency menu
- Kobold ear currency should be up top, near the other fighter resources 
- change the order of the minigame currency unlocks so it goes gold-meat-pots rather than gold-pots-meat
- Fighter attack damage character stat shouldn't display until minigames are unlocked 
- Rename "Base" in the filters to Fighter 
- Recall all jacks button 
- After unlocking 5 jacks, add a "remove all and add all" button above and below the jacks box 
- Some sort of "new upgrade unlocked here" notif? maybe flash the character menu till its selected? 
- Any upgrade with a 1 level cap (or no level cap like JoAT) should have a golden left color bar
- Victory should be a base info log unless you receive a secondary drop. 
- Short rest selection should be saved and remembered between screens
- Wholesale spices toggle should be saved
- Hovering over or clicking on a per second should show you all fo the factors adding or subtracting to that value 

## Balancing
-Add some more one off big upgrades shortly after minigame unlocks?
- Some of the upgrades maybe don't need to go to 999 and can instead just progress multiple % per level, and scale a little harder in return? 
- Short rest basically makes you invincible, it should operate at reduced potion efficiency 
- Pixie dust could use another use 

## Bug Fixes
- 200% herb save isn't saving 2 herbs
- the experience bar maxes out at like 2.5k or something, the next few unlocks should be there too
- The reward from the last ranger minigame isnt going away upon starting the next 
- Jacks after the last special costed one should not be purchaseable (they go back to gold only) 

## Code Refactors
- extract log text to flavor file, might need to implement string replacement here idk
