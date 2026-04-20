# Version Alpha 1.4.1

## Added
- You can now hold to click to buy or stitch in the sidequests 
## Removed

## Changed
- Failing the last memory game press should subtract -1 from your earned constructs at the end
- Familiars can be toggled individually per character
- First strike can be toggled 
- the upgrade unlocked glimmer looks better
- rebalanced merchant costs, chimera creation requirements

## Bugfixes
- Fixed a bug in the hint for the ranger gold-2
- Fixed a cost for the merchant
- Necromancer button changing no longer breaks hold click on other buttons
- The chimeramancer now checks costs properly. 
- The Thief gold bead now checks properly 
- fixed some per second and logging values
----------------------------
# Version Alpha 1.4.0

## Added
- The End Times
- Lore


## Removed

## Changed

## Bugfixes

----------------------------

# Version Alpha 1.3.0

## Added
- Bead System
- Blue bead 1 and 2 are unlcoked by manual clicking and jacks clicking
- Auto-Solve system for all sidequests, unlocked by socketing a Gold Bead
- Gold Bead has a 1/100 chance to drop on any successful sidequest completion, after 100 manual clears of that sidequest
- Gold Bead 2 is unlocked through secret patterns in sidequests
- The character menu will display a shine when something new is 
- Buy quantity buttons 
- New Character: The Merchant! Fence illicit goods and buy all sorts of items on the black market
- New Character: The Artificer! Study up to discover secrets and generate mana to create some particular enhancements to familiars
- New Character: Chimeramancer! Create a horror beyond comprehension using the parts of your fallen enemies and the resources you've gathered
- Two new kobolds! 
## Removed

## Changed
- Misc UI tweaks
- Kobold Ears no longer double from blue beads (other kobold parts still do)
- The LVL 0 dev button now unsockets all beads
- The UNLOCK dev button now finds all four bead types (not just blue)
- Hero button border pulses when clicked (color is configurable in flavor-text.ts)
- Thief gold-2 "good" auto-solve now probes at 0° and 30° then targets the sweet spot directly, instead of cycling through 90° intervals
- Necromancer costs more XP 
- Artisan costs more XP 
- Renamed Alchemist hero button to Distill


## Bugfixes
- Fixed per seconds not adding up properly 


----------------------------
# Version Alpha 1.2.2

## Added
- You are gaurenteed to get a relic on your first successful safe crack after you have 100 successful safe cracks, and you have yet to recieve a relic
- Added a stat milestone for when you obtain your first relic currency
## Removed
- Appraisals removed from the sidequest stats section
## Changed
- Renamed the minigame system to the sidequest system.
- The sidequest menu collapsable
- Good Enough now only checks for a 50% gem rather than a 75% gem. 
- Lucky Gem now contributes more and has fewer levels. It can max out at 100% 
- Potion Titration can have 100 max levels and gives a 4% chance each level
- The apothecary minigame toggles look like the fighter minigame toggles.
## Bugfixes
- Spelling mistakes
- Fixed a bug where Lucky Gems wasn't applying as much as it should have 
- Ward and defile jacks boxes have the all and none buttons
- Necromancer has coloring as well when the character select menu is collapsed
- Kobold Bait cost now displays correctly
----------------------------

# Version Alpha 1.2.1

## Added

## Removed

## Changed
- Improved the game area layout 
- Reduced the bait cost for kobolds 
- Reduced the meat cost of scouting
- Tweaked the success rates for thieving and meticulious planning

## Bugfixes
- Fixed the cost of potion of sticky fingers

----------------------------

# Version Alpha 1.2.0

## Added
- Statistics tracing menu for all sorts of stats! 
- Two new passive resource generation upgrades for Herbs and Meat
- A new automatic potion making upgrade for the apothecary. It can be toggled on and off
- A minimum hit upgrade for the fighter 
- A new upgrade to the thief minigame that gives hints as to the sweet spot location 
- Add new scaling upgrades for herbs and raw meat to the ranger
- Two new tiers of kobold!
- A New character, the Artisan! 
- A New Character, the Necromancer!
- More Jacks!
- Artisan "Faceting" minigame, pick the highest quality gem from six randomly generated stones
- Necromancer "Well of Souls" minigame, allows for the creation of Soul Stones, which can be used to provide temporary jacks!
- Added a ton of new upgrades across the board 
- Added a new potion base, Synaptical
- New Fighter minigame upgrade: Potion of Foresight — each level gives a 10% chance to roll attack damage twice and take the higher result
- Added a new Familiar system

## Removed
- Bigger Game upgrade

## Changed
- More Herbs and Better Tracking are stronger
- Short Rest is a tad more expensive
- Toggling a Vault or Activity Log filter while on ALL will select all options individually for ease of exclusion
- Failing the apothecary minigame will now reduce the percent chance of a successful dilution
- The dilution percent display color reflects this 
- Reduced the Kobold Ear cost of the Kobold Ear Jack
- Swapped the order of the Pixie Dust and Kobold Ear jack 
- Renamed "Unassign" to "Recall" all jacks
- Swapped the order of treasure and kobold 
- Tweaked the description of Plentiful Plundering
- Significantly more gold is awarded per unused detection in the thief minigame 
- Relic Hunter now costs more Hearty Meals
- Sharper Swords scales slower
- Reworked Serial Dilution to award more concentrated potions
- Kobolds drop more gold 
- Waste Not hearty meal cost scales harder
- Stronger Kobolds has a lower kobold part cost
- Hovel Garden and Beast Traps scale a little less
- Bubbling Brew now costs herbs 
- Fermentation Vats cost scaling is less
- Made the minigame panel a little wider to give a little more breathing room
- Unified the scrollbar design to use the clean, blocky style
- Reworked activity log currency display formatting
- Reworked Perfect Potions to give bonus dilution success chance per perfect click
- Reduces kobold ear scaling on Stronger Kobolds
- Relics now cost a scaling amount of jewelry in addition to the static 1 relic 
- Increased the Wholesale cap

## Bugfixes
- Cleaned up the missing row on the ranger character stats box 
- Cat's Eye potion is now factored in to the per seconds 
- You can no longer toggle the dilution upgrade in the middle of a brew
- Differentiated base and waste not yield in the activity log message for the culinarian minigame
- Fixed perfect potions upgrade not showing up 
- General Performance improvements
- Fix a bug with bonus potion not calculating correctly
- Corrected misc math errors

----------------------------

# Version Alpha 1.1.1

## Added
- Relic Upgrades
- Start timestamp to save games for metadata tracking purposes
- Currency Source tooltips by 
- Dev button secrets

## Removed
- Dossiers/s from the thief character stats, it's only in the currency menu now 
- Best hunt % from the upgrade description. It's in the character stats box 
- Bountiful lands mazes out at 4, the current cap for kobold parts
## Changed
- Changed the color of upgrades a little
- XP threshold unlocks will remember that they were unlocked 
- Kobolds drop a tad more gold 
- If INFO level logs are filtered out, they won't be generated at all and will not display in the log, and will therefore not count against the max log memory limit
## Bugfixes
- Sidebar per seconds will use the correctly formatted number system
- Fixed Ancient Cookbook unlock requirement not registering correctly 
- Having over a 100% herb save chance will allow you to save more than 1 herb, as intended
- Fixed some issues with savegames not fully resetting when loading a new game 

----------------------------

# Version Alpha 1.1.0

## Added
- A new character, the Thief. They will collect knowledge in the form of Dossiers, and crack safes for treasure and a handful of very rare relics...
- A handful of new upgrades for the thief
- A new upgrade for the Apothecary, Perfect Potion
- A new upgrade for the Culinarian, Ancient Cookbook
- Plentiful Plundering upgrade for the Thief — awards gold per heist equal to dossiers × upgrade level
- A new ranger upgrade, Fairy Hostage, that reveals the location of one randomly chosen pixie tile with a sparkle animation
- A new tier of Kobold
- First Strike, allowing you to take less damage from Kobolds, and a cool hidden feature...!
- The currencies panel now pins gold and xp to the top, and moved them to a "global" currency group

## Removed
- Dev Tools button... Unless?

## Changed
- Nerfed Short Rest Potion Efficiency
- Changed Bountiful lands to give a flat +1 node, costed around the fighter minigame resources
- Assorted lore changes
- Tweaked the XP unlock milestones
- Ranger minigame requires a little more meat
- Buffed Kobold Tongue drop rate
- Nerfed Waste Not Scaling

## Bugfixes
- Fixed costs not scaling properly when loading from an outdated save game 
- Fixed a bug where the fighters attack power was factored in twice
- Savegame now remembers the dilution toggle
----------------------------
# Version Alpha 1.0.1

## Added
- Add version number to the option menu
- New Jacks management Buttons
- Special upgrade coloring for one off powerful upgrades
- Short rest potion chugging logging

## Removed
 - Removed the beat bar label form the apothecary minigame

## Changed
- Renamed the Culinarian minigame to the "Test Kitchen"
- Changed the description of Potion Dilution to make it a tad more clear what effects it might have
- Reduced the scaling of most upgrades
- Increased the XP threshold for unlocking some of the later XP milestones
- All upgrades that use concentrated potions cost less
- Potion marketing costs a tad more to start
- Log messages now reflect the rarity of the drop in the fighter minigame
- Kobold hairs have a new coat of paint
- Made the attack and heal button not selectable
- Potion dilution has a higher start chance

## Bugfixes
- Cleanup up the mutual kill message as to not cause excessive wrapping in the fighter minigame
- The XP Progress track now reflects all XP unlock milestones
- Missing costs are now shown when restarting the culinarian minigame
- Named the wholesale price character stat properly
----------------------------
# Version Alpha 1.0.0
 Initial Alpha Release

## Added
- Short rest selection is now saved and remembered between screens and through the savegame
- Wholesale spices toggle is now saved through the savegame
- A sad message when you don't get anything in the ranger minigame 


## Removed



## Changed
- Include the game version in the savegame file
- Renamed the "Base" filter to "Fighter" in the currency menu
- Fighter attack damage will not display in the character stats until minigames are unlocked
- The order of the minigame currency unlocks is now gold-meat-pots rather than gold-pots-meat
- Fighter resources are now grouped together in the currency menu 
- Fixed the ranger minigame reward text persisting after restarting the game

## Bugfixes
- Jacks upgrades no longer show up after the last one is purchased. 

----------------------------

# Version Alpha X.X.X

## Added

## Removed

## Changed

## Bugfixes

----------------------------
