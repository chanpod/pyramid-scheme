import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import PyramidView from './components/PyramidView'
import ActionModal from './components/ActionModal'
import InvestorListModal from './components/InvestorListModal'
import { generateBotNames } from './botNames'
import {
  generatePyramid,
  calculateDownlineIncome,
  calculateInvestorPayouts,
  calculatePower,
  attemptCoup,
  investInNode,
  botTick,
  getNodeLevel,
  getDownline,
  canInvestIn,
} from './pyramid'
import {
  DAY,
  MARKETING,
  TIERS,
  QUOTES,
  UPGRADES,
  getUpgrade,
  getUpgradesByCategory,
  INVESTMENT_TIER_REQUIREMENTS,
} from './config'

const SAVE_KEY = 'pyramid-game-save'

function formatNumber(num) {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return Math.floor(num).toString()
}

// Load game state from localStorage
function loadGameState() {
  try {
    const saved = localStorage.getItem(SAVE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load save:', e)
  }
  return null
}

// Save game state to localStorage
function saveGameState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save:', e)
  }
}

function App() {
  const [totalRecruits, setTotalRecruits] = useState(0)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [purchasedUpgrades, setPurchasedUpgrades] = useState([]) // Array of upgrade IDs
  const [recruitMultiplier, setRecruitMultiplier] = useState(1) // 1, 10, 100, or 'max'

  // Day cycle state
  const [dayCount, setDayCount] = useState(1)
  const [dayProgress, setDayProgress] = useState(0) // 0-100% progress to next day
  const [lastDayIncome, setLastDayIncome] = useState(0) // Income earned last day tick

  // Pyramid state
  const [pyramid, setPyramid] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [investorModalNode, setInvestorModalNode] = useState(null)
  const [coupResult, setCoupResult] = useState(null)
  const [eventLog, setEventLog] = useState([])

  // Menu state
  const [showMenu, setShowMenu] = useState(false)
  const [showRanksModal, setShowRanksModal] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  // Game over state
  const [gameOver, setGameOver] = useState(false)
  const [gameOverReason, setGameOverReason] = useState(null)
  const gameOverRef = useRef(false) // Ref to prevent race conditions in interval

  // Track if game is initialized
  const isInitialized = useRef(false)

  // Start a new game function
  const startNewGame = useCallback(() => {
    const botNames = generateBotNames(300)
    const { nodes, rootId, playerId: pId } = generatePyramid(botNames)
    // Give player starting budget
    nodes[pId] = { ...nodes[pId], money: MARKETING.startingBudget }
    setPyramid({ nodes, rootId })
    setPlayerId(pId)
    setTotalRecruits(0)
    setPurchasedUpgrades([])
    setDayCount(1)
    setDayProgress(0)
    setLastDayIncome(0)
    setEventLog([])
    setQuoteIndex(0)
    setCoupResult(null)
    setSelectedNode(null)
    setLastSaved(null)
    setGameOver(false)
    setGameOverReason(null)
    gameOverRef.current = false
    localStorage.removeItem(SAVE_KEY)
  }, [])

  // Initialize or load game on mount
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    const savedState = loadGameState()

    if (savedState && savedState.pyramid && savedState.playerId) {
      // Restore from save
      console.log('Loading saved game...')
      setTotalRecruits(savedState.totalRecruits || 0)
      // Migrate old upgrade system to new purchasedUpgrades array
      if (savedState.purchasedUpgrades) {
        setPurchasedUpgrades(savedState.purchasedUpgrades)
      } else {
        // Legacy migration: convert old upgradeLevels to new system
        const legacyUpgrades = []
        const oldLevels = savedState.upgradeLevels || {}
        // If they had click upgrades, give them bulk_ads
        if (oldLevels.clickPower >= 1) legacyUpgrades.push('bulk_ads')
        // If they had efficiency upgrades, give them recruit_training
        if (oldLevels.efficiency >= 1) legacyUpgrades.push('recruit_training')
        setPurchasedUpgrades(legacyUpgrades)
      }
      setDayCount(savedState.dayCount || 1)
      setPyramid(savedState.pyramid)
      setPlayerId(savedState.playerId)
      setEventLog(savedState.eventLog || [])
      setLastSaved(new Date(savedState.savedAt))
    } else {
      // Start new game
      console.log('Starting new game...')
      const botNames = generateBotNames(300)
      const { nodes, rootId, playerId: pId } = generatePyramid(botNames)
      // Give player starting budget
      nodes[pId] = { ...nodes[pId], money: MARKETING.startingBudget }
      setPyramid({ nodes, rootId })
      setPlayerId(pId)
    }
  }, [])

  // Refs for save data to avoid re-running effect
  const saveDataRef = useRef({})
  useEffect(() => {
    saveDataRef.current = {
      totalRecruits,
      purchasedUpgrades,
      dayCount,
      pyramid,
      playerId,
      eventLog,
    }
  }, [totalRecruits, purchasedUpgrades, dayCount, pyramid, playerId, eventLog])

  // Auto-save every 30 seconds + save on page unload
  useEffect(() => {
    if (!playerId) return

    const doSave = (updateState = false) => {
      const data = saveDataRef.current
      if (!data.pyramid || !data.playerId) return

      try {
        const state = {
          ...data,
          savedAt: Date.now(),
        }
        saveGameState(state)
        // Only update lastSaved state if explicitly requested (manual save)
        // to avoid triggering re-renders during auto-save
        if (updateState) {
          setLastSaved(new Date())
        }
      } catch (e) {
        console.error('Auto-save failed:', e)
      }
    }

    const saveInterval = setInterval(() => doSave(false), 30000)

    // Save when leaving the page
    const handleBeforeUnload = () => {
      doSave(false)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(saveInterval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [playerId]) // Only depend on playerId

  // Manual save
  const handleSave = () => {
    const state = {
      totalRecruits,
      purchasedUpgrades,
      dayCount,
      pyramid,
      playerId,
      eventLog,
      savedAt: Date.now(),
    }
    saveGameState(state)
    setLastSaved(new Date())
  }

  // Restart game
  const handleRestart = () => {
    if (window.confirm('Are you sure you want to restart? All progress will be lost!')) {
      startNewGame()
      setShowMenu(false)
    }
  }

  // Get player node and calculate income
  const playerNode = pyramid?.nodes?.[playerId]

  // Calculate upgrade effects from purchased upgrades
  const upgradeEffects = (() => {
    const effects = {
      recruitsPerClick: 1,        // Base: 1 recruit per click
      adCostMultiplier: 1.0,      // Base: no discount
      incomePerRecruit: 0,        // Bonus on top of DAY.baseIncomePerRecruit
      downlineIncomeBonus: 0,     // Bonus on top of ECONOMY.downlineIncomePercent
      uplineSkimReduction: 0,     // Reduction to upline skim
      investmentPowerMultiplier: 1.0, // Multiplier for investment power boost
      buyoutCostMultiplier: 1.0,  // Multiplier for buyout cost
      maxSuccessChanceBonus: 0,   // Bonus to max success chance
      dividendMultiplier: 1.0,    // Multiplier for dividend income
      roiBonus: 0,                // Bonus ROI on buyout success
    }

    for (const upgradeId of purchasedUpgrades) {
      const upgrade = getUpgrade(upgradeId)
      if (!upgrade) continue

      if (upgrade.effect.recruitsPerClick) {
        effects.recruitsPerClick += upgrade.effect.recruitsPerClick
      }
      if (upgrade.effect.adCostMultiplier) {
        effects.adCostMultiplier *= upgrade.effect.adCostMultiplier
      }
      if (upgrade.effect.incomePerRecruit) {
        effects.incomePerRecruit += upgrade.effect.incomePerRecruit
      }
      if (upgrade.effect.downlineIncomeBonus) {
        effects.downlineIncomeBonus += upgrade.effect.downlineIncomeBonus
      }
      if (upgrade.effect.uplineSkimReduction) {
        effects.uplineSkimReduction += upgrade.effect.uplineSkimReduction
      }
      if (upgrade.effect.investmentPowerMultiplier) {
        effects.investmentPowerMultiplier *= upgrade.effect.investmentPowerMultiplier
      }
      if (upgrade.effect.buyoutCostMultiplier) {
        effects.buyoutCostMultiplier *= upgrade.effect.buyoutCostMultiplier
      }
      if (upgrade.effect.maxSuccessChanceBonus) {
        effects.maxSuccessChanceBonus += upgrade.effect.maxSuccessChanceBonus
      }
      if (upgrade.effect.dividendMultiplier) {
        effects.dividendMultiplier *= upgrade.effect.dividendMultiplier
      }
      if (upgrade.effect.roiBonus) {
        effects.roiBonus += upgrade.effect.roiBonus
      }
    }

    return effects
  })()

  const downlineIncome = playerNode ? calculateDownlineIncome(pyramid.nodes, playerId) : 0

  // Calculate investment income (from nodes the player has invested in)
  const investmentIncome = (() => {
    if (!pyramid?.nodes || !playerId) return 0
    let total = 0
    for (const nodeId of Object.keys(pyramid.nodes)) {
      const node = pyramid.nodes[nodeId]
      const nodeIncome = node.incomePerSec + calculateDownlineIncome(pyramid.nodes, nodeId)
      if (nodeIncome > 0) {
        const payouts = calculateInvestorPayouts(pyramid.nodes, nodeId, nodeIncome)
        if (payouts[playerId]) {
          total += payouts[playerId]
        }
      }
    }
    return total
  })()

  // Calculate recruit income (base + upgrade bonus per recruit)
  const incomePerRecruit = DAY.baseIncomePerRecruit + upgradeEffects.incomePerRecruit
  const recruitIncome = totalRecruits * incomePerRecruit

  // Total income per day = recruits income + downline + investments
  const totalIncomePerDay = recruitIncome + downlineIncome + investmentIncome
  const money = playerNode?.money ?? 0

  // Calculate downline size (number of people under you)
  const downlineCount = playerNode ? getDownline(pyramid.nodes, playerId).length : 0

  // Calculate player's active investments (where player has invested in others)
  const playerInvestments = (() => {
    if (!pyramid?.nodes || !playerId) return []
    const investments = []
    for (const nodeId of Object.keys(pyramid.nodes)) {
      const node = pyramid.nodes[nodeId]
      if (node.investors && node.investors[playerId]) {
        investments.push({
          nodeId,
          nodeName: node.name,
          amount: node.investors[playerId],
          totalInvested: node.investmentsReceived,
          nodePower: calculatePower(node),
        })
      }
    }
    return investments.sort((a, b) => b.amount - a.amount)
  })()

  // Calculate total invested amount
  const totalInvested = playerInvestments.reduce((sum, i) => sum + i.amount, 0)

  // Net worth = cash on hand + investments made
  const netWorth = money + totalInvested

  // Sync player's income to their pyramid node (for power calculation)
  useEffect(() => {
    if (!pyramid || !playerId) return
    const currentIncome = pyramid.nodes[playerId]?.incomePerSec ?? 0
    // Only update if income changed significantly (avoid floating point loops)
    if (Math.abs(currentIncome - totalIncomePerDay) > 0.01) {
      setPyramid(prev => {
        if (!prev || !playerId) return prev
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [playerId]: {
              ...prev.nodes[playerId],
              incomePerSec: totalIncomePerDay,
            }
          }
        }
      })
    }
  }, [totalIncomePerDay, playerId, pyramid])

  // Sync player money changes back to pyramid
  const setMoney = useCallback((updater) => {
    setPyramid(prev => {
      if (!prev || !playerId) return prev
      const newMoney = typeof updater === 'function'
        ? updater(prev.nodes[playerId].money)
        : updater
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [playerId]: {
            ...prev.nodes[playerId],
            money: newMoney,
          }
        }
      }
    })
  }, [playerId])

  // Refs for game state that changes frequently
  const totalRecruitsRef = useRef(totalRecruits)
  const upgradeEffectsRef = useRef(upgradeEffects)
  useEffect(() => {
    totalRecruitsRef.current = totalRecruits
    upgradeEffectsRef.current = upgradeEffects
  }, [totalRecruits, upgradeEffects])

  // Ref to collect events from game loop without causing re-renders
  const pendingEventsRef = useRef([])

  // Day progress timer (updates every 100ms for smooth progress bar)
  useEffect(() => {
    if (!playerId) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      if (gameOverRef.current) return
      const elapsed = (Date.now() - startTime) % DAY.durationMs
      setDayProgress((elapsed / DAY.durationMs) * 100)
    }, 100)

    return () => clearInterval(interval)
  }, [playerId, dayCount]) // Reset timer when day changes

  // Day tick - income calculation + bot AI (every 15 seconds)
  useEffect(() => {
    if (!playerId) return

    const dayInterval = setInterval(() => {
      // Check ref to prevent processing after game over
      if (gameOverRef.current) return

      let playerWasCouped = false
      let coupedByName = ''
      let dayIncome = 0

      setPyramid(prev => {
        if (!prev || gameOverRef.current) return prev

        const newNodes = { ...prev.nodes }
        let currentRootId = prev.rootId
        const currentRecruits = totalRecruitsRef.current
        const currentUpgradeEffects = upgradeEffectsRef.current

        // === PHASE 1: Calculate all incomes and investor payouts ===
        const investmentPayouts = {} // investorId -> total amount to receive

        for (const nodeId of Object.keys(newNodes)) {
          const node = newNodes[nodeId]
          const nodeIncome = node.incomePerSec + calculateDownlineIncome(newNodes, nodeId)

          if (nodeIncome > 0) {
            const payouts = calculateInvestorPayouts(newNodes, nodeId, nodeIncome)
            for (const [investorId, amount] of Object.entries(payouts)) {
              investmentPayouts[investorId] = (investmentPayouts[investorId] || 0) + amount
            }
          }
        }

        // === PHASE 2: Update player income (recruit-based) ===
        const player = newNodes[playerId]
        if (!player) return prev

        const incomePerRecruit = DAY.baseIncomePerRecruit + currentUpgradeEffects.incomePerRecruit
        const playerRecruitIncome = currentRecruits * incomePerRecruit
        const playerDownlineIncome = calculateDownlineIncome(newNodes, playerId)
        const playerInvestmentIncome = investmentPayouts[playerId] || 0
        const totalPlayerIncome = playerRecruitIncome + playerDownlineIncome + playerInvestmentIncome

        dayIncome = totalPlayerIncome

        newNodes[playerId] = {
          ...player,
          money: player.money + totalPlayerIncome,
          incomePerSec: totalPlayerIncome, // Store for display purposes
        }

        // === PHASE 3: Bot AI tick ===
        const botIds = Object.keys(newNodes).filter(id => !newNodes[id].isPlayer)
        for (const botId of botIds) {
          if (gameOverRef.current) break

          newNodes[botId] = { ...newNodes[botId] }

          // Add investment income to bot's money
          const botInvestmentIncome = investmentPayouts[botId] || 0
          if (botInvestmentIncome > 0) {
            newNodes[botId].money += botInvestmentIncome
          }

          // Check if this bot's upline is the player
          const botParentIsPlayer = newNodes[botId].parentId === playerId

          const result = botTick(newNodes, botId)

          if (result?.action === 'coup' && result.result.success) {
            if (botParentIsPlayer && result.target === playerId) {
              playerWasCouped = true
              coupedByName = newNodes[botId].name
              gameOverRef.current = true
            }

            if (result.result.newRootId) {
              currentRootId = result.result.newRootId
            }

            pendingEventsRef.current.push({
              id: Date.now() + Math.random(),
              text: `${newNodes[botId].name} bought out ${newNodes[result.target].name}!`,
              type: result.target === playerId ? 'player-couped' : 'coup'
            })
          }
        }

        return { ...prev, nodes: newNodes, rootId: currentRootId }
      })

      // Increment day counter
      setDayCount(d => d + 1)
      setLastDayIncome(dayIncome)

      // Check if player was couped - game over!
      if (playerWasCouped) {
        setGameOver(true)
        setGameOverReason(`${coupedByName} bought you out!`)
      }

      // Process pending events
      if (pendingEventsRef.current.length > 0) {
        const events = pendingEventsRef.current
        pendingEventsRef.current = []
        setEventLog(log => [...events, ...log.slice(0, 9 - events.length)])
      }
    }, DAY.durationMs)

    return () => clearInterval(dayInterval)
  }, [playerId]) // Only depend on playerId

  // Calculate current tier based on pyramid level
  const pyramidLevel = playerNode ? getNodeLevel(pyramid.nodes, playerId) : 4
  const currentTierIndex = Math.max(0, TIERS.length - 1 - pyramidLevel)
  const currentTier = TIERS[Math.min(currentTierIndex, TIERS.length - 1)]
  const nextTier = TIERS[currentTierIndex + 1]

  // Progress to next tier (based on money/power)
  const progressPercent = nextTier
    ? Math.min(100, (money / 1000) * 10)
    : 100

  // Calculate "reality check" - people needed in the world
  const calculatePeopleNeeded = () => {
    const levels = Math.floor(totalRecruits / 10) + 1
    const peopleNeeded = Math.pow(5, levels)
    return peopleNeeded
  }

  // Calculate marketing cost (slight scaling based on total recruits)
  const recruitsPerClick = upgradeEffects.recruitsPerClick
  const baseCostPerBatch = MARKETING.baseCostPerRecruit * Math.pow(MARKETING.costScaling, totalRecruits) * upgradeEffects.adCostMultiplier * recruitsPerClick

  // Calculate how many batches we can afford for MAX option
  const maxAffordableBatches = (() => {
    if (money < baseCostPerBatch) return 0
    // Simple calculation - find how many batches we can buy
    // Since cost scales slightly, we iterate to be accurate
    let batches = 0
    let totalCost = 0
    let currentRecruits = totalRecruits
    while (batches < 1000) { // Cap at 1000 to prevent infinite loop
      const batchCost = MARKETING.baseCostPerRecruit * Math.pow(MARKETING.costScaling, currentRecruits) * upgradeEffects.adCostMultiplier * recruitsPerClick
      if (totalCost + batchCost > money) break
      totalCost += batchCost
      currentRecruits += recruitsPerClick
      batches++
    }
    return batches
  })()

  // Determine effective multiplier
  const effectiveMultiplier = recruitMultiplier === 'max' ? maxAffordableBatches : Math.min(recruitMultiplier, maxAffordableBatches)

  // Calculate total cost for the effective multiplier
  const totalMarketingCost = (() => {
    let cost = 0
    let currentRecruits = totalRecruits
    for (let i = 0; i < effectiveMultiplier; i++) {
      cost += MARKETING.baseCostPerRecruit * Math.pow(MARKETING.costScaling, currentRecruits) * upgradeEffects.adCostMultiplier * recruitsPerClick
      currentRecruits += recruitsPerClick
    }
    return cost
  })()

  const totalRecruitsGained = effectiveMultiplier * recruitsPerClick
  const canAffordMarketing = effectiveMultiplier > 0

  const handleRecruit = () => {
    if (!canAffordMarketing) return

    // Deduct marketing cost
    setMoney(prev => prev - totalMarketingCost)
    setTotalRecruits(prev => prev + totalRecruitsGained)

    if (Math.random() < 0.1) {
      setQuoteIndex(Math.floor(Math.random() * QUOTES.length))
    }
  }

  const handleNodeClick = (node) => {
    if (node.id === playerId) return
    setSelectedNode(node)
    setCoupResult(null)
  }

  const handleCoup = (targetId, bonusAmount) => {
    if (!pyramid || !playerId) return

    setPyramid(prev => {
      const newNodes = { ...prev.nodes }
      // Deep copy affected nodes
      newNodes[playerId] = { ...newNodes[playerId] }
      newNodes[targetId] = { ...newNodes[targetId] }

      const result = attemptCoup(newNodes, playerId, targetId, bonusAmount)
      setCoupResult(result)

      if (result.success) {
        setEventLog(log => [
          { id: Date.now(), text: `YOU bought out ${prev.nodes[targetId].name}!`, type: 'player-coup' },
          ...log.slice(0, 9)
        ])
        setQuoteIndex(Math.floor(Math.random() * QUOTES.length))
      }

      // Update rootId if root was replaced (player couped the root!)
      const newRootId = result.newRootId || prev.rootId
      return { ...prev, nodes: newNodes, rootId: newRootId }
    })
  }

  const handleInvest = (targetId, amount) => {
    if (!pyramid || !playerId) return

    setPyramid(prev => {
      const newNodes = { ...prev.nodes }
      newNodes[playerId] = { ...newNodes[playerId] }
      newNodes[targetId] = { ...newNodes[targetId] }

      investInNode(newNodes, playerId, targetId, amount)

      setEventLog(log => [
        { id: Date.now(), text: `You invested $${formatNumber(amount)} in ${prev.nodes[targetId].name}`, type: 'invest' },
        ...log.slice(0, 9)
      ])

      return { ...prev, nodes: newNodes }
    })
  }

  const currentQuote = QUOTES[quoteIndex]
  const peopleNeeded = calculatePeopleNeeded()
  const worldPopulation = 8000000000

  // Check if player can coup selected node
  const canCoup = selectedNode && playerNode?.parentId === selectedNode.id

  return (
    <div className="game-container game-container--with-pyramid">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>THE PYRAMID</h1>
          <button className="menu-button" onClick={() => setShowMenu(true)}>Menu</button>
        </div>
        <div className="header-stats">
          <div className="header-stat header-stat--day">
            <div className="header-stat-label">Day {dayCount}</div>
            <div className="day-progress-bar">
              <div className="day-progress-fill" style={{ width: `${dayProgress}%` }} />
            </div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Balance</div>
            <div className="header-stat-value">${formatNumber(money)}</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Net Worth</div>
            <div className="header-stat-value header-stat-value--networth">${formatNumber(netWorth)}</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Per Day</div>
            <div className="header-stat-value">${formatNumber(totalIncomePerDay)}</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Recruits</div>
            <div className="header-stat-value header-stat-value--recruits">{formatNumber(totalRecruits)}</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Downline</div>
            <div className="header-stat-value header-stat-value--downline">{downlineCount}</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Invested</div>
            <div className="header-stat-value header-stat-value--investment">${formatNumber(totalInvested)}</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Inv. Income</div>
            <div className="header-stat-value header-stat-value--investment">${formatNumber(investmentIncome)}/day</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Level</div>
            <div className="header-stat-value">{pyramidLevel === 0 ? 'TOP!' : pyramidLevel}</div>
          </div>
        </div>
      </header>

      {/* Left Sidebar - Tier & Stats */}
      <aside className="sidebar-left">
        <div className="card clickable" onClick={() => setShowRanksModal(true)}>
          <div className="card-title">Your Rank <span className="card-hint">(click for details)</span></div>
          <div className="tier-display">
            <span className={`tier-badge ${currentTier.badge}`}>RANK {currentTierIndex + 1}</span>
            <div className="tier-name">{currentTier.name}</div>
            <div className="tier-subtitle">{currentTier.subtitle}</div>
            {nextTier && (
              <div className="tier-next">
                <span className="next-label">Next:</span> {nextTier.name}
                <div className="next-hint">Buy out your upline to rank up!</div>
              </div>
            )}
            {!nextTier && (
              <div className="tier-next tier-max">
                You've reached the top rank!
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Recruits</div>
          <div className="stats-list">
            <div className="stat-row">
              <span className="stat-label">Your Recruits</span>
              <span className="stat-value recruits">{formatNumber(totalRecruits)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Per Click</span>
              <span className="stat-value">{recruitsPerClick}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Efficiency</span>
              <span className="stat-value money">${incomePerRecruit.toFixed(2)}/each</span>
            </div>
            <div className="stat-row stat-row--highlight">
              <span className="stat-label">Recruit Income</span>
              <span className="stat-value money">${formatNumber(recruitIncome)}/day</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Pyramid Network</div>
          <div className="stats-list">
            <div className="stat-row">
              <span className="stat-label">Downline Size</span>
              <span className="stat-value">{downlineCount} people</span>
            </div>
            <div className="stat-row stat-row--highlight">
              <span className="stat-label">Downline Income</span>
              <span className="stat-value money">${formatNumber(downlineIncome)}/day</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Investment Summary</div>
          <div className="stats-list">
            <div className="stat-row">
              <span className="stat-label">Total Invested</span>
              <span className="stat-value">${formatNumber(totalInvested)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Active Positions</span>
              <span className="stat-value">{playerInvestments.length}</span>
            </div>
            <div className="stat-row stat-row--highlight">
              <span className="stat-label">Investment Income</span>
              <span className="stat-value money">${formatNumber(investmentIncome)}/day</span>
            </div>
            {totalInvested > 0 && investmentIncome > 0 && (
              <div className="stat-row">
                <span className="stat-label">Daily ROI</span>
                <span className="stat-value">{((investmentIncome / totalInvested) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Event Log</div>
          <div className="event-log">
            {eventLog.length === 0 ? (
              <div className="event-log__empty">No events yet...</div>
            ) : (
              eventLog.map(event => (
                <div key={event.id} className={`event-log__item event-log__item--${event.type}`}>
                  {event.text}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">My Investments</div>
          <div className="investments-list">
            {playerInvestments.length === 0 ? (
              <div className="investments-list__empty">
                No active investments. Click on pyramid nodes to invest!
              </div>
            ) : (
              playerInvestments.map(inv => (
                <div
                  key={inv.nodeId}
                  className="investment-item"
                  onClick={() => {
                    const node = pyramid?.nodes?.[inv.nodeId]
                    if (node) setSelectedNode(node)
                  }}
                >
                  <div className="investment-item__name">{inv.nodeName}</div>
                  <div className="investment-item__details">
                    <span className="investment-item__amount">${formatNumber(inv.amount)}</span>
                    <span className="investment-item__power">Power: ${formatNumber(inv.nodePower)}</span>
                  </div>
                </div>
              ))
            )}
            {playerInvestments.length > 0 && (
              <div className="investments-list__total">
                Total Invested: ${formatNumber(playerInvestments.reduce((sum, i) => sum + i.amount, 0))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Area - Pyramid View */}
      <main className="main-area main-area--pyramid">
        <div className="recruit-section recruit-section--compact">
          <div className="recruit-multiplier">
            {[1, 10, 100, 'max'].map(mult => (
              <button
                key={mult}
                className={`multiplier-btn ${recruitMultiplier === mult ? 'active' : ''}`}
                onClick={() => setRecruitMultiplier(mult)}
              >
                {mult === 'max' ? 'MAX' : `${mult}x`}
              </button>
            ))}
          </div>
          <button
            className={`recruit-button recruit-button--small ${!canAffordMarketing ? 'recruit-button--disabled' : ''}`}
            onClick={handleRecruit}
            disabled={!canAffordMarketing}
          >
            <span className="recruit-icon">📢</span>
            <span className="recruit-label">RUN ADS</span>
            <span className="recruit-value">+{formatNumber(totalRecruitsGained)} recruit{totalRecruitsGained !== 1 ? 's' : ''}</span>
            <span className="recruit-cost">${formatNumber(totalMarketingCost)}</span>
          </button>
        </div>

        <div className="pyramid-container">
          <div className="pyramid-header">
            <h2>The Pyramid</h2>
            <p>Click on your upline to buy them out, or invest in others</p>
          </div>
          {pyramid && (
            <PyramidView
              nodes={pyramid.nodes}
              rootId={pyramid.rootId}
              playerId={playerId}
              selectedNodeId={selectedNode?.id}
              onNodeClick={handleNodeClick}
              onInvestorBadgeClick={(node) => setInvestorModalNode(node)}
              onQuickInvest={handleInvest}
              playerTierIndex={currentTierIndex}
              playerMoney={money}
            />
          )}
        </div>

        <div className="quote-banner">
          <div className="quote-text">"{currentQuote.text}"</div>
          <div className="quote-author">{currentQuote.author}</div>
        </div>

        <div className="reality-check">
          <div className="reality-check-title">Reality Check</div>
          <div className="reality-check-value">
            {peopleNeeded > worldPopulation
              ? `${(peopleNeeded / worldPopulation).toFixed(1)}x Earth's Population`
              : formatNumber(peopleNeeded)
            }
          </div>
          <div className="reality-check-label">
            people needed at your level to sustain this
          </div>
        </div>
      </main>

      {/* Right Sidebar - Upgrades */}
      <aside className="sidebar-right">
        <div className="card">
          <div className="card-title">Upgrades</div>
          <div className="upgrades-list">
            {UPGRADES.map(upgrade => {
              const isPurchased = purchasedUpgrades.includes(upgrade.id)
              const canAfford = money >= upgrade.cost

              return (
                <div
                  key={upgrade.id}
                  className={`upgrade-item ${isPurchased ? 'purchased' : !canAfford ? 'locked' : ''}`}
                  onClick={() => {
                    if (!isPurchased && canAfford) {
                      setMoney(prev => prev - upgrade.cost)
                      setPurchasedUpgrades(prev => [...prev, upgrade.id])
                    }
                  }}
                >
                  <div className="upgrade-icon">{upgrade.icon}</div>
                  <div className="upgrade-info">
                    <div className="upgrade-name">
                      {upgrade.name}
                      {isPurchased && <span className="upgrade-owned">OWNED</span>}
                    </div>
                    <div className="upgrade-desc">
                      {upgrade.subtitle}
                    </div>
                    <div className="upgrade-effect">
                      {upgrade.desc}
                    </div>
                  </div>
                  <div className="upgrade-cost">
                    {isPurchased ? '✓' : `$${formatNumber(upgrade.cost)}`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Action Modal */}
      {selectedNode && playerNode && (
        <ActionModal
          targetNode={selectedNode}
          playerNode={playerNode}
          nodes={pyramid?.nodes}
          canCoup={canCoup}
          onCoup={handleCoup}
          onInvest={handleInvest}
          onClose={() => {
            setSelectedNode(null)
            setCoupResult(null)
          }}
          playerTierIndex={currentTierIndex}
        />
      )}

      {/* Investor List Modal */}
      {investorModalNode && pyramid && (
        <InvestorListModal
          node={investorModalNode}
          nodes={pyramid.nodes}
          onClose={() => setInvestorModalNode(null)}
        />
      )}

      {/* Buy Out Result Toast */}
      {coupResult && (
        <div className={`coup-toast coup-toast--${coupResult.success ? 'success' : 'fail'}`}>
          {coupResult.success ? (
            <>Buy out successful! You moved up the pyramid!</>
          ) : (
            <>Buy out failed ({coupResult.chance}% chance, rolled {coupResult.roll}). Try again soon.</>
          )}
          <button onClick={() => setCoupResult(null)}>×</button>
        </div>
      )}

      {/* Game Menu Modal */}
      {showMenu && (
        <div className="menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="menu-modal" onClick={e => e.stopPropagation()}>
            <h2>Game Menu</h2>

            <div className="menu-section">
              <h3>Save Game</h3>
              <p className="menu-info">
                {lastSaved
                  ? `Last saved: ${lastSaved.toLocaleTimeString()}`
                  : 'Not saved yet'}
              </p>
              <p className="menu-hint">Game auto-saves every 30 seconds</p>
              <button className="menu-btn menu-btn--primary" onClick={handleSave}>
                Save Now
              </button>
            </div>

            <div className="menu-section">
              <h3>New Game</h3>
              <p className="menu-warning">This will erase all your progress!</p>
              <button className="menu-btn menu-btn--danger" onClick={handleRestart}>
                Restart Game
              </button>
            </div>

            <button className="menu-btn menu-btn--close" onClick={() => setShowMenu(false)}>
              Close Menu
            </button>
          </div>
        </div>
      )}

      {/* Ranks Modal */}
      {showRanksModal && (
        <div className="menu-overlay" onClick={() => setShowRanksModal(false)}>
          <div className="menu-modal ranks-modal" onClick={e => e.stopPropagation()}>
            <h2>Rank Progression</h2>
            <p className="ranks-intro">Climb the pyramid to unlock investment access to higher tiers!</p>

            <div className="ranks-list">
              {TIERS.map((tier, index) => {
                const isCurrentTier = index === currentTierIndex
                const isUnlocked = index <= currentTierIndex
                // Find which pyramid level this tier unlocks investment for
                const unlocksLevel = Object.entries(INVESTMENT_TIER_REQUIREMENTS)
                  .find(([, reqTier]) => reqTier === index)?.[0]

                return (
                  <div
                    key={index}
                    className={`rank-item ${isCurrentTier ? 'current' : ''} ${isUnlocked ? 'unlocked' : 'locked'}`}
                  >
                    <div className="rank-number">#{index + 1}</div>
                    <div className="rank-info">
                      <div className="rank-name">
                        <span className={`tier-badge ${tier.badge}`}>{tier.name}</span>
                        {isCurrentTier && <span className="current-badge">YOU</span>}
                      </div>
                      <div className="rank-subtitle">{tier.subtitle}</div>
                      {unlocksLevel !== undefined && (
                        <div className="rank-unlock">
                          Unlocks investing in Level {unlocksLevel} nodes
                        </div>
                      )}
                    </div>
                    <div className="rank-status">
                      {isUnlocked ? '✓' : '🔒'}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="ranks-tip">
              <strong>How to rank up:</strong> Buy out your direct upline to climb the pyramid!
            </div>

            <button className="menu-btn menu-btn--close" onClick={() => setShowRanksModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>GAME OVER</h2>
            <div className="game-over-icon">💀</div>
            <p className="game-over-reason">{gameOverReason}</p>
            <p className="game-over-message">
              You've been overthrown and pushed down the pyramid.
              In the real world of MLM, this is when people realize
              they've lost everything.
            </p>
            <div className="game-over-stats">
              <div className="game-over-stat">
                <span className="label">Final Level</span>
                <span className="value">{pyramidLevel}</span>
              </div>
              <div className="game-over-stat">
                <span className="label">Total Recruits</span>
                <span className="value">{formatNumber(totalRecruits)}</span>
              </div>
              <div className="game-over-stat">
                <span className="label">Final Balance</span>
                <span className="value">${formatNumber(money)}</span>
              </div>
            </div>
            <button className="menu-btn menu-btn--primary" onClick={startNewGame}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
