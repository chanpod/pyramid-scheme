// ============================================
// GAME CONFIGURATION
// All tunable game values in one place!
// ============================================

// ===================
// PYRAMID STRUCTURE
// ===================
export const PYRAMID = {
  levels: 8,                    // Total levels (1+2+4+8+16+32+64+128 = 255 nodes)
  playerStartLevelMin: 6,       // Player starts at this level or below (0 = top)
}

// ===================
// DAY CYCLE (Turn-based)
// ===================
export const DAY = {
  durationMs: 15000,            // 15 seconds per "day"
  baseIncomePerRecruit: 0.5,    // Base $ each recruit generates per day
}

// ===================
// MARKETING (Recruiting)
// ===================
export const MARKETING = {
  startingBudget: 500,          // Starting money for new players
  baseCostPerRecruit: 5,        // Base cost per recruit
  costScaling: 1.001,           // Cost multiplier per existing recruit (very slight scaling)
}

// ===================
// ECONOMY & INCOME
// ===================
export const ECONOMY = {
  moneyPerRecruit: 0,           // No instant money from clicking (recruits generate income on day tick)
  downlineIncomePercent: 0.30,  // 30% of each downline member's income - THE PYRAMID SCHEME!
  uplineSkimPercent: 0.10,      // 10% of your income goes to upline
}

// ===================
// COUP MECHANICS
// ===================
export const COUP = {
  baseCostMultiplier: 2.0,      // Coup cost = defender power × this
  powerReduction: 0.1,          // Your power reduces coup cost by this %
  minCost: 200,                 // Minimum coup cost

  successBase: 20,              // Base success chance (%)
  powerScaleFactor: 200,        // How much power difference affects success
  minChance: 5,                 // Minimum success chance (%)
  maxChance: 100,               // Maximum success chance (%) - can guarantee with enough investment

  defenderCooldownMs: 30000,    // Defender protection after failed coup (30 sec)
  attackerCooldownMs: 10000,    // Attacker cooldown after ANY attempt (10 sec)
}

// ===================
// INVESTMENTS
// ===================
export const INVESTMENT = {
  roi: 1.5,                     // Payout multiplier on coup success (1.5 = 50% ROI)
  lostOnFail: true,             // Investors lose money if coup fails
  powerMultiplier: 1.5,         // Investments count 1.5x toward power
  costMultiplier: 10,           // Ownership % = investment / (nodePower × this)
}

// ===================
// POWER CALCULATION
// ===================
export const POWER = {
  incomeMultiplier: 10,         // Income counts as X days worth toward power
  investmentMultiplier: 1.5,    // Investments received count 1.5x toward power
}

// ===================
// BOT AI
// ===================
export const BOT = {
  coupChancePerTick: 0.10,      // 10% chance bot attempts coup each second
  minCoupOdds: 30,              // Bot won't coup unless odds ≥ 30%
  coupMoneyBuffer: 1.5,         // Bot needs cost × 1.5 money to coup
  coupExtraInvestPercent: 0.2,  // Bot invests 20% of money in coup attempt

  investChancePerTick: 0.05,    // 5% chance bot invests each second
  investPercent: 0.1,           // Bot invests 10% of money
  minInvestAmount: 10,          // Minimum investment

  // Starting stats - EXPONENTIAL scaling by level (level 0 = top)
  // Higher tiers are MUCH more powerful, making them expensive to invest in
  baseMoney: 100,               // Base money for bottom level
  moneyScaleBase: 2.5,          // Money multiplier per level up (exponential)
  baseIncome: 1,                // Base income for bottom level
  incomeScaleBase: 2.0,         // Income multiplier per level up (exponential)
}

// ===================
// BOT PROFILES
// ===================
// Each profile modifies base bot behavior to create distinct personalities
export const BOT_PROFILES = {
  grinder: {
    name: 'Grinder',
    coupChanceMultiplier: 0.3,      // 30% of base coup chance
    minCoupOdds: 50,                 // Only coup at 50%+ odds
    investChanceMultiplier: 0.3,    // Rarely invests
    investPercentMultiplier: 0.5,   // Small investments when they do
    savingsMultiplier: 3.0,         // Wants 3x the money before acting
    targetPreference: 'none',       // Doesn't have specific targets
  },
  shark: {
    name: 'Shark',
    coupChanceMultiplier: 2.5,      // Very aggressive
    minCoupOdds: 20,                 // Takes big risks
    investChanceMultiplier: 0.5,    // Prefers direct action
    investPercentMultiplier: 1.0,   // Normal investment size
    savingsMultiplier: 1.0,         // Acts as soon as possible
    targetPreference: 'none',
  },
  vc: {
    name: 'Venture Capitalist',
    coupChanceMultiplier: 0.2,      // Rarely coups
    minCoupOdds: 60,                 // Very high threshold
    investChanceMultiplier: 3.0,    // Invests constantly
    investPercentMultiplier: 1.5,   // Large investments
    savingsMultiplier: 1.5,
    targetPreference: 'highPower',  // Backs winners
  },
  schemer: {
    name: 'Schemer',
    coupChanceMultiplier: 1.2,
    minCoupOdds: 35,
    investChanceMultiplier: 2.0,    // Invests often
    investPercentMultiplier: 1.2,
    savingsMultiplier: 1.2,
    targetPreference: 'siblings',   // Invests in siblings specifically
  },
  opportunist: {
    name: 'Opportunist',
    coupChanceMultiplier: 1.0,      // Baseline behavior
    minCoupOdds: 30,
    investChanceMultiplier: 1.0,
    investPercentMultiplier: 1.0,
    savingsMultiplier: 1.5,
    targetPreference: 'threatened', // Invests in nodes about to coup
  },
  sleeper: {
    name: 'Sleeper',
    coupChanceMultiplier: 0.1,      // Almost never acts
    minCoupOdds: 70,
    investChanceMultiplier: 0.1,
    investPercentMultiplier: 0.3,
    savingsMultiplier: 5.0,         // Needs huge buffer
    targetPreference: 'none',
  },
  kingmaker: {
    name: 'Kingmaker',
    coupChanceMultiplier: 0.1,
    minCoupOdds: 65,
    investChanceMultiplier: 4.0,    // Maximum investment focus
    investPercentMultiplier: 2.0,   // Big investments
    savingsMultiplier: 1.0,
    targetPreference: 'highIncome', // Targets nodes with high $/sec
  },
}

// Level-based profile weight distribution
// Creates realistic dynamics: top = defensive, bottom = aggressive
export const LEVEL_PROFILE_WEIGHTS = {
  // Top levels (0-2): Established, defensive old guard
  top: {
    grinder: 25,     // Conservative, protecting position
    shark: 5,        // Few aggressive ones at top
    vc: 20,          // Investing in others to maintain power
    schemer: 15,
    opportunist: 15,
    sleeper: 15,     // Coasting on success
    kingmaker: 5,
  },
  // Middle levels (3-5): Political players, strategic
  middle: {
    grinder: 15,
    shark: 15,
    vc: 15,
    schemer: 25,     // Peak scheming territory
    opportunist: 20,
    sleeper: 5,
    kingmaker: 5,
  },
  // Bottom levels (6-7): Hungry newcomers, aggressive
  bottom: {
    grinder: 10,
    shark: 30,       // Very aggressive at bottom
    vc: 5,
    schemer: 10,
    opportunist: 30, // Hungry for opportunity
    sleeper: 10,
    kingmaker: 5,
  },
}

// ===================
// UPGRADES
// ===================
// 10 distinct upgrades, each purchasable once
// Progressively more expensive but significantly more impactful

export const UPGRADES = [
  // === MARKETING & RECRUITING ===
  {
    id: 'bulk_ads',
    name: 'Bulk Advertising',
    icon: '📣',
    category: 'marketing',
    cost: 200,
    subtitle: 'Buy ad space in bulk',
    desc: '+2 recruits per ad click',
    effect: { recruitsPerClick: 2 },
  },
  {
    id: 'marketing_discount',
    name: 'Marketing Discount',
    icon: '💰',
    category: 'marketing',
    cost: 500,
    subtitle: 'Negotiate better ad rates',
    desc: '-20% ad cost per recruit',
    effect: { adCostMultiplier: 0.8 },
  },
  {
    id: 'recruit_training',
    name: 'Recruit Training',
    icon: '📚',
    category: 'marketing',
    cost: 1500,
    subtitle: 'Train recruits to sell better',
    desc: '+$0.50 income per recruit/day',
    effect: { incomePerRecruit: 0.5 },
  },

  // === NETWORK POWER ===
  {
    id: 'network_expansion',
    name: 'Network Expansion',
    icon: '🌐',
    category: 'network',
    cost: 3000,
    subtitle: 'Deeper downline integration',
    desc: '+10% downline income (30%→40%)',
    effect: { downlineIncomeBonus: 0.10 },
  },
  {
    id: 'tax_shelter',
    name: 'Tax Shelter',
    icon: '🏦',
    category: 'network',
    cost: 5000,
    subtitle: 'Creative accounting strategies',
    desc: '-5% upline skimming (10%→5%)',
    effect: { uplineSkimReduction: 0.05 },
  },
  {
    id: 'investor_magnetism',
    name: 'Investor Magnetism',
    icon: '🧲',
    category: 'network',
    cost: 8000,
    subtitle: 'Attract bigger investors',
    desc: 'Investments give 2x power boost',
    effect: { investmentPowerMultiplier: 2.0 },
  },

  // === BUY-OUT & COMPETITION ===
  {
    id: 'hostile_takeover',
    name: 'Hostile Takeover Training',
    icon: '⚔️',
    category: 'buyout',
    cost: 15000,
    subtitle: 'Learn aggressive tactics',
    desc: '-25% buy-out base cost',
    effect: { buyoutCostMultiplier: 0.75 },
  },
  {
    id: 'power_move',
    name: 'Power Move',
    icon: '👊',
    category: 'buyout',
    cost: 30000,
    subtitle: 'Dominate negotiations',
    desc: '+15% base success chance',
    effect: { baseSuccessChanceBonus: 15 },
  },

  // === INVESTMENT RETURNS ===
  {
    id: 'dividend_master',
    name: 'Dividend Master',
    icon: '💎',
    category: 'investment',
    cost: 50000,
    subtitle: 'Extract maximum value',
    desc: '+50% dividend income from investments',
    effect: { dividendMultiplier: 1.5 },
  },
  {
    id: 'exit_strategy',
    name: 'Exit Strategy',
    icon: '🚀',
    category: 'investment',
    cost: 100000,
    subtitle: 'Perfect timing on payouts',
    desc: '+25% ROI from buy-out payouts (50%→75%)',
    effect: { roiBonus: 0.25 },
  },
]

// Helper to get upgrade by ID
export function getUpgrade(id) {
  return UPGRADES.find(u => u.id === id)
}

// Helper to get all upgrades in a category
export function getUpgradesByCategory(category) {
  return UPGRADES.filter(u => u.category === category)
}

// Legacy exports for backwards compatibility (removed - using new system)
export const CLICK_UPGRADE = { name: 'Legacy', icon: '💳', levels: [] }
export const EFFICIENCY_UPGRADE = { name: 'Legacy', icon: '📈', baseCost: 50, costMultiplier: 1.4, baseBonus: 0.1, bonusPerLevel: 0.1, subtitles: [] }
export function getClickUpgrade() { return null }
export function getEfficiencyUpgrade() { return { cost: 0, bonus: 0, subtitle: '', desc: '' } }

// ===================
// TIERS (Ranks)
// ===================
export const TIERS = [
  { name: 'Hopeful Newcomer', subtitle: '"Everyone starts somewhere!"', badge: 'bronze' },
  { name: 'Bronze Associate', subtitle: '"You\'re on your way!"', badge: 'bronze' },
  { name: 'Silver Partner', subtitle: '"The grind is real!"', badge: 'silver' },
  { name: 'Gold Executive', subtitle: '"Leadership material!"', badge: 'gold' },
  { name: 'Platinum Director', subtitle: '"Inspiring others daily!"', badge: 'platinum' },
  { name: 'Diamond Elite', subtitle: '"Top 1% mindset!"', badge: 'diamond' },
  { name: 'Double Diamond Supreme', subtitle: '"Blessed and highly favored!"', badge: 'diamond' },
  { name: 'Triple Platinum Sapphire Overlord', subtitle: '"Beyond human limits!"', badge: 'platinum' },
  { name: 'Galactic Ruby Omega Champion', subtitle: '"Basically a deity!"', badge: 'diamond' },
  { name: 'Transcendent Uranium Phoenix Master', subtitle: '"This isn\'t even possible!"', badge: 'diamond' },
]

// ===================
// INVESTMENT TIER GATES
// ===================
// Maps pyramid level to minimum tier required to invest
// "You must be THIS exclusive to invest in our top performers!"
export const INVESTMENT_TIER_REQUIREMENTS = {
  7: 0,  // Bottom level: Hopeful Newcomer (anyone)
  6: 1,  // Bronze Associate required
  5: 2,  // Silver Partner required
  4: 3,  // Gold Executive required
  3: 4,  // Platinum Director required
  2: 5,  // Diamond Elite required
  1: 6,  // Double Diamond Supreme required
  0: 7,  // CEO level: Triple Platinum Sapphire Overlord required
}

// Helper to check if a tier can invest in a pyramid level
export function canTierInvestInLevel(playerTierIndex, targetPyramidLevel) {
  const requiredTier = INVESTMENT_TIER_REQUIREMENTS[targetPyramidLevel] ?? 0
  return playerTierIndex >= requiredTier
}

// Helper to get the required tier name for a pyramid level
export function getRequiredTierName(pyramidLevel) {
  const requiredTierIndex = INVESTMENT_TIER_REQUIREMENTS[pyramidLevel] ?? 0
  return TIERS[requiredTierIndex]?.name ?? 'Unknown'
}

// ===================
// MOTIVATIONAL QUOTES
// ===================
export const QUOTES = [
  { text: "You're not buying products, you're investing in YOUR future!", author: "- Your Upline" },
  { text: "If you're not recruiting in your sleep, you're sleeping on success!", author: "- Diamond Elite Conference 2023" },
  { text: "The pyramid is just a triangle of OPPORTUNITY!", author: "- Definitely Not A Scam Inc." },
  { text: "Your friends and family aren't 'victims', they're 'pre-partners'!", author: "- Corporate Training Manual" },
  { text: "Financial freedom is just 47 levels away!", author: "- CEO's Yacht" },
  { text: "Winners never quit, and quitters never reach Platinum!", author: "- Motivational Poster" },
  { text: "Coups are just 'aggressive networking'!", author: "- Your Sibling in the Pyramid" },
  { text: "Invest in others so they can invest in you... wait, that's a pyramid scheme.", author: "- Self-Aware Bot" },
]
