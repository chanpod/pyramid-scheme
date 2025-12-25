import { calculatePower } from '../pyramid'

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return Math.floor(num).toString()
}

export default function PyramidNode({
  node,
  isPlayer,
  isUpline,
  isSibling,
  isDownline,
  isSelected,
  hasInvestors,
  investorCount,
  totalInvested,
  onClick,
  x,
  y,
}) {
  const power = calculatePower(node)

  let nodeClass = 'pyramid-node'
  if (isPlayer) nodeClass += ' pyramid-node--player'
  if (isUpline) nodeClass += ' pyramid-node--upline'
  if (isSibling) nodeClass += ' pyramid-node--sibling'
  if (isDownline) nodeClass += ' pyramid-node--downline'
  if (isSelected) nodeClass += ' pyramid-node--selected'
  if (node.coupCooldown > Date.now()) nodeClass += ' pyramid-node--cooldown'
  if (hasInvestors && !isPlayer) nodeClass += ' pyramid-node--has-investors'

  // Truncate name for display
  const displayName = node.name.length > 12
    ? node.name.substring(0, 11) + '…'
    : node.name

  return (
    <g
      className={nodeClass}
      transform={`translate(${x}, ${y})`}
      onClick={() => onClick(node)}
      style={{ cursor: 'pointer' }}
    >
      {/* Node background */}
      <circle
        r={35}
        className="pyramid-node__circle"
      />

      {/* Power ring (visual indicator of strength) */}
      <circle
        r={38}
        className="pyramid-node__power-ring"
        style={{
          strokeDasharray: `${Math.min(power / 10, 240)} 240`,
        }}
      />

      {/* Name */}
      <text
        y={-8}
        className="pyramid-node__name"
        textAnchor="middle"
      >
        {displayName}
      </text>

      {/* Power */}
      <text
        y={10}
        className="pyramid-node__power"
        textAnchor="middle"
      >
        ${formatNumber(power)}
      </text>

      {/* Income indicator */}
      <text
        y={24}
        className="pyramid-node__income"
        textAnchor="middle"
      >
        +${node.incomePerSec.toFixed(1)}/s
      </text>

      {/* Player marker - very obvious */}
      {isPlayer && (
        <>
          <text
            y={-48}
            className="pyramid-node__crown"
            textAnchor="middle"
            fontSize="16"
          >
            ⬇ YOU ⬇
          </text>
          {/* Extra glow ring for player */}
          <circle
            r={42}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeDasharray="8 4"
            className="pyramid-node__player-ring"
          />
        </>
      )}

      {/* Investment indicator - shows when someone has invested in this node */}
      {hasInvestors && totalInvested > 0 && (
        <g className="pyramid-node__investment-badge">
          <circle
            cx={28}
            cy={-28}
            r={12}
            fill="var(--success)"
            stroke="#fff"
            strokeWidth="1"
          />
          <text
            x={28}
            y={-24}
            textAnchor="middle"
            fontSize="8"
            fill="#fff"
            fontWeight="bold"
          >
            ${formatNumber(totalInvested)}
          </text>
        </g>
      )}

      {/* Investor count badge */}
      {investorCount > 0 && (
        <g className="pyramid-node__investor-count">
          <circle
            cx={-28}
            cy={-28}
            r={10}
            fill="var(--info)"
            stroke="#fff"
            strokeWidth="1"
          />
          <text
            x={-28}
            y={-25}
            textAnchor="middle"
            fontSize="9"
            fill="#fff"
            fontWeight="bold"
          >
            {investorCount}
          </text>
        </g>
      )}

      {/* Coup indicator for upline */}
      {isUpline && (
        <text
          y={48}
          className="pyramid-node__action-hint"
          textAnchor="middle"
          fontSize="10"
        >
          ⚔ COUP ⚔
        </text>
      )}
    </g>
  )
}
