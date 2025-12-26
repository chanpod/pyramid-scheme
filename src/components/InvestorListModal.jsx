import { calculatePower } from '../pyramid'

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return Math.floor(num).toString()
}

export default function InvestorListModal({ node, nodes, onClose }) {
  if (!node || !nodes) return null

  const investors = node.investors || {}
  const investorEntries = Object.entries(investors)
  const totalInvested = node.investmentsReceived || 0

  return (
    <div className="investor-modal-overlay" onClick={onClose}>
      <div className="investor-modal" onClick={e => e.stopPropagation()}>
        <button className="investor-modal__close" onClick={onClose}>×</button>

        <div className="investor-modal__header">
          <h3>Investors in {node.name}</h3>
          <div className="investor-modal__total">
            Total Invested: <strong>${formatNumber(totalInvested)}</strong>
          </div>
        </div>

        <div className="investor-modal__list">
          {investorEntries.length === 0 ? (
            <div className="investor-modal__empty">No investors yet</div>
          ) : (
            investorEntries.map(([investorId, amount]) => {
              const investor = nodes[investorId]
              if (!investor) return null

              const investorPower = calculatePower(investor)
              const sharePercent = totalInvested > 0
                ? ((amount / totalInvested) * 100).toFixed(1)
                : 0

              return (
                <div key={investorId} className={`investor-modal__item ${investor.isPlayer ? 'investor-modal__item--player' : ''}`}>
                  <div className="investor-modal__investor-info">
                    <span className="investor-modal__investor-name">
                      {investor.isPlayer ? '⭐ YOU' : investor.name}
                    </span>
                    <span className="investor-modal__investor-power">
                      Power: ${formatNumber(investorPower)}
                    </span>
                  </div>
                  <div className="investor-modal__investment-info">
                    <span className="investor-modal__amount">${formatNumber(amount)}</span>
                    <span className="investor-modal__share">({sharePercent}%)</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="investor-modal__footer">
          <p className="investor-modal__hint">
            Investors boost this node's power and earn income from them.
            If this node successfully coups, investors get 50% ROI.
          </p>
        </div>

        <button className="investor-modal__close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
