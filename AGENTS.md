# AGENTS.md — RPG Clicker Codebase Guide

Angular 18 incremental-clicker game. No backend; all state is in-browser via `localStorage`.

## Commands
```bash
ng serve          # dev server at http://localhost:4200
ng build          # production build → dist/
ng test           # Karma unit tests
```

## Architecture Overview

### Data Flow
`game-config.ts` → Services → Components → Templates

- **`game-config.ts`** is the single source of truth for *all* tunable values: upgrade definitions (`UPGRADE_DEFS`), global purchase definitions (`GLOBAL_PURCHASE_DEFS`), per-minigame constants (`FIGHTER_MG`, `APOTH_MG`, etc.), and balance numbers (`YIELDS`). **Edit numbers here only** — no logic files need changing for balance tweaks.
- **Services** (`WalletService`, `UpgradeService`, `CharacterService`, `StatisticsService`) are `providedIn: 'root'` singletons injected with Angular's `inject()`. They hold runtime state and expose RxJS `BehaviorSubject`s / `Subject`s.
- **`AppComponent`** orchestrates game ticks, save/load, and cross-service wiring.
- **`SaveService`** serializes/deserializes the full `UpgradeState` + `WalletState` to `localStorage`. All new persistent fields are added to `UpgradeState` with `?` (optional) for backward save compatibility.

### Characters & Unlocking
Each character is defined in `CharacterService` and unlocked via a matching `UNLOCK_<CHARID>` entry in `GLOBAL_PURCHASE_DEFS`. Adding a new character requires:
1. An `UNLOCK_<CHARID>` entry in `GLOBAL_PURCHASE_DEFS` (`game-config.ts`)
2. A character object in `CharacterService`
3. Upgrade entries in `UPGRADE_DEFS` with matching `characterId`
4. Currencies registered in `WalletService.currencies`
5. A minigame component under `src/app/minigame/<name>/`

### Upgrade System
`UpgradeService` drives all upgrades. Key API:
- `u.level('UPGRADE_ID')` — current level
- `u.maxLevel('UPGRADE_ID')` — configured max (from `UPGRADE_DEFS`)
- `u.purchase('UPGRADE_ID')` — deducts costs via `WalletService` and increments level
- `UpgradeGates` on each `UpgradeDef` control visibility; evaluated by the host component, not the service.

### Hero Stats & Yield Helpers
- `src/app/hero/yield-helpers.ts` — pure math functions for all per-click/per-second calculations.
- `src/app/hero/hero-stats.ts` — calls yield-helpers to build `HeroStat[]` for the sidebar; dispatches by `charId` string.
- `src/app/hero/per-second-calculator.ts` — computes wallet per-second rates for the Jack system.

### Jack of All Trades (Auto-click)
Jacks are allocated per character (`jacksAllocations: Record<string, number>`). Each jack auto-clicks the character's hero button on a timer. The "Jack'd Up" upgrade increases speed by `JACKD_UP_SPEED_MULT`. The Familiar system (Necromancer) adds virtual jacks.

### Minigame System
Each character has a minigame panel under `src/app/minigame/<name>/`. They share the `minigame-panel` wrapper. Auto-solve timings live in `AUTO_SOLVE` (and `GOOD_AUTO_SOLVE` when both gold beads are socketed).

### Save Format
`UpgradeState` in `save.service.ts` — all fields optional for forward/backward compatibility. Adding new fields: always use `?` and provide a default on load. See `example-savegames/` for real save strings across versions.

## Key Conventions
- **Balance changes**: only in `game-config.ts`. Never hardcode magic numbers in components or services.
- **Flavor/text**: only in `flavor-text.ts` (`CHARACTER_FLAVOR`, `UPGRADE_FLAVOR`, `CURRENCY_FLAVOR`, `LOG_MSG`, etc.).
- **Upgrade gating**: add a `gates` field in `UPGRADE_DEFS`; evaluate the gate in the relevant component's template (pattern: `*ngIf="upgradeService.isVisible(id, gates)"`).
- **New currency**: register in `WalletService.currencies[]` with `requiredCharacterId` and/or `manualUnlock: true` as needed.
- **Dynamic upgrade max**: use `UpgradeService.setMaxOverride(id, n)` from `AppComponent` (see `SLOW_BLADE` example).
- **Relic costs**: computed dynamically by `UpgradeService.syncRelicCosts()` using `RELIC_COSTS`; do not hardcode jewelry amounts.

## Key Files
| File | Purpose |
|------|---------|
| `src/app/game-config.ts` | All constants, upgrade defs, minigame params |
| `src/app/flavor-text.ts` | All user-visible strings |
| `src/app/hero/yield-helpers.ts` | Pure math for all stat calculations |
| `src/app/hero/hero-stats.ts` | Sidebar stat builders per character |
| `src/app/options/save.service.ts` | Save/load schema and localStorage logic |
| `src/app/upgrade/upgrade.service.ts` | Upgrade purchase, level, cost management |
| `src/app/wallet/wallet.service.ts` | Currency amounts, per-second rates |
| `src/app/character/character.service.ts` | Character unlock state |

