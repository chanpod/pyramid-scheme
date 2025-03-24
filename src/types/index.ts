export interface PyramidNode {
	id: string;
	level: number;
	x?: number; // Position for D3 rendering
	y?: number; // Position for D3 rendering
	isPlayerPosition: boolean;
	recruits: number;
	money: number;
	ownedByPlayer: boolean;
	name?: string; // Optional name for AI competitors
	aiControlled?: boolean; // Flag to indicate if this node is controlled by AI
	aiStrategy?: string; // Strategy type for AI players
	lastUpdated?: number; // Timestamp for tracking changes
	isPotentialRecruit?: boolean; // DEPRECATED - Kept for backwards compatibility but no longer used
	inventory?: { [productId: string]: number }; // Product inventory counts
	maxInventory: number; // Maximum inventory capacity
	lastRestocked?: number; // Timestamp for when this node was last restocked
}

export interface PyramidLink {
	source: string;
	target: string;
}

export interface PyramidGraph {
	nodes: PyramidNode[];
	links: PyramidLink[];
	version: number; // Version counter for tracking changes to the graph structure
}

// Interface for products to sell in MLM system
export interface Product {
	id: string;
	name: string;
	baseCost: number; // Cost to buy from upstream
	basePrice: number; // Price when selling to random people
	downsellPrice: number; // Discounted price when selling to downstreams
	baseChance: number; // Base chance to successfully sell to random person
}

// Marketing event interface for time-based events
export interface MarketingEvent {
	id: string;
	type: "social-media" | "home-party" | "workshop";
	purpose: "recruitment"; // Only used for recruitment now
	name: string;
	remainingHours: number;
	totalHours: number;
	successChance: number;
	baseReward: { min: number; max: number };
	maxAttempts: number;
	investmentAmount?: number; // Optional additional money invested to boost success
}

export interface PlayerStats {
	money: number;
	recruits: number;
	level: number;
	currentNodeId: string;
	charisma: number;
	recruitingPower: number;
	energy: number;
	reputation: number;
	isResting: boolean;
	restUntil: number;
	recoveryPercentage?: number; // Used to store recovery rate during resting
	inventory: { [productId: string]: number }; // Product inventory counts
	maxInventory: number; // Maximum inventory capacity
	totalSalesRandom: number; // Total lifetime sales to random people
	totalSalesDownstream: number; // Total lifetime sales to downstreams
}

export interface GameState {
	pyramid: PyramidGraph;
	player: PlayerStats;
	gameLevel: number;
	turns: number;
	gameDay: number;
	gameHour: number;
	gameOver: boolean;
	isWinner: boolean;
	// pendingRecruits: { nodeId: string; chance: number }[]; // Removed - recruitment now only via marketing events
	lastDailyEnergyBonus: number; // Timestamp of when the last daily energy bonus was given
	products: Product[]; // Available products in the game
	marketingEvents: MarketingEvent[]; // Active marketing events
}

export type GameAction =
	// Removed RECRUIT action - recruitment now only via marketing events
	| { type: "MOVE_UP"; targetNodeId: string }
	| { type: "COLLECT_MONEY" }
	| { type: "UPGRADE_CHARISMA" }
	| { type: "UPGRADE_RECRUITING" }
	| { type: "UPGRADE_ENERGY" }
	| { type: "UPGRADE_INVENTORY" }
	| { type: "REST"; hours: number }
	| { type: "ADVANCE_TIME"; hours: number }
	| { type: "RESET_GAME" }
	| { type: "SET_GAME_OVER"; isWinner: boolean }
	| {
			type: "NETWORK_MARKETING";
			intensity: "light" | "medium" | "aggressive";
			purpose?: "cash" | "recruitment";
			eventName?: string;
			investmentAmount?: number;
	  }
	| { type: "BUY_PRODUCT"; productId: string; quantity: number }
	| {
			type: "SELL_DOWNSTREAM";
			productId: string;
			targetNodeId: string;
			quantity: number;
	  }
	| {
			type: "RESTOCK_DOWNSTREAM";
			targetNodeId: string;
			productId: string;
			quantity: number;
	  };
