import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
	PlayerStats as PlayerStatsType,
	GameAction,
	PyramidGraph,
} from "../types";
import { getNodesBelow } from "../utils/pyramidGenerator";

// Constants to match the ones in useGameState.ts
const ENERGY_COST = 800;
const MAX_ENERGY = 20;

interface PlayerStatsProps {
	stats: PlayerStatsType;
	lastDailyEnergyBonus: number;
	dispatch: React.Dispatch<GameAction>; // Add dispatch function to handle upgrades
	pyramid: PyramidGraph; // Add pyramid to count potential recruits
	playerNodeId: string | null; // Add player node ID to identify potential recruits
}

const StatsContainer = styled.div`
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
  position: relative;
  min-height: 280px; /* Set minimum height to prevent UI jumping */
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 6px;
  transition: all 0.2s;
  
  &:hover {
    background-color: #f0f0f0;
    transform: translateY(-2px);
  }
`;

const StatLabel = styled.span`
  font-size: 14px;
  color: #666;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StatValue = styled.span`
  font-size: 20px;
  font-weight: bold;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StatBar = styled.div<{ value: number; max: number }>`
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  margin-top: 5px;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${(props) => (props.value / props.max) * 100}%;
    background-color: #4CAF50;
    border-radius: 4px;
  }
`;

const UpgradeButton = styled.button<{ disabled?: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${(props) => (props.disabled ? "#e0e0e0" : "#2196F3")};
  color: white;
  border: none;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  padding: 0;
  margin-left: 8px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background-color: ${(props) => (props.disabled ? "#e0e0e0" : "#1976D2")};
    transform: ${(props) => (props.disabled ? "none" : "scale(1.1)")};
  }
`;

const UpgradeCost = styled.span`
  font-size: 12px;
  color: #666;
  margin-left: 5px;
`;

const Title = styled.h2`
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  font-size: 24px;
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

const PlayerInfo = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px dashed #eee;
`;

const LevelBadge = styled.div`
  background-color: #2196F3;
  color: white;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
  box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
`;

const EnergyBonus = styled.div`
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  position: absolute;
  top: 10px;
  right: 10px;
  font-weight: bold;
  animation: fadeInOut 5s ease-in-out;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-10px); }
    10% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

const StatIcon = styled.span`
  margin-right: 6px;
  font-size: 14px;
  opacity: 0.7;
`;

const Tooltip = styled.div`
  position: relative;
  display: inline-block;
  
  &:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 10;
    margin-bottom: 5px;
  }
`;

const PlayerStatsDisplay: React.FC<PlayerStatsProps> = ({
	stats,
	lastDailyEnergyBonus,
	dispatch,
	pyramid,
	playerNodeId,
}) => {
	const [showEnergyBonus, setShowEnergyBonus] = useState(false);

	// Calculate upgrade costs
	const charismaCost = stats.charisma * 200;
	const recruitingCost = stats.recruitingPower * 250;
	const energyCost = ENERGY_COST;
	const isMaxEnergy = stats.energy >= MAX_ENERGY;

	// Check if player can afford upgrades
	const canAffordCharisma = stats.money >= charismaCost;
	const canAffordRecruiting = stats.money >= recruitingCost;
	const canAffordEnergy = stats.money >= energyCost && !isMaxEnergy;

	// Calculate potential recruits (nodes below the player that are not owned)
	const potentialRecruits = playerNodeId
		? getNodesBelow(pyramid, playerNodeId).filter((node) => !node.ownedByPlayer)
				.length
		: 0;

	// Show energy bonus notification if the bonus was given less than 5 seconds ago
	useEffect(() => {
		if (lastDailyEnergyBonus > 0) {
			const timeSinceBonus = Date.now() - lastDailyEnergyBonus;
			if (timeSinceBonus < 5000) {
				// 5 seconds
				setShowEnergyBonus(true);

				// Hide the notification after 5 seconds
				const timer = setTimeout(() => {
					setShowEnergyBonus(false);
				}, 5000);

				return () => clearTimeout(timer);
			}
		}
	}, [lastDailyEnergyBonus]);

	return (
		<StatsContainer>
			{showEnergyBonus && <EnergyBonus>+3 Energy (Daily Bonus)</EnergyBonus>}

			<Title>Your Stats</Title>
			<PlayerInfo>
				<LevelBadge>{stats.level}</LevelBadge>
				<div style={{ marginLeft: "15px" }}>
					<StatLabel>Current Level</StatLabel>
					<StatValue>Level {stats.level}</StatValue>
				</div>
			</PlayerInfo>

			<StatGrid>
				<StatItem>
					<StatLabel>
						<StatIcon>💰</StatIcon>Money
					</StatLabel>
					<StatValue>${stats.money}</StatValue>
				</StatItem>

				<StatItem>
					<StatLabel>
						<StatIcon>👥</StatIcon>Recruits
					</StatLabel>
					<StatValue>{stats.recruits}</StatValue>
				</StatItem>

				<StatItem>
					<StatLabel>
						<StatIcon>🎯</StatIcon>Potential Recruits
					</StatLabel>
					<StatValue>{potentialRecruits}</StatValue>
				</StatItem>

				<StatItem>
					<StatLabel>
						<div>
							<StatIcon>⚡</StatIcon>Energy
						</div>
						{!isMaxEnergy && (
							<Tooltip data-tooltip={`Upgrade Energy: $${energyCost}`}>
								<UpgradeButton
									disabled={stats.isResting || !canAffordEnergy || isMaxEnergy}
									onClick={() => dispatch({ type: "UPGRADE_ENERGY" })}
								>
									+
								</UpgradeButton>
							</Tooltip>
						)}
					</StatLabel>
					<StatValue>
						<span>
							{stats.energy} / {MAX_ENERGY}
						</span>
						{!canAffordEnergy && !isMaxEnergy && (
							<UpgradeCost>${energyCost}</UpgradeCost>
						)}
					</StatValue>
					<StatBar value={stats.energy} max={MAX_ENERGY} />
				</StatItem>

				<StatItem>
					<StatLabel>
						<div>
							<StatIcon>✨</StatIcon>Charisma
						</div>
						<Tooltip data-tooltip={`Upgrade Charisma: $${charismaCost}`}>
							<UpgradeButton
								disabled={stats.isResting || !canAffordCharisma}
								onClick={() => dispatch({ type: "UPGRADE_CHARISMA" })}
							>
								+
							</UpgradeButton>
						</Tooltip>
					</StatLabel>
					<StatValue>
						<span>{stats.charisma}</span>
						{!canAffordCharisma && <UpgradeCost>${charismaCost}</UpgradeCost>}
					</StatValue>
				</StatItem>

				<StatItem>
					<StatLabel>
						<div>
							<StatIcon>🌟</StatIcon>Recruiting Power
						</div>
						<Tooltip
							data-tooltip={`Upgrade Recruiting Power: $${recruitingCost}`}
						>
							<UpgradeButton
								disabled={stats.isResting || !canAffordRecruiting}
								onClick={() => dispatch({ type: "UPGRADE_RECRUITING" })}
							>
								+
							</UpgradeButton>
						</Tooltip>
					</StatLabel>
					<StatValue>
						<span>{stats.recruitingPower}</span>
						{!canAffordRecruiting && (
							<UpgradeCost>${recruitingCost}</UpgradeCost>
						)}
					</StatValue>
				</StatItem>

				<StatItem>
					<StatLabel>
						<StatIcon>📊</StatIcon>Reputation
					</StatLabel>
					<StatValue>{stats.reputation}</StatValue>
				</StatItem>
			</StatGrid>
		</StatsContainer>
	);
};

export default PlayerStatsDisplay;
