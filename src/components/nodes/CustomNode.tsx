import { memo } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import styled from "styled-components";
import type { PyramidNode } from "../../types";

type CustomNodeData = PyramidNode & {
	isSelected: boolean;
	onClick: () => void;
};

const NodeContainer = styled.div<{ isPlayer: boolean; isSelected: boolean }>`
  position: relative;
  text-align: center;
  width: ${(props) => (props.isPlayer ? "36px" : "28px")};
  height: ${(props) => (props.isPlayer ? "36px" : "28px")};
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
`;

const NodeShadow = styled.div<{ isPlayer: boolean }>`
  position: absolute;
  width: ${(props) => (props.isPlayer ? "36px" : "28px")};
  height: ${(props) => (props.isPlayer ? "36px" : "28px")};
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.2);
  top: 2px;
  left: 2px;
  z-index: 1;
`;

const NodeCircle = styled.div<{
	color: string;
	isPlayer: boolean;
	isSelected: boolean;
}>`
  position: relative;
  width: ${(props) => (props.isPlayer ? "36px" : "28px")};
  height: ${(props) => (props.isPlayer ? "36px" : "28px")};
  border-radius: 50%;
  background-color: ${(props) => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: ${(props) => (props.isSelected ? "0 0 0 3px #FF5722" : "none")};
`;

const NodeLabel = styled.div<{ isPlayer: boolean }>`
  color: white;
  font-weight: bold;
  font-size: ${(props) => (props.isPlayer ? "14px" : "12px")};
  user-select: none;
`;

const MoneyPill = styled.div`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid #aaa;
  border-radius: 8px;
  padding: 2px 8px;
  margin-top: 4px;
  font-size: 11px;
  font-weight: bold;
  z-index: 3;
  white-space: nowrap;
`;

export const CustomNode = memo(({ data }: NodeProps<CustomNodeData>) => {
	// Determine node color based on status
	const getNodeColor = (): string => {
		if (data.isPlayerPosition) return "#4CAF50"; // Player's position (green)
		if (data.ownedByPlayer) return "#2196F3"; // Owned by player (blue)
		if (data.aiControlled) return "#9C27B0"; // AI controlled (purple)
		return "#B0BEC5"; // Neutral node (light gray)
	};

	// Format node label
	const getNodeLabel = (): string => {
		if (data.isPlayerPosition) return "YOU";
		if (data.name) return data.name;
		return data.level.toString();
	};

	// Format money display
	const getMoneyDisplay = (): string => {
		if (data.money >= 1000) {
			return `$${(data.money / 1000).toFixed(1)}K`;
		}
		return `$${data.money}`;
	};

	const isPlayer = data.isPlayerPosition;
	const color = getNodeColor();

	return (
		<NodeContainer
			isPlayer={isPlayer}
			isSelected={data.isSelected}
			onClick={data.onClick}
			title={`Level: ${data.level}\nStatus: ${
				isPlayer
					? "You"
					: data.ownedByPlayer
						? "Owned by You"
						: data.aiControlled
							? "AI Controlled"
							: "Unowned Node"
			}\nID: ${data.id.substring(0, 6)}\nMoney: $${data.money.toLocaleString()}`}
		>
			{/* Input and output connection points - reversed for proper pyramid flow */}
			<Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
			<Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />

			{/* Node shadow for 3D effect */}
			<NodeShadow isPlayer={isPlayer} />

			{/* Main node circle */}
			<NodeCircle
				color={color}
				isPlayer={isPlayer}
				isSelected={data.isSelected}
			>
				<NodeLabel isPlayer={isPlayer}>{getNodeLabel()}</NodeLabel>
			</NodeCircle>

			{/* Money indicator for non-zero amounts */}
			{data.money > 0 && (
				<MoneyPill style={{ color: data.money >= 1000 ? "#2E7D32" : "#333" }}>
					{getMoneyDisplay()}
				</MoneyPill>
			)}
		</NodeContainer>
	);
});

export default CustomNode;
