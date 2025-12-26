# The Pyramid

A satirical idle/strategy game that exposes the mathematical impossibility of pyramid schemes while being genuinely fun to play.

## Concept

**The Pyramid** is a strategic game where players climb a pyramid scheme through marketing, investments, and buy-outs. The twist: a "Reality Check" counter shows how quickly the required recruits exceeds Earth's population - making the inherent unsustainability viscerally obvious.

### Core Theme
- **Game first, education second** - Genuinely fun gameplay
- **Corporate satire** - Mocking absurd tier names, motivational culture, and hollow promises
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

### The Day Cycle

The game operates on a **day-based economy** (1 day = 15 seconds):
- Income is calculated once per day
- Decisions are strategic, not spam-based
- Plan your moves between day ticks

### Making Money

1. **Run Ads** - Spend money to recruit people (costs $5+ per recruit)
2. **Recruit Income** - Each recruit generates $0.50+ per day based on efficiency upgrades
3. **Downline Income** - Earn 30% of each person below you in the pyramid
4. **Investment Dividends** - Earn your ownership % of invested nodes' income per day

### Starting Budget

You begin with **$500** and must decide how to spend it:
- Run ads to get recruits (your income source)
- Buy efficiency upgrades (make recruits worth more)
- Invest in others (earn dividends + ROI on successful buy-outs)
- Save for a buy-out attempt

---

## The Pyramid View

You start near the bottom of a visual pyramid with 255 positions (8 levels). Your goal is to climb to the top by:

1. **Marketing** - Spend money to recruit, generating income
2. **Upgrading efficiency** - Make each recruit more valuable
3. **Buying out your upline** - Take their position and their downline
4. **Strategic investing** - Fund others for dividends and ROI

### Visual Indicators

- **You** - Green glow
- **Your upline** - Red highlight (who you can buy out)
- **Your siblings** - Blue (same level, same upline)
- **Your downline** - Cyan (everyone below you)
- **Green badge** - Total investments received (click to see investors)
- **Blue badge** - Number of investors
- **Red pulsing glow** - Threatened nodes (subordinate has 25%+ buy-out chance)

---

## Buy-Out Mechanics

A **buy-out** is how you climb the pyramid by taking over your direct upline's position.

### How Buy-Outs Work

1. **Click your upline** (red-highlighted node)
2. **Pay the base cost** - Based on power difference
3. **Optional: Add extra investment** - Increases success chance
4. **Roll for success** - Algorithmic chance based on power comparison

### Power Calculation

```
Power = Money + (Investments Received × 1.5)
```

Having investors backing you makes you stronger!

### Success Chance

```
successChance = 20 + (yourPower - theirPower) / 200
```
- **Base**: 20%
- **Minimum**: 5%
- **Maximum**: 75%

### On Success
- Swap positions with your target
- They become YOUR subordinate
- All investors in you receive 50% ROI payout
- You gain their entire downline

### On Failure
- You lose ALL money spent
- Your lost money goes to YOUR downline (they can buy YOU out!)
- Target gets 30-second protection
- Your investors lose their investment

---

## Investment System

Invest in others to boost their power and earn returns.

### Investment Rules

**Cannot invest in:**
- Yourself
- Direct parent (immediate upline)
- Direct children (immediate downline)
- Anyone whose upline you are

**Can invest in:**
- Siblings (same parent)
- Extended family (cousins, nieces/nephews, etc.)

### Returns

**Ownership Calculation:**
```
Ownership % = Your Investment / Total Investments in Node
```

If you invest $100 and there's $1000 total invested, you own 10%.

**Dividends:** You earn your ownership % of their daily income.

**Buy-Out Payouts:** If they successfully buy out someone: **50% ROI** on your investment!

---

## Upgrades

### Recruitment Skills (Capped at 5 levels)
Increases recruits per ad click.

| Level | Cost | Bonus |
|-------|------|-------|
| 1 | $1,000 | +1/click |
| 2 | $5,000 | +3/click |
| 3 | $25,000 | +8/click |
| 4 | $100,000 | +20/click |
| 5 | $400,000 | +50/click |

### Recruit Efficiency (Infinite levels)
Increases income per recruit per day.

- **Cost**: $50 × 1.4^level (exponential)
- **Bonus**: +$0.1 per recruit per day per level (linear)

---

## Bot AI

The pyramid is populated with bots who have different personalities:

- **Grinder** - Conservative, rarely acts, protects position
- **Shark** - Very aggressive, takes big risks on buy-outs
- **Venture Capitalist** - Invests constantly, rarely buys out
- **Schemer** - Invests in siblings, moderate aggression
- **Opportunist** - Balanced approach, watches for openings
- **Sleeper** - Almost never acts, saves money
- **Kingmaker** - Maximum investment focus, backs high-income nodes

Bot personality distribution varies by pyramid level (sharks at bottom, grinders at top).

---

## Game Configuration

All game parameters are in **`src/config.js`**:

```javascript
// Day cycle
DAY = {
  durationMs: 15000,           // 15 seconds per day
  baseIncomePerRecruit: 0.5,   // $0.50 per recruit per day
}

// Marketing
MARKETING = {
  startingBudget: 500,         // Starting money
  baseCostPerRecruit: 5,       // $5 per recruit
  costScaling: 1.001,          // Slight scaling
}

// Economy
ECONOMY = {
  downlineIncomePercent: 0.30, // 30% of downline income
  uplineSkimPercent: 0.10,     // 10% goes to your upline
}

// Investments
INVESTMENT = {
  roi: 1.5,                    // 50% ROI on success
  powerMultiplier: 1.5,        // 1.5x power from investments
}
```

---

## Controls

### Pyramid View
- **Scroll wheel** - Zoom in/out
- **Click and drag** - Pan around
- **Click node** - Open action modal (buy-out/invest)

### Game Over

If someone below you successfully buys you out, the game ends! You'll see your final stats and can restart.

### Auto-Save
- Auto-saves every 30 seconds
- Saves when closing the tab

---

## Header Analytics

The header shows key stats:
- **Day** - Current day with progress bar to next tick
- **Balance** - Your money
- **Per Day** - Total expected income per day
- **Recruits** - Your direct recruits
- **Downline** - People below you in pyramid
- **Invested** - Total money invested in others
- **Inv. Income** - Income from investments per day
- **Level** - Your pyramid level (0 = TOP!)

---

## File Structure

```
src/
├── config.js          - ALL tunable game values
├── App.jsx            - Main game, day loop, save/load
├── App.css            - All styling
├── pyramid.js         - Pyramid logic, buy-out/invest, bot AI
├── botNames.js        - Satirical name generator
└── components/
    ├── PyramidView.jsx      - SVG pyramid visualization
    ├── PyramidNode.jsx      - Individual node with indicators
    ├── ActionModal.jsx      - Buy-out/invest modal
    └── InvestorListModal.jsx - Shows investors
```

---

## The Reality Check

The game reminds players that in real life:
- Each pyramid level needs exponentially more people
- After ~13 levels at 5 recruits each, you exceed world population
- 99% of MLM participants lose money

---

## License

MIT
