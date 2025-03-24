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
	isPotentialRecruit?: boolean; // Flag to indicate if this node is a potential recruit not yet in the pyramid
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
	pendingRecruits: { nodeId: string; chance: number }[];
	lastDailyEnergyBonus: number; // Timestamp of when the last daily energy bonus was given
}

export type GameAction =
	| { type: "RECRUIT"; targetNodeId: string }
	| { type: "MOVE_UP"; targetNodeId: string }
	| { type: "COLLECT_MONEY" }
	| { type: "UPGRADE_CHARISMA" }
	| { type: "UPGRADE_RECRUITING" }
	| { type: "UPGRADE_ENERGY" }
	| { type: "REST"; hours: number }
	| { type: "ADVANCE_TIME"; hours: number }
	| { type: "RESET_GAME" };
