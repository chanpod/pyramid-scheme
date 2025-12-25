// Pyramid data structure and game logic

// ============================================
// GAME BALANCE CONFIGURATION
// Adjust these values to tune the game economy
// ============================================
export const CONFIG = {
  // PYRAMID STRUCTURE
  pyramidLevels: 5,              // Total levels (1+2+4+8+16 = 31 nodes)
  playerStartLevelMin: 3,        // Player starts at this level or below (0 = top)

  // INCOME & ECONOMY
  recruitsPerClickBase: 1,       // Base recruits per click
  moneyPerRecruit: 10,           // $ earned per recruit
  downlineIncomePercent: 0.15,   // % of each downline member's income you get
  uplineSkimPercent: 0.10,       // % of your income your upline takes

  // COUP MECHANICS
  coupBaseCostMultiplier: 0.5,   // Coup cost = defender power * this
  coupPowerReduction: 0.1,       // Your power reduces coup cost by this %
  coupMinCost: 50,               // Minimum coup cost
  coupSuccessBase: 50,           // Base success chance (%)
  coupPowerScaleFactor: 50,      // How much power difference affects success
  coupMinChance: 10,             // Minimum success chance (%)
  coupMaxChance: 95,             // Maximum success chance (%)
  coupCooldownMs: 10000,         // Cooldown after failed coup (ms)

  // INVESTMENTS
  investmentROI: 1.5,            // Payout multiplier on successful coup (1.5 = 50% ROI)
  investmentsLostOnFail: true,   // Do investors lose money if coup fails?
  investorIncomeShare: 0.50,     // Investors collectively get up to 50% of investee's income
  // Each investor's share is proportional to their investment amount

  // BOT AI
  botCoupChancePerTick: 0.10,    // Chance bot attempts coup each second
  botMinCoupOdds: 30,            // Bot won't coup unless odds are at least this %
  botCoupMoneyBuffer: 1.5,       // Bot needs cost * this much money to coup
  botCoupExtraInvestPercent: 0.2,// Bot invests this % of money in coup attempt
  botInvestChancePerTick: 0.05,  // Chance bot invests in a sibling each second
  botInvestPercent: 0.1,         // Bot invests this % of money
  botMinInvestAmount: 10,        // Minimum investment amount

  // INITIAL BOT STATS (per level, level 0 = top)
  botBaseMoney: 50,              // Base starting money
  botMoneyPerLevel: 100,         // Additional money per level from top
  botBaseIncome: 0,              // Base income/sec
  botIncomePerLevel: 0.5,        // Additional income/sec per level from top
}

let nodeIdCounter = 0

function generateId() {
  return `node_${++nodeIdCounter}`
}

// Create a single node
export function createNode(name, isPlayer = false) {
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
  }
}

// Calculate a node's power
export function calculatePower(node) {
  return node.money + (node.incomePerSec * 100) + node.investmentsReceived
}

// Calculate coup success chance (10% - 95%)
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
      const node = createNode(name, false)

      // Higher level = more power (they got there first)
      node.money += CONFIG.botBaseMoney + (levels - level) * CONFIG.botMoneyPerLevel
      node.incomePerSec += CONFIG.botBaseIncome + (levels - level) * CONFIG.botIncomePerLevel

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

// Calculate income that goes to investors (they get a share of your earnings)
// Returns an object mapping investorId -> amount they receive this tick
export function calculateInvestorPayouts(nodes, nodeId, nodeIncome) {
  const node = nodes[nodeId]
  if (!node.investors || Object.keys(node.investors).length === 0) {
    return {}
  }

  const totalInvested = node.investmentsReceived || 0
  if (totalInvested <= 0) return {}

  // Investors collectively get up to X% of this node's income
  const maxPayoutToInvestors = nodeIncome * CONFIG.investorIncomeShare

  const payouts = {}
  for (const [investorId, investmentAmount] of Object.entries(node.investors)) {
    // Each investor gets proportional share based on their investment
    const share = investmentAmount / totalInvested
    payouts[investorId] = maxPayoutToInvestors * share
  }

  return payouts
}

// Attempt a coup - returns payouts for investors if successful
export function attemptCoup(nodes, attackerId, defenderId, investmentAmount) {
  const attacker = nodes[attackerId]
  const defender = nodes[defenderId]

  // Verify attacker can target defender (must be direct upline)
  if (attacker.parentId !== defenderId) {
    return { success: false, reason: 'Can only coup your direct upline' }
  }

  // Check cooldown
  const now = Date.now()
  if (attacker.coupCooldown > now) {
    return { success: false, reason: 'Coup on cooldown' }
  }

  const cost = calculateCoupCost(attacker, defender)
  if (attacker.money < cost + investmentAmount) {
    return { success: false, reason: 'Not enough money' }
  }

  // Deduct cost
  attacker.money -= (cost + investmentAmount)

  // Calculate success
  const chance = calculateCoupChance(attacker, defender, investmentAmount)
  const roll = Math.random() * 100

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

    // Swap positions
    swapPositions(nodes, attackerId, defenderId)

    return {
      success: true,
      chance: Math.floor(chance),
      roll: Math.floor(roll),
      investorPayouts,
    }
  } else {
    // Failed - set cooldown, investments are lost
    attacker.coupCooldown = now + CONFIG.coupCooldownMs
    attacker.lastCoupAttempt = now

    // Clear failed investments (they lose their money)
    attacker.investors = {}
    attacker.investmentsReceived = 0

    return {
      success: false,
      reason: 'Coup failed',
      chance: Math.floor(chance),
      roll: Math.floor(roll),
    }
  }
}

// Swap positions in the pyramid
function swapPositions(nodes, attackerId, defenderId) {
  // Ensure we have fresh copies of all affected nodes to avoid mutation issues
  if (nodes[attackerId] === nodes[defenderId]) {
    console.error('Cannot swap node with itself')
    return
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

// Check if investment is valid (only siblings or downline can invest, not upline)
export function canInvestIn(nodes, investorId, targetId) {
  // Can't invest in yourself
  if (investorId === targetId) {
    return { allowed: false, reason: "Can't invest in yourself" }
  }

  // Upline can't invest in you - they already "own" you in the pyramid
  if (isUplineOf(nodes, investorId, targetId)) {
    return { allowed: false, reason: "Upline can't invest in you - they already benefit from your position" }
  }

  return { allowed: true }
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

// Bot AI decision making - returns earnings breakdown
export function botTick(nodes, botId) {
  const bot = nodes[botId]
  if (bot.isPlayer) return null

  // Calculate bot earnings
  const downlineIncome = calculateDownlineIncome(nodes, botId)
  const uplineSkimming = calculateUplineSkimming(nodes, botId)
  const netIncome = bot.incomePerSec + downlineIncome - uplineSkimming

  // Bots earn money passively
  bot.money += Math.max(0, netIncome)

  // Random chance to attempt coup
  if (bot.parentId && Math.random() < CONFIG.botCoupChancePerTick) {
    const parent = nodes[bot.parentId]
    const cost = calculateCoupCost(bot, parent)
    const chance = calculateCoupChance(bot, parent)

    // Bot will attempt if they have money and decent odds
    if (bot.money >= cost * CONFIG.botCoupMoneyBuffer && chance > CONFIG.botMinCoupOdds) {
      const extraInvestment = Math.floor(bot.money * CONFIG.botCoupExtraInvestPercent)
      const result = attemptCoup(nodes, botId, bot.parentId, extraInvestment)
      return { botId, action: 'coup', target: bot.parentId, result }
    }
  }

  // Small chance bots invest in others
  if (Math.random() < CONFIG.botInvestChancePerTick && bot.money > CONFIG.botMinInvestAmount * 10) {
    // Find someone who might coup soon (has decent power)
    const siblings = getSiblings(nodes, botId)
    if (siblings.length > 0) {
      const targetId = siblings[Math.floor(Math.random() * siblings.length)]
      const investAmount = Math.floor(bot.money * CONFIG.botInvestPercent)
      if (investAmount > CONFIG.botMinInvestAmount) {
        investInNode(nodes, botId, targetId, investAmount)
        return { botId, action: 'invest', target: targetId, amount: investAmount }
      }
    }
  }

  return null
}
