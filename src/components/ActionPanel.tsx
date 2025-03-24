import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { GameAction, PlayerStats, Product, MarketingEvent } from "../types";
import { PRODUCT_BUY_ENERGY_COST } from "../hooks/useGameState";

// Constants - update to match useGameState.ts
const SOCIAL_MEDIA_DURATION = 24; // 24 hours (1 day)
const HOME_PARTY_DURATION = 48; // 48 hours (2 days)
const PUBLIC_WORKSHOP_DURATION = 168; // 168 hours (7 days)
const SOCIAL_MEDIA_ENERGY = 2;
const HOME_PARTY_ENERGY = 5;
const PUBLIC_WORKSHOP_ENERGY = 8;

// Success chances
const SOCIAL_MEDIA_SUCCESS_CHANCE = 0.25; // 25% base chance for social media
const HOME_PARTY_SUCCESS_CHANCE = 0.35; // 35% base chance for home party
const WORKSHOP_SUCCESS_CHANCE = 0.75; // 75% base chance for workshop
const WORKSHOP_EXTRA_RECRUIT_CHANCE = 0.1; // 10% chance for extra recruit in workshops

// Investment constants
const MIN_INVESTMENT = 50;
const MAX_INVESTMENT = 500;
const INVESTMENT_SUCCESS_MULTIPLIER = 0.0005; // 0.05% per dollar invested
const INVESTMENT_ATTEMPTS_MULTIPLIER = 0.002; // 0.2% per dollar invested

interface ActionPanelProps {
	dispatch: React.Dispatch<GameAction>;
	playerStats: PlayerStats;
	gameDay: number;
	gameHour: number;
	// pendingRecruits: { nodeId: string; chance: number }[];
	products: Product[];
	marketingEvents: MarketingEvent[];
}

const PanelContainer = styled.div`
	background-color: #fff;
	border-radius: 8px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	padding: 20px;
	margin-bottom: 20px;
	min-height: 500px; /* Set minimum height to prevent UI jumping */
	max-height: 90vh;
	overflow-y: auto;
`;

const MoneyDisplay = styled.div`
	background-color: #4CAF50;
	color: white;
	border-radius: 8px;
	padding: 15px;
	margin-bottom: 20px;
	text-align: center;
	font-weight: bold;
	font-size: 22px;
	display: flex;
	justify-content: center;
	align-items: center;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	position: relative;
	overflow: hidden;
	
	&.flash {
		animation: moneyFlash 0.6s ease-out;
	}
	
	@keyframes moneyFlash {
		0% {
			background-color: #4CAF50;
		}
		50% {
			background-color: #8BC34A;
		}
		100% {
			background-color: #4CAF50;
		}
	}
`;

const MoneyIcon = styled.span`
	margin-right: 10px;
	font-size: 24px;
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

const StatusTag = styled.span<{ isAffordable?: boolean; isPositive?: boolean }>`
	background-color: ${(props) => {
		if (props.isPositive) return "#e8f5e9";
		if (props.isAffordable) return "#e8f5e9";
		return "#ffebee";
	}};
	color: ${(props) => {
		if (props.isPositive) return "#388e3c";
		if (props.isAffordable) return "#388e3c";
		return "#d32f2f";
	}};
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
	font-size: 18px;
	margin-bottom: 15px;
	color: #333;
	display: flex;
	align-items: center;
`;

const InventorySection = styled.div`
	margin: 20px 0;
	background-color: #f9f9f9;
	border-radius: 8px;
	padding: 15px;
`;

const ProductCard = styled.div`
	border: 1px solid #ddd;
	border-radius: 6px;
	padding: 10px;
	margin-bottom: 10px;
	background-color: white;
`;

const ProductHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 5px;
`;

const ProductName = styled.h4`
	margin: 0;
	color: #333;
`;

const ProductQuantity = styled.div`
	font-weight: bold;
	color: ${(props) => (props.children && Number(props.children.toString().split(" ")[0]) > 0 ? "#388e3c" : "#d32f2f")};
`;

const ProductActions = styled.div`
	display: flex;
	flex-wrap: wrap;
	margin-top: 10px;
`;

const ProductDetails = styled.div`
	font-size: 13px;
	color: #777;
	margin: 5px 0;
`;

const QuantityControls = styled.div`
	display: flex;
	align-items: center;
	margin-top: 8px;
`;

const QuantityButton = styled.button`
	background-color: ${(props) => (props.disabled ? "#e0e0e0" : "#f0f0f0")};
	border: 1px solid #ddd;
	color: ${(props) => (props.disabled ? "#999" : "#333")};
	width: 30px;
	height: 30px;
	border-radius: 3px;
	cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
	font-weight: bold;
	font-size: 14px;
	display: flex;
	align-items: center;
	justify-content: center;
`;

const QuantityInput = styled.input`
	width: 40px;
	height: 30px;
	text-align: center;
	margin: 0 5px;
	border: 1px solid #ddd;
	border-radius: 3px;
`;

const NetworkMarketingSection = styled.div`
	margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
	margin-top: 0;
	margin-bottom: 15px;
	color: #333;
	font-size: 24px;
`;

const SectionDescription = styled.p`
	margin: 0;
	color: #666;
	font-size: 14px;
`;

const MarketingDetails = styled.div`
	margin-top: 10px;
`;

const MarketingDetailItem = styled.div`
	margin-bottom: 5px;
`;

const DetailLabel = styled.span`
	font-weight: bold;
	margin-right: 5px;
`;

const PanelTitle = styled.h2`
	margin-top: 0;
	margin-bottom: 15px;
	color: #333;
	font-size: 24px;
`;

const PanelTitleIcon = styled.span`
	margin-right: 8px;
	font-size: 16px;
`;

const SectionTitleIcon = styled.span`
	margin-right: 8px;
	font-size: 16px;
`;

const EventButton = styled.button<{
	isEmergency?: boolean;
	disabled?: boolean;
}>`
	background-color: ${(props) => {
		if (props.disabled) return "#e0e0e0";
		if (props.isEmergency) return "#d32f2f";
		return "#2196F3";
	}};
	color: ${(props) => {
		if (props.disabled) return "#999";
		if (props.isEmergency) return "white";
		return "white";
	}};
	border: ${(props) => (props.disabled ? "1px solid #ddd" : "none")};
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
			if (props.isEmergency) return "#c62323";
			return "#1976D2";
		}};
		transform: ${(props) => (props.disabled ? "none" : "translateY(-2px)")};
		box-shadow: ${(props) => (props.disabled ? "none" : "0 4px 8px rgba(0, 0, 0, 0.1)")};
	}
`;

const EventIcon = styled.span`
	margin-right: 8px;
	font-size: 16px;
`;

const EventDialogOverlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5);
	display: flex;
	justify-content: center;
	align-items: center;
`;

const EventDialog = styled.div`
	background-color: white;
	border-radius: 8px;
	padding: 20px;
	max-width: 400px;
	width: 100%;
`;

const DialogTitle = styled.h2`
	margin-top: 0;
	margin-bottom: 15px;
	color: #333;
	font-size: 24px;
`;

const DialogDescription = styled.p`
	margin-bottom: 20px;
	color: #666;
	font-size: 14px;
`;

const EventOption = styled.div`
	padding: 10px;
	border-bottom: 1px solid #ddd;
	cursor: pointer;
	transition: all 0.2s;
	
	&:hover {
		background-color: #e8f4fd;
	}
`;

const EventOptionTitle = styled.h4`
	margin-top: 0;
	margin-bottom: 8px;
	color: #333;
	display: flex;
	align-items: center;
`;

const EventOptionDescription = styled.p`
	margin: 0;
	color: #666;
	font-size: 14px;
`;

const CloseButton = styled.button`
	background-color: #f44336;
	color: white;
	border: none;
	border-radius: 4px;
	padding: 10px 15px;
	font-weight: bold;
	cursor: pointer;
	margin-top: 10px;
`;

const ActiveEventBanner = styled.div`
	background: linear-gradient(to right, #FF9800, #F57C00);
	color: white;
	border-radius: 8px;
	padding: 15px;
	margin-bottom: 15px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	position: relative;
	overflow: hidden;
	animation: pulse 1.5s infinite;
	
	@keyframes pulse {
		0% {
			box-shadow: 0 4px 8px rgba(245, 124, 0, 0.4);
		}
		50% {
			box-shadow: 0 4px 12px rgba(245, 124, 0, 0.7);
		}
		100% {
			box-shadow: 0 4px 8px rgba(245, 124, 0, 0.4);
		}
	}
	
	&::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, 
							transparent 50%, rgba(255,255,255,0.1) 50%, 
							rgba(255,255,255,0.1) 75%, transparent 75%, transparent);
		background-size: 20px 20px;
		animation: slide 20s linear infinite;
		z-index: 1;
	}
	
	@keyframes slide {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 1000px 0;
		}
	}
`;

const EventTitle = styled.div`
	font-weight: bold;
	font-size: 18px;
	margin-bottom: 5px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	z-index: 2;
	position: relative;
`;

const EventTimeRemaining = styled.div`
	font-size: 14px;
	font-weight: normal;
	z-index: 2;
	position: relative;
`;

const EventProgress = styled.div`
	height: 6px;
	background-color: rgba(255, 255, 255, 0.3);
	border-radius: 3px;
	margin-top: 10px;
	overflow: hidden;
	z-index: 2;
	position: relative;
`;

const ProgressBar = styled.div<{ progress: number }>`
	height: 100%;
	width: ${(props) => props.progress}%;
	background-color: rgba(255, 255, 255, 0.8);
	border-radius: 3px;
`;

const TabContainer = styled.div`
	display: flex;
	margin-bottom: 15px;
	border-bottom: 1px solid #ddd;
`;

const Tab = styled.div<{ active: boolean }>`
	padding: 10px 20px;
	cursor: pointer;
	font-weight: ${(props) => (props.active ? "bold" : "normal")};
	color: ${(props) => (props.active ? "#2196F3" : "#666")};
	border-bottom: ${(props) => (props.active ? "2px solid #2196F3" : "none")};
	transition: all 0.2s;
	
	&:hover {
		color: #2196F3;
	}
`;

const InvestmentContainer = styled.div`
	margin: 15px 0;
	padding: 15px;
	background-color: #f5f5f5;
	border-radius: 8px;
`;

const InvestmentLabel = styled.div`
	font-weight: bold;
	margin-bottom: 5px;
	display: flex;
	justify-content: space-between;
`;

const InvestmentAmount = styled.div`
	font-weight: normal;
	color: #2196F3;
`;

const InvestmentSlider = styled.input`
	width: 100%;
	margin: 10px 0;
`;

const InvestmentBenefits = styled.div`
	margin-top: 10px;
	font-size: 14px;
	color: #666;
`;

const Benefit = styled.div`
	margin-bottom: 5px;
	display: flex;
	align-items: center;
`;

const BenefitIcon = styled.span`
	margin-right: 5px;
`;

const InfoIcon = styled.span`
	margin-right: 8px;
	font-size: 16px;
`;

const ActionPanel: React.FC<ActionPanelProps> = ({
	dispatch,
	playerStats,
	gameDay,
	gameHour,
	// pendingRecruits: { nodeId: string; chance: number }[],
	products,
	marketingEvents,
}) => {
	const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
	const [productQuantity, setProductQuantity] = useState(5);
	const [showEventDialog, setShowEventDialog] = useState(false);
	const [flashMoney, setFlashMoney] = useState(false);
	const [prevMoney, setPrevMoney] = useState(playerStats.money);
	const [investmentAmount, setInvestmentAmount] = useState(MIN_INVESTMENT);

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

	// Format time remaining for events
	const formatTimeRemaining = (hours: number) => {
		if (hours >= 24) {
			const days = Math.floor(hours / 24);
			const remainingHours = hours % 24;
			return `${days} day${days !== 1 ? "s" : ""} ${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`;
		}
		return `${hours} hour${hours !== 1 ? "s" : ""}`;
	};

	// Get event icon based on type
	const getEventIcon = (eventType: string) => {
		switch (eventType) {
			case "social-media":
				return "📱";
			case "home-party":
				return "🏠";
			case "workshop":
				return "🎪";
			default:
				return "📊";
		}
	};

	// Effect to check if money has changed and trigger animation
	useEffect(() => {
		if (playerStats.money !== prevMoney) {
			setFlashMoney(true);
			setPrevMoney(playerStats.money);

			// Remove flash class after animation completes
			const timer = setTimeout(() => {
				setFlashMoney(false);
			}, 600);

			return () => clearTimeout(timer);
		}
	}, [playerStats.money, prevMoney]);

	// Handle buy product
	const handleBuyProduct = (productId: string) => {
		if (productQuantity <= 0) return;
		dispatch({
			type: "BUY_PRODUCT",
			productId,
			quantity: productQuantity,
		});
		setProductQuantity(5); // Reset to 5
	};

	// Calculate success chance for selling product
	const calculateSellChance = (productId: string) => {
		const product = products.find((p) => p.id === productId);
		if (!product) return 0;

		// Base chance improved by charisma
		return Math.min(0.95, product.baseChance + playerStats.charisma * 0.05);
	};

	// Calculate network marketing success chances
	const calculateMarketingChance = (intensity: string) => {
		// Use the constants we defined at the top of the file
		switch (intensity) {
			case "light":
				return SOCIAL_MEDIA_SUCCESS_CHANCE;
			case "medium":
				return HOME_PARTY_SUCCESS_CHANCE;
			case "aggressive":
				return WORKSHOP_SUCCESS_CHANCE;
			default:
				return SOCIAL_MEDIA_SUCCESS_CHANCE;
		}
	};

	// Calculate max attempts for network marketing
	const calculateMaxAttempts = (intensity: string) => {
		switch (intensity) {
			case "light":
				return 2 + Math.floor(playerStats.charisma / 2);
			case "medium":
				return 4 + Math.floor(playerStats.charisma / 2);
			case "aggressive":
				return 6 + Math.floor(playerStats.charisma / 2);
			default:
				return 0;
		}
	};

	// Calculate the benefits of investment for recruiting
	const calculateInvestmentBenefits = (amount: number) => {
		// Success chance boost from investment (capped at 15%)
		const successBoost = Math.min(
			15,
			amount * INVESTMENT_SUCCESS_MULTIPLIER * 100,
		);

		// Additional recruitment attempts from investment
		const additionalAttempts = Math.floor(
			amount * INVESTMENT_ATTEMPTS_MULTIPLIER,
		);

		return { successBoost, additionalAttempts };
	};

	// Handle network marketing - now only for recruitment
	const handleNetworkMarketing = (
		intensity: "light" | "medium" | "aggressive",
	) => {
		dispatch({
			type: "NETWORK_MARKETING",
			intensity,
			purpose: "recruitment",
			investmentAmount: investmentAmount,
		});
		setShowEventDialog(false); // Close dialog after action
		// Reset investment amount to minimum after sending
		setInvestmentAmount(MIN_INVESTMENT);
	};

	// Determine if player is low on money and products - to adjust messaging
	const isLowOnResources = () => {
		const lowMoney = playerStats.money < 100;
		const totalInventory = Object.values(playerStats.inventory).reduce(
			(sum, qty) => sum + qty,
			0,
		);
		const lowInventory = totalInventory < 5;

		return lowMoney || lowInventory;
	};

	// Check if a marketing event is already running
	const isMarketingEventRunning = () => {
		return marketingEvents.length > 0;
	};

	// Get the duration text for an event type
	const getEventDurationText = (
		intensity: "light" | "medium" | "aggressive",
	) => {
		switch (intensity) {
			case "light":
				return `${SOCIAL_MEDIA_DURATION} hours (1 day)`;
			case "medium":
				return `${HOME_PARTY_DURATION} hours (2 days)`;
			case "aggressive":
				return `${PUBLIC_WORKSHOP_DURATION} hours (7 days)`;
			default:
				return "";
		}
	};

	// Calculate and format remaining rest time
	const formatRemainingRestTime = (
		restUntil: number,
		currentDay: number,
		currentHour: number,
	) => {
		const currentTotalHours = currentDay * 24 + currentHour;
		const remainingHours = Math.max(0, restUntil - currentTotalHours);

		return remainingHours > 0 ? `${remainingHours} hours` : "finishing soon";
	};

	// Calculate the max investment amount based on charisma and reputation
	const calculateMaxInvestment = () => {
		return Math.floor(
			MIN_INVESTMENT + (playerStats.charisma + playerStats.reputation) * 50,
		);
	};

	return (
		<PanelContainer>
			<PanelTitle>
				<PanelTitleIcon>📊</PanelTitleIcon> Inventory & Products
			</PanelTitle>

			{/* Money Display */}
			<MoneyDisplay className={flashMoney ? "flash" : ""}>
				<MoneyIcon>💰</MoneyIcon> Your Money: ${playerStats.money}
			</MoneyDisplay>

			{playerStats.isResting && (
				<RestingMessage>
					<span>😴</span> You are currently resting and cannot perform actions.
					<div style={{ marginTop: "8px", fontSize: "14px" }}>
						Time remaining:{" "}
						{formatRemainingRestTime(playerStats.restUntil, gameDay, gameHour)}
					</div>
				</RestingMessage>
			)}

			{/* Active Marketing Event Banner */}
			{marketingEvents.length > 0 &&
				marketingEvents.map((event) => (
					<ActiveEventBanner key={event.id}>
						<EventTitle>
							<div>
								<EventIcon>{getEventIcon(event.type)}</EventIcon>
								{event.name} In Progress
							</div>
							<span style={{ fontSize: "14px" }}>
								{Math.round(event.successChance * 100)}% Success Rate
							</span>
						</EventTitle>
						<EventTimeRemaining>
							Time Remaining: {formatTimeRemaining(event.remainingHours)}
						</EventTimeRemaining>
						{event.investmentAmount && (
							<div
								style={{
									fontSize: "13px",
									marginTop: "5px",
									zIndex: 2,
									position: "relative",
								}}
							>
								Investment: ${event.investmentAmount}
								<span style={{ marginLeft: "10px", color: "#FFD54F" }}>
									+
									{Math.round(
										event.investmentAmount *
											INVESTMENT_SUCCESS_MULTIPLIER *
											100,
									)}
									% success
								</span>
							</div>
						)}
						<EventProgress>
							<ProgressBar
								progress={100 - (event.remainingHours / event.totalHours) * 100}
							/>
						</EventProgress>
					</ActiveEventBanner>
				))}

			{/* Host an Event Button */}
			<EventButton
				onClick={() => setShowEventDialog(true)}
				isEmergency={false}
				disabled={playerStats.isResting || isMarketingEventRunning()}
			>
				<EventIcon>📣</EventIcon>
				Host a Recruitment Event
				{isMarketingEventRunning() && (
					<StatusTag isPositive={false}>Event in Progress</StatusTag>
				)}
			</EventButton>

			{/* Event Dialog Modal */}
			{showEventDialog && (
				<EventDialogOverlay onClick={() => setShowEventDialog(false)}>
					<EventDialog onClick={(e) => e.stopPropagation()}>
						<DialogTitle>Host a Recruitment Event</DialogTitle>

						<DialogDescription>
							Recruitment events run over time and help you find potential
							recruits for your network. Investing more money improves your
							chances and the number of potential recruits you can attract. Each
							event type has different duration and effectiveness.
						</DialogDescription>

						{/* Investment slider for recruitment events */}
						<InvestmentContainer>
							<InvestmentLabel>
								Investment Amount
								<InvestmentAmount>${investmentAmount}</InvestmentAmount>
							</InvestmentLabel>
							<InvestmentSlider
								type="range"
								min={MIN_INVESTMENT}
								max={Math.min(calculateMaxInvestment(), playerStats.money)}
								value={investmentAmount}
								onChange={(e) =>
									setInvestmentAmount(Number.parseInt(e.target.value))
								}
							/>
							<div
								style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}
							>
								Max Investment: ${calculateMaxInvestment()} (based on Charisma +
								Reputation)
							</div>
							<InvestmentBenefits>
								{calculateInvestmentBenefits(investmentAmount).successBoost >
									0 && (
									<Benefit>
										<BenefitIcon>✅</BenefitIcon>+
										{calculateInvestmentBenefits(
											investmentAmount,
										).successBoost.toFixed(1)}
										% recruitment success chance
									</Benefit>
								)}
								{calculateInvestmentBenefits(investmentAmount)
									.additionalAttempts > 0 && (
									<Benefit>
										<BenefitIcon>✅</BenefitIcon>
										{
											calculateInvestmentBenefits(investmentAmount)
												.additionalAttempts
										}{" "}
										additional recruitment attempts
									</Benefit>
								)}
							</InvestmentBenefits>
						</InvestmentContainer>

						<EventOption onClick={() => handleNetworkMarketing("light")}>
							<EventOptionTitle>
								<ActionIcon>📱</ActionIcon>
								Social Media Recruitment
								{playerStats.energy < 2 && (
									<StatusTag isPositive={false}>No Energy</StatusTag>
								)}
								{playerStats.money < investmentAmount && (
									<StatusTag isPositive={false}>
										Can't Afford Investment
									</StatusTag>
								)}
							</EventOptionTitle>
							<EventOptionDescription>
								Find potential recruits through targeted social media posts.
								Runs for {getEventDurationText("light")}.
							</EventOptionDescription>
							<MarketingDetails>
								<MarketingDetailItem>
									<DetailLabel>Energy Cost:</DetailLabel> 2
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Investment:</DetailLabel> ${investmentAmount}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Duration:</DetailLabel>{" "}
									{getEventDurationText("light")}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Potential Recruits:</DetailLabel> 1-2
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Success Chance:</DetailLabel>{" "}
									{Math.round(calculateMarketingChance("light") * 100)}%
									{investmentAmount > 0 && (
										<span style={{ color: "#4CAF50", marginLeft: "5px" }}>
											+
											{calculateInvestmentBenefits(
												investmentAmount,
											).successBoost.toFixed(1)}
											%
										</span>
									)}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Attempts:</DetailLabel>{" "}
									{calculateMaxAttempts("light")}
									{calculateInvestmentBenefits(investmentAmount)
										.additionalAttempts > 0 && (
										<span style={{ color: "#4CAF50", marginLeft: "5px" }}>
											+
											{
												calculateInvestmentBenefits(investmentAmount)
													.additionalAttempts
											}
										</span>
									)}
								</MarketingDetailItem>
							</MarketingDetails>
						</EventOption>

						<EventOption onClick={() => handleNetworkMarketing("medium")}>
							<EventOptionTitle>
								<ActionIcon>🏠</ActionIcon>
								Home Recruitment Party
								{playerStats.energy < 5 && (
									<StatusTag isPositive={false}>No Energy</StatusTag>
								)}
								{playerStats.money < investmentAmount && (
									<StatusTag isPositive={false}>
										Can't Afford Investment
									</StatusTag>
								)}
							</EventOptionTitle>
							<EventOptionDescription>
								Host a recruitment party at your home for potential business
								partners. Runs for {getEventDurationText("medium")}.
							</EventOptionDescription>
							<MarketingDetails>
								<MarketingDetailItem>
									<DetailLabel>Energy Cost:</DetailLabel> 5
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Investment:</DetailLabel> ${investmentAmount}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Duration:</DetailLabel>{" "}
									{getEventDurationText("medium")}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Potential Recruits:</DetailLabel> 1-3
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Success Chance:</DetailLabel>{" "}
									{Math.round(calculateMarketingChance("medium") * 100)}%
									{investmentAmount > 0 && (
										<span style={{ color: "#4CAF50", marginLeft: "5px" }}>
											+
											{calculateInvestmentBenefits(
												investmentAmount,
											).successBoost.toFixed(1)}
											%
										</span>
									)}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Attempts:</DetailLabel>{" "}
									{calculateMaxAttempts("medium")}
									{calculateInvestmentBenefits(investmentAmount)
										.additionalAttempts > 0 && (
										<span style={{ color: "#4CAF50", marginLeft: "5px" }}>
											+
											{
												calculateInvestmentBenefits(investmentAmount)
													.additionalAttempts
											}
										</span>
									)}
								</MarketingDetailItem>
							</MarketingDetails>
						</EventOption>

						<EventOption onClick={() => handleNetworkMarketing("aggressive")}>
							<EventOptionTitle>
								<ActionIcon>🎪</ActionIcon>
								Recruitment Seminar
								{playerStats.energy < 8 && (
									<StatusTag isPositive={false}>No Energy</StatusTag>
								)}
								{playerStats.money < investmentAmount && (
									<StatusTag isPositive={false}>
										Can't Afford Investment
									</StatusTag>
								)}
							</EventOptionTitle>
							<EventOptionDescription>
								Host a professional seminar to attract serious business partners
								to your network. Runs for {getEventDurationText("aggressive")}.
								10% chance for bonus recruits!
							</EventOptionDescription>
							<MarketingDetails>
								<MarketingDetailItem>
									<DetailLabel>Energy Cost:</DetailLabel> 8
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Investment:</DetailLabel> ${investmentAmount}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Duration:</DetailLabel>{" "}
									{getEventDurationText("aggressive")}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Potential Recruits:</DetailLabel> 2-4
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Success Chance:</DetailLabel>{" "}
									{Math.round(calculateMarketingChance("aggressive") * 100)}%
									{investmentAmount > 0 && (
										<span style={{ color: "#4CAF50", marginLeft: "5px" }}>
											+
											{calculateInvestmentBenefits(
												investmentAmount,
											).successBoost.toFixed(1)}
											%
										</span>
									)}
								</MarketingDetailItem>
								<MarketingDetailItem>
									<DetailLabel>Attempts:</DetailLabel>{" "}
									{calculateMaxAttempts("aggressive")}
									{calculateInvestmentBenefits(investmentAmount)
										.additionalAttempts > 0 && (
										<span style={{ color: "#4CAF50", marginLeft: "5px" }}>
											+
											{
												calculateInvestmentBenefits(investmentAmount)
													.additionalAttempts
											}
										</span>
									)}
								</MarketingDetailItem>
							</MarketingDetails>
						</EventOption>

						<CloseButton onClick={() => setShowEventDialog(false)}>
							Cancel
						</CloseButton>
					</EventDialog>
				</EventDialogOverlay>
			)}

			<InventorySection>
				<SectionTitle>
					<SectionTitleIcon>📦</SectionTitleIcon>Your Inventory
					<span style={{ fontSize: "14px", marginLeft: "10px", color: "#666" }}>
						(
						{Object.values(playerStats.inventory).reduce(
							(sum, qty) => sum + qty,
							0,
						)}
						/{playerStats.maxInventory})
					</span>
				</SectionTitle>

				{/* Product list */}
				{products.map((product) => {
					const quantity = playerStats.inventory[product.id] || 0;
					const isSelected = selectedProduct === product.id;

					return (
						<ProductCard
							key={product.id}
							onClick={() => setSelectedProduct(product.id)}
						>
							<ProductHeader>
								<ProductName>{product.name}</ProductName>
								<ProductQuantity>{quantity} in stock</ProductQuantity>
							</ProductHeader>

							<ProductDetails>
								Cost: ${product.baseCost} | Retail: ${product.basePrice} |
								Downstream: ${product.downsellPrice}
							</ProductDetails>

							{isSelected && (
								<>
									<QuantityControls>
										<QuantityButton
											onClick={(e) => {
												e.stopPropagation();
												setProductQuantity(Math.max(5, productQuantity - 5));
											}}
											disabled={productQuantity <= 5}
										>
											-
										</QuantityButton>
										<QuantityInput
											type="number"
											min="5"
											step="5"
											value={productQuantity}
											onChange={(e) =>
												setProductQuantity(
													Math.max(5, Number.parseInt(e.target.value) || 5),
												)
											}
											onClick={(e) => e.stopPropagation()}
										/>
										<QuantityButton
											onClick={(e) => {
												e.stopPropagation();
												setProductQuantity(productQuantity + 5);
											}}
										>
											+
										</QuantityButton>
									</QuantityControls>

									<ProductActions>
										<ActionButton
											onClick={(e) => {
												e.stopPropagation();
												handleBuyProduct(product.id);
											}}
											disabled={
												playerStats.money <
													product.baseCost * productQuantity ||
												playerStats.energy < PRODUCT_BUY_ENERGY_COST ||
												Object.values(playerStats.inventory).reduce(
													(sum, qty) => sum + qty,
													0,
												) +
													productQuantity >
													playerStats.maxInventory
											}
										>
											<ActionIcon>🛒</ActionIcon> Buy ({productQuantity})
											{playerStats.energy < PRODUCT_BUY_ENERGY_COST && (
												<StatusTag isPositive={false}>
													Need {PRODUCT_BUY_ENERGY_COST} Energy
												</StatusTag>
											)}
											{Object.values(playerStats.inventory).reduce(
												(sum, qty) => sum + qty,
												0,
											) +
												productQuantity >
												playerStats.maxInventory && (
												<StatusTag isPositive={false}>
													Not enough space
												</StatusTag>
											)}
										</ActionButton>
									</ProductActions>

									<div
										style={{
											fontSize: "12px",
											marginTop: "5px",
											color: "#555",
										}}
									>
										<div>
											Daily auto-sell chance:{" "}
											{Math.round(calculateSellChance(product.id) * 100)}%
										</div>
										<div style={{ marginTop: "2px" }}>
											Cost: ${product.baseCost * productQuantity} +{" "}
											{PRODUCT_BUY_ENERGY_COST} Energy
										</div>
									</div>
								</>
							)}
						</ProductCard>
					);
				})}

				<div style={{ fontSize: "13px", color: "#666", marginTop: "10px" }}>
					<p>
						<strong>Total Sales:</strong>
						<br />
						Random People: {playerStats.totalSalesRandom || 0} units
						<br />
						Downstream: {playerStats.totalSalesDownstream || 0} units
					</p>
					<p
						style={{
							backgroundColor: "#f5f5f5",
							padding: "5px",
							borderRadius: "3px",
						}}
					>
						<strong>Note:</strong> Your inventory is limited to{" "}
						{playerStats.maxInventory} total items. Upgrade your inventory
						capacity in the stats panel to carry more products.
					</p>
				</div>
			</InventorySection>

			{/* Pending Recruits Info */}
			{/* pendingRecruits.length > 0 && (
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
			)} */}
		</PanelContainer>
	);
};

export default ActionPanel;
