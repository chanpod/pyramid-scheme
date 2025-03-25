import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
	PlayerStats as PlayerStatsType,
	GameAction,
	PyramidGraph,
	Product,
} from "../types";
import { getNodesBelow } from "../utils/pyramidGenerator";

// Constants to match the ones in useGameState.ts
const ENERGY_COST = 800;
const MAX_ENERGY = 20;
const INVENTORY_UPGRADE_COST = 1000;

interface PlayerStatsProps {
	stats: PlayerStatsType;
	lastDailyEnergyBonus: number;
	dispatch: React.Dispatch<GameAction>; // Add dispatch function to handle upgrades
	pyramid: PyramidGraph; // Add pyramid to count potential recruits
	playerNodeId: string | null; // Add player node ID to identify potential recruits
	products?: Product[]; // Add products for rank display
}

const StatsContainer = styled.div`
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
  position: relative;
  min-height: 280px; /* Set minimum height to prevent UI jumping */
  height: 100%;
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
  margin-right: 15px;
`;

const PlayerLevelInfo = styled.div`
  display: flex;
  align-items: center;
`;

const CurrentLevel = styled.div`
  display: flex;
  flex-direction: column;
`;

const LevelLabel = styled.span`
  font-size: 14px;
  color: #666;
`;

const LevelValue = styled.span`
  font-size: 20px;
  font-weight: bold;
  color: #333;
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

const RestButton = styled.button<{ disabled?: boolean }>`
	background-color: ${(props) => (props.disabled ? "#e0e0e0" : "#ff9800")};
	color: white;
	font-size: 12px;
	padding: 4px 8px;
	border: none;
	border-radius: 4px;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	margin-left: 10px;
	transition: all 0.2s;
	display: flex;
	align-items: center;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	
	&:hover {
		background-color: ${(props) => (props.disabled ? "#e0e0e0" : "#f57c00")};
		transform: ${(props) => (props.disabled ? "none" : "translateY(-2px)")};
	}
`;

const RestIcon = styled.span`
	margin-right: 5px;
	font-size: 12px;
`;

const InventorySummary = styled.div`
  margin-top: 15px;
  background-color: #f5f5f5;
  border-radius: 6px;
  padding: 12px;
`;

const InventoryTitle = styled.div`
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
`;

const InventoryList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  font-size: 13px;
`;

const InventoryItem = styled.div`
  display: flex;
  justify-content: space-between;
  background-color: #fff;
  padding: 5px 8px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
`;

const ProductName = styled.span`
  color: #555;
`;

const ProductCount = styled.span`
  font-weight: bold;
  color: #388e3c;
`;

const ProductRankSummary = styled.div`
  margin-top: 15px;
  background-color: #f5f5f5;
  border-radius: 6px;
  padding: 12px;
`;

const ProductRankTitle = styled.div`
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
`;

const ProductRankList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ProductRankItem = styled.div`
  background-color: #fff;
  padding: 8px 10px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
`;

const ProductRankHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
`;

const ProductRankName = styled.span`
  color: #333;
  font-weight: bold;
`;

const ProductRankBadge = styled.span<{ color: string }>`
  background-color: ${(props) => props.color || "#ccc"};
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: bold;
`;

const ProductRankProgress = styled.div`
  font-size: 12px;
  color: #666;
  margin-top: 4px;
`;

const ProductRankBar = styled.div<{ progress: number }>`
  height: 6px;
  background-color: #e0e0e0;
  border-radius: 3px;
  margin-top: 3px;
  overflow: hidden;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${(props) => Math.min(100, props.progress)}%;
    background-color: #4CAF50;
  }
`;

const PlayerStatsDisplay: React.FC<PlayerStatsProps> = ({
	stats,
	lastDailyEnergyBonus,
	dispatch,
	pyramid,
	playerNodeId,
	products,
}) => {
	const [showEnergyBonus, setShowEnergyBonus] = useState(false);

	// Calculate upgrade costs
	const charismaCost = stats.charisma * 200;
	const recruitingCost = stats.recruitingPower * 250;
	const energyCost = ENERGY_COST;
	const inventoryCost =
		INVENTORY_UPGRADE_COST + (stats.maxInventory - 10) * 500;
	const isMaxEnergy = stats.energy >= MAX_ENERGY;

	// Check if player can afford upgrades
	const canAffordCharisma = stats.money >= charismaCost;
	const canAffordRecruiting = stats.money >= recruitingCost;
	const canAffordEnergy = stats.money >= energyCost && !isMaxEnergy;
	const canAffordInventory = stats.money >= inventoryCost;

	// Calculate potential recruits (nodes below the player that are not owned)
	const potentialRecruits = playerNodeId
		? getNodesBelow(pyramid, playerNodeId).filter((node) => !node.ownedByPlayer)
				.length
		: 0;

	// Calculate rest duration based on current energy
	const calculateRestDuration = () => {
		if (stats.energy <= 0) {
			return 10; // Maximum rest for 0 energy
		}

		// Calculate rest duration inversely proportional to energy level
		// Higher energy = shorter rest, lower energy = longer rest
		const energyRatio = stats.energy / MAX_ENERGY;
		const baseDuration = 10 - energyRatio * 6; // Scale from 4-10 based on energy
		return Math.ceil(baseDuration);
	};

	// Handle rest action
	const handleRest = () => {
		const restHours = calculateRestDuration();
		dispatch({ type: "REST", hours: restHours });
	};

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

	// Get inventory items that player has
	const inventoryItems = Object.entries(stats.inventory)
		.filter(([_, count]) => count > 0)
		.map(([productId, count]) => ({
			id: productId,
			count,
		}));

	return (
		<StatsContainer>
			{showEnergyBonus && <EnergyBonus>+3 Energy (Daily Bonus)</EnergyBonus>}

			<Title>Your Stats</Title>
			<PlayerInfo>
				<LevelBadge>{stats.level}</LevelBadge>
				<PlayerLevelInfo>
					<CurrentLevel>
						<LevelLabel>Current Level</LevelLabel>
						<LevelValue>Level {stats.level}</LevelValue>
					</CurrentLevel>
				</PlayerLevelInfo>
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
					<StatLabel style={{ marginBottom: "8px" }}>
						<div
							style={{ display: "flex", alignItems: "center", width: "100%" }}
						>
							<div style={{ display: "flex", alignItems: "center" }}>
								<StatIcon>⚡</StatIcon>Energy
							</div>
							<div
								style={{
									marginLeft: "auto",
									display: "flex",
									alignItems: "center",
								}}
							>
								<RestButton
									disabled={stats.isResting}
									onClick={handleRest}
									title={`Rest for ${calculateRestDuration()} hours to recover energy`}
								>
									<RestIcon>🛌</RestIcon>
									Rest ({calculateRestDuration()}h)
								</RestButton>
								{!isMaxEnergy && (
									<Tooltip data-tooltip={`Upgrade Energy: $${energyCost}`}>
										<UpgradeButton
											disabled={
												stats.isResting || !canAffordEnergy || isMaxEnergy
											}
											onClick={() => dispatch({ type: "UPGRADE_ENERGY" })}
											style={{ marginLeft: "5px" }}
										>
											+
										</UpgradeButton>
									</Tooltip>
								)}
							</div>
						</div>
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
						<div
							style={{ display: "flex", alignItems: "center", width: "100%" }}
						>
							<div style={{ display: "flex", alignItems: "center" }}>
								<StatIcon>📦</StatIcon>Inventory
							</div>
							<div style={{ marginLeft: "auto" }}>
								<Tooltip data-tooltip={`Upgrade Inventory: $${inventoryCost}`}>
									<UpgradeButton
										disabled={stats.isResting || !canAffordInventory}
										onClick={() => dispatch({ type: "UPGRADE_INVENTORY" })}
									>
										+
									</UpgradeButton>
								</Tooltip>
							</div>
						</div>
					</StatLabel>
					<StatValue>
						<span>
							{Object.values(stats.inventory).reduce(
								(sum, qty) => sum + qty,
								0,
							)}{" "}
							/ {stats.maxInventory}
						</span>
						{!canAffordInventory && <UpgradeCost>${inventoryCost}</UpgradeCost>}
					</StatValue>
					<StatBar
						value={Object.values(stats.inventory).reduce(
							(sum, qty) => sum + qty,
							0,
						)}
						max={stats.maxInventory}
					/>
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
						<StatIcon>✨</StatIcon>Reputation
					</StatLabel>
					<StatValue>{stats.reputation}</StatValue>
				</StatItem>
			</StatGrid>

			{/* Add inventory summary if player has items */}
			{inventoryItems.length > 0 && (
				<InventorySummary>
					<InventoryTitle>
						<StatIcon>🧰</StatIcon> Inventory Items
					</InventoryTitle>
					<InventoryList>
						{inventoryItems.map((item) => (
							<InventoryItem key={item.id}>
								<ProductName>
									{item.id.charAt(0).toUpperCase() + item.id.slice(1)}
								</ProductName>
								<ProductCount>{item.count}</ProductCount>
							</InventoryItem>
						))}
					</InventoryList>
				</InventorySummary>
			)}

			{/* Add product rank summary if player has product purchases */}
			{Object.entries(stats.productPurchases || {}).length > 0 && products && (
				<ProductRankSummary>
					<ProductRankTitle>
						<StatIcon>🏆</StatIcon> Product Ranks
					</ProductRankTitle>
					<ProductRankList>
						{Object.entries(stats.productPurchases || {}).map(
							([productId, purchaseStats]) => {
								// Find product details
								const product = products.find((p) => p.id === productId);
								if (!product || !product.ranks) return null;

								// Get current rank
								const currentRank = purchaseStats.currentRank;
								const rankInfo =
									currentRank > 0 ? product.ranks[currentRank - 1] : null;

								// Calculate progress to next rank if not at max rank
								let progress = 0;
								let nextRankName = "None";
								let nextRequirement = 0;

								if (currentRank < (product.ranks?.length || 0)) {
									const nextRank = product.ranks[currentRank];
									nextRankName = nextRank.name;
									// Scale requirement based on player level
									const levelMultiplier = Math.pow(3, stats.level - 1);
									nextRequirement = Math.ceil(
										nextRank.weeklyRequirement * levelMultiplier,
									);
									progress =
										(purchaseStats.weeklyPurchased / nextRequirement) * 100;
								}

								return (
									<ProductRankItem key={productId}>
										<ProductRankHeader>
											<ProductRankName>{product.name}</ProductRankName>
											{currentRank > 0 && rankInfo ? (
												<ProductRankBadge color={rankInfo.color}>
													{rankInfo.name}
												</ProductRankBadge>
											) : (
												<ProductRankBadge color="#ccc">
													Unranked
												</ProductRankBadge>
											)}
										</ProductRankHeader>

										{currentRank < (product.ranks?.length || 0) ? (
											<>
												<ProductRankProgress>
													Next Rank: {nextRankName} (
													{purchaseStats.weeklyPurchased}/{nextRequirement}{" "}
													purchases)
												</ProductRankProgress>
												<ProductRankBar progress={progress} />
											</>
										) : currentRank > 0 ? (
											<ProductRankProgress>
												Maximum rank achieved!
											</ProductRankProgress>
										) : null}
									</ProductRankItem>
								);
							},
						)}
					</ProductRankList>
				</ProductRankSummary>
			)}
		</StatsContainer>
	);
};

export default PlayerStatsDisplay;
