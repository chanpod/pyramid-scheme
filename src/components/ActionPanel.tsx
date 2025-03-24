import React from "react";
import styled from "styled-components";
import { GameAction, PlayerStats } from "../types";

// Define constants here to match the ones in useGameState.ts
const ENERGY_COST = 800;
const MAX_ENERGY = 20;

interface ActionPanelProps {
	dispatch: React.Dispatch<GameAction>;
	playerStats: PlayerStats;
	gameDay: number;
	gameHour: number;
	pendingRecruits: { nodeId: string; chance: number }[];
}

const PanelContainer = styled.div`
	background-color: #fff;
	border-radius: 8px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	padding: 20px;
	margin-bottom: 20px;
	min-height: 500px; /* Set minimum height to prevent UI jumping */
`;

const ActionButton = styled.button<{ disabled?: boolean; primary?: boolean }>`
	background-color: ${(props) => {
		if (props.disabled) return "#e0e0e0";
		if (props.primary) return "#2196F3";
		return "#f5f5f5";
	}};
	color: ${(props) => {
		if (props.disabled) return "#999";
		if (props.primary) return "white";
		return "#333";
	}};
	border: ${(props) => (props.primary ? "none" : "1px solid #ddd")};
	border-radius: 4px;
	padding: 10px 15px;
	font-weight: bold;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	margin-right: 10px;
	margin-bottom: 10px;
	transition: all 0.2s;
	display: flex;
	align-items: center;
	justify-content: center;
	
	&:hover {
		background-color: ${(props) => {
			if (props.disabled) return "#e0e0e0";
			if (props.primary) return "#1976D2";
			return "#e8f4fd";
		}};
		transform: ${(props) => (props.disabled ? "none" : "translateY(-2px)")};
		box-shadow: ${(props) => (props.disabled ? "none" : "0 4px 8px rgba(0, 0, 0, 0.1)")};
	}
`;

const ActionIcon = styled.span`
	margin-right: 8px;
	font-size: 16px;
`;

const StatusTag = styled.span<{ isAffordable?: boolean }>`
	background-color: ${(props) => (props.isAffordable ? "#e8f5e9" : "#ffebee")};
	color: ${(props) => (props.isAffordable ? "#388e3c" : "#d32f2f")};
	border-radius: 3px;
	padding: 2px 6px;
	font-size: 11px;
	margin-left: 5px;
`;

const Title = styled.h2`
	margin-top: 0;
	margin-bottom: 15px;
	color: #333;
	font-size: 24px;
`;

const TimeDisplay = styled.div`
	background-color: #f0f8ff;
	border-radius: 4px;
	padding: 12px;
	margin-bottom: 15px;
	text-align: center;
	font-weight: bold;
	font-size: 16px;
`;

const RestingMessage = styled.div`
	background-color: #fff8e1;
	border-left: 4px solid #ffc107;
	padding: 15px;
	margin-bottom: 20px;
	font-weight: bold;
	color: #ff6f00;
`;

const PendingRecruitsInfo = styled.div`
	background-color: #e8f5e9;
	border-radius: 4px;
	padding: 12px;
	margin-top: 15px;
	margin-bottom: 15px;
`;

const Section = styled.div`
	margin-bottom: 20px;
`;

const PendingRecruitItem = styled.div`
	padding: 8px 12px;
	background-color: #f0f8ff;
	border-radius: 4px;
	margin-bottom: 6px;
	font-size: 14px;
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

const ChanceIndicator = styled.div<{ chance: number }>`
	width: 60px;
	height: 6px;
	background-color: #e0e0e0;
	border-radius: 3px;
	overflow: hidden;
	position: relative;
	margin-left: 8px;
	
	&::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: ${(props) => props.chance}%;
		background-color: ${(props) => {
			if (props.chance > 75) return "#4CAF50"; // green
			if (props.chance > 50) return "#8BC34A"; // light green
			if (props.chance > 25) return "#FFC107"; // amber
			return "#F44336"; // red
		}};
	}
`;

const ChanceLabel = styled.span`
	font-weight: bold;
	margin-left: 8px;
	color: #555;
`;

const GameActionCard = styled.div`
	background-color: #f5f5f5;
	border-radius: 8px;
	padding: 15px;
	margin-bottom: 15px;
	transition: all 0.2s;
	cursor: pointer;
	
	&:hover {
		background-color: #e8f4fd;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}
`;

const GameActionTitle = styled.h4`
	margin-top: 0;
	margin-bottom: 8px;
	color: #333;
	display: flex;
	align-items: center;
`;

const GameActionDescription = styled.p`
	margin: 0;
	color: #666;
	font-size: 14px;
`;

const GameActionCost = styled.div`
	display: flex;
	align-items: center;
	margin-top: 10px;
	color: #555;
	font-size: 13px;
	font-weight: bold;
`;

const InfoTitle = styled.h3`
	margin-top: 0;
	margin-bottom: 10px;
	color: #333;
	font-size: 18px;
`;

const ActionPanel: React.FC<ActionPanelProps> = ({
	dispatch,
	playerStats,
	gameDay,
	gameHour,
	pendingRecruits,
}) => {
	// Format the recruitment chance as a percentage
	const formatChance = (chance: number) => {
		return `${Math.floor(chance * 100)}%`;
	};

	// Format time for display (12-hour format with AM/PM)
	const formatTime = (hour: number) => {
		const period = hour >= 12 ? "PM" : "AM";
		const displayHour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
		return `${displayHour}:00 ${period}`;
	};

	// Handle collect money action
	const handleCollectMoney = () => {
		if (playerStats.energy >= 1) {
			dispatch({ type: "COLLECT_MONEY" });
		}
	};

	// Handle short rest action
	const handleShortRest = () => {
		dispatch({ type: "REST", hours: 8 });
	};

	// Handle long rest action
	const handleLongRest = () => {
		dispatch({ type: "REST", hours: 16 });
	};

	return (
		<PanelContainer>
			<Title>Game Actions</Title>
			<TimeDisplay>
				Day {gameDay} - {formatTime(gameHour)}
				{playerStats.isResting && " (Resting)"}
			</TimeDisplay>

			{playerStats.isResting && (
				<RestingMessage>
					You are currently resting. Your actions are limited until you finish
					resting.
				</RestingMessage>
			)}

			<Section>
				<GameActionCard onClick={handleCollectMoney}>
					<GameActionTitle>
						<ActionIcon>💰</ActionIcon> Network Activation
					</GameActionTitle>
					<GameActionDescription>
						Activate your network to generate money from your downline.
					</GameActionDescription>
					<GameActionCost>
						<span>Cost: 1 Energy</span>
						{playerStats.energy < 1 && (
							<StatusTag isAffordable={false}>No Energy</StatusTag>
						)}
					</GameActionCost>
				</GameActionCard>

				<GameActionCard onClick={handleShortRest}>
					<GameActionTitle>
						<ActionIcon>🛌</ActionIcon> Power Nap
					</GameActionTitle>
					<GameActionDescription>
						Take a short rest to recover some energy. Time will advance by 8
						hours.
					</GameActionDescription>
					<GameActionCost>
						<span>Gain: ~5-8 Energy</span>
					</GameActionCost>
				</GameActionCard>

				<GameActionCard onClick={handleLongRest}>
					<GameActionTitle>
						<ActionIcon>😴</ActionIcon> Deep Rest
					</GameActionTitle>
					<GameActionDescription>
						Take a longer rest to recover more energy. Time will advance by 16
						hours.
					</GameActionDescription>
					<GameActionCost>
						<span>Gain: ~12-16 Energy</span>
					</GameActionCost>
				</GameActionCard>
			</Section>

			{pendingRecruits.length > 0 && (
				<PendingRecruitsInfo>
					<InfoTitle>Pending Recruitment Attempts</InfoTitle>
					{pendingRecruits.map((recruit) => (
						<PendingRecruitItem key={recruit.nodeId}>
							<span>Node {recruit.nodeId.split("-")[1]}</span>
							<div style={{ display: "flex", alignItems: "center" }}>
								<ChanceIndicator chance={recruit.chance * 100} />
								<ChanceLabel>{formatChance(recruit.chance)}</ChanceLabel>
							</div>
						</PendingRecruitItem>
					))}
				</PendingRecruitsInfo>
			)}
		</PanelContainer>
	);
};

export default ActionPanel;
