import { useMemo, useState, useRef, useEffect } from 'react'
import PyramidNode from './PyramidNode'
import { getSiblings, getDownline, calculatePower, calculateCoupChance, canInvestIn, getMaxInvestment } from '../pyramid'

export default function PyramidView({
  nodes,
  rootId,
  playerId,
  selectedNodeId,
  onNodeClick,
  onInvestorBadgeClick,
  onQuickInvest,
  playerTierIndex = 0,
  playerMoney = 0,
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const viewportRef = useRef(null)

  // Calculate positions for all nodes using proper tree layout
  const { nodePositions, connections, viewBox } = useMemo(() => {
    if (!nodes || !rootId) return { nodePositions: [], connections: [], viewBox: '0 0 800 600' }

    const positions = []
    const conns = []

    const nodeWidth = 100
    const nodeSpacing = 20
    const levelHeight = 100

    // First pass: calculate subtree widths (bottom-up)
    const subtreeWidth = {}
    const calculateWidth = (nodeId) => {
      const node = nodes[nodeId]
      if (!node) {
        // Safety check: node doesn't exist
        subtreeWidth[nodeId] = nodeWidth
        return nodeWidth
      }
      if (!node.childIds || node.childIds.length === 0) {
        subtreeWidth[nodeId] = nodeWidth
        return nodeWidth
      }
      let totalWidth = 0
      for (const childId of node.childIds) {
        if (nodes[childId]) {
          totalWidth += calculateWidth(childId)
        }
      }
      // Add spacing between children
      const validChildCount = node.childIds.filter(id => nodes[id]).length
      if (validChildCount > 1) {
        totalWidth += (validChildCount - 1) * nodeSpacing
      }
      subtreeWidth[nodeId] = Math.max(nodeWidth, totalWidth)
      return subtreeWidth[nodeId]
    }
    calculateWidth(rootId)

    // Second pass: position nodes (top-down)
    const positioned = {}
    const positionNode = (nodeId, x, level) => {
      const node = nodes[nodeId]
      if (!node) return // Safety check

      const y = 50 + level * levelHeight

      positioned[nodeId] = { x, y }
      positions.push({ id: nodeId, x, y })

      if (node.childIds && node.childIds.length > 0) {
        // Filter to valid children only
        const validChildIds = node.childIds.filter(id => nodes[id])
        if (validChildIds.length === 0) return

        // Calculate total width of all children
        let totalChildWidth = 0
        for (const childId of validChildIds) {
          totalChildWidth += subtreeWidth[childId] || nodeWidth
        }
        totalChildWidth += (validChildIds.length - 1) * nodeSpacing

        // Position children centered under parent
        let childX = x - totalChildWidth / 2
        for (const childId of validChildIds) {
          const childWidth = subtreeWidth[childId] || nodeWidth
          positionNode(childId, childX + childWidth / 2, level + 1)
          childX += childWidth + nodeSpacing
        }
      }
    }
    positionNode(rootId, (subtreeWidth[rootId] || nodeWidth) / 2 + 50, 0)

    // Third pass: create connections with bus lines
    for (const nodeId of Object.keys(positioned)) {
      const node = nodes[nodeId]
      if (!node || !node.childIds || node.childIds.length === 0) continue

      const parent = positioned[nodeId]
      // Filter to only children that have been positioned
      const childPositions = node.childIds
        .map(id => positioned[id])
        .filter(pos => pos !== undefined)

      if (childPositions.length === 0) continue

      const parentY = parent.y + 35
      const childY = childPositions[0].y - 35
      const busY = (parentY + childY) / 2

      // Find leftmost and rightmost child
      const childXs = childPositions.map(p => p.x)
      const minX = Math.min(...childXs)
      const maxX = Math.max(...childXs)

      // Draw: parent down to bus, horizontal bus, each child up from bus
      // Parent stem down to bus
      conns.push({
        path: `M ${parent.x} ${parentY} L ${parent.x} ${busY}`,
        type: 'stem'
      })

      // Horizontal bus line
      if (childPositions.length > 1) {
        conns.push({
          path: `M ${minX} ${busY} L ${maxX} ${busY}`,
          type: 'bus'
        })
      }

      // Child stems up from bus
      for (const childPos of childPositions) {
        conns.push({
          path: `M ${childPos.x} ${busY} L ${childPos.x} ${childY}`,
          type: 'stem'
        })
      }
    }

    // Calculate bounds
    const allX = positions.map(p => p.x)
    const allY = positions.map(p => p.y)
    const minX = Math.min(...allX) - 60
    const maxX = Math.max(...allX) + 60
    const maxY = Math.max(...allY) + 60

    const width = maxX - minX + 100
    const height = maxY + 50

    return {
      nodePositions: positions,
      connections: conns,
      viewBox: `${minX - 50} 0 ${width} ${height}`,
    }
  }, [nodes, rootId])

  // Handle wheel zoom with non-passive listener - zoom toward cursor
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleWheel = (e) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = viewport.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top

      // Transform origin is 'center top' = (cx, 0) where cx = rect.width/2
      const cx = rect.width / 2

      // The transform is: scale(zoom) translate(pan.x/zoom, pan.y/zoom)
      // with origin at (cx, 0). This means:
      //   finalX = cx + (baseX - cx) * zoom + pan.x
      //   finalY = baseY * zoom + pan.y
      //
      // To keep the point under cursor stationary during zoom:
      // 1. Find the "base" position (at zoom=1, pan=0) under cursor
      // 2. Calculate new pan so that base position still maps to cursor

      // Solve for base position from current cursor position:
      const baseX = cx + (cursorX - cx - pan.x) / zoom
      const baseY = (cursorY - pan.y) / zoom

      // Multiplicative zoom for consistent feel at any level
      const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18
      const newZoom = Math.max(0.1, Math.min(50, zoom * zoomFactor))

      // Calculate new pan to keep base position at cursor
      const newPanX = cursorX - cx - (baseX - cx) * newZoom
      const newPanY = cursorY - baseY * newZoom

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [zoom, pan])

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 50))
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 0.1))
  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Find player position and zoom to it
  const handleZoomToPlayer = () => {
    const playerPos = nodePositions.find(p => p.id === playerId)
    if (!playerPos || !viewportRef.current) return

    const rect = viewportRef.current.getBoundingClientRect()
    const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number)

    const targetZoom = 12

    // Calculate how SVG fits in viewport at zoom=1, pan=0 (preserveAspectRatio="xMidYMid meet")
    const svgScale = Math.min(rect.width / vbWidth, rect.height / vbHeight)
    const offsetX = (rect.width - vbWidth * svgScale) / 2
    const offsetY = (rect.height - vbHeight * svgScale) / 2

    // Player position in screen coords at zoom=1, pan=0
    const playerScreenX = offsetX + (playerPos.x - vbX) * svgScale
    const playerScreenY = offsetY + (playerPos.y - vbY) * svgScale

    // Transform uses: scale(zoom) translate(pan.x/zoom, pan.y/zoom)
    // with transformOrigin: 'center top' = (rect.width/2, 0)
    //
    // After transform, a point at (screenX, screenY) at zoom=1 appears at:
    //   finalX = rect.width/2 + (screenX - rect.width/2) * zoom + pan.x
    //   finalY = screenY * zoom + pan.y
    //
    // To center player at viewport center (rect.width/2, rect.height/2):
    const panX = (rect.width / 2 - playerScreenX) * targetZoom
    const panY = rect.height / 2 - playerScreenY * targetZoom

    setZoom(targetZoom)
    setPan({ x: panX, y: panY })
  }

  const handleMouseDown = (e) => {
    // Only start drag on left click, not on nodes
    if (e.button !== 0) return
    if (e.target.closest('.pyramid-node')) return

    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (!nodes || !playerId) {
    return <div className="pyramid-loading">Generating pyramid...</div>
  }

  const playerNode = nodes[playerId]
  const playerUplineId = playerNode?.parentId
  const playerSiblings = playerNode ? getSiblings(nodes, playerId) : []
  const playerDownline = playerNode ? getDownline(nodes, playerId) : []

  // Calculate which nodes are "threatened" - have subordinates with decent coup odds
  const threatenedNodes = useMemo(() => {
    if (!nodes) return new Set()
    const threatened = new Set()
    const THREAT_THRESHOLD = 25 // Node is threatened if any child has >= 25% coup chance

    for (const nodeId of Object.keys(nodes)) {
      const node = nodes[nodeId]
      if (!node.childIds || node.childIds.length === 0) continue

      for (const childId of node.childIds) {
        const child = nodes[childId]
        if (!child) continue

        // Check if this child could coup their parent
        const coupChance = calculateCoupChance(child, node)
        if (coupChance >= THREAT_THRESHOLD) {
          threatened.add(nodeId)
          break
        }
      }
    }

    return threatened
  }, [nodes])

  return (
    <div className="pyramid-view">
      <div className="pyramid-controls">
        <button onClick={handleZoomOut} title="Zoom Out">-</button>
        <span className="pyramid-zoom-level">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} title="Zoom In">+</button>
        <button onClick={handleResetView} title="Reset View">Reset</button>
        <button onClick={handleZoomToPlayer} title="Zoom to Your Position" className="pyramid-controls__find-me">
          Find Me
        </button>
      </div>
      <div
        ref={viewportRef}
        className="pyramid-viewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <svg
          viewBox={viewBox}
          className="pyramid-svg"
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center top',
          }}
        >
          {/* Connection lines */}
          <g className="pyramid-connections">
            {connections.map((conn, idx) => (
              <path
                key={idx}
                d={conn.path}
                className="pyramid-connection"
                fill="none"
              />
            ))}
          </g>

          {/* Nodes */}
          <g className="pyramid-nodes">
            {nodePositions.map(({ id, x, y }) => {
              const node = nodes[id]
              if (!node) return null // Safety check
              const investors = node.investors || {}
              const investorCount = Object.keys(investors).length
              const totalInvested = node.investmentsReceived || 0

              // Calculate quick invest eligibility (5% of target power)
              let canQuickInvest = false
              let quickInvestCost = 0
              if (id !== playerId && onQuickInvest) {
                const targetPower = calculatePower(node)
                quickInvestCost = Math.floor(targetPower * 0.05)
                const maxInvest = getMaxInvestment(nodes, playerId, id)
                const investCheck = canInvestIn(nodes, playerId, id, playerTierIndex)

                canQuickInvest = investCheck.allowed &&
                  quickInvestCost > 0 &&
                  quickInvestCost <= maxInvest &&
                  playerMoney >= quickInvestCost
              }

              return (
                <PyramidNode
                  key={id}
                  node={node}
                  x={x}
                  y={y}
                  isPlayer={id === playerId}
                  isUpline={id === playerUplineId}
                  isSibling={playerSiblings.includes(id)}
                  isDownline={playerDownline.includes(id)}
                  isSelected={id === selectedNodeId}
                  isThreatened={threatenedNodes.has(id)}
                  hasInvestors={investorCount > 0}
                  investorCount={investorCount}
                  totalInvested={totalInvested}
                  onClick={onNodeClick}
                  onInvestorBadgeClick={onInvestorBadgeClick}
                  onQuickInvest={onQuickInvest}
                  canQuickInvest={canQuickInvest}
                  quickInvestCost={quickInvestCost}
                />
              )
            })}
          </g>
        </svg>
      </div>
      <div className="pyramid-help">
        Scroll to zoom | Drag to pan | Click nodes to interact
      </div>
    </div>
  )
}
