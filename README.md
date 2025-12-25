# The Pyramid

A satirical idle/clicker game that exposes the mathematical impossibility of pyramid schemes while being genuinely fun to play.

## Concept

**The Pyramid** is a Cookie Clicker-style game where players "recruit" people into a pyramid scheme. The twist: the game includes a "Reality Check" counter showing how quickly the required number of recruits exceeds Earth's population - making the inherent unsustainability of these schemes viscerally obvious.

### Core Theme
- **Game first, education second** - It should be genuinely fun
- **Corporate satire** - Mocking the absurd tier names, motivational culture, and hollow promises
- **Mathematical reality** - Showing through gameplay how pyramid math is impossible

## Tech Stack

- React 18 + Vite
- Pure CSS (no framework)
- Local Storage for save state

## Getting Started

```bash
npm install
npm run dev
```

## How to Play

### The Pyramid View

You start near the bottom of a visual pyramid with ~31 positions. Your goal is to climb to the top by:
1. **Clicking to recruit** - Generate money through direct recruitment
2. **Building passive income** - Upgrade your income-per-second
3. **Executing coups** - Overtake the person directly above you
4. **Strategic investing** - Fund others' coups for ROI

### Your Position

- **You** are highlighted in the pyramid (green glow)
- **Your upline** (direct boss) is shown in red - this is who you can coup
- **Your siblings** (same level, same upline) are shown in blue
- **Your downline** (everyone below you) is shown in cyan

### Making Money

1. **Click the Recruit button** - Direct income from new recruits
2. **Passive Income** - $/sec from upgrades
3. **Downline Income** - You earn 15% of each downline member's income
4. **Investment ROI** - 50% return when someone you invested in successfully coups

### The MLM Reality

Your upline takes 10% of your base income. This is the pyramid scheme reality - money flows up.

---

## Coup Mechanics

A **coup** is how you climb the pyramid by overtaking your direct upline.

### How Coups Work

1. **Click your upline** (red-highlighted node above you)
2. **Pay the base cost** - Calculated from power difference
3. **Optional: Add extra investment** - Increases success chance
4. **Roll for success** - Algorithmic chance based on power comparison

### Power Calculation

```
Power = money + (incomePerSec × 100) + investmentsReceived
```

### Success Chance

```
successChance = 50 + (yourPower - theirPower) / 50
```
- **Minimum**: 10% (even weak players have a chance)
- **Maximum**: 95% (never guaranteed)
- Adding extra investment to your coup attempt increases your power for the calculation

### On Success

- You swap positions with your target
- They become YOUR subordinate
- All investors in you receive 50% ROI payout
- You gain access to a larger downline

### On Failure

- You lose the money spent
- 10-second cooldown before you can try again
- Investments in you are lost (investors lose their money)

---

## Investment System

Invest in other pyramid members to boost their coup power and earn returns.

### How to Invest

1. **Click any node** in the pyramid
2. **Enter an investment amount**
3. **Click Invest**

### Returns

- If your investment target successfully coups someone: **50% ROI**
- If they fail: **You lose your investment**

### Strategy

- **Invest in siblings** - If they coup your shared upline, there's now an opening above you
- **Invest in your upline** - They climb, you climb (your downline expands)
- **Invest in aggressive bots** - Watch for bots with high power who might coup soon

---

## Bot AI

The pyramid is populated with bot players who:

- **Accumulate money** over time based on their level
- **Attempt coups** when they have good odds (~30%+) and enough money
- **Invest in siblings** occasionally (5% chance per tick)
- **Make the pyramid dynamic** - Positions change even when you're not acting

Bot names are satirical takes on MLM culture ("Karen from Facebook", "Your Uncle Chad", etc.)

---

## Game Configuration

All game parameters are tunable in `src/pyramid.js` via the `CONFIG` object:

```javascript
CONFIG = {
  // PYRAMID STRUCTURE
  pyramidLevels: 5,              // Total levels (1+2+4+8+16 = 31 nodes)
  playerStartLevelMin: 3,        // Player starts at this level or below

  // INCOME & ECONOMY
  recruitsPerClickBase: 1,       // Base recruits per click
  moneyPerRecruit: 10,           // $ earned per recruit
  downlineIncomePercent: 0.15,   // 15% of each downline member's income
  uplineSkimPercent: 0.10,       // 10% of your income goes to upline

  // COUP MECHANICS
  coupBaseCostMultiplier: 0.5,   // Coup cost = defender power × this
  coupPowerReduction: 0.1,       // Your power reduces coup cost by this %
  coupMinCost: 50,               // Minimum coup cost
  coupSuccessBase: 50,           // Base success chance (%)
  coupPowerScaleFactor: 50,      // How much power difference affects success
  coupMinChance: 10,             // Minimum success chance (%)
  coupMaxChance: 95,             // Maximum success chance (%)
  coupCooldownMs: 10000,         // Cooldown after failed coup (10 sec)

  // INVESTMENTS
  investmentROI: 1.5,            // Payout multiplier (1.5 = 50% ROI)
  investmentsLostOnFail: true,   // Investors lose money if coup fails

  // BOT AI
  botCoupChancePerTick: 0.10,    // 10% chance bot attempts coup each second
  botMinCoupOdds: 30,            // Bot won't coup unless odds ≥ 30%
  botCoupMoneyBuffer: 1.5,       // Bot needs cost × 1.5 money to coup
  botCoupExtraInvestPercent: 0.2,// Bot invests 20% of money in coup attempt
  botInvestChancePerTick: 0.05,  // 5% chance bot invests in sibling
  botInvestPercent: 0.1,         // Bot invests 10% of money
  botMinInvestAmount: 10,        // Minimum investment
}
```

---

## Controls

### Pyramid View
- **Scroll wheel** - Zoom in/out
- **Click and drag** - Pan around
- **Click node** - Open action modal (coup/invest)
- **Zoom buttons** - Fine control (+/-/Reset)

### Menu
- **Menu button** (top right) - Open game menu
- **Save** - Manual save to localStorage
- **Restart** - Start a new game

### Auto-Save
- Game auto-saves every 30 seconds
- Game saves when you close the tab/window

---

## Current Features

- [x] Basic UI layout (3-column responsive grid)
- [x] Main recruit button (click to recruit)
- [x] Money system ($10 per recruit)
- [x] Tier progression system with satirical names
- [x] Statistics panel
- [x] Upgrades panel with scaling costs
- [x] Rotating motivational quotes (satirical)
- [x] Reality Check counter (shows people needed to sustain)
- [x] Visual pyramid with 31 nodes
- [x] Coup mechanic with success chance algorithm
- [x] Investment system with ROI tracking
- [x] Bot AI (coups, investments, income)
- [x] Downline income (15% of subordinates' earnings)
- [x] Upline skimming (10% taken by your boss)
- [x] Save/load game state to localStorage
- [x] Auto-save every 30 seconds
- [x] Zoom and pan controls for pyramid
- [x] Satirical bot name generator

## Tier System

1. Hopeful Newcomer
2. Bronze Associate
3. Silver Partner
4. Gold Executive
5. Platinum Director
6. Diamond Elite
7. Double Diamond Supreme
8. Triple Platinum Sapphire Overlord
9. Galactic Ruby Omega Champion
10. Transcendent Uranium Phoenix Master

---

## Game Balance Notes

### Design Philosophy

The early game should feel like a **grind**. Players need to work for their first upgrades, and as they progress, the game should push them to engage with **all systems** (clicking, passive income, investments, coups) rather than just clicking their way through.

### Upgrade Economics

The upgrade system is designed with these principles:

1. **Escalating click requirements**: Each upgrade tier requires MORE clicks than the last (not fewer)
2. **Reward patience**: Later upgrades provide better value per dollar spent
3. **Force system engagement**: By mid-game, clicking alone becomes impractical - players MUST use passive income and investments
4. **Human click speed**: Assumes ~5 clicks/second, so costs are calibrated accordingly

### Current Upgrade Tiers

**Recruitment Skills (Click Power):**
| Level | Cost | Bonus | Clicks to Earn |
|-------|------|-------|----------------|
| 1 | $1,000 | +1/click | ~100 clicks |
| 2 | $5,000 | +3/click | ~250 clicks |
| 3 | $25,000 | +8/click | ~500 clicks |
| 4 | $100,000 | +20/click | ~770 clicks |
| 5 | $400,000 | +50/click | ~1200 clicks |

**Passive Income:**
| Level | Cost | Bonus |
|-------|------|-------|
| 1 | $2,000 | +$2/sec |
| 2 | $8,000 | +$5/sec |
| 3 | $30,000 | +$15/sec |
| 4 | $120,000 | +$40/sec |
| 5 | $500,000 | +$100/sec |

### Balance Rationale

- **First upgrade at $1,000**: At base rate ($10/click), this is 100 clicks (~20 seconds of dedicated clicking). Feels earned but not tedious.
- **Escalating costs**: By upgrade 3-4, pure clicking would take 500-800 clicks. Players should be thinking: "I need to coup for better downline income" or "I should invest in that bot about to coup."
- **Passive income becomes essential**: The passive income upgrades help offset the increasing click requirements, but aren't a replacement for strategic play.

### The Reality Check

The game should feel progressively easier due to upgrades, but the Reality Check counter reminds players that in real life:
- Each level of a pyramid needs exponentially more people
- After ~13 levels at 5 recruits each, you exceed world population
- 99% of MLM participants lose money

---

## Development Notes for AI Assistants

When continuing development on this project:

1. **File Structure**:
   - `src/App.jsx` - Main game component, game loop, save/load
   - `src/pyramid.js` - Pyramid data structure, coup/invest logic, bot AI
   - `src/botNames.js` - Satirical name generator
   - `src/components/PyramidView.jsx` - SVG pyramid visualization
   - `src/components/PyramidNode.jsx` - Individual node component
   - `src/components/ActionModal.jsx` - Coup/invest modal UI

2. **State Management**: React useState with refs to avoid useEffect dependency issues in game loop

3. **Game Loop**: 1-second tick interval handles:
   - Player passive income + downline income - upline skimming
   - Bot income and AI decisions (coup attempts, investments)

4. **Styling**: CSS variables defined in `index.css` for theming

5. **Satirical Tone**: Keep the humor corporate/MLM focused - absurd tier names, hollow motivational speak, etc.

## License

MIT
