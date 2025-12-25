import { useMemo, useState, useRef, useEffect } from 'react'
import PyramidNode from './PyramidNode'
import { getSiblings, getDownline } from '../pyramid'

export default function PyramidView({
  nodes,
  rootId,
  playerId,
  selectedNodeId,
  onNodeClick,
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
      if (!node.childIds || node.childIds.length === 0) {
        subtreeWidth[nodeId] = nodeWidth
        return nodeWidth
      }
      let totalWidth = 0
      for (const childId of node.childIds) {
        totalWidth += calculateWidth(childId)
      }
      // Add spacing between children
      totalWidth += (node.childIds.length - 1) * nodeSpacing
      subtreeWidth[nodeId] = Math.max(nodeWidth, totalWidth)
      return subtreeWidth[nodeId]
    }
    calculateWidth(rootId)

    // Second pass: position nodes (top-down)
    const positioned = {}
    const positionNode = (nodeId, x, level) => {
      const node = nodes[nodeId]
      const y = 50 + level * levelHeight

      positioned[nodeId] = { x, y }
      positions.push({ id: nodeId, x, y })

      if (node.childIds && node.childIds.length > 0) {
        // Calculate total width of all children
        let totalChildWidth = 0
        for (const childId of node.childIds) {
          totalChildWidth += subtreeWidth[childId]
        }
        totalChildWidth += (node.childIds.length - 1) * nodeSpacing

        // Position children centered under parent
        let childX = x - totalChildWidth / 2
        for (const childId of node.childIds) {
          const childWidth = subtreeWidth[childId]
          positionNode(childId, childX + childWidth / 2, level + 1)
          childX += childWidth + nodeSpacing
        }
      }
    }
    positionNode(rootId, subtreeWidth[rootId] / 2 + 50, 0)

    // Third pass: create connections with bus lines
    for (const nodeId of Object.keys(positioned)) {
      const node = nodes[nodeId]
      if (!node.childIds || node.childIds.length === 0) continue

      const parent = positioned[nodeId]
      const parentY = parent.y + 35
      const childPositions = node.childIds.map(id => positioned[id])
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
      if (node.childIds.length > 1) {
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

      // Point in "pan space" under cursor before zoom
      const pointX = (cursorX - pan.x) / zoom
      const pointY = (cursorY - pan.y) / zoom

      const delta = e.deltaY > 0 ? -0.1 : 0.1
      const newZoom = Math.max(0.5, Math.min(2.5, zoom + delta))

      // Adjust pan so the same point stays under cursor after zoom
      const newPanX = cursorX - pointX * newZoom
      const newPanY = cursorY - pointY * newZoom

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [zoom, pan])

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 2.5))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5))
  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Find player position and zoom to it
  const handleZoomToPlayer = () => {
    const playerPos = nodePositions.find(p => p.id === playerId)
    if (!playerPos || !viewportRef.current) return

    const rect = viewportRef.current.getBoundingClientRect()
    const viewportCenterX = rect.width / 2
    const viewportCenterY = rect.height / 2

    // Parse viewBox to get SVG coordinate system
    const [vbX] = viewBox.split(' ').map(Number)

    // Set zoom and center on player
    const targetZoom = 1.5
    const panX = viewportCenterX - (playerPos.x - vbX) * targetZoom
    const panY = viewportCenterY - playerPos.y * targetZoom

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
              const investors = node.investors || {}
              const investorCount = Object.keys(investors).length
              const totalInvested = node.investmentsReceived || 0
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
                  hasInvestors={investorCount > 0}
                  investorCount={investorCount}
                  totalInvested={totalInvested}
                  onClick={onNodeClick}
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
