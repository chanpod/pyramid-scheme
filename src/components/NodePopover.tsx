import React from "react";
import styled from "styled-components";
import { PyramidNode } from "../types";

interface NodePopoverProps {
	node: PyramidNode;
	position: { x: number; y: number };
	onClose: () => void;
	canMoveUp?: boolean;
	canRecruit?: boolean;
	playerStats?: any;
	dispatch?: any;
}

const PopoverContainer = styled.div<{ x: number; y: number }>`
  position: absolute;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y - 30}px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 15px;
  width: 280px;
  z-index: 10;
  transform: translate(-50%, -100%);
  
  &::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid white;
  }
`;

const PopoverHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
`;

const PopoverTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-size: 18px;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: #333;
  }
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
`;

const Label = styled.span`
  color: #666;
`;

const Value = styled.span`
  color: #333;
  font-weight: 500;
`;

const ActionButton = styled.button<{ primary?: boolean; disabled?: boolean }>`
  background-color: ${(props) =>
		props.disabled ? "#e0e0e0" : props.primary ? "#2196F3" : "#f5f5f5"};
  color: ${(props) =>
		props.disabled ? "#999" : props.primary ? "white" : "#333"};
  border: ${(props) => (props.primary ? "none" : "1px solid #ddd")};
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 10px;
  width: 100%;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${(props) =>
			props.disabled ? "#e0e0e0" : props.primary ? "#1976D2" : "#e8f4fd"};
    transform: ${(props) => (props.disabled ? "none" : "translateY(-2px)")};
    box-shadow: ${(props) => (props.disabled ? "none" : "0 4px 8px rgba(0, 0, 0, 0.1)")};
  }
`;

const ActionIcon = styled.span`
  margin-right: 8px;
  font-size: 16px;
`;

const StatusTag = styled.span<{ isPositive?: boolean }>`
  background-color: ${(props) => (props.isPositive ? "#e8f5e9" : "#ffebee")};
  color: ${(props) => (props.isPositive ? "#388e3c" : "#d32f2f")};
  border-radius: 3px;
  padding: 3px 6px;
  font-size: 11px;
  margin-left: 5px;
`;

const NodePopover: React.FC<NodePopoverProps> = ({
	node,
	position,
	onClose,
	canMoveUp,
	canRecruit,
	playerStats,
	dispatch,
}) => {
	// Generate node title based on node properties
	const getNodeTitle = () => {
		if (node.isPlayerPosition) return "Your Position";
		if (node.ownedByPlayer) return "Your Network Member";
		if (node.aiControlled) return "Competitor's Member";
		return "Potential Recruit";
	};

	// Calculate required recruits to move up
	const requiredRecruits = canMoveUp ? 7 - node.level : 0;

	// Check if player can afford to recruit
	const canAffordRecruit = playerStats && playerStats.money >= 60;

	// Check if player has enough energy
	const hasEnergyToRecruit = playerStats && playerStats.energy >= 1;
	const hasEnergyToMoveUp = playerStats && playerStats.energy >= 10;

	// Check if player has enough recruits to move up
	const hasEnoughRecruits =
		playerStats && playerStats.recruits >= requiredRecruits;

	// Handle recruitment action
	const handleRecruit = () => {
		if (
			dispatch &&
			node &&
			canRecruit &&
			hasEnergyToRecruit &&
			canAffordRecruit
		) {
			dispatch({
				type: "RECRUIT",
				targetNodeId: node.id,
			});
			onClose();
		}
	};

	// Handle move up action
	const handleMoveUp = () => {
		if (
			dispatch &&
			node &&
			canMoveUp &&
			hasEnoughRecruits &&
			hasEnergyToMoveUp
		) {
			dispatch({
				type: "MOVE_UP",
				targetNodeId: node.id,
			});
			onClose();
		}
	};

	return (
		<PopoverContainer x={position.x} y={position.y}>
			<PopoverHeader>
				<PopoverTitle>{getNodeTitle()}</PopoverTitle>
				<CloseButton onClick={onClose}>×</CloseButton>
			</PopoverHeader>

			<InfoRow>
				<Label>Level:</Label>
				<Value>{node.level}</Value>
			</InfoRow>

			<InfoRow>
				<Label>Recruits:</Label>
				<Value>{node.recruits}</Value>
			</InfoRow>

			<InfoRow>
				<Label>Money:</Label>
				<Value>${node.money}</Value>
			</InfoRow>

			<InfoRow>
				<Label>Status:</Label>
				<Value>
					{node.ownedByPlayer
						? "Owned by You"
						: node.aiControlled
							? "Owned by Another Player"
							: "Not Owned"}
				</Value>
			</InfoRow>

			{/* Actions based on node state */}
			{canRecruit && !node.ownedByPlayer && !node.aiControlled && dispatch && (
				<ActionButton
					primary
					disabled={!hasEnergyToRecruit || !canAffordRecruit}
					onClick={handleRecruit}
				>
					<ActionIcon>👥</ActionIcon> Recruit This Person
					{!hasEnergyToRecruit && (
						<StatusTag isPositive={false}>No Energy</StatusTag>
					)}
					{!canAffordRecruit && (
						<StatusTag isPositive={false}>Need $60</StatusTag>
					)}
				</ActionButton>
			)}

			{canMoveUp && dispatch && (
				<ActionButton
					primary
					disabled={!hasEnoughRecruits || !hasEnergyToMoveUp}
					onClick={handleMoveUp}
				>
					<ActionIcon>⬆️</ActionIcon> Move Up Here
					{!hasEnoughRecruits && (
						<StatusTag isPositive={false}>
							Need {requiredRecruits} Recruits
						</StatusTag>
					)}
					{!hasEnergyToMoveUp && (
						<StatusTag isPositive={false}>Need 10 Energy</StatusTag>
					)}
				</ActionButton>
			)}
		</PopoverContainer>
	);
};

export default NodePopover;
