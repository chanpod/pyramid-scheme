import { useState } from 'react'
import { calculatePower, calculateCoupCost, calculateCoupChance, canInvestIn, getMaxInvestment } from '../pyramid'

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
  playerTierIndex = 0,
}) {
  const [investAmount, setInvestAmount] = useState(0)
  const [coupBonus, setCoupBonus] = useState(0)

  if (!targetNode || !playerNode) return null

  const targetPower = calculatePower(targetNode)
  const playerPower = calculatePower(playerNode)

  // Check if player can invest in this target (including tier requirements)
  const investCheck = nodes ? canInvestIn(nodes, playerNode.id, targetNode.id, playerTierIndex) : { allowed: true }
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
            <h4>Buy Out</h4>
            {isOnCooldown ? (
              <div className="action-modal__cooldown">
                Target is protected (recently bought out)
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
                  {canAffordCoup ? `Buy Out (${Math.floor(boostedChance || baseSuccessChance)}%)` : 'Not Enough Money'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="action-modal__section">
          <h4>Invest in {targetNode.name}</h4>
          {canInvestInTarget ? (
            <>
              {(() => {
                const playerInvestment = targetNode.investors?.[playerNode.id] || 0
                const totalInvested = targetNode.investmentsReceived || 0
                const ownershipPercent = totalInvested > 0 ? (playerInvestment / totalInvested) * 100 : 0
                const maxInvestment = nodes ? getMaxInvestment(nodes, playerNode.id, targetNode.id) : playerNode.money
                const effectiveMax = Math.min(maxInvestment, playerNode.money)

                return (
                  <>
                    {playerInvestment > 0 && (
                      <div className="action-modal__ownership">
                        <span className="label">Your Investment:</span>
                        <span className="value">${formatNumber(playerInvestment)}</span>
                        <span className="percent">({ownershipPercent.toFixed(1)}% ownership)</span>
                      </div>
                    )}
                    <div className="action-modal__max-invest">
                      <span className="label">Max Investment:</span>
                      <span className="value">${formatNumber(maxInvestment)}</span>
                      <span className="note">(50% of their power)</span>
                    </div>
                    <p className="action-modal__invest-desc">
                      Earn your % of their income. If they buy out their upline, you get 50% ROI!
                    </p>

                    <div className="action-modal__quick-invest">
                      {[5, 10, 25, 50].map(percent => {
                        const cost = Math.floor(targetPower * (percent / 100))
                        const canAfford = playerNode.money >= cost && cost <= maxInvestment
                        return (
                          <button
                            key={percent}
                            className="action-btn action-btn--quick-invest"
                            disabled={!canAfford || cost <= 0}
                            onClick={() => onInvest(targetNode.id, cost)}
                            title={`$${formatNumber(cost)}`}
                          >
                            {percent}% (${formatNumber(cost)})
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
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
