import React, { useEffect, useRef, memo, useCallback } from "react";
import * as d3 from "d3";
import styled from "styled-components";
import {
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
  height: 600px; /* Increased height for better visualization */
  background-color: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  margin-bottom: 20px; /* Consistent margin */
  flex: 1; /* Take available space */
  min-height: 600px; /* Ensure minimum height is maintained */
`;

const StatsOverlay = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
  line-height: 1.5;
  
  div {
    margin-bottom: 2px;
  }
`;

const ZoomControls = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 100;
`;

const ZoomButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: white;
  border: 1px solid #ccc;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background-color: #f0f0f0;
  }
`;

// Memoized component to prevent unnecessary re-renders
const PyramidGraph: React.FC<PyramidGraphProps> = memo(
	({ pyramid, onNodeClick, selectedNodeId }) => {
		const svgRef = useRef<SVGSVGElement>(null);
		const previousVersionRef = useRef<number>(-1);

		// Format node name for display
		const getNodeLabel = useCallback((node: PyramidNode) => {
			if (node.isPlayerPosition) return "YOU";
			if (node.name) return node.name;
			return node.level.toString();
		}, []);

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
			const width = svgRef.current.clientWidth || 800; // Default if clientWidth is 0
			const height = svgRef.current.clientHeight || 600; // Default if clientHeight is 0

			// Check if pyramid has changed
			let shouldRebuildGraph = pyramid.version !== previousVersionRef.current;
			previousVersionRef.current = pyramid.version;

			// Create or get existing SVG element
			let svg = d3.select(svgRef.current);

			// If we don't need to rebuild, just update selected node
			if (!shouldRebuildGraph) {
				// Just update the selected node highlight without rebuilding
				try {
					svg
						.selectAll("circle")
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

			// Create SVG element
			svg = d3
				.select(svgRef.current)
				.attr("width", width)
				.attr("height", height);

			// Create zoom behavior
			const zoom = d3
				.zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.5, 3])
				.on("zoom", (event) => {
					container.attr("transform", event.transform);
				});

			svg.call(zoom);

			// Create a container for all elements with a transform to center content
			const container = svg
				.append("g")
				.attr("class", "container")
				.attr("transform", `translate(0, 20)`); // Add some top padding

			// Create background grid for better visual orientation
			const grid = container.append("g").attr("class", "grid");
			const maxLevel = Math.max(...pyramid.nodes.map((node) => node.level));

			// Add horizontal grid lines for levels
			for (let level = 1; level <= maxLevel; level++) {
				const y = (height / (maxLevel + 1)) * level;
				grid
					.append("line")
					.attr("x1", 0)
					.attr("y1", y)
					.attr("x2", width)
					.attr("y2", y)
					.attr("stroke", "#e0e0e0")
					.attr("stroke-width", 1)
					.attr("stroke-dasharray", "3,3");
			}

			// Determine levels in the pyramid
			const levelCounts = new Array(maxLevel + 1).fill(0);

			// Count nodes per level
			for (const node of pyramid.nodes) {
				levelCounts[node.level]++;
			}

			// Create a node id to position map for quick lookup
			const nodeIdMap: Record<string, NodeWithPosition> = {};

			// Assign initial positions to nodes based on their level
			const positionedNodes: NodeWithPosition[] = pyramid.nodes.map((node) => {
				const levelWidth = width * 0.8; // Use 80% of width to leave margins
				const levelHeight = height / (maxLevel + 1);

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

				const x =
					width * 0.1 +
					(levelWidth * (validLevelIndex + 1)) / (nodesInLevel + 1);
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

			// Prepare the links (connections between nodes)
			const links: D3Link[] = [];

			// Track node visibility - we'll show all nodes except potential recruits
			const visibleNodeIds = new Set<string>();

			// Step 1: Find all visible nodes (all nodes except potential recruits)
			pyramid.nodes.forEach((node) => {
				// Skip potential recruits entirely - they're not part of the visible network yet
				if (node.isPotentialRecruit) {
					return;
				}

				// Include all other nodes in the visualization
				visibleNodeIds.add(node.id);
			});

			// Step 2: Filter links to only show connections between visible nodes
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

			// Step 3: Filter nodes to only show visible ones
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

			// Draw the links first (so they're behind the nodes)
			container
				.selectAll("line")
				.data(links)
				.enter()
				.append("line")
				.attr("x1", (d) => d.source.x)
				.attr("y1", (d) => d.source.y)
				.attr("x2", (d) => d.target.x)
				.attr("y2", (d) => d.target.y)
				.attr("stroke", (d) => {
					// Player's links are more prominent
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return "#2196F3"; // Bold blue for player connections
					}
					// AI-controlled links
					else if (d.source.aiControlled && d.target.aiControlled) {
						return "#9C27B0"; // Purple for AI connections
					}
					// Mixed ownership (AI claimed some player nodes or vice versa)
					else if (
						(d.source.ownedByPlayer && d.target.aiControlled) ||
						(d.source.aiControlled && d.target.ownedByPlayer)
					) {
						return "#FF5722"; // Orange for contested connections
					}
					// Player position links
					else if (d.source.isPlayerPosition || d.target.isPlayerPosition) {
						return "#4CAF50"; // Green for player position connections
					}
					// Other links
					else {
						return "#BDBDBD"; // Lighter gray for other visible connections
					}
				})
				.attr("stroke-width", (d) => {
					// Player's links are thicker
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return 3;
					}
					// Player position links
					else if (d.source.isPlayerPosition || d.target.isPlayerPosition) {
						return 3;
					}
					// Other links (AI, etc)
					else {
						return 1.5;
					}
				})
				.attr("stroke-opacity", (d) => {
					// Player's links more opaque
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return 0.9;
					}
					// AI links less opaque
					else {
						return 0.6;
					}
				})
				.attr("stroke-dasharray", (d) => {
					// Player's links solid
					if (d.source.ownedByPlayer && d.target.ownedByPlayer) {
						return null;
					}
					// AI links dashed
					else if (d.source.aiControlled && d.target.aiControlled) {
						return "3,3";
					} else {
						return null;
					}
				});

			// Create node groups
			const nodeGroups = container
				.selectAll("g.node")
				.data(visibleNodes) // Use filtered nodes
				.enter()
				.append("g")
				.attr("transform", (d) => `translate(${d.x},${d.y})`)
				.attr("class", "node")
				.style("cursor", "pointer")
				.on("click", (_event, d) => onNodeClick(d.id));

			// Add shadows for 3D effect
			nodeGroups
				.append("circle")
				.attr("r", (d) => (d.isPlayerPosition ? 15 : 12))
				.attr("fill", "rgba(0,0,0,0.2)")
				.attr("cx", 2)
				.attr("cy", 2);

			// Add circles for nodes
			nodeGroups
				.append("circle")
				.attr("r", (d) => (d.isPlayerPosition ? 15 : 12))
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
				.style("font-size", (d) => (d.isPlayerPosition ? "12px" : "10px"))
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
				return `Level: ${d.level}\nStatus: ${status}\nID: ${nodeId}\nMoney: $${d.money}`;
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
			if (!svgRef.current) return;
			const svg = d3.select(svgRef.current);
			const zoomBehavior = d3.zoom<SVGSVGElement, unknown>();
			svg.transition().call(zoomBehavior.scaleBy, 1.3);
		}, []);

		const handleZoomOut = useCallback(() => {
			if (!svgRef.current) return;
			const svg = d3.select(svgRef.current);
			const zoomBehavior = d3.zoom<SVGSVGElement, unknown>();
			svg.transition().call(zoomBehavior.scaleBy, 0.7);
		}, []);

		const handleResetZoom = useCallback(() => {
			if (!svgRef.current) return;
			const svg = d3.select(svgRef.current);
			const zoomBehavior = d3.zoom<SVGSVGElement, unknown>();
			svg.transition().call(zoomBehavior.transform, d3.zoomIdentity);
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
					<div>
						Potential Recruits:{" "}
						{pyramid.nodes.filter((n) => n.isPotentialRecruit).length}
					</div>
					<div>Levels: {Math.max(...pyramid.nodes.map((n) => n.level))}</div>
				</StatsOverlay>
				<ZoomControls>
					<ZoomButton onClick={handleZoomIn} title="Zoom In">
						+
					</ZoomButton>
					<ZoomButton onClick={handleZoomOut} title="Zoom Out">
						−
					</ZoomButton>
					<ZoomButton onClick={handleResetZoom} title="Reset Zoom">
						⟲
					</ZoomButton>
				</ZoomControls>
				<svg ref={svgRef} width="100%" height="100%" />
			</GraphContainer>
		);
	},
);

export default PyramidGraph;
