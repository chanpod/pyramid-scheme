import React from "react";
import styled from "styled-components";
import { GameAction, PyramidNode, PlayerStats } from "../types";

// Define constants here to match the ones in useGameState.ts
const ENERGY_COST = 800;
const MAX_ENERGY = 20;
const MONEY_RECRUITMENT_FACTOR = 0.0001; // How much money affects recruitment (0.0001 = +1% per $100)
const BASE_RECRUITMENT_CHANCE = 0.08; // Base recruitment success chance (8%)

interface ActionPanelProps {
	dispatch: React.Dispatch<GameAction>;
	selectedNodeId: string | null;
	playerNode: PyramidNode | null;
	selectedNode: PyramidNode | null;
	playerStats: PlayerStats;
	canMoveUp: boolean;
	canRecruit: boolean;
	nodesAbove: PyramidNode[];
	nodesBelow: PyramidNode[];
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

const ActionButton = styled.button<{ disabled?: boolean }>`
	background-color: ${(props) => (props.disabled ? "#e0e0e0" : "#2196F3")};
	color: ${(props) => (props.disabled ? "#999" : "white")};
	border: none;
	border-radius: 4px;
	padding: 10px 15px;
	font-weight: bold;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	margin-right: 10px;
	margin-bottom: 10px;
	transition: background-color 0.2s;
	
	&:hover {
		background-color: ${(props) => (props.disabled ? "#e0e0e0" : "#1976D2")};
	}
`;

// More compact button style for upgrades
const UpgradeButton = styled.button<{ disabled?: boolean }>`
	background-color: ${(props) => (props.disabled ? "#f0f0f0" : "#f5f5f5")};
	color: ${(props) => (props.disabled ? "#aaa" : "#333")};
	border: 1px solid ${(props) => (props.disabled ? "#e0e0e0" : "#ddd")};
	border-radius: 4px;
	padding: 8px 12px;
	font-size: 13px;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	margin-bottom: 8px;
	transition: all 0.2s;
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
	
	&:hover {
		background-color: ${(props) => (props.disabled ? "#f0f0f0" : "#e8f4fd")};
		border-color: ${(props) => (props.disabled ? "#e0e0e0" : "#2196F3")};
	}
`;

const ButtonLabel = styled.span`
	font-weight: bold;
`;

const ButtonCost = styled.span`
	color: #666;
	font-size: 12px;
`;

const StatusTag = styled.span<{ isAffordable?: boolean }>`
	background-color: ${(props) => (props.isAffordable ? "#e8f5e9" : "#ffebee")};
	color: ${(props) => (props.isAffordable ? "#388e3c" : "#d32f2f")};
	border-radius: 3px;
	padding: 2px 6px;
	font-size: 11px;
	margin-left: 5px;
`;

const ActionGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 10px;
	margin-bottom: 20px;
`;

const UpgradeGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 10px;
	margin-bottom: 20px;
`;

const Title = styled.h2`
	margin-top: 0;
	margin-bottom: 15px;
	color: #333;
	font-size: 24px;
`;

const NodeInfo = styled.div`
	background-color: #f5f5f5;
	border-radius: 4px;
	padding: 15px;
	margin-bottom: 20px;
`;

const InfoTitle = styled.h3`
	margin-top: 0;
	margin-bottom: 10px;
	color: #333;
	font-size: 18px;
`;

const InfoText = styled.p`
	margin: 5px 0;
	color: #555;
`;

const SubTitle = styled.h3`
	margin-top: 20px;
	margin-bottom: 10px;
	color: #333;
	font-size: 18px;
	display: flex;
	align-items: center;
	
	&::after {
		content: '';
		flex: 1;
		height: 1px;
		background-color: #eee;
		margin-left: 10px;
	}
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

const ActionPanel: React.FC<ActionPanelProps> = ({
	dispatch,
	selectedNodeId,
	playerNode,
	selectedNode,
	playerStats,
	canMoveUp,
	canRecruit,
	nodesAbove,
	nodesBelow,
	gameDay,
	gameHour,
	pendingRecruits,
}) => {
	// Calculate required recruits to move up
	const requiredRecruits =
		selectedNode && canMoveUp ? 7 - selectedNode.level : 0;

	// Calculate recruitment chance based on player stats for display purposes
	const calculateRecruitmentChance = () => {
		if (!selectedNode || !canRecruit) return 0;

		// Recruiting power has the strongest effect
		let baseChance =
			BASE_RECRUITMENT_CHANCE + playerStats.recruitingPower * 0.06;
		// Charisma no longer affects recruitment success
		// Money provides a small boost
		baseChance += playerStats.money * MONEY_RECRUITMENT_FACTOR;
		// Add small base bonus
		baseChance += 0.05;

		// Cap at 90%
		return Math.min(baseChance * 100, 90);
	};

	const recruitmentChance = calculateRecruitmentChance();

	// Format time for display (12-hour format with AM/PM)
	const formatTime = (hour: number) => {
		const period = hour >= 12 ? "PM" : "AM";
		const displayHour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
		return `${displayHour}:00 ${period}`;
	};

	return (
		<PanelContainer>
			<Title>Actions</Title>

			<TimeDisplay>
				Day {gameDay} - {formatTime(gameHour)}
			</TimeDisplay>

			{playerStats.isResting && (
				<RestingMessage>
					You are resting. You will be able to take actions when you wake up.
				</RestingMessage>
			)}

			{pendingRecruits.length > 0 && (
				<PendingRecruitsInfo>
					<InfoTitle>Pending Recruits</InfoTitle>
					<InfoText>
						You have {pendingRecruits.length} recruitment attempts in progress.
					</InfoText>
					<InfoText>Results will be available at the end of the day.</InfoText>

					{/* Display each pending recruit with chance */}
					<div style={{ marginTop: "10px" }}>
						{pendingRecruits.map((recruit, index) => (
							<PendingRecruitItem key={index}>
								<span>Node #{recruit.nodeId.substring(0, 6)}</span>
								<div style={{ display: "flex", alignItems: "center" }}>
									<ChanceIndicator chance={recruit.chance * 100} />
									<ChanceLabel>{Math.round(recruit.chance * 100)}%</ChanceLabel>
								</div>
							</PendingRecruitItem>
						))}
					</div>
				</PendingRecruitsInfo>
			)}

			{!playerStats.isResting &&
				selectedNode &&
				selectedNode.id !== playerNode?.id && (
					<NodeInfo>
						<InfoTitle>Selected Node Info</InfoTitle>
						<InfoText>Level: {selectedNode.level}</InfoText>
						<InfoText>Recruits: {selectedNode.recruits}</InfoText>
						<InfoText>Money: ${selectedNode.money}</InfoText>
						<InfoText>
							Status: {selectedNode.ownedByPlayer ? "Owned" : "Not Owned"}
						</InfoText>

						{canMoveUp && (
							<>
								<InfoText>
									Required Recruits to Move Up: {requiredRecruits}
								</InfoText>
								<ActionButton
									disabled={
										playerStats.recruits < requiredRecruits ||
										playerStats.energy < 3
									}
									onClick={() =>
										dispatch({ type: "MOVE_UP", targetNodeId: selectedNode.id })
									}
								>
									Move Up (3 Energy)
								</ActionButton>
							</>
						)}

						{canRecruit && !selectedNode.ownedByPlayer && (
							<>
								<InfoText>
									Recruitment Chance:{" "}
									<strong
										style={{
											color:
												recruitmentChance > 75
													? "#4CAF50"
													: recruitmentChance > 50
														? "#8BC34A"
														: recruitmentChance > 25
															? "#FFC107"
															: "#F44336",
											fontSize: "16px",
										}}
									>
										{Math.round(recruitmentChance)}%
									</strong>
									<ChanceIndicator
										chance={recruitmentChance}
										style={{
											display: "inline-block",
											width: "100px",
											marginLeft: "10px",
											verticalAlign: "middle",
										}}
									/>
								</InfoText>
								<InfoText
									style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}
								>
									Based on:
									<span style={{ color: "#1976D2", fontWeight: "bold" }}>
										{" "}
										Recruiting Power ({playerStats.recruitingPower}×6%)
									</span>
									,
									<span style={{ color: "#FF9800", fontWeight: "bold" }}>
										{" "}
										Money (${playerStats.money}×
										{MONEY_RECRUITMENT_FACTOR.toFixed(4)})
									</span>
									<span style={{ color: "#555", fontWeight: "normal" }}>
										{" "}
										+ {BASE_RECRUITMENT_CHANCE * 100}% base + 5% bonus
									</span>
								</InfoText>
								<InfoText
									style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}
								>
									<strong>Tip:</strong> Recruiting Power affects success rate,
									Charisma only helps generate new potential recruits
								</InfoText>
								<ActionButton
									disabled={playerStats.energy < 2}
									onClick={() =>
										dispatch({ type: "RECRUIT", targetNodeId: selectedNode.id })
									}
								>
									Recruit (2 Energy)
								</ActionButton>
							</>
						)}
					</NodeInfo>
				)}

			<Section>
				<SubTitle>General Actions</SubTitle>
				<ActionGrid>
					<ActionButton
						disabled={playerStats.isResting || playerStats.energy < 1}
						onClick={() => dispatch({ type: "COLLECT_MONEY" })}
					>
						Collect Money (1 Energy)
					</ActionButton>

					<ActionButton
						disabled={playerStats.isResting}
						onClick={() => dispatch({ type: "REST", hours: 8 })}
					>
						Short Rest (8 Hours)
					</ActionButton>

					<ActionButton
						disabled={playerStats.isResting}
						onClick={() => dispatch({ type: "REST", hours: 16 })}
					>
						Long Rest (16 Hours)
					</ActionButton>
				</ActionGrid>
			</Section>

			<Section>
				<div style={{ textAlign: "right", marginTop: "10px" }}>
					<ActionButton
						onClick={() => dispatch({ type: "RESET_GAME" })}
						style={{ backgroundColor: "#f44336", marginRight: 0 }}
					>
						Reset Game
					</ActionButton>
				</div>
			</Section>
		</PanelContainer>
	);
};

export default ActionPanel;
