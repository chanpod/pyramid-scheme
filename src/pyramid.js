// Pyramid data structure and game logic
import { PYRAMID, ECONOMY, COUP, INVESTMENT, BOT, BOT_PROFILES, LEVEL_PROFILE_WEIGHTS, POWER, canTierInvestInLevel, getRequiredTierName } from './config'

// Legacy CONFIG export for backwards compatibility
// All values now come from src/config.js - edit there!
export const CONFIG = {
  pyramidLevels: PYRAMID.levels,
  playerStartLevelMin: PYRAMID.playerStartLevelMin,
  moneyPerRecruit: ECONOMY.moneyPerRecruit,
  downlineIncomePercent: ECONOMY.downlineIncomePercent,
  uplineSkimPercent: ECONOMY.uplineSkimPercent,
  coupBaseCostMultiplier: COUP.baseCostMultiplier,
  coupPowerReduction: COUP.powerReduction,
  coupMinCost: COUP.minCost,
  coupSuccessBase: COUP.successBase,
  coupPowerScaleFactor: COUP.powerScaleFactor,
  coupMinChance: COUP.minChance,
  coupMaxChance: COUP.maxChance,
  coupCooldownMs: COUP.defenderCooldownMs,
  attackerCooldownMs: COUP.attackerCooldownMs,
  investmentROI: INVESTMENT.roi,
  investmentsLostOnFail: INVESTMENT.lostOnFail,
  investmentPowerMultiplier: INVESTMENT.powerMultiplier,
  investmentCostMultiplier: INVESTMENT.costMultiplier,
  botCoupChancePerTick: BOT.coupChancePerTick,
  botMinCoupOdds: BOT.minCoupOdds,
  botCoupMoneyBuffer: BOT.coupMoneyBuffer,
  botCoupExtraInvestPercent: BOT.coupExtraInvestPercent,
  botInvestChancePerTick: BOT.investChancePerTick,
  botInvestPercent: BOT.investPercent,
  botMinInvestAmount: BOT.minInvestAmount,
  // Exponential scaling for bot starting stats
  botBaseMoney: BOT.baseMoney,
  botMoneyScaleBase: BOT.moneyScaleBase,
  botBaseIncome: BOT.baseIncome,
  botIncomeScaleBase: BOT.incomeScaleBase,
}

let nodeIdCounter = 0

function generateId() {
  return `node_${++nodeIdCounter}`
}

// Get level tier for profile weight selection
function getLevelTier(level) {
  if (level <= 2) return 'top'
  if (level <= 5) return 'middle'
  return 'bottom'
}

// Select a random profile based on level-weighted distribution
export function selectProfile(level) {
  const tier = getLevelTier(level)
  const weights = LEVEL_PROFILE_WEIGHTS[tier]

  // Calculate total weight
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)

  // Random selection
  let random = Math.random() * totalWeight
  for (const [profile, weight] of Object.entries(weights)) {
    random -= weight
    if (random <= 0) {
      return profile
    }
  }

  // Fallback to opportunist
  return 'opportunist'
}

// Create a single node
export function createNode(name, isPlayer = false, profile = null) {
  return {
    id: generateId(),
    name,
    isPlayer,
    money: isPlayer ? 0 : Math.floor(Math.random() * 100) + 50,
    incomePerSec: isPlayer ? 0 : Math.random() * 2,
    investmentsReceived: 0,
    parentId: null,
    childIds: [],
    coupCooldown: 0,
    lastCoupAttempt: 0,
    // Track investments made in this node: { investorId: amount }
    investors: {},
    // Bot AI profile (null for player)
    profile: isPlayer ? null : profile,
  }
}

// Calculate a node's power (used for buy-out costs and success chances)
// Power = money + income (as X days worth) + investments received (weighted)
export function calculatePower(node) {
  const incomePower = (node.incomePerSec || 0) * POWER.incomeMultiplier
  const investmentPower = (node.investmentsReceived || 0) * POWER.investmentMultiplier
  return node.money + incomePower + investmentPower
}

// Calculate coup success chance (5% - 90%)
// Base 30% + power differential / 100
export function calculateCoupChance(attacker, defender, investmentAmount = 0) {
  const attackerPower = calculatePower(attacker) + investmentAmount
  const defenderPower = calculatePower(defender)

  const baseChance = CONFIG.coupSuccessBase + (attackerPower - defenderPower) / CONFIG.coupPowerScaleFactor

  return Math.max(CONFIG.coupMinChance, Math.min(CONFIG.coupMaxChance, baseChance))
}

// Calculate coup cost
export function calculateCoupCost(attacker, defender) {
  const defenderPower = calculatePower(defender)
  const attackerPower = calculatePower(attacker)

  const baseCost = Math.max(CONFIG.coupMinCost, defenderPower * CONFIG.coupBaseCostMultiplier - attackerPower * CONFIG.coupPowerReduction)
  return Math.floor(baseCost)
}

// Generate initial pyramid structure
export function generatePyramid(botNames) {
  const nodes = {}
  const levels = CONFIG.pyramidLevels

  let allNodes = []

  // Create nodes level by level
  for (let level = 0; level < levels; level++) {
    const nodesInLevel = Math.pow(2, level)
    for (let i = 0; i < nodesInLevel; i++) {
      const name = botNames.shift() || `Bot ${Object.keys(nodes).length}`
      // Assign profile based on level
      const profile = selectProfile(level)
      const node = createNode(name, false, profile)

      // EXPONENTIAL scaling - higher level (closer to top) = MUCH more power
      // levelsFromBottom: 0 for bottom, 7 for top (in 8-level pyramid)
      const levelsFromBottom = levels - 1 - level
      node.money += Math.floor(CONFIG.botBaseMoney * Math.pow(CONFIG.botMoneyScaleBase, levelsFromBottom))
      node.incomePerSec += CONFIG.botBaseIncome * Math.pow(CONFIG.botIncomeScaleBase, levelsFromBottom)

      nodes[node.id] = node
      allNodes.push({ node, level })
    }
  }

  // Build parent-child relationships
  let levelStart = 0
  for (let level = 0; level < levels - 1; level++) {
    const nodesInLevel = Math.pow(2, level)
    const nextLevelStart = levelStart + nodesInLevel

    for (let i = 0; i < nodesInLevel; i++) {
      const parentNode = allNodes[levelStart + i].node
      const leftChildIdx = nextLevelStart + (i * 2)
      const rightChildIdx = nextLevelStart + (i * 2) + 1

      if (leftChildIdx < allNodes.length) {
        const leftChild = allNodes[leftChildIdx].node
        leftChild.parentId = parentNode.id
        parentNode.childIds.push(leftChild.id)
      }
      if (rightChildIdx < allNodes.length) {
        const rightChild = allNodes[rightChildIdx].node
        rightChild.parentId = parentNode.id
        parentNode.childIds.push(rightChild.id)
      }
    }

    levelStart += nodesInLevel
  }

  // Place player randomly in bottom levels
  const bottomNodes = allNodes.filter(n => n.level >= CONFIG.playerStartLevelMin)
  const playerSpot = bottomNodes[Math.floor(Math.random() * bottomNodes.length)]
  const playerNode = playerSpot.node

  // Convert to player
  playerNode.name = 'You'
  playerNode.isPlayer = true
  playerNode.money = 0
  playerNode.incomePerSec = 0

  return {
    nodes,
    rootId: allNodes[0].node.id,
    playerId: playerNode.id,
  }
}

// Get all descendants (downline) of a node
export function getDownline(nodes, nodeId) {
  const result = []
  const queue = [nodeId]
  const visited = new Set([nodeId]) // Prevent infinite loops from cycles

  while (queue.length > 0) {
    const currentId = queue.shift()
    const current = nodes[currentId]
    if (!current) continue

    for (const childId of current.childIds) {
      if (!visited.has(childId)) {
        visited.add(childId)
        result.push(childId)
        queue.push(childId)
      }
    }
  }

  return result
}

// Get siblings (same parent, excluding self)
export function getSiblings(nodes, nodeId) {
  const node = nodes[nodeId]
  if (!node.parentId) return []

  const parent = nodes[node.parentId]
  return parent.childIds.filter(id => id !== nodeId)
}

// Calculate passive income from downline (% of their earnings)
// This is what makes moving UP valuable - more downline = more income
export function calculateDownlineIncome(nodes, nodeId) {
  const downline = getDownline(nodes, nodeId)
  let totalIncome = 0

  for (const childId of downline) {
    const child = nodes[childId]
    // Take configured % of each downline member's base income
    totalIncome += child.incomePerSec * CONFIG.downlineIncomePercent
  }

  return totalIncome
}

// Calculate how much upline skims from you (the MLM reality)
export function calculateUplineSkimming(nodes, nodeId) {
  const node = nodes[nodeId]
  if (!node.parentId) return 0

  // Your upline takes configured % of your base income
  return node.incomePerSec * CONFIG.uplineSkimPercent
}

// Calculate ownership percentage for an investment amount
// Ownership = your investment / total investments in this node
export function calculateOwnershipPercent(node, investmentAmount) {
  const totalInvested = node.investmentsReceived || 0
  if (totalInvested <= 0) return 0
  return (investmentAmount / totalInvested) * 100
}

// Calculate income that goes to investors (they get a share of your earnings)
// Returns an object mapping investorId -> amount they receive this tick
// Ownership % = your investment / total investments in this node
// Payout = ownership % * nodeIncome
export function calculateInvestorPayouts(nodes, nodeId, nodeIncome) {
  const node = nodes[nodeId]
  if (!node.investors || Object.keys(node.investors).length === 0) {
    return {}
  }

  const totalInvested = node.investmentsReceived || 0
  if (totalInvested <= 0) return {}

  const payouts = {}
  for (const [investorId, investmentAmount] of Object.entries(node.investors)) {
    // Each investor's ownership % = their investment / total investments
    // Their payout = ownership % * nodeIncome
    const ownershipPercent = investmentAmount / totalInvested
    payouts[investorId] = nodeIncome * ownershipPercent
  }

  return payouts
}

// Attempt a coup - returns payouts for investors if successful
// On failure: lost money is distributed to attacker's downline (empowering them to overthrow the attacker!)
export function attemptCoup(nodes, attackerId, defenderId, investmentAmount) {
  const attacker = nodes[attackerId]
  const defender = nodes[defenderId]

  // Verify attacker can target defender (must be direct upline)
  if (attacker.parentId !== defenderId) {
    return { success: false, reason: 'Can only coup your direct upline' }
  }

  // Check attacker cooldown (can't spam coups)
  const now = Date.now()
  if (attacker.coupCooldown > now) {
    return { success: false, reason: 'Coup on cooldown' }
  }

  // Check if defender is protected (recently failed coup against them)
  if (defender.coupCooldown > now) {
    return { success: false, reason: 'Target is protected' }
  }

  const cost = calculateCoupCost(attacker, defender)
  const totalCost = cost + investmentAmount
  if (attacker.money < totalCost) {
    return { success: false, reason: 'Not enough money' }
  }

  // Calculate success BEFORE deducting money (so chance matches what UI showed)
  const chance = calculateCoupChance(attacker, defender, investmentAmount)
  const roll = Math.random() * 100

  // Deduct cost after calculating chance
  attacker.money -= totalCost

  // Attacker always gets a cooldown after attempting (prevents spam)
  attacker.coupCooldown = now + CONFIG.attackerCooldownMs
  attacker.lastCoupAttempt = now

  if (roll < chance) {
    // Success! Pay out investors with configured ROI
    const investorPayouts = {}
    for (const [investorId, amount] of Object.entries(attacker.investors)) {
      const payout = Math.floor(amount * CONFIG.investmentROI)
      investorPayouts[investorId] = payout
      // Pay the investor
      if (nodes[investorId]) {
        nodes[investorId].money += payout
      }
    }
    // Clear investments after payout
    attacker.investors = {}
    attacker.investmentsReceived = 0

    // Swap positions - returns new rootId if root was replaced
    const newRootId = swapPositions(nodes, attackerId, defenderId)

    return {
      success: true,
      chance: Math.floor(chance),
      roll: Math.floor(roll),
      investorPayouts,
      newRootId,
    }
  } else {
    // Failed - defender gets protection, attacker's money goes to their downline!
    defender.coupCooldown = now + CONFIG.coupCooldownMs

    // Distribute lost money to attacker's downline (this empowers them to overthrow the attacker!)
    const downline = getDownline(nodes, attackerId)
    const downlinePayouts = {}

    if (downline.length > 0) {
      const payoutPerNode = Math.floor(totalCost / downline.length)
      if (payoutPerNode > 0) {
        for (const nodeId of downline) {
          if (nodes[nodeId]) {
            nodes[nodeId].money += payoutPerNode
            downlinePayouts[nodeId] = payoutPerNode
          }
        }
      }
    }

    // Investments stay intact - investors don't lose money just because you failed
    // (They only get paid out on success, so their investment remains at risk)

    return {
      success: false,
      reason: 'Coup failed',
      chance: Math.floor(chance),
      roll: Math.floor(roll),
      downlinePayouts,
      moneyLost: totalCost,
    }
  }
}

// Swap positions in the pyramid
// Returns the new rootId if the root was replaced, otherwise null
function swapPositions(nodes, attackerId, defenderId) {
  // Ensure we have fresh copies of all affected nodes to avoid mutation issues
  if (nodes[attackerId] === nodes[defenderId]) {
    console.error('Cannot swap node with itself')
    return null
  }

  // Create fresh copies of the main nodes involved
  nodes[attackerId] = { ...nodes[attackerId] }
  nodes[defenderId] = { ...nodes[defenderId] }

  const attacker = nodes[attackerId]
  const defender = nodes[defenderId]

  // Store original values BEFORE any modifications
  const originalDefenderParentId = defender.parentId
  const originalDefenderChildIds = [...defender.childIds]
  const originalAttackerChildIds = [...attacker.childIds]

  // Check if defender was the root (will need to update rootId)
  const defenderWasRoot = originalDefenderParentId === null

  // Filter out attacker from defender's children (attacker was defender's child)
  const defenderOtherChildren = originalDefenderChildIds.filter(id => id !== attackerId)

  // === PHASE 1: Update the main swap ===
  // Attacker takes defender's place (moves up)
  attacker.parentId = originalDefenderParentId
  attacker.childIds = [defenderId, ...defenderOtherChildren]

  // Defender takes attacker's old place (moves down, becomes attacker's child)
  defender.parentId = attackerId
  defender.childIds = [...originalAttackerChildIds]

  // === PHASE 2: Update references from other nodes ===

  // Defender's other children now point to attacker as parent
  for (const childId of defenderOtherChildren) {
    if (childId !== attackerId && childId !== defenderId) {
      nodes[childId] = { ...nodes[childId] }
      nodes[childId].parentId = attackerId
    }
  }

  // Attacker's old children now point to defender as parent
  for (const childId of originalAttackerChildIds) {
    if (childId !== attackerId && childId !== defenderId) {
      nodes[childId] = { ...nodes[childId] }
      nodes[childId].parentId = defenderId
    }
  }

  // Defender's old parent now points to attacker as child
  if (originalDefenderParentId && nodes[originalDefenderParentId]) {
    nodes[originalDefenderParentId] = { ...nodes[originalDefenderParentId] }
    const defenderParent = nodes[originalDefenderParentId]
    defenderParent.childIds = defenderParent.childIds.map(id =>
      id === defenderId ? attackerId : id
    )
  }

  // Return new rootId if the root was replaced
  return defenderWasRoot ? attackerId : null
}

// Check if investor is in target's upline (not allowed to invest)
export function isUplineOf(nodes, potentialUplineId, nodeId) {
  let current = nodes[nodeId]
  const visited = new Set([nodeId]) // Prevent infinite loops from cycles

  while (current && current.parentId) {
    if (visited.has(current.parentId)) {
      console.warn('Cycle detected in pyramid structure!')
      return false
    }
    visited.add(current.parentId)

    if (current.parentId === potentialUplineId) {
      return true
    }
    current = nodes[current.parentId]
  }
  return false
}

// Check if investment is valid
// Rules: Can't invest in yourself, your direct parent, or your direct children
// playerTierIndex: optional tier index for tier-gated investments (only for player)
export function canInvestIn(nodes, investorId, targetId, playerTierIndex = null) {
  const investor = nodes[investorId]
  const target = nodes[targetId]

  if (!investor || !target) {
    return { allowed: false, reason: "Invalid nodes" }
  }

  // Can't invest in yourself
  if (investorId === targetId) {
    return { allowed: false, reason: "Can't invest in yourself" }
  }

  // Can't invest in your direct parent (immediate upline)
  if (investor.parentId === targetId) {
    return { allowed: false, reason: "Can't invest in your direct upline - they already benefit from you" }
  }

  // Can't invest in your direct children (immediate downline)
  if (investor.childIds && investor.childIds.includes(targetId)) {
    return { allowed: false, reason: "Can't invest in your direct downline - you already benefit from them" }
  }

  // Your upline can't invest in you (they already benefit from your position)
  if (isUplineOf(nodes, investorId, targetId)) {
    return { allowed: false, reason: "Your upline can't invest in you - they already benefit from your position" }
  }

  // Tier-gated investment check (only for player investments)
  if (playerTierIndex !== null) {
    const targetLevel = getNodeLevel(nodes, targetId)
    if (!canTierInvestInLevel(playerTierIndex, targetLevel)) {
      const requiredTier = getRequiredTierName(targetLevel)
      return {
        allowed: false,
        reason: `Requires ${requiredTier} rank to invest in Level ${targetLevel} nodes`,
        requiredTier,
        targetLevel,
      }
    }
  }

  return { allowed: true }
}

// Calculate maximum investment allowed in a node (50% of their power)
export function getMaxInvestment(nodes, investorId, targetId) {
  const target = nodes[targetId]
  if (!target) return 0

  const targetPower = calculatePower(target)
  const maxTotal = Math.floor(targetPower * 0.5) // 50% of power
  const existingInvestment = target.investors?.[investorId] || 0

  return Math.max(0, maxTotal - existingInvestment)
}

// Invest in a node - tracked for ROI payout
export function investInNode(nodes, investorId, targetId, amount) {
  const investor = nodes[investorId]
  const target = nodes[targetId]

  // Check if investment is allowed
  const canInvest = canInvestIn(nodes, investorId, targetId)
  if (!canInvest.allowed) {
    return { success: false, reason: canInvest.reason }
  }

  if (investor.money < amount) {
    return { success: false, reason: 'Not enough money' }
  }

  // Check 50% cap
  const maxAllowed = getMaxInvestment(nodes, investorId, targetId)
  if (amount > maxAllowed) {
    return { success: false, reason: `Max investment is $${Math.floor(maxAllowed)} (50% of their power)` }
  }

  investor.money -= amount
  target.investmentsReceived += amount

  // Track the investment for ROI
  if (!target.investors) target.investors = {}
  target.investors[investorId] = (target.investors[investorId] || 0) + amount

  return { success: true }
}

// Get node's level in the pyramid (0 = top)
export function getNodeLevel(nodes, nodeId) {
  let level = 0
  let current = nodes[nodeId]
  const visited = new Set([nodeId]) // Prevent infinite loops

  while (current && current.parentId) {
    if (visited.has(current.parentId)) {
      console.warn('Cycle detected in getNodeLevel!')
      return level
    }
    visited.add(current.parentId)
    level++
    current = nodes[current.parentId]
  }

  return level
}

// Select investment target based on profile preference
function selectInvestmentTarget(nodes, botId, preference) {
  const bot = nodes[botId]

  switch (preference) {
    case 'siblings':
      // Schemer: Focus on siblings who might coup shared upline
      return selectFromSiblings(nodes, botId)

    case 'highPower':
      // VC: Back the strongest potential winners
      return selectHighPowerNode(nodes, botId)

    case 'highIncome':
      // Kingmaker: Target nodes with best $/sec for dividends
      return selectHighIncomeNode(nodes, botId)

    case 'threatened':
      // Opportunist: Find nodes that are about to coup (high power vs parent)
      return selectThreatenedNode(nodes, botId)

    default:
      // Random sibling (fallback behavior)
      return selectFromSiblings(nodes, botId)
  }
}

// Helper: Select random sibling
function selectFromSiblings(nodes, botId) {
  const siblings = getSiblings(nodes, botId)
  if (siblings.length === 0) return null
  return siblings[Math.floor(Math.random() * siblings.length)]
}

// Helper: Select highest power node we can invest in
function selectHighPowerNode(nodes, botId) {
  const candidates = getInvestmentCandidates(nodes, botId)
  if (candidates.length === 0) return null

  // Sort by power descending and pick from top candidates
  candidates.sort((a, b) => calculatePower(nodes[b]) - calculatePower(nodes[a]))
  // Pick from top 3 with some randomness
  const topCount = Math.min(3, candidates.length)
  return candidates[Math.floor(Math.random() * topCount)]
}

// Helper: Select highest income node for dividend farming
function selectHighIncomeNode(nodes, botId) {
  const candidates = getInvestmentCandidates(nodes, botId)
  if (candidates.length === 0) return null

  // Sort by income descending
  candidates.sort((a, b) => nodes[b].incomePerSec - nodes[a].incomePerSec)
  // Pick from top 3 with some randomness
  const topCount = Math.min(3, candidates.length)
  return candidates[Math.floor(Math.random() * topCount)]
}

// Helper: Select a node that looks ready to coup (high power relative to parent)
function selectThreatenedNode(nodes, botId) {
  const candidates = getInvestmentCandidates(nodes, botId)
  if (candidates.length === 0) return null

  // Find nodes with good coup odds against their parent
  const threateningNodes = candidates.filter(id => {
    const node = nodes[id]
    if (!node.parentId) return false
    const parent = nodes[node.parentId]
    if (!parent) return false
    const coupChance = calculateCoupChance(node, parent)
    return coupChance >= 25 // At least 25% chance
  })

  if (threateningNodes.length > 0) {
    return threateningNodes[Math.floor(Math.random() * threateningNodes.length)]
  }

  // Fallback to random sibling
  return selectFromSiblings(nodes, botId)
}

// Helper: Get all valid investment candidates for a bot
function getInvestmentCandidates(nodes, botId) {
  const candidates = []
  for (const nodeId of Object.keys(nodes)) {
    if (nodeId === botId) continue
    const result = canInvestIn(nodes, botId, nodeId)
    if (result.allowed) {
      candidates.push(nodeId)
    }
  }
  return candidates
}

// Bot AI decision making - returns earnings breakdown
export function botTick(nodes, botId) {
  const bot = nodes[botId]
  if (bot.isPlayer) return null

  // Get bot's profile (fallback to opportunist for backwards compatibility)
  const profile = BOT_PROFILES[bot.profile] || BOT_PROFILES.opportunist

  // Calculate bot earnings
  const downlineIncome = calculateDownlineIncome(nodes, botId)
  const uplineSkimming = calculateUplineSkimming(nodes, botId)
  const netIncome = bot.incomePerSec + downlineIncome - uplineSkimming

  // Bots earn money passively
  bot.money += Math.max(0, netIncome)

  // COUP DECISION (profile-modified)
  const coupChance = CONFIG.botCoupChancePerTick * profile.coupChanceMultiplier

  if (bot.parentId && Math.random() < coupChance) {
    const parent = nodes[bot.parentId]
    const cost = calculateCoupCost(bot, parent)
    const chance = calculateCoupChance(bot, parent)

    // Profile affects money threshold and minimum odds
    const moneyThreshold = cost * CONFIG.botCoupMoneyBuffer * profile.savingsMultiplier

    if (bot.money >= moneyThreshold && chance >= profile.minCoupOdds) {
      const extraInvestment = Math.floor(bot.money * CONFIG.botCoupExtraInvestPercent)
      const result = attemptCoup(nodes, botId, bot.parentId, extraInvestment)
      return { botId, action: 'coup', target: bot.parentId, result }
    }
  }

  // INVEST DECISION (profile-modified)
  const investChance = CONFIG.botInvestChancePerTick * profile.investChanceMultiplier
  const minInvestMoney = CONFIG.botMinInvestAmount * 10 * profile.savingsMultiplier

  if (Math.random() < investChance && bot.money > minInvestMoney) {
    // Use profile's target preference
    const targetId = selectInvestmentTarget(nodes, botId, profile.targetPreference)

    if (targetId) {
      const investAmount = Math.floor(
        bot.money * CONFIG.botInvestPercent * profile.investPercentMultiplier
      )
      if (investAmount > CONFIG.botMinInvestAmount) {
        const result = investInNode(nodes, botId, targetId, investAmount)
        if (result.success) {
          return { botId, action: 'invest', target: targetId, amount: investAmount }
        }
      }
    }
  }

  return null
}
