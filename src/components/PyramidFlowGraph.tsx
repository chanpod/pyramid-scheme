import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import ReactFlow, {
	Background,
	Controls,
	Node,
	Edge,
	useReactFlow,
	ReactFlowProvider,
	NodeTypes,
	EdgeTypes,
	Panel,
	ConnectionLineType,
} from "reactflow";
import styled from "styled-components";
import type {
	PyramidGraph as PyramidGraphType,
	PyramidNode,
	PyramidLink,
	Product,
} from "../types";
import "reactflow/dist/style.css";
import { CustomNode } from "./nodes/CustomNode";
import { CustomEdge } from "./edges/CustomEdge";
import NodePopover from "./NodePopover";

interface PyramidFlowGraphProps {
	pyramid: PyramidGraphType;
	onNodeClick: (nodeId: string) => void;
	selectedNodeId?: string;
	canMoveUp?: boolean;
	playerStats?: any;
	dispatch?: any;
	products?: Product[];
}

const GraphContainer = styled.div`
  width: 100%;
  height: 800px;
  background-color: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  margin-bottom: 20px;
  flex: 1;
  min-height: 850px;
  
  @media (max-width: 1200px) {
    min-height: 700px;
  }
  
  @media (max-width: 768px) {
    min-height: 600px;
  }
`;

const StatsOverlay = styled.div`
  background-color: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  font-size: 13px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  line-height: 1.5;
  max-width: 200px;
  max-height: 80vh;
  overflow-y: auto;
  
  div {
    margin-bottom: 2px;
  }
  
  /* Heading styles */
  .network-heading {
    font-weight: bold;
    margin-top: 8px;
    margin-bottom: 6px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e0e0e0;
  }
  
  /* Network list styles */
  .network-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }
  
  /* Network item styles */
  .network-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  
  /* Color swatch styles */
  .color-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  
  /* Network name styles */
  .network-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const PanInstructions = styled.div`
  background-color: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    width: 18px;
    height: 18px;
    fill: #666;
  }
`;

// Inner component to access React Flow context
const PyramidFlowInner = ({
	pyramid,
	onNodeClick,
	selectedNodeId,
	canMoveUp,
	playerStats,
	dispatch,
	products,
}: PyramidFlowGraphProps) => {
	const reactFlowInstance = useReactFlow();
	const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
	const [showPopover, setShowPopover] = useState(false);

	// Define node types
	const nodeTypes: NodeTypes = useMemo(
		() => ({
			pyramidNode: CustomNode,
		}),
		[],
	);

	// Define edge types
	const edgeTypes: EdgeTypes = useMemo(
		() => ({
			pyramidEdge: CustomEdge,
		}),
		[],
	);

	// Handle node click to show popover with node information
	const handleNodeClick = useCallback(
		(nodeId: string, position: { x: number; y: number }) => {
			// Call original onNodeClick handler
			onNodeClick(nodeId);

			// Use viewport coordinates from reactflow instance for better positioning
			const node = reactFlowInstance.getNode(nodeId);
			if (node) {
				// Get viewport coordinates based on node's center point
				const { x, y } = reactFlowInstance.project({
					x: node.position.x + (node.width || 0) / 2,
					y: node.position.y,
				});

				// Set popover position and show it
				setPopoverPosition({ x, y });
				setShowPopover(true);
			}
		},
		[onNodeClick, reactFlowInstance],
	);

	// Convert pyramid nodes to React Flow nodes
	const nodes: Node[] = useMemo(() => {
		// Calculate levels
		const maxLevel = Math.max(...pyramid.nodes.map((node) => node.level));
		const levelCounts = new Array(maxLevel + 1).fill(0);

		// Count nodes per level
		for (const node of pyramid.nodes) {
			levelCounts[node.level]++;
		}

		// Sort nodes for consistent layout
		const sortedNodes = [...pyramid.nodes].sort((a, b) => {
			// First by level
			if (a.level !== b.level) return a.level - b.level;
			// Then by owned status (player-owned first)
			if (a.ownedByPlayer && !b.ownedByPlayer) return -1;
			if (!a.ownedByPlayer && b.ownedByPlayer) return 1;
			// Then by AI control status
			if (a.aiControlled && !b.aiControlled) return -1;
			if (!a.aiControlled && b.aiControlled) return 1;
			return 0;
		});

		// Setup pyramid dimensions - making pyramid larger and more centered
		const pyramidWidth = 1800; // Wide base width for better horizontal spacing
		const levelHeight = 170; // Vertical spacing between levels
		const topLevelWidth = 220; // Width for the top level

		// Map to track position of nodes in each level
		const levelPositions: Record<number, number> = {};

		return sortedNodes.map((node) => {
			// Get or initialize position counter for this level
			levelPositions[node.level] = levelPositions[node.level] || 0;

			// Calculate position within level
			const nodesInLevel = levelCounts[node.level];
			const levelIndex = levelPositions[node.level]++;

			// Calculate level width (gets wider as we go down)
			// Top level (level 1) is narrow, bottom level is full width
			const levelWidthRatio = node.level / maxLevel;
			const levelWidth =
				topLevelWidth + (pyramidWidth - topLevelWidth) * levelWidthRatio;

			// For single node levels (like level 1), center it
			const spacing = levelWidth / (nodesInLevel + 1);

			// Position X: start from center and spread nodes evenly within level width
			const x = pyramidWidth / 2 - levelWidth / 2 + spacing * (levelIndex + 1);

			// Position Y: top to bottom
			const y = node.level * levelHeight;

			// Create React Flow node
			return {
				id: node.id,
				type: "pyramidNode",
				position: { x, y },
				data: {
					...node,
					isSelected: node.id === selectedNodeId,
					onClick: () => handleNodeClick(node.id, { x, y }),
				},
			};
		});
	}, [pyramid.nodes, selectedNodeId, handleNodeClick]);

	// Find the player node to center the view
	const centerOnPlayer = useCallback(() => {
		const playerNode = nodes.find((node) => node.data.isPlayerPosition);

		if (playerNode && reactFlowInstance) {
			// Center on player with animation
			reactFlowInstance.setCenter(
				playerNode.position.x,
				playerNode.position.y,
				{ duration: 800, zoom: 1.5 },
			);
		} else {
			// Fall back to fit view if no player node
			reactFlowInstance.fitView({ duration: 800 });
		}
	}, [nodes, reactFlowInstance]);

	// Create a ref to store the centerOnPlayer function
	const centerOnPlayerRef = useRef(centerOnPlayer);

	// Update the ref whenever centerOnPlayer changes
	useEffect(() => {
		centerOnPlayerRef.current = centerOnPlayer;
	}, [centerOnPlayer]);

	// Convert pyramid links to React Flow edges
	const edges: Edge[] = useMemo(() => {
		const nodeIds = new Set(nodes.map((node) => node.id));

		return pyramid.links
			.filter((link) => {
				// Only include links where both source and target are visible
				return nodeIds.has(link.source) && nodeIds.has(link.target);
			})
			.map((link) => ({
				id: `${link.source}-${link.target}`,
				source: link.source,
				target: link.target,
				type: "pyramidEdge",
				data: {
					sourceNode: pyramid.nodes.find((n) => n.id === link.source),
					targetNode: pyramid.nodes.find((n) => n.id === link.target),
				},
			}));
	}, [pyramid.links, pyramid.nodes, nodes]);

	// Find selected node data
	const selectedNode = useMemo(() => {
		if (!selectedNodeId) return null;
		return pyramid.nodes.find((node) => node.id === selectedNodeId) || null;
	}, [pyramid.nodes, selectedNodeId]);

	// Close popover when clicking canvas
	const onPaneClick = useCallback(() => {
		setShowPopover(false);
	}, []);

	// Center the view when graph loads only
	useEffect(() => {
		// Initial centering - only on first load
		const timer = setTimeout(() => {
			centerOnPlayerRef.current();
		}, 100);

		// Cleanup
		return () => {
			clearTimeout(timer);
		};
	}, []); // Empty dependency array is now correct since we use the ref

	return (
		<GraphContainer>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				fitView
				proOptions={{ hideAttribution: true }}
				minZoom={0.2}
				maxZoom={8}
				defaultEdgeOptions={{
					type: "pyramidEdge",
					animated: false,
				}}
				connectionLineType={ConnectionLineType.SmoothStep}
				fitViewOptions={{
					padding: 0.2,
					includeHiddenNodes: false,
				}}
				onPaneClick={onPaneClick}
			>
				<Controls
					position="bottom-right"
					showInteractive={false}
					fitViewOptions={{ duration: 800 }}
				/>
				<Background color="#e0e0e0" gap={16} />

				<Panel position="top-left">
					<StatsOverlay>
						<div>
							<strong>Nodes:</strong> {pyramid.nodes.length}
						</div>
						<div>
							<strong>Your Network:</strong> {playerStats?.recruits + 1}
						</div>
						<div>
							<strong>AI Networks:</strong>{" "}
							{pyramid.nodes.filter((n) => n.aiControlled).length}
						</div>

						{/* Add network information */}
						<div className="network-heading">Networks</div>
						<div className="network-list">
							<div className="network-item">
								<div
									className="color-swatch"
									style={{ backgroundColor: "#4CAF50" }}
								/>
								<div className="network-name">You</div>
							</div>
							<div className="network-item">
								<div
									className="color-swatch"
									style={{ backgroundColor: "#2196F3" }}
								/>
								<div className="network-name">Your Network</div>
							</div>

							{/* Display AI network colors */}
							{Array.from(
								new Set(
									pyramid.nodes
										.filter(
											(n) =>
												n.aiControlled &&
												n.name &&
												!n.name.includes("'s Recruit"),
										)
										.map((n) => n.name),
								),
							).map((networkName, index) => {
								// Calculate the hash from name for a consistent color
								let hashSum = 0;
								if (networkName) {
									for (let i = 0; i < networkName.length; i++) {
										hashSum += networkName.charCodeAt(i);
									}
								}

								// Get color from the same network colors array defined in CustomNode
								const networkColors = [
									"#9C27B0",
									"#E91E63",
									"#FF5722",
									"#FF9800",
									"#FFC107",
									"#8BC34A",
									"#009688",
									"#03A9F4",
									"#673AB7",
									"#3F51B5",
								];
								const color = networkColors[hashSum % networkColors.length];

								return (
									<div key={`network-${index}`} className="network-item">
										<div
											className="color-swatch"
											style={{ backgroundColor: color }}
										/>
										<div className="network-name">
											{networkName?.length && networkName.length > 15
												? networkName.substring(0, 15) + "..."
												: networkName}
										</div>
									</div>
								);
							})}
						</div>
					</StatsOverlay>
				</Panel>

				<Panel position="bottom-left">
					<PanInstructions>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<title>Navigation controls</title>
							<path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
						</svg>
						Drag to pan • Scroll to zoom • Double-click to reset view
					</PanInstructions>
				</Panel>

				<Panel position="top-right">
					<button
						onClick={centerOnPlayer}
						style={{
							padding: "8px 12px",
							background: "#4CAF50",
							color: "white",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
						}}
						type="button"
					>
						Center on YOU
					</button>
				</Panel>

				{showPopover && selectedNode && (
					<NodePopover
						node={selectedNode}
						position={popoverPosition}
						onClose={() => setShowPopover(false)}
						canMoveUp={canMoveUp}
						playerStats={playerStats}
						dispatch={dispatch}
						products={products}
					/>
				)}
			</ReactFlow>
		</GraphContainer>
	);
};

// Wrap component with ReactFlowProvider
const PyramidFlowGraph = (props: PyramidFlowGraphProps) => {
	return (
		<ReactFlowProvider>
			<PyramidFlowInner {...props} />
		</ReactFlowProvider>
	);
};

export default PyramidFlowGraph;
