import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import PyramidView from './components/PyramidView'
import ActionModal from './components/ActionModal'
import { generateBotNames } from './botNames'
import {
  generatePyramid,
  calculateDownlineIncome,
  calculateInvestorPayouts,
  attemptCoup,
  investInNode,
  botTick,
  getNodeLevel,
  canInvestIn,
} from './pyramid'

const SAVE_KEY = 'pyramid-game-save'

// Tier definitions with satirical names
const TIERS = [
  { name: 'Hopeful Newcomer', subtitle: '"Everyone starts somewhere!"', badge: 'bronze', threshold: 0 },
  { name: 'Bronze Associate', subtitle: '"You\'re on your way!"', badge: 'bronze', threshold: 10 },
  { name: 'Silver Partner', subtitle: '"The grind is real!"', badge: 'silver', threshold: 50 },
  { name: 'Gold Executive', subtitle: '"Leadership material!"', badge: 'gold', threshold: 200 },
  { name: 'Platinum Director', subtitle: '"Inspiring others daily!"', badge: 'platinum', threshold: 1000 },
  { name: 'Diamond Elite', subtitle: '"Top 1% mindset!"', badge: 'diamond', threshold: 5000 },
  { name: 'Double Diamond Supreme', subtitle: '"Blessed and highly favored!"', badge: 'diamond', threshold: 25000 },
  { name: 'Triple Platinum Sapphire Overlord', subtitle: '"Beyond human limits!"', badge: 'platinum', threshold: 100000 },
  { name: 'Galactic Ruby Omega Champion', subtitle: '"Basically a deity!"', badge: 'diamond', threshold: 1000000 },
  { name: 'Transcendent Uranium Phoenix Master', subtitle: '"This isn\'t even possible!"', badge: 'diamond', threshold: 10000000 },
]

// Motivational quotes (satirical)
const QUOTES = [
  { text: "You're not buying products, you're investing in YOUR future!", author: "- Your Upline" },
  { text: "If you're not recruiting in your sleep, you're sleeping on success!", author: "- Diamond Elite Conference 2023" },
  { text: "The pyramid is just a triangle of OPPORTUNITY!", author: "- Definitely Not A Scam Inc." },
  { text: "Your friends and family aren't 'victims', they're 'pre-partners'!", author: "- Corporate Training Manual" },
  { text: "Financial freedom is just 47 levels away!", author: "- CEO's Yacht" },
  { text: "Winners never quit, and quitters never reach Platinum!", author: "- Motivational Poster" },
  { text: "Coups are just 'aggressive networking'!", author: "- Your Sibling in the Pyramid" },
  { text: "Invest in others so they can invest in you... wait, that's a pyramid scheme.", author: "- Self-Aware Bot" },
]

// Tiered upgrade system - costs escalate to force engagement with investments/passive income
const UPGRADE_TIERS = {
  clickPower: {
    name: 'Recruitment Skills',
    icon: '💳',
    levels: [
      { cost: 1000, bonus: 1, desc: '+1 recruit/click', subtitle: 'Better Business Cards' },
      { cost: 5000, bonus: 3, desc: '+3 recruits/click', subtitle: 'Coffee Meeting Mastery' },
      { cost: 25000, bonus: 8, desc: '+8 recruits/click', subtitle: 'Networking Guru Status' },
      { cost: 100000, bonus: 20, desc: '+20 recruits/click', subtitle: 'LinkedIn Influencer' },
      { cost: 400000, bonus: 50, desc: '+50 recruits/click', subtitle: 'Pyramid Whisperer' },
    ]
  },
  passiveIncome: {
    name: 'Passive Income',
    icon: '🖼️',
    levels: [
      { cost: 2000, bonus: 2, desc: '+$2/sec', subtitle: 'Motivational Poster' },
      { cost: 8000, bonus: 5, desc: '+$5/sec', subtitle: 'Garage Full of Inventory' },
      { cost: 30000, bonus: 15, desc: '+$15/sec', subtitle: 'Luxury Car Lease' },
      { cost: 120000, bonus: 40, desc: '+$40/sec', subtitle: 'Annual Conference VIP' },
      { cost: 500000, bonus: 100, desc: '+$100/sec', subtitle: 'Private Jet Membership' },
    ]
  }
}

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
  const [recruitsPerClick, setRecruitsPerClick] = useState(1)
  const [basePassiveIncome, setBasePassiveIncome] = useState(0)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [upgradeLevels, setUpgradeLevels] = useState({ clickPower: 0, passiveIncome: 0 })

  // Pyramid state
  const [pyramid, setPyramid] = useState(null)
  const [playerId, setPlayerId] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [coupResult, setCoupResult] = useState(null)
  const [eventLog, setEventLog] = useState([])

  // Menu state
  const [showMenu, setShowMenu] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  // Game over state
  const [gameOver, setGameOver] = useState(false)
  const [gameOverReason, setGameOverReason] = useState(null)
  const gameOverRef = useRef(false) // Ref to prevent race conditions in interval

  // Track if game is initialized
  const isInitialized = useRef(false)

  // Start a new game function
  const startNewGame = useCallback(() => {
    const botNames = generateBotNames(50)
    const { nodes, rootId, playerId: pId } = generatePyramid(botNames)
    setPyramid({ nodes, rootId })
    setPlayerId(pId)
    setTotalRecruits(0)
    setRecruitsPerClick(1)
    setBasePassiveIncome(0)
    setUpgradeLevels({ clickPower: 0, passiveIncome: 0 })
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
      setRecruitsPerClick(savedState.recruitsPerClick || 1)
      setBasePassiveIncome(savedState.basePassiveIncome || 0)
      setUpgradeLevels(savedState.upgradeLevels || { clickPower: 0, passiveIncome: 0 })
      setPyramid(savedState.pyramid)
      setPlayerId(savedState.playerId)
      setEventLog(savedState.eventLog || [])
      setLastSaved(new Date(savedState.savedAt))
    } else {
      // Start new game
      console.log('Starting new game...')
      const botNames = generateBotNames(50)
      const { nodes, rootId, playerId: pId } = generatePyramid(botNames)
      setPyramid({ nodes, rootId })
      setPlayerId(pId)
    }
  }, [])

  // Refs for save data to avoid re-running effect
  const saveDataRef = useRef({})
  useEffect(() => {
    saveDataRef.current = {
      totalRecruits,
      recruitsPerClick,
      basePassiveIncome,
      upgradeLevels,
      pyramid,
      playerId,
      eventLog,
    }
  }, [totalRecruits, recruitsPerClick, basePassiveIncome, upgradeLevels, pyramid, playerId, eventLog])

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
      recruitsPerClick,
      basePassiveIncome,
      upgradeLevels,
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

  const totalPassiveIncome = basePassiveIncome + downlineIncome + investmentIncome
  const money = playerNode?.money ?? 0

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

  // Use ref for basePassiveIncome to avoid re-running effect
  const basePassiveIncomeRef = useRef(basePassiveIncome)
  useEffect(() => {
    basePassiveIncomeRef.current = basePassiveIncome
  }, [basePassiveIncome])

  // Ref to collect events from game loop without causing re-renders
  const pendingEventsRef = useRef([])

  // Game loop - passive income tick + bot AI
  useEffect(() => {
    if (!playerId) return

    const interval = setInterval(() => {
      // Check ref to prevent processing after game over
      if (gameOverRef.current) return

      let playerWasCouped = false
      let coupedByName = ''

      setPyramid(prev => {
        if (!prev || gameOverRef.current) return prev

        const newNodes = { ...prev.nodes }
        const currentBaseIncome = basePassiveIncomeRef.current

        // === PHASE 1: Calculate all incomes and investor payouts ===
        // Track investment income to pay out
        const investmentPayouts = {} // investorId -> total amount to receive

        // Process all nodes to calculate investor payouts
        for (const nodeId of Object.keys(newNodes)) {
          const node = newNodes[nodeId]
          const nodeIncome = node.incomePerSec + calculateDownlineIncome(newNodes, nodeId)

          if (nodeIncome > 0) {
            // Calculate payouts to this node's investors
            const payouts = calculateInvestorPayouts(newNodes, nodeId, nodeIncome)
            for (const [investorId, amount] of Object.entries(payouts)) {
              investmentPayouts[investorId] = (investmentPayouts[investorId] || 0) + amount
            }
          }
        }

        // === PHASE 2: Update player income ===
        const player = newNodes[playerId]
        if (!player) return prev

        const playerDownlineIncome = calculateDownlineIncome(newNodes, playerId)
        const playerInvestmentIncome = investmentPayouts[playerId] || 0
        const totalPlayerIncome = currentBaseIncome + playerDownlineIncome + playerInvestmentIncome

        newNodes[playerId] = {
          ...player,
          money: player.money + totalPlayerIncome,
          incomePerSec: totalPlayerIncome,
        }

        // === PHASE 3: Bot AI tick (includes their income + investment payouts) ===
        const botIds = Object.keys(newNodes).filter(id => !newNodes[id].isPlayer)
        for (const botId of botIds) {
          if (gameOverRef.current) break // Stop if game ended

          newNodes[botId] = { ...newNodes[botId] }

          // Add investment income to bot's money
          const botInvestmentIncome = investmentPayouts[botId] || 0
          if (botInvestmentIncome > 0) {
            newNodes[botId].money += botInvestmentIncome
          }

          // Check if this bot's upline is the player (they could coup the player!)
          const botParentIsPlayer = newNodes[botId].parentId === playerId

          const result = botTick(newNodes, botId)

          if (result?.action === 'coup' && result.result.success) {
            // Check if the player was couped
            if (botParentIsPlayer && result.target === playerId) {
              playerWasCouped = true
              coupedByName = newNodes[botId].name
              gameOverRef.current = true // Set immediately to prevent further processing
            }

            pendingEventsRef.current.push({
              id: Date.now() + Math.random(),
              text: `${newNodes[botId].name} overthrew ${newNodes[result.target].name}!`,
              type: result.target === playerId ? 'player-couped' : 'coup'
            })
          }
        }

        return { ...prev, nodes: newNodes }
      })

      // Check if player was couped - game over!
      if (playerWasCouped) {
        setGameOver(true)
        setGameOverReason(`${coupedByName} overthrew you!`)
      }

      // Process pending events after state update
      if (pendingEventsRef.current.length > 0) {
        const events = pendingEventsRef.current
        pendingEventsRef.current = []
        setEventLog(log => [...events, ...log.slice(0, 9 - events.length)])
      }
    }, 1000)

    return () => clearInterval(interval)
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

  const handleRecruit = () => {
    setTotalRecruits(prev => prev + recruitsPerClick)
    setMoney(prev => prev + recruitsPerClick * 10)

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
          { id: Date.now(), text: `YOU overthrew ${prev.nodes[targetId].name}!`, type: 'player-coup' },
          ...log.slice(0, 9)
        ])
        setQuoteIndex(Math.floor(Math.random() * QUOTES.length))
      }

      return { ...prev, nodes: newNodes }
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

    setSelectedNode(null)
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
          <div className="header-stat">
            <div className="header-stat-label">Balance</div>
            <div className="header-stat-value">${formatNumber(money)}</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Per Second</div>
            <div className="header-stat-value">${formatNumber(totalPassiveIncome)}/s</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-label">Pyramid Level</div>
            <div className="header-stat-value">{pyramidLevel === 0 ? 'TOP!' : `Level ${pyramidLevel}`}</div>
          </div>
        </div>
      </header>

      {/* Left Sidebar - Tier & Stats */}
      <aside className="sidebar-left">
        <div className="card">
          <div className="card-title">Your Rank</div>
          <div className="tier-display">
            <span className={`tier-badge ${currentTier.badge}`}>RANK {currentTierIndex + 1}</span>
            <div className="tier-name">{currentTier.name}</div>
            <div className="tier-subtitle">{currentTier.subtitle}</div>
            {nextTier && (
              <div className="tier-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                </div>
                <div className="progress-label">
                  <span>{formatNumber(totalRecruits)}</span>
                  <span>{formatNumber(nextTier.threshold)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Statistics</div>
          <div className="stats-list">
            <div className="stat-row">
              <span className="stat-label">Total Recruits</span>
              <span className="stat-value recruits">{formatNumber(totalRecruits)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Per Click</span>
              <span className="stat-value">{recruitsPerClick}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Base $/sec</span>
              <span className="stat-value money">${basePassiveIncome.toFixed(1)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Downline $/sec</span>
              <span className="stat-value money">${downlineIncome.toFixed(1)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Investment $/sec</span>
              <span className="stat-value money">${investmentIncome.toFixed(1)}</span>
            </div>
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
      </aside>

      {/* Main Area - Pyramid View */}
      <main className="main-area main-area--pyramid">
        <div className="recruit-section recruit-section--compact">
          <button className="recruit-button recruit-button--small" onClick={handleRecruit}>
            <span className="recruit-icon">👥</span>
            <span className="recruit-label">RECRUIT</span>
            <span className="recruit-value">+{recruitsPerClick}</span>
          </button>
        </div>

        <div className="pyramid-container">
          <div className="pyramid-header">
            <h2>The Pyramid</h2>
            <p>Click on your upline to attempt a coup, or invest in others</p>
          </div>
          {pyramid && (
            <PyramidView
              nodes={pyramid.nodes}
              rootId={pyramid.rootId}
              playerId={playerId}
              selectedNodeId={selectedNode?.id}
              onNodeClick={handleNodeClick}
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
            {Object.entries(UPGRADE_TIERS).map(([key, tier]) => {
              const currentLevel = upgradeLevels[key] || 0
              const nextUpgrade = tier.levels[currentLevel]
              const isMaxed = currentLevel >= tier.levels.length
              const canAfford = nextUpgrade && money >= nextUpgrade.cost

              return (
                <div
                  key={key}
                  className={`upgrade-item ${isMaxed ? 'maxed' : !canAfford ? 'locked' : ''}`}
                  onClick={() => {
                    if (canAfford && nextUpgrade) {
                      setMoney(prev => prev - nextUpgrade.cost)
                      setUpgradeLevels(prev => ({ ...prev, [key]: prev[key] + 1 }))
                      if (key === 'clickPower') {
                        setRecruitsPerClick(prev => prev + nextUpgrade.bonus)
                      } else if (key === 'passiveIncome') {
                        setBasePassiveIncome(prev => prev + nextUpgrade.bonus)
                      }
                    }
                  }}
                >
                  <div className="upgrade-icon">{tier.icon}</div>
                  <div className="upgrade-info">
                    <div className="upgrade-name">
                      {tier.name} {currentLevel > 0 && <span className="upgrade-level">Lvl {currentLevel}</span>}
                    </div>
                    <div className="upgrade-desc">
                      {isMaxed ? 'MAXED OUT!' : nextUpgrade.subtitle}
                    </div>
                    <div className="upgrade-effect">
                      {isMaxed ? 'No more upgrades available' : nextUpgrade.desc}
                    </div>
                  </div>
                  <div className="upgrade-cost">
                    {isMaxed ? '---' : `$${formatNumber(nextUpgrade.cost)}`}
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
        />
      )}

      {/* Coup Result Toast */}
      {coupResult && (
        <div className={`coup-toast coup-toast--${coupResult.success ? 'success' : 'fail'}`}>
          {coupResult.success ? (
            <>Coup successful! You moved up the pyramid!</>
          ) : (
            <>Coup failed ({coupResult.chance}% chance, rolled {coupResult.roll}). Try again soon.</>
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
