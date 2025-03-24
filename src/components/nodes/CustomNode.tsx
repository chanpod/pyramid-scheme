import { memo, useMemo } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import styled from "styled-components";
import type { PyramidNode } from "../../types";

type CustomNodeData = PyramidNode & {
	isSelected: boolean;
	onClick: () => void;
};

// Network colors for different AI competitors
const NETWORK_COLORS = [
	"#9C27B0", // Purple (default)
	"#E91E63", // Pink
	"#FF5722", // Deep Orange
	"#FF9800", // Orange
	"#FFC107", // Amber
	"#8BC34A", // Light Green
	"#009688", // Teal
	"#03A9F4", // Light Blue
	"#673AB7", // Deep Purple
	"#3F51B5", // Indigo
];

// First names for AI competitors
const FIRST_NAMES = [
	"Alex",
	"Jordan",
	"Morgan",
	"Taylor",
	"Casey",
	"Quinn",
	"Riley",
	"Avery",
	"Jamie",
	"Blake",
	"Charlie",
	"Dakota",
	"Emerson",
	"Finley",
	"Hayden",
	"Kai",
];

// Last names for AI competitors
const LAST_NAMES = [
	"Smith",
	"Johnson",
	"Williams",
	"Brown",
	"Jones",
	"Garcia",
	"Miller",
	"Davis",
	"Rodriguez",
	"Martinez",
	"Wilson",
	"Anderson",
	"Thomas",
	"Taylor",
	"Moore",
	"Lee",
];

const NodeContainer = styled.div<{ isPlayer: boolean; isSelected: boolean }>`
	position: relative;
	text-align: center;
	width: ${(props) => (props.isPlayer ? "110px" : "100px")};
	height: ${(props) => (props.isPlayer ? "60px" : "50px")};
	cursor: pointer;
	transition: transform 0.2s;

	&:hover {
		transform: scale(1.05);
	}
`;

const NodeShadow = styled.div<{ isPlayer: boolean }>`
	position: absolute;
	width: ${(props) => (props.isPlayer ? "110px" : "100px")};
	height: ${(props) => (props.isPlayer ? "60px" : "50px")};
	border-radius: 6px;
	background-color: rgba(0, 0, 0, 0.2);
	top: 2px;
	left: 2px;
	z-index: 1;
`;

const NodeRect = styled.div<{
	color: string;
	isPlayer: boolean;
	isSelected: boolean;
}>`
	position: relative;
	width: ${(props) => (props.isPlayer ? "110px" : "100px")};
	height: ${(props) => (props.isPlayer ? "60px" : "50px")};
	border-radius: 6px;
	background-color: ${(props) => props.color};
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	z-index: 2;
	box-shadow: ${(props) => (props.isSelected ? "0 0 0 3px #FF5722" : "none")};
	padding: 3px;
`;

const NodeLabel = styled.div<{ isPlayer: boolean }>`
	color: white;
	font-weight: bold;
	font-size: ${(props) => (props.isPlayer ? "15px" : "13px")};
	user-select: none;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	width: 100%;
	text-align: center;
`;

const NodeInfo = styled.div`
	font-size: 11px;
	color: white;
	user-select: none;
	margin-top: 2px;
`;

const LevelPill = styled.div`
	position: absolute;
	top: -16px;
	right: 0;
	background-color: rgba(0, 0, 0, 0.7);
	color: white;
	border-radius: 9px;
	padding: 1px 5px;
	font-size: 9px;
	font-weight: bold;
	z-index: 3;
`;

const OwnerPill = styled.div`
	position: absolute;
	top: -16px;
	left: 0;
	border-radius: 8px;
	padding: 1px 4px;
	font-size: 9px;
	font-weight: bold;
	z-index: 3;
	white-space: nowrap;
`;

const InventoryPill = styled.div`
	position: absolute;
	bottom: -16px;
	left: 50%;
	transform: translateX(-50%);
	background-color: rgba(255, 255, 255, 0.9);
	border: 1px solid #ddd;
	border-radius: 6px;
	padding: 0px 4px;
	font-size: 9px;
	font-weight: bold;
	z-index: 3;
	white-space: nowrap;
	color: #333;
`;

export const CustomNode = memo(({ data }: NodeProps<CustomNodeData>) => {
	// Generate a consistent color for AI networks based on their name
	const getConsistentAIColor = (): string => {
		if (!data.name) return NETWORK_COLORS[0];

		// Extract network name (remove "'s Recruit" if present)
		const networkName = data.name.replace(/'s Recruit$/, "");

		// Use hash of network name to consistently pick a color
		let hashSum = 0;
		for (let i = 0; i < networkName.length; i++) {
			hashSum += networkName.charCodeAt(i);
		}

		return NETWORK_COLORS[hashSum % NETWORK_COLORS.length];
	};

	// Determine node color based on status
	const getNodeColor = (): string => {
		if (data.isPlayerPosition) return "#4CAF50"; // Player's position (green)
		if (data.ownedByPlayer) return "#2196F3"; // Owned by player (blue)
		if (data.aiControlled) return getConsistentAIColor(); // AI controlled (pick specific color)
		return "#B0BEC5"; // Neutral node (light gray)
	};

	// Get appropriate network name
	const getNetworkName = (): string => {
		if (data.isPlayerPosition) return "YOU";

		if (data.ownedByPlayer) {
			return "Your Network";
		}

		if (data.aiControlled && data.name) {
			// If it already has a name, use it
			return data.name;
		}

		// Generate a consistent name for AI nodes without names
		if (data.aiControlled) {
			// Use node ID to generate a consistent name
			const idSum = data.id
				.split("")
				.reduce((sum, char) => sum + char.charCodeAt(0), 0);
			const firstName = FIRST_NAMES[idSum % FIRST_NAMES.length];
			const lastName = LAST_NAMES[(idSum * 13) % LAST_NAMES.length]; // Use a different seed for last name
			return `${firstName} ${lastName}`;
		}

		return "Unaffiliated";
	};

	// Format node label
	const getNodeLabel = (): string => {
		if (data.isPlayerPosition) return "YOU";

		// For AI controlled nodes that are not recruits
		if (data.aiControlled && !data.name?.includes("'s Recruit")) {
			// Extract the name (should be a human name now)
			return getNetworkName().split(" ")[0]; // Just show first name to save space
		}

		// For recruits, show a minimal label
		if (data.name?.includes("'s Recruit")) {
			return "Recruit";
		}

		// For player's recruits
		if (data.ownedByPlayer) {
			return "Recruit";
		}

		return "Unowned";
	};

	// Format money display
	const getMoneyDisplay = (): string => {
		if (data.money >= 1000) {
			return `$${(data.money / 1000).toFixed(1)}K`;
		}
		return `$${data.money}`;
	};

	// Get inventory information
	const getInventoryDisplay = (): string => {
		if (!data.inventory) return "";

		const totalItems = Object.values(data.inventory).reduce(
			(sum, qty) => sum + qty,
			0,
		);
		if (totalItems === 0) return "";

		return `📦${totalItems}/${data.maxInventory}`;
	};

	const isPlayer = data.isPlayerPosition;
	const color = getNodeColor();
	const networkName = getNetworkName();
	const inventoryInfo = getInventoryDisplay();
	const nodeLabel = getNodeLabel();

	return (
		<NodeContainer
			isPlayer={isPlayer}
			isSelected={data.isSelected}
			onClick={data.onClick}
			title={`${networkName} (Level ${data.level})
Money: $${data.money.toLocaleString()}
Status: ${isPlayer ? "You" : data.ownedByPlayer ? "Your Network" : "AI Controlled"}`}
		>
			{/* Input and output connection points - reversed for proper pyramid flow */}
			<Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
			<Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

			{/* Node shadow for 3D effect */}
			<NodeShadow isPlayer={isPlayer} />

			{/* Level indicator */}
			<LevelPill>L{data.level}</LevelPill>

			{/* Owner indicator for non-player nodes */}
			{!isPlayer && data.aiControlled && (
				<OwnerPill
					style={{
						backgroundColor: color,
						color: "white",
						opacity: 0.9,
					}}
				>
					{
						data.name?.includes("'s Recruit")
							? networkName.split(" ")[0].substring(0, 4)
							: // First name truncated
								networkName
									.split(" ")[0]
									.substring(0, 4) // First name truncated
					}
				</OwnerPill>
			)}

			{/* Main node rectangle */}
			<NodeRect color={color} isPlayer={isPlayer} isSelected={data.isSelected}>
				<NodeLabel isPlayer={isPlayer}>{nodeLabel}</NodeLabel>
				<NodeInfo>{getMoneyDisplay()}</NodeInfo>
			</NodeRect>

			{/* Inventory indicator */}
			{inventoryInfo && <InventoryPill>{inventoryInfo}</InventoryPill>}
		</NodeContainer>
	);
});

export default CustomNode;
