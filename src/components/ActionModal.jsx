import { useState } from 'react'
import { calculatePower, calculateCoupCost, calculateCoupChance, canInvestIn } from '../pyramid'

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return Math.floor(num).toString()
}

export default function ActionModal({
  targetNode,
  playerNode,
  nodes,
  canCoup,
  onCoup,
  onInvest,
  onClose,
}) {
  const [investAmount, setInvestAmount] = useState(0)
  const [coupBonus, setCoupBonus] = useState(0)

  if (!targetNode || !playerNode) return null

  const targetPower = calculatePower(targetNode)
  const playerPower = calculatePower(playerNode)

  // Check if player can invest in this target
  const investCheck = nodes ? canInvestIn(nodes, playerNode.id, targetNode.id) : { allowed: true }
  const canInvestInTarget = investCheck.allowed

  const baseCoupCost = canCoup ? calculateCoupCost(playerNode, targetNode) : 0
  const baseSuccessChance = canCoup ? calculateCoupChance(playerNode, targetNode) : 0
  const boostedChance = canCoup ? calculateCoupChance(playerNode, targetNode, coupBonus) : 0

  const totalCoupCost = baseCoupCost + coupBonus
  const canAffordCoup = playerNode.money >= totalCoupCost

  const isOnCooldown = targetNode.coupCooldown > Date.now()

  return (
    <div className="action-modal-overlay">
      <div className="action-modal">
        <button className="action-modal__close" onClick={onClose}>×</button>

        <div className="action-modal__header">
          <h3>{targetNode.name}</h3>
          <div className="action-modal__power">
            Power: ${formatNumber(targetPower)}
          </div>
        </div>

        <div className="action-modal__stats">
          <div className="action-modal__stat">
            <span className="label">Their Money</span>
            <span className="value">${formatNumber(targetNode.money)}</span>
          </div>
          <div className="action-modal__stat">
            <span className="label">Their Income</span>
            <span className="value">${targetNode.incomePerSec.toFixed(1)}/s</span>
          </div>
          <div className="action-modal__stat">
            <span className="label">Your Power</span>
            <span className="value">${formatNumber(playerPower)}</span>
          </div>
        </div>

        {canCoup && (
          <div className="action-modal__section">
            <h4>Coup Attempt</h4>
            {isOnCooldown ? (
              <div className="action-modal__cooldown">
                Target is protected (cooldown active)
              </div>
            ) : (
              <>
                <div className="action-modal__coup-info">
                  <div className="coup-stat">
                    <span className="label">Base Cost</span>
                    <span className="value">${formatNumber(baseCoupCost)}</span>
                  </div>
                  <div className="coup-stat">
                    <span className="label">Success Chance</span>
                    <span className="value chance">{Math.floor(baseSuccessChance)}%</span>
                  </div>
                </div>

                <div className="action-modal__bonus">
                  <label>Extra Investment (improves odds):</label>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, playerNode.money - baseCoupCost)}
                    value={coupBonus}
                    onChange={e => setCoupBonus(Number(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                  />
                  <span className="bonus-value">+${formatNumber(coupBonus)}</span>
                {coupBonus > 0 && (
                  <div className="boosted-chance">
                    Boosted chance: <strong>{Math.floor(boostedChance)}%</strong>
                  </div>
                )}
                </div>

                <div className="action-modal__total">
                  Total Cost: <strong>${formatNumber(totalCoupCost)}</strong>
                </div>

                <button
                  className="action-btn action-btn--coup"
                  disabled={!canAffordCoup}
                  onClick={() => onCoup(targetNode.id, coupBonus)}
                >
                  {canAffordCoup ? `Attempt Coup (${Math.floor(boostedChance || baseSuccessChance)}%)` : 'Not Enough Money'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="action-modal__section">
          <h4>Invest in {targetNode.name}</h4>
          {canInvestInTarget ? (
            <>
              <p className="action-modal__invest-desc">
                Boost their power & earn 50% of their income. If they coup, you get 50% ROI.
              </p>

              <div className="action-modal__quick-invest">
                {[100, 1000, 10000, 100000].map(amount => (
                  <button
                    key={amount}
                    className="action-btn action-btn--quick-invest"
                    disabled={playerNode.money < amount}
                    onClick={() => onInvest(targetNode.id, amount)}
                  >
                    ${formatNumber(amount)}
                  </button>
                ))}
              </div>

              <div className="action-modal__invest-input">
                <label htmlFor="invest-amount">Custom Amount:</label>
                <input
                  id="invest-amount"
                  type="number"
                  min="0"
                  max={playerNode.money}
                  value={investAmount}
                  onChange={e => setInvestAmount(Math.max(0, Number(e.target.value)))}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                />
                <button
                  className="action-btn action-btn--invest"
                  disabled={investAmount <= 0 || investAmount > playerNode.money}
                  onClick={() => onInvest(targetNode.id, investAmount)}
                >
                  Invest ${formatNumber(investAmount)}
                </button>
              </div>
            </>
          ) : (
            <p className="action-modal__invest-blocked">
              {investCheck.reason}
            </p>
          )}
        </div>

        <button className="action-modal__close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
