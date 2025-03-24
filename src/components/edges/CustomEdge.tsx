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

			if (sourceNode.aiControlled && targetNode.aiControlled) {
				return "#9C27B0"; // Purple for AI connections
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
				return 3;
			}

			if (sourceNode.isPlayerPosition || targetNode.isPlayerPosition) {
				return 3;
			}

			return 1.5;
		};

		// Determine edge opacity
		const getEdgeOpacity = (): number => {
			// Player's links more opaque
			if (sourceNode.ownedByPlayer && targetNode.ownedByPlayer) {
				return 0.9;
			}

			return 0.6;
		};

		// Determine dash pattern
		const getDashArray = (): string | undefined => {
			// Player's links solid
			if (sourceNode.ownedByPlayer && targetNode.ownedByPlayer) {
				return undefined;
			}

			if (sourceNode.aiControlled && targetNode.aiControlled) {
				return "5,3";
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
