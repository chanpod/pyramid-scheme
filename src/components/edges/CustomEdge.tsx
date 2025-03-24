import { memo } from "react";
import type { EdgeProps } from "reactflow";
import { getSmoothStepPath, getBezierPath } from "reactflow";
import type { PyramidNode } from "../../types";

type CustomEdgeData = {
	sourceNode?: PyramidNode;
	targetNode?: PyramidNode;
};

export const CustomEdge = memo(
	({
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		data,
	}: EdgeProps<CustomEdgeData>) => {
		const sourceNode = data?.sourceNode;
		const targetNode = data?.targetNode;

		if (!sourceNode || !targetNode) {
			// Fall back to default edge style if node data is missing
			const [edgePath] = getBezierPath({
				sourceX,
				sourceY,
				sourcePosition,
				targetX,
				targetY,
				targetPosition,
			});

			return (
				<path
					id={id}
					d={edgePath}
					stroke="#BDBDBD"
					strokeWidth={1.5}
					strokeOpacity={0.6}
					fill="none"
				/>
			);
		}

		// Determine edge color based on node ownership
		const getEdgeColor = (): string => {
			// Player's links are more prominent
			if (sourceNode.ownedByPlayer && targetNode.ownedByPlayer) {
				return "#2196F3"; // Bold blue for player connections
			}

			// AI links should use the same color as the node for consistency
			if (sourceNode.aiControlled && targetNode.aiControlled) {
				// Check if they have the same owner (belong to same network)
				const sourceOwner = sourceNode.name?.replace(/'s Recruit$/, "");
				const targetOwner = targetNode.name?.replace(/'s Recruit$/, "");

				if (sourceOwner === targetOwner) {
					// Get consistent color hash (simplified version of what's in CustomNode)
					let hashSum = 0;
					if (sourceOwner) {
						for (let i = 0; i < sourceOwner.length; i++) {
							hashSum += sourceOwner.charCodeAt(i);
						}
					}

					// Colors array must match the one in CustomNode.tsx
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
					return networkColors[hashSum % networkColors.length];
				} else {
					// Different AI networks - use a neutral color
					return "#9C27B0"; // Default purple for non-matched AI connections
				}
			}

			if (
				(sourceNode.ownedByPlayer && targetNode.aiControlled) ||
				(sourceNode.aiControlled && targetNode.ownedByPlayer)
			) {
				return "#FF5722"; // Orange for contested connections
			}

			if (sourceNode.isPlayerPosition || targetNode.isPlayerPosition) {
				return "#4CAF50"; // Green for player position connections
			}

			return "#BDBDBD"; // Lighter gray for other visible connections
		};

		// Determine edge width
		const getEdgeWidth = (): number => {
			// Player's links are thicker
			if (sourceNode.ownedByPlayer && targetNode.ownedByPlayer) {
				return 2.5;
			}

			if (sourceNode.isPlayerPosition || targetNode.isPlayerPosition) {
				return 2.5;
			}

			// Same AI network connections slightly thicker
			if (sourceNode.aiControlled && targetNode.aiControlled) {
				const sourceOwner = sourceNode.name?.replace(/'s Recruit$/, "");
				const targetOwner = targetNode.name?.replace(/'s Recruit$/, "");

				if (sourceOwner === targetOwner) {
					return 2;
				}
			}

			return 1.5;
		};

		// Determine edge opacity
		const getEdgeOpacity = (): number => {
			// Player's links more opaque
			if (sourceNode.ownedByPlayer && targetNode.ownedByPlayer) {
				return 0.9;
			}

			// Same AI network connections slightly more opaque
			if (sourceNode.aiControlled && targetNode.aiControlled) {
				const sourceOwner = sourceNode.name?.replace(/'s Recruit$/, "");
				const targetOwner = targetNode.name?.replace(/'s Recruit$/, "");

				if (sourceOwner === targetOwner) {
					return 0.8;
				}
			}

			return 0.6;
		};

		// Determine dash pattern
		const getDashArray = (): string | undefined => {
			// Player's links solid
			if (sourceNode.ownedByPlayer && targetNode.ownedByPlayer) {
				return undefined;
			}

			// Same AI network connections solid
			if (sourceNode.aiControlled && targetNode.aiControlled) {
				const sourceOwner = sourceNode.name?.replace(/'s Recruit$/, "");
				const targetOwner = targetNode.name?.replace(/'s Recruit$/, "");

				if (sourceOwner === targetOwner) {
					return undefined;
				}

				return "5,3"; // Different AI networks have dashed lines
			}

			return undefined;
		};

		// Get curved path between nodes
		const [edgePath] = getSmoothStepPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
			borderRadius: 12,
			curvature: 0.3,
		});

		const color = getEdgeColor();
		const width = getEdgeWidth();
		const opacity = getEdgeOpacity();
		const dashArray = getDashArray();

		return (
			<path
				id={id}
				d={edgePath}
				stroke={color}
				strokeWidth={width}
				strokeOpacity={opacity}
				strokeDasharray={dashArray}
				fill="none"
			/>
		);
	},
);

export default CustomEdge;
