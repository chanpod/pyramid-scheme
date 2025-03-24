import { type FC, useEffect, useRef, memo, useCallback } from "react";
import * as d3 from "d3";
import styled from "styled-components";
import type {
	PyramidGraph as PyramidGraphType,
	PyramidNode,
	PyramidLink,
} from "../types";

interface PyramidGraphProps {
	pyramid: PyramidGraphType;
	onNodeClick: (nodeId: string) => void;
	selectedNodeId?: string;
}

type NodeWithPosition = PyramidNode & { x: number; y: number };
type D3Link = { source: NodeWithPosition; target: NodeWithPosition };

const GraphContainer = styled.div`
  width: 100%;
  height: 800px; /* Increased from 700px for better visibility */
  background-color: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  margin-bottom: 20px; /* Consistent margin */
  flex: 1; /* Take available space */
  min-height: 800px; /* Ensure minimum height is maintained */
  
  /* Make SVG responsive and take full width */
  svg {
    width: 100%;
    height: 100%;
    cursor: grab;
    &:active {
      cursor: grabbing;
    }
  }
  
  /* Style for active dragging */
  .pyramid-graph.dragging {
    cursor: grabbing !important;
  }
`;

const StatsOverlay = styled.div`
  position: absolute;
  top: 15px;
  left: 15px;
  background-color: rgba(255, 255, 255, 0.95);
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 100;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  line-height: 1.7;
  
  div {
    margin-bottom: 3px;
  }
`;

const ZoomControls = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
`;

const ZoomButton = styled.button`
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background-color: white;
  border: 1px solid #ccc;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16);
  transition: transform 0.2s, background-color 0.2s;
  
  &:hover {
    background-color: #f0f0f0;
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const PanInstructions = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 100;
  
  svg {
    width: 18px;
    height: 18px;
    fill: #666;
  }
`;

// Memoized component to prevent unnecessary re-renders
const PyramidGraph: React.FC<PyramidGraphProps> = memo(
	({ pyramid, onNodeClick, selectedNodeId }) => {
		const svgRef = useRef<SVGSVGElement>(null);
		const previousVersionRef = useRef<number>(-1);
		const positionedNodesRef = useRef<NodeWithPosition[] | null>(null);
		const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(
			null,
		);

		// Format node name for display
		const getNodeLabel = useCallback((node: PyramidNode) => {
			if (node.isPlayerPosition) return "YOU";
			if (node.name) return node.name;
			return node.level.toString();
		}, []);

		useEffect(() => {
			if (!svgRef.current || pyramid.nodes.length === 0) return;

			// Setup cursor change event listeners
			const svgElement = svgRef.current;

			const handleMouseDown = () => {
				svgElement.classList.add("dragging");
			};

			const handleMouseUp = () => {
				svgElement.classList.remove("dragging");
			};

			// Add event listeners for cursor change
			svgElement.addEventListener("mousedown", handleMouseDown);
			window.addEventListener("mouseup", handleMouseUp); // Use window to catch events outside SVG

			// Return cleanup function
			return () => {
				svgElement.removeEventListener("mousedown", handleMouseDown);
				window.removeEventListener("mouseup", handleMouseUp);
			};
		}, [pyramid.nodes.length]); // Re-run if nodes change

		useEffect(() => {
			if (!svgRef.current || pyramid.nodes.length === 0) return;

			console.log(
				"Rendering pyramid with",
				pyramid.nodes.length,
				"nodes and",
				pyramid.links.length,
				"links",
			);

			// Get the svg container dimensions
			const width = svgRef.current.clientWidth || 1000; // Default if clientWidth is 0
			const height = svgRef.current.clientHeight || 700; // Default if clientHeight is 0

			// Check if pyramid has changed
			let shouldRebuildGraph = pyramid.version !== previousVersionRef.current;
			previousVersionRef.current = pyramid.version;

			// Create or get existing SVG element
			const svg = d3.select(svgRef.current);

			// If we don't need to rebuild, just update selected node
			if (!shouldRebuildGraph) {
				// Just update the selected node highlight without rebuilding
				try {
					svg
						.selectAll("circle.node-circle")
						.attr("stroke", (d) => {
							const node = d as unknown as NodeWithPosition;
							return node.id === selectedNodeId ? "#FF5722" : "none";
						})
						.attr("stroke-width", (d) => {
							const node = d as unknown as NodeWithPosition;
							return node.id === selectedNodeId ? 3 : 0;
						});
				} catch (e) {
					console.error("Error updating selected node:", e);
					// If there's an error, force rebuild
					shouldRebuildGraph = true;
				}

				if (!shouldRebuildGraph) {
					return;
				}
			}

			// Clear the SVG for a fresh render
			svg.selectAll("*").remove();

			// Create a group for the entire visualization that will be transformed by zoom
			const g = svg.append("g").attr("class", "zoom-container");

			// Determine levels in the pyramid
			const maxLevel = Math.max(...pyramid.nodes.map((node) => node.level));
			const levelCounts = new Array(maxLevel + 1).fill(0);

			// Count nodes per level
			for (const node of pyramid.nodes) {
				levelCounts[node.level]++;
			}

			// Create a node id to position map for quick lookup
			const nodeIdMap: Record<string, NodeWithPosition> = {};

			// Assign initial positions to nodes based on their level
			const positionedNodes: NodeWithPosition[] = pyramid.nodes.map((node) => {
				const levelWidth = width * 1.5; // Use 150% of width to make the tree wider
				const levelHeight = (height / (maxLevel + 1)) * 0.9; // Use 90% of height per level

				// Calculate position within level (spread evenly)
				const nodesInLevel = levelCounts[node.level];
				const levelNodesAtCurrentLevel = pyramid.nodes.filter(
					(n) => n.level === node.level,
				);
				const levelIndex = levelNodesAtCurrentLevel.findIndex(
					(n) => n.id === node.id,
				);

				// Ensure we have a valid index
				const validLevelIndex = levelIndex >= 0 ? levelIndex : 0;

				// Calculate x position with wider spacing
				const x =
					(levelWidth * (validLevelIndex + 0.5)) / nodesInLevel -
					levelWidth / 4;
				const y = levelHeight * node.level;

				const positionedNode = {
					...node,
					x,
					y,
				};

				// Store in map for quick lookup
				nodeIdMap[node.id] = positionedNode;

				return positionedNode;
			});

			// Store positioned nodes for zoom controls to use
			positionedNodesRef.current = positionedNodes;

			// Create background grid for better visual orientation
			const grid = g.append("g").attr("class", "grid");

			// Add horizontal grid lines for levels
			for (let level = 1; level <= maxLevel; level++) {
				const y = (height / (maxLevel + 1)) * level;
				grid
					.append("line")
					.attr("x1", -width * 2)
					.attr("y1", y)
					.attr("x2", width * 3)
					.attr("y2", y)
					.attr("stroke", "#e0e0e0")
					.attr("stroke-width", 1)
					.attr("stroke-dasharray", "3,3");
			}

			// Track node visibility - we'll show all nodes except potential recruits
			const visibleNodeIds = new Set<string>();

			// Find all visible nodes (all nodes except potential recruits)
			for (const node of pyramid.nodes) {
				// Skip potential recruits entirely - they're not part of the visible network yet
				// if (node.isPotentialRecruit) {
				// 	continue;
				// }

				// Include all other nodes in the visualization
				visibleNodeIds.add(node.id);
			}

			// Prepare the links (connections between nodes)
			const links: D3Link[] = [];

			// Filter links to only show connections between visible nodes
			for (const link of pyramid.links) {
				const source = nodeIdMap[link.source];
				const target = nodeIdMap[link.target];

				if (
					source &&
					target &&
					visibleNodeIds.has(source.id) &&
					visibleNodeIds.has(target.id)
				) {
					links.push({ source, target });
				}
			}

			// Filter nodes to only show visible ones
			const visibleNodes = positionedNodes.filter((node) =>
				visibleNodeIds.has(node.id),
			);

			console.log(
				"Showing",
				visibleNodes.length,
				"nodes and",
				links.length,
				"links",
			);

			// Create a group for links so they appear behind nodes
			const linkGroup = g.append("g").attr("class", "links");

			// Draw the links
			linkGroup
				.selectAll("path")
				.data(links)
				.enter()
				.append("path")
				.attr("d", (d) => {
					// Create a curved path between source and target
					const dx = d.target.x - d.source.x;
					const dy = d.target.y - d.source.y;

					// For straight links between levels
					return `M${d.source.x},${d.source.y} C${d.source.x},${d.source.y + dy / 3} ${d.target.x},${d.target.y - dy / 3} ${d.target.x},${d.target.y}`;
				})
				.attr("fill", "none")
				.attr("stroke", (d) => {
					// Player's links are more prominent
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return "#2196F3"; // Bold blue for player connections
					}

					if (d.source.aiControlled && d.target.aiControlled) {
						return "#9C27B0"; // Purple for AI connections
					}

					if (
						(d.source.ownedByPlayer && d.target.aiControlled) ||
						(d.source.aiControlled && d.target.ownedByPlayer)
					) {
						return "#FF5722"; // Orange for contested connections
					}

					if (d.source.isPlayerPosition || d.target.isPlayerPosition) {
						return "#4CAF50"; // Green for player position connections
					}

					return "#BDBDBD"; // Lighter gray for other visible connections
				})
				.attr("stroke-width", (d) => {
					// Player's links are thicker
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return 3;
					}

					if (d.source.isPlayerPosition || d.target.isPlayerPosition) {
						return 3;
					}

					return 1.5;
				})
				.attr("stroke-opacity", (d) => {
					// Player's links more opaque
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return 0.9;
					}

					return 0.6;
				})
				.attr("stroke-dasharray", (d) => {
					// Player's links solid
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return null;
					}

					if (d.source.aiControlled && d.target.aiControlled) {
						return "5,3";
					}

					return null;
				});

			// Create node groups
			const nodeGroups = g
				.selectAll("g.node")
				.data(visibleNodes) // Use filtered nodes
				.enter()
				.append("g")
				.attr("transform", (d) => `translate(${d.x},${d.y})`)
				.attr("class", "node")
				.style("cursor", "pointer")
				.on("click", (_: MouseEvent, d: NodeWithPosition) => {
					onNodeClick(d.id);
				});

			// Add shadows for 3D effect
			nodeGroups
				.append("circle")
				.attr("r", (d) => (d.isPlayerPosition ? 18 : 14))
				.attr("fill", "rgba(0,0,0,0.2)")
				.attr("cx", 2)
				.attr("cy", 2);

			// Add circles for nodes
			nodeGroups
				.append("circle")
				.attr("class", "node-circle")
				.attr("r", (d) => (d.isPlayerPosition ? 18 : 14))
				.attr("fill", (d) => {
					if (d.isPlayerPosition) return "#4CAF50"; // Player's position (green)
					if (d.ownedByPlayer) return "#2196F3"; // Owned by player (blue)
					if (d.aiControlled) return "#9C27B0"; // AI controlled (purple)
					return "#B0BEC5"; // Neutral node (light gray)
				})
				.attr("stroke", (d) => (d.id === selectedNodeId ? "#FF5722" : "none"))
				.attr("stroke-width", (d) => (d.id === selectedNodeId ? 3 : 0));

			// Add text labels
			nodeGroups
				.append("text")
				.attr("dy", 4)
				.attr("text-anchor", "middle")
				.attr("fill", "white")
				.style("font-weight", "bold")
				.style("font-size", (d) => (d.isPlayerPosition ? "14px" : "12px"))
				.style("pointer-events", "none") // Prevent text from blocking click events
				.text((d) => getNodeLabel(d));

			// Add tooltips
			nodeGroups.append("title").text((d) => {
				const status = d.isPlayerPosition
					? "You"
					: d.ownedByPlayer
						? "Owned by You"
						: d.aiControlled
							? "AI Controlled"
							: "Unowned Node";
				const nodeId = d.id.substring(0, 6);
				return `Level: ${d.level}\nStatus: ${status}\nID: ${nodeId}\nMoney: $${d.money.toLocaleString()}`;
			});

			// Add money display below node for amounts > 0
			nodeGroups
				.filter((d) => d.money > 0)
				.append("g")
				.attr("class", "money-label")
				.each(function (d) {
					const g = d3.select(this);

					// Add background pill for better visibility
					g.append("rect")
						.attr("rx", 8)
						.attr("ry", 8)
						.attr("x", -24)
						.attr("y", 20)
						.attr("width", 48)
						.attr("height", 16)
						.attr("fill", "rgba(255, 255, 255, 0.9)")
						.attr("stroke", "#aaa")
						.attr("stroke-width", 1);

					// Add money text on top of background
					g.append("text")
						.attr("dy", 32)
						.attr("text-anchor", "middle")
						.attr("fill", d.money >= 1000 ? "#2E7D32" : "#333") // Green for larger amounts
						.style("font-size", "11px")
						.style("font-weight", "bold")
						.text(() => {
							// Format money with K suffix for thousands
							if (d.money >= 1000) {
								return `$${(d.money / 1000).toFixed(1)}K`;
							}
							return `$${d.money}`;
						});
				});

			// After nodes are positioned, find player node for initial view centering
			const playerNode = positionedNodes.find((node) => node.isPlayerPosition);
			const initialScale = 0.8; // Slightly smaller scale to show more of the graph
			let initialX = width / 2;
			let initialY = height / 2;

			// If player node exists, center view on player position
			if (playerNode) {
				initialX = playerNode.x;
				initialY = playerNode.y;
			}

			// Define zoom behavior with proper type
			const zoom = d3
				.zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.2, 8]) // Limit zoom scale between 0.2x and 8x
				.on("zoom", (event) => {
					if (!event) return;
					// This properly applies the transformation to the group
					g.attr(
						"transform",
						`translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`,
					);
				});

			// Store zoom behavior for button handlers
			zoomRef.current = zoom;

			// Apply zoom behavior to SVG
			// Don't add any other mousedown/mouseup handlers to the svg element
			// The zoom behavior will handle these automatically
			svg.call(zoom).on("dblclick.zoom", null); // Disable default double-click zoom

			// Initialize with player node centered
			svg.call(
				zoom.transform,
				d3.zoomIdentity
					.translate(width / 2, height / 2)
					.scale(initialScale)
					.translate(-initialX, -initialY),
			);

			// Add double-click handler to reset view
			svg.on("dblclick", (event) => {
				// Prevent event bubbling
				event.preventDefault();
				event.stopPropagation();

				// Find player node for centering
				const playerNode = positionedNodesRef.current?.find(
					(node) => node.isPlayerPosition,
				);

				const resetScale = 0.8;
				let centerX = width / 2;
				let centerY = height / 2;

				// If player exists, use its position
				if (playerNode) {
					centerX = playerNode.x;
					centerY = playerNode.y;
				}

				// Smoothly transition to reset view
				svg
					.transition()
					.duration(750)
					.call(
						zoom.transform,
						d3.zoomIdentity
							.translate(width / 2, height / 2)
							.scale(resetScale)
							.translate(-centerX, -centerY),
					);
			});
		}, [
			pyramid.version,
			pyramid.nodes,
			pyramid.links,
			selectedNodeId,
			onNodeClick,
			getNodeLabel,
		]);

		const handleZoomIn = useCallback(() => {
			if (!svgRef.current || !zoomRef.current) return;

			// Get the SVG element and zoom behavior
			const svg = d3.select(svgRef.current);
			const zoom = zoomRef.current;

			// Apply zoom in with transition
			svg.transition().duration(300).call(zoom.scaleBy, 1.5);
		}, []);

		const handleZoomOut = useCallback(() => {
			if (!svgRef.current || !zoomRef.current) return;

			// Get the SVG element and zoom behavior
			const svg = d3.select(svgRef.current);
			const zoom = zoomRef.current;

			// Apply zoom out with transition
			svg.transition().duration(300).call(zoom.scaleBy, 0.66);
		}, []);

		const handleResetZoom = useCallback(() => {
			if (!svgRef.current || !zoomRef.current) return;

			// Get the SVG element and dimensions
			const svg = d3.select(svgRef.current);
			const width = svgRef.current.clientWidth || 1000;
			const height = svgRef.current.clientHeight || 700;
			const zoom = zoomRef.current;

			// Find player node for centering
			const playerNode = positionedNodesRef.current?.find(
				(node) => node.isPlayerPosition,
			);

			const resetScale = 0.8;
			let centerX = width / 2;
			let centerY = height / 2;

			// If player exists, use its position
			if (playerNode) {
				centerX = playerNode.x;
				centerY = playerNode.y;
			}

			// Smoothly transition to reset view
			svg
				.transition()
				.duration(750)
				.call(
					zoom.transform,
					d3.zoomIdentity
						.translate(width / 2, height / 2)
						.scale(resetScale)
						.translate(-centerX, -centerY),
				);
		}, []);

		return (
			<GraphContainer>
				<StatsOverlay>
					<div>Total Nodes: {pyramid.nodes.length}</div>
					<div>
						Player Owned: {pyramid.nodes.filter((n) => n.ownedByPlayer).length}
					</div>
					<div>
						AI Owned: {pyramid.nodes.filter((n) => n.aiControlled).length}
					</div>
					<div>Levels: {Math.max(...pyramid.nodes.map((n) => n.level))}</div>
				</StatsOverlay>
				<PanInstructions>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<title>Navigation controls</title>
						<path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
					</svg>
					Drag to pan • Scroll to zoom • Double-click to reset view
				</PanInstructions>
				<ZoomControls>
					<ZoomButton
						onClick={handleZoomIn}
						title="Zoom In"
						aria-label="Zoom In"
					>
						+
					</ZoomButton>
					<ZoomButton
						onClick={handleZoomOut}
						title="Zoom Out"
						aria-label="Zoom Out"
					>
						−
					</ZoomButton>
					<ZoomButton
						onClick={handleResetZoom}
						title="Reset Zoom"
						aria-label="Reset Zoom"
					>
						⟲
					</ZoomButton>
				</ZoomControls>
				<svg
					ref={svgRef}
					width="100%"
					height="100%"
					aria-label="Pyramid network visualization"
					role="img"
					style={{
						cursor: "grab",
						touchAction: "none" /* Prevents default touch behaviors */,
						WebkitUserSelect: "none" /* Prevents text selection */,
						MozUserSelect: "none",
						msUserSelect: "none",
						userSelect: "none" /* Prevents text selection */,
					}}
					className="pyramid-graph"
				/>
			</GraphContainer>
		);
	},
);

export default PyramidGraph;
