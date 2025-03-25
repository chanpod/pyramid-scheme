import { useReducer, useEffect } from "react";
import {
	GameState,
	GameAction,
	PlayerStats,
	PyramidGraph,
	MarketingEvent,
	PyramidNode,
	Product,
	ProductPurchaseStats,
	ProductRank,
} from "../types";
import {
	generatePyramid,
	getNodesAbove,
	getNodesBelow,
	addNodeToPyramid,
	hasParent,
} from "../utils/pyramidGenerator";
import React from "react";

// Constants for game mechanics
const HOURS_PER_DAY = 3;
const MAX_ENERGY = 20;
const REST_ENERGY_PER_HOUR = 0.5; // Energy gained per hour of rest
const ENERGY_COST = 800; // Cost to buy energy
const INVENTORY_UPGRADE_COST = 1000; // Cost to upgrade inventory capacity (fairly expensive)
export const PRODUCT_BUY_ENERGY_COST = 5; // Energy cost to buy products
const AI_NODE_RECRUIT_CHANCE = 0.1; // Increased AI node recruitment chance to make competition harder
const AI_NODE_EXPANSION_CHANCE = 0.3; // Increased AI expansion chance to make competition harder
const DEFAULT_MAX_INVENTORY = 20; // Default maximum inventory capacity for nodes
const NODE_RESTOCK_ENERGY_COST = 1; // Energy cost to restock a downstream node

// Trading chance constants - easy to adjust
const PLAYER_INVENTORY_TRADE_CHANCE = 1; // Chance for player to auto-trade inventory to downstream nodes
const AI_INVENTORY_TRADE_CHANCE = 0.3; // Chance for AI to auto-trade inventory to downstream nodes

// Selling chance constants - easy to adjust
const NODE_RANDOM_SALE_CHANCE = 0.05; // Base chance for nodes to sell products to random customers
const NODE_SALE_LEVEL_BONUS = 0.05; // Additional sale chance per level (higher levels sell better)
const PLAYER_OWNED_SALE_BONUS = 0.1; // 10% bonus for player-owned nodes
const CHARISMA_SALE_BONUS = 0.05; // 5% bonus per charisma point for player sales

// Marketing event constants
const SOCIAL_MEDIA_DURATION = 24; // 24 hours (1 day)
const HOME_PARTY_DURATION = 48; // 48 hours (2 days)
const PUBLIC_WORKSHOP_DURATION = 168; // 168 hours (7 days)
const SOCIAL_MEDIA_ENERGY = 2;
const HOME_PARTY_ENERGY = 5;
const PUBLIC_WORKSHOP_ENERGY = 8;

// Event success chances (updated)
const SOCIAL_MEDIA_SUCCESS_CHANCE = 0.25; // 25% base chance for social media
const HOME_PARTY_SUCCESS_CHANCE = 0.35; // 35% base chance for home party
const WORKSHOP_SUCCESS_CHANCE = 0.75; // 75% base chance for workshop
const WORKSHOP_EXTRA_RECRUIT_CHANCE = 0.1; // 10% chance for extra recruit in workshops

// Investment multipliers for recruitment events
const INVESTMENT_SUCCESS_MULTIPLIER = 0.0005; // 0.05% per dollar invested
const INVESTMENT_ATTEMPTS_MULTIPLIER = 0.002; // 0.2% per dollar invested

// Product definitions
const productDefinitions = [
	{
		id: "essential-oils",
		name: "Essential Oils",
		baseCost: 10,
		basePrice: 25,
		downsellPrice: 15,
		baseChance: 0.15, // 25% base chance to sell to a random person (increased from 0.2)
	},
	{
		id: "wellness-supplements",
		name: "Wellness Supplements",
		baseCost: 20,
		basePrice: 45,
		downsellPrice: 30,
		baseChance: 0.1, // 20% base chance to sell to a random person (increased from 0.15)
	},
	{
		id: "lifestyle-kit",
		name: "Lifestyle Enhancement Kit",
		baseCost: 50,
		basePrice: 120,
		downsellPrice: 80,
		baseChance: 0.05, // 15% base chance to sell to a random person (increased from 0.1)
	},
];

// Constants for product ranks
const PRODUCT_RANKS = [
	{
		level: 1,
		name: "Bronze",
		weeklyRequirement: 5,
		bonusMultiplier: 1.1,
		color: "#CD7F32",
	},
	{
		level: 2,
		name: "Silver",
		weeklyRequirement: 10,
		bonusMultiplier: 1.2,
		color: "#C0C0C0",
	},
	{
		level: 3,
		name: "Gold",
		weeklyRequirement: 15,
		bonusMultiplier: 1.3,
		color: "#FFD700",
	},
	{
		level: 4,
		name: "Platinum",
		weeklyRequirement: 25,
		bonusMultiplier: 1.5,
		color: "#E5E4E2",
	},
	{
		level: 5,
		name: "Diamond",
		weeklyRequirement: 40,
		bonusMultiplier: 2.0,
		color: "#B9F2FF",
	},
];

// Helper function to propagate ownership down the network
const propagateOwnership = (
	pyramid: PyramidGraph,
	startNodeId: string,
	isPlayer: boolean = true,
	aiName?: string,
	aiStrategy?: string,
): PyramidGraph => {
	const updatedNodes = [...pyramid.nodes];
	const processed = new Set<string>();

	// For player propagation, we need to track how many player-owned nodes we've marked
	// to respect the limit of 2 recruits
	let playerOwnedCount = 0;
	if (isPlayer) {
		// Count existing player-owned nodes (excluding player position)
		playerOwnedCount = updatedNodes.filter(
			(node) => node.ownedByPlayer && !node.isPlayerPosition,
		).length;
	}

	// Recursive function to traverse network downward and update ownership
	const processNode = (nodeId: string) => {
		if (processed.has(nodeId)) return; // Prevent cycles
		processed.add(nodeId);

		// Find nodes that are directly below this node
		const childLinks = pyramid.links.filter((link) => link.target === nodeId);

		for (const link of childLinks) {
			const childNodeIndex = updatedNodes.findIndex(
				(node) => node.id === link.source,
			);

			if (childNodeIndex >= 0) {
				// Update ownership
				if (isPlayer) {
					// For player network, only mark up to 2 nodes as owned
					if (
						playerOwnedCount < 2 ||
						updatedNodes[childNodeIndex].ownedByPlayer
					) {
						// Only increment count if this is a new player-owned node
						if (!updatedNodes[childNodeIndex].ownedByPlayer) {
							playerOwnedCount++;
						}

						// Mark as owned by player
						updatedNodes[childNodeIndex] = {
							...updatedNodes[childNodeIndex],
							ownedByPlayer: true,
							aiControlled: false, // Remove from AI network if it was there
							aiStrategy: undefined, // Clear AI strategy
							name: undefined, // Clear AI name
							lastUpdated: Date.now(),
						};

						// Only continue propagation if we haven't reached the limit
						if (playerOwnedCount < 2) {
							// Process children of this node recursively
							processNode(link.source);
						}
					}
				} else {
					// For AI network
					if (
						!updatedNodes[childNodeIndex].ownedByPlayer &&
						!updatedNodes[childNodeIndex].aiControlled
					) {
						// Don't take over player nodes or other AI's nodes
						updatedNodes[childNodeIndex] = {
							...updatedNodes[childNodeIndex],
							aiControlled: true,
							ownedByPlayer: false,
							aiStrategy: aiStrategy,
							name: aiName ? `${aiName}'s Recruit` : "AI Recruit",
							lastUpdated: Date.now(),
						};

						// Process children of this node recursively
						processNode(link.source);
					}
				}
			}
		}
	};

	// Start the propagation from the given node
	processNode(startNodeId);

	// Return updated pyramid with ownership propagated
	return {
		...pyramid,
		nodes: updatedNodes,
		version: (pyramid.version || 0) + 1, // Increment version
	};
};

// Create initial game state
const createInitialGameState = (): GameState => {
	// Initialize pyramid with just one node for the player at top
	let initialRecruits = 0;
	const playerNodeId = "player-node-0";

	// Generate basic pyramid structure
	let pyramid = generatePyramid(7, 5); // 7 levels total, player starts at level 5

	// Clear any existing player/AI positions and ownership
	pyramid.nodes.forEach((node) => {
		node.isPlayerPosition = false;
		node.ownedByPlayer = false;
		node.aiControlled = false;
		node.name = undefined;
	});

	// Set up initial player stats
	const initialPlayerStats: PlayerStats = {
		money: 1000,
		recruits: initialRecruits,
		level: 1,
		currentNodeId: playerNodeId,
		charisma: 1,
		recruitingPower: 1,
		energy: 10,
		reputation: 1,
		isResting: false,
		restUntil: 0,
		recoveryPercentage: undefined,
		inventory: {},
		maxInventory: DEFAULT_MAX_INVENTORY,
		totalSalesRandom: 0,
		totalSalesDownstream: 0,
		productPurchases: {},
	};

	// Helper to check if one node is below another in the hierarchy
	function isNodeBelow(
		pyramid: PyramidGraph,
		nodeId: string,
		ancestorId: string,
		visited: Set<string> = new Set(),
	): boolean {
		if (visited.has(nodeId)) return false; // Prevent cycles
		visited.add(nodeId);

		// Get direct parents of this node
		const parents = pyramid.links
			.filter((link) => link.source === nodeId)
			.map((link) => link.target);

		// Check if any parent is the ancestor we're looking for
		if (parents.includes(ancestorId)) return true;

		// Recursively check each parent
		for (const parentId of parents) {
			if (isNodeBelow(pyramid, parentId, ancestorId, visited)) return true;
		}

		return false;
	}

	// Step 1: Place player at a node in level 5
	const level5Nodes = pyramid.nodes.filter((node) => node.level === 5);
	// Place player at a random position in level 5, not always in the center
	const playerNodeIndex = Math.floor(Math.random() * level5Nodes.length);
	const playerNode = level5Nodes[playerNodeIndex];

	// Mark the player's node
	if (playerNode) {
		playerNode.isPlayerPosition = true;
		playerNode.ownedByPlayer = true;
		playerNode.inventory = undefined; // Player node doesn't need inventory - using player stats instead
		initialPlayerStats.currentNodeId = playerNode.id;
		console.log(
			`Player randomly placed at node ${playerNode.id} on level ${playerNode.level} (position ${playerNodeIndex + 1} of ${level5Nodes.length})`,
		);

		// LIMIT DOWNSTREAM NODES: Find all nodes that are directly below the player
		const nodesBelow = pyramid.nodes.filter(
			(node) =>
				node.level === playerNode.level + 1 &&
				pyramid.links.some(
					(link) => link.source === node.id && link.target === playerNode.id,
				),
		);

		console.log(`Found ${nodesBelow.length} nodes directly below player`);

		// If there are more than 2 nodes below, keep only 2 and remove the rest
		if (nodesBelow.length > 2) {
			// Sort nodes by ID to ensure deterministic selection
			const sortedNodesBelow = [...nodesBelow].sort((a, b) =>
				a.id.localeCompare(b.id),
			);

			// Keep the first 2 nodes, remove the rest
			const nodesToKeep = sortedNodesBelow.slice(0, 2);
			const nodesToRemove = sortedNodesBelow.slice(2);

			console.log(
				`Keeping ${nodesToKeep.length} nodes, removing ${nodesToRemove.length} nodes`,
			);

			// Remove the excess nodes from the pyramid
			for (const nodeToRemove of nodesToRemove) {
				// Remove the node
				const nodeIndex = pyramid.nodes.findIndex(
					(n) => n.id === nodeToRemove.id,
				);
				if (nodeIndex >= 0) {
					pyramid.nodes.splice(nodeIndex, 1);
				}

				// Remove all links connected to this node
				pyramid.links = pyramid.links.filter(
					(link) =>
						link.source !== nodeToRemove.id && link.target !== nodeToRemove.id,
				);
			}

			console.log(
				`Pyramid now has ${pyramid.nodes.length} nodes and ${pyramid.links.length} links`,
			);
		}

		// If there are fewer than 2 nodes below, the standard ensureRecruitableNodesBelow
		// logic will add them later
	}

	// Step 2: Create AI competitors (5-7 competitors)
	const numAICompetitors = 5 + Math.floor(Math.random() * 3); // 5-7 AI competitors
	console.log(`Creating ${numAICompetitors} AI competitors`);

	const aiCompetitors = [];

	// Select nodes for AI competitors (preferably on levels 3-6)
	const possibleAINodes = pyramid.nodes.filter(
		(node) =>
			node.level >= 3 &&
			node.level <= 6 &&
			!node.isPlayerPosition &&
			!node.ownedByPlayer &&
			// Ensure AI competitors are not placed below the player
			!isNodeBelow(pyramid, node.id, playerNode.id),
	);

	// Shuffle the possible nodes to randomize AI placement
	const shuffledAINodes = [...possibleAINodes].sort(() => Math.random() - 0.5);

	// Place AI competitors
	for (let i = 0; i < Math.min(numAICompetitors, shuffledAINodes.length); i++) {
		// Get a random node for this AI competitor
		const aiNode = shuffledAINodes[i];

		// Generate a name for this AI competitor
		const aiName = generateAIName();

		// Assign a strategy (50/50 chance of aggressive vs steady)
		const aiStrategy = Math.random() < 0.5 ? "aggressive" : "steady";

		// Mark the node as AI-controlled
		aiNode.aiControlled = true;
		aiNode.name = aiName;
		aiNode.aiStrategy = aiStrategy;
		aiNode.maxInventory = DEFAULT_MAX_INVENTORY;

		// Initialize AI inventory
		aiNode.inventory = aiNode.inventory || {};

		// Higher-level AI competitors start with more inventory and money
		const startingMoney =
			800 + Math.floor(Math.random() * 400) - aiNode.level * 50;
		aiNode.money = Math.max(200, startingMoney); // Ensure at least 200 starting money

		// Give some starting inventory to the AI (preferring different products based on strategy)
		productDefinitions.forEach((product, index) => {
			// Aggressive AI starts with more expensive products
			// Steady AI starts with more reliable products
			const shouldStock =
				aiStrategy === "aggressive"
					? product.basePrice > 30 // Aggressive AI prefers more expensive products
					: product.baseChance > 0.15; // Steady AI prefers more reliable products

			if (shouldStock || Math.random() < 0.4) {
				// 40% chance to stock any product
				const quantity = 1 + Math.floor(Math.random() * 3); // 1-3 of each product
				aiNode.inventory[product.id] = quantity;
			}
		});

		aiCompetitors.push({
			id: aiNode.id,
			name: aiName,
			strategy: aiStrategy,
			level: aiNode.level,
		});

		console.log(`AI competitor ${aiName} placed at level ${aiNode.level}`);

		// Propagate AI ownership down the hierarchy
		pyramid = propagateOwnership(pyramid, aiNode.id, false, aiName, aiStrategy);
	}

	// Step 3: Assign any remaining unowned nodes randomly
	const unownedNodes = pyramid.nodes.filter(
		(node) => !node.ownedByPlayer && !node.aiControlled,
	);

	if (unownedNodes.length > 0) {
		console.log(`Assigning ${unownedNodes.length} remaining unowned nodes`);

		for (const node of unownedNodes) {
			// For nodes below the player, give higher chance to be player-owned
			const isBelow = isNodeBelow(pyramid, node.id, playerNode.id);

			// Only assign to player if it's below the player's position
			if (isBelow) {
				node.ownedByPlayer = true;
				node.maxInventory = DEFAULT_MAX_INVENTORY;
				node.inventory = {};
			} else {
				node.aiControlled = true;
				// Pick a random AI competitor to own this node
				const randomAI =
					aiCompetitors[Math.floor(Math.random() * aiCompetitors.length)];
				node.aiStrategy = randomAI.strategy;
				node.name = `${randomAI.name}'s Recruit`;
				// Initialize with empty inventory
				node.inventory = {};
				node.maxInventory = DEFAULT_MAX_INVENTORY;
				// Give some starting money
				node.money = 50 + Math.floor(Math.random() * 150);
			}
		}
	}

	// Step 4: Assign nodes to networks based on hierarchy
	// First pass: assign all nodes directly connected (below) to owned nodes
	let assignedSomeNodes = true;
	while (assignedSomeNodes) {
		assignedSomeNodes = false;

		// For each node in the pyramid
		for (const node of pyramid.nodes) {
			// Skip if already assigned
			if (node.ownedByPlayer || node.aiControlled) {
				continue;
			}

			// Get nodes above this node
			const nodesAbove = getNodesAbove(pyramid, node.id);

			// Check if any node above is owned by player or AI
			for (const aboveNode of nodesAbove) {
				const owningNode = pyramid.nodes.find((n) => n.id === aboveNode.id);
				if (owningNode) {
					if (owningNode.ownedByPlayer) {
						// This node belongs to player's network but ONLY if it's below the player's position
						if (isNodeBelow(pyramid, node.id, playerNode.id)) {
							node.ownedByPlayer = true;
							node.inventory = {};
							node.maxInventory = DEFAULT_MAX_INVENTORY;
							assignedSomeNodes = true;
							break;
						}
					} else if (owningNode.aiControlled) {
						// This node belongs to AI's network
						node.aiControlled = true;
						node.aiStrategy = owningNode.aiStrategy;
						node.name = owningNode.name
							? `${owningNode.name}'s Recruit`
							: "AI Recruit";
						// Initialize with empty inventory
						node.inventory = {};
						node.maxInventory = DEFAULT_MAX_INVENTORY;
						// Give some starting money
						node.money = 100 + Math.floor(Math.random() * 200);
						assignedSomeNodes = true;
						break;
					}
				}
			}
		}
	}

	// Add version number to track changes
	pyramid.version = 1;

	// Initialize player inventory with some product
	const playerInventory: { [productId: string]: number } = {};
	productDefinitions.forEach((product) => {
		playerInventory[product.id] = 5; // Start with 5 of each product
	});

	// Set the inventory in player stats (single source of truth)
	initialPlayerStats.inventory = playerInventory;

	// Calculate initial recruit count based on owned nodes
	const playerOwnedNodes = pyramid.nodes.filter(
		(node) => node.ownedByPlayer && !node.isPlayerPosition,
	);

	// Instead of just unmarking excess nodes, we'll remove them completely
	initialRecruits = playerOwnedNodes.length;

	// If we have more than 2 owned nodes, we need to remove the excess nodes
	if (initialRecruits > 2) {
		console.log(
			`Limiting player's owned nodes from ${initialRecruits} to 2 by removing excess nodes`,
		);

		// Sort owned nodes by level (ascending) so we keep nodes closest to player
		const sortedOwnedNodes = [...playerOwnedNodes].sort(
			(a, b) => a.level - b.level,
		);

		// Keep only the first 2 nodes, remove the rest
		const nodesToKeep = sortedOwnedNodes.slice(0, 2);
		const nodesToRemove = sortedOwnedNodes.slice(2);

		// Remove the excess nodes from the pyramid
		for (const nodeToRemove of nodesToRemove) {
			// Remove the node
			const nodeIndex = pyramid.nodes.findIndex(
				(n) => n.id === nodeToRemove.id,
			);
			if (nodeIndex >= 0) {
				pyramid.nodes.splice(nodeIndex, 1);
			}

			// Remove all links connected to this node
			pyramid.links = pyramid.links.filter(
				(link) =>
					link.source !== nodeToRemove.id && link.target !== nodeToRemove.id,
			);
		}

		// Update the recruit count
		initialRecruits = 2;
		console.log(
			`After removal: Pyramid has ${pyramid.nodes.length} nodes and ${pyramid.links.length} links`,
		);
	}

	console.log(
		`Player starting with ${initialRecruits} recruits and ${Object.keys(playerInventory).length} product types`,
	);
	console.log(
		`AI distribution: ${aiCompetitors.map((ai) => ai.name + " (Level " + ai.level + ")").join(", ")}`,
	);

	// Create initial products with ranks
	const products: Product[] = [
		{
			id: "vitamins",
			name: "Essential Vitamins",
			baseCost: 15,
			basePrice: 30,
			downsellPrice: 20,
			baseChance: 0.6,
			ranks: PRODUCT_RANKS,
			playerRank: 0, // Start with no rank
		},
		{
			id: "shakes",
			name: "Protein Shakes",
			baseCost: 20,
			basePrice: 45,
			downsellPrice: 30,
			baseChance: 0.5,
			ranks: PRODUCT_RANKS,
			playerRank: 0,
		},
		{
			id: "skincare",
			name: "Premium Skincare",
			baseCost: 30,
			basePrice: 75,
			downsellPrice: 50,
			baseChance: 0.4,
			ranks: PRODUCT_RANKS,
			playerRank: 0,
		},
		{
			id: "essential-oils",
			name: "Essential Oils",
			baseCost: 25,
			basePrice: 60,
			downsellPrice: 40,
			baseChance: 0.45,
			ranks: PRODUCT_RANKS,
			playerRank: 0,
		},
	];

	// Initialize product purchase stats tracking
	const productPurchases: { [productId: string]: ProductPurchaseStats } = {};
	products.forEach((product) => {
		productPurchases[product.id] = {
			totalPurchased: 0,
			weeklyPurchased: 0,
			currentRank: 0,
			lastPurchase: 0,
		};
	});
	initialPlayerStats.productPurchases = productPurchases;

	// Ensure proper AI network hierarchy by propagating ownership from all AI competitor roots
	// This ensures each AI network follows the correct inheritance structure
	for (const aiCompetitor of aiCompetitors) {
		// Find the AI competitor node
		const aiRootNode = pyramid.nodes.find(
			(node) => node.id === aiCompetitor.id,
		);
		if (aiRootNode) {
			// Propagate ownership from this root node
			pyramid = propagateOwnership(
				pyramid,
				aiRootNode.id,
				false,
				aiRootNode.name,
				aiRootNode.aiStrategy,
			);

			console.log(
				`Propagated AI ownership from ${aiRootNode.name} to downstream nodes`,
			);
		}
	}

	// Return the initial game state
	return {
		pyramid,
		player: {
			...initialPlayerStats,
			currentNodeId: playerNode?.id || "",
			inventory: playerInventory,
			recruits: initialRecruits,
			productPurchases: productPurchases,
		},
		gameLevel: 1,
		turns: 0,
		gameDay: 1,
		gameHour: 9, // Start at 9 AM
		gameOver: false,
		isWinner: false,
		lastDailyEnergyBonus: 0,
		products,
		marketingEvents: [],
	};
};

// Helper function to increment pyramid version
const incrementPyramidVersion = (pyramid: PyramidGraph) => {
	return {
		...pyramid,
		version: (pyramid.version || 0) + 1,
	};
};

// Helper function to ensure player always has nodes to recruit below them
// Now only checks if there are nodes below, but doesn't mark them as potential recruits
// since recruitment is now only via marketing events
const ensureRecruitableNodesBelow = (
	pyramidGraph: PyramidGraph,
	playerNodeId: string,
): PyramidGraph => {
	console.log(`Ensuring nodes below player ${playerNodeId}`);

	// Get the player node
	const playerNode = pyramidGraph.nodes.find(
		(node) => node.id === playerNodeId,
	);
	if (!playerNode) {
		console.error("Player node not found");
		return pyramidGraph;
	}

	// Get nodes directly below the player
	const nodesBelow = pyramidGraph.nodes.filter(
		(node) =>
			node.level === playerNode.level + 1 &&
			pyramidGraph.links.some(
				(link) => link.source === node.id && link.target === playerNode.id,
			),
	);

	console.log(`Found ${nodesBelow.length} nodes directly below player`);

	// If there are fewer than 2 nodes below, add new ones without marking them as potential recruits
	let updatedPyramid = { ...pyramidGraph };
	if (nodesBelow.length < 2 && playerNode.level < 7) {
		const numNodesToAdd = 2 - nodesBelow.length;
		console.log(`Adding ${numNodesToAdd} new nodes below player`);

		for (let i = 0; i < numNodesToAdd; i++) {
			// Add new node to the pyramid
			const result = addNodeToPyramid(
				updatedPyramid,
				playerNode.id,
				playerNode.level + 1,
			);

			updatedPyramid = result.pyramid;

			// Initialize the node with inventory but don't mark as potential recruit
			const newNodeIndex = updatedPyramid.nodes.findIndex(
				(node) => node.id === result.newNodeId,
			);
			if (newNodeIndex >= 0) {
				updatedPyramid.nodes[newNodeIndex] = {
					...updatedPyramid.nodes[newNodeIndex],
					// isPotentialRecruit: true, // Removed - recruitment now only via marketing events
					inventory: {},
					maxInventory: DEFAULT_MAX_INVENTORY,
				};
			}

			console.log(
				`Added new node at level ${playerNode.level + 1}, nodeId: ${result.newNodeId}`,
			);
		}

		// Increment the version to trigger a re-render
		updatedPyramid = incrementPyramidVersion(updatedPyramid);
	}

	return updatedPyramid;
};

// Process day cycle - AI behaviors and passive game mechanics
// Note: Auto-trading is limited by PLAYER_INVENTORY_TRADE_CHANCE and AI_INVENTORY_TRADE_CHANCE constants
// Players should be incentivized to grow their network rather than relying solely on passive income
const processDayCycle = (state: GameState): GameState => {
	let updatedNodes = [...state.pyramid.nodes];
	let updatedLinks = [...state.pyramid.links];
	let newRecruits = state.player.recruits;
	let updatedPyramid = {
		...state.pyramid,
		nodes: updatedNodes,
		links: updatedLinks,
	};
	let pyramidChanged = false;
	// Track player commissions from downstream sales
	let playerCommissions = 0;

	// Debug log
	console.log(
		`%c[DAY CYCLE] Processing day ${state.gameDay}`,
		"background: #3f51b5; color: white; padding: 2px 5px; border-radius: 3px;",
	);

	// 1. AI behavior: buy inventory and manage sales
	// Process AI nodes - buy inventory and process random sales
	updatedNodes = updatedNodes.map((node) => {
		// Skip player nodes and nodes without AI control
		if (node.isPlayerPosition || !node.aiControlled) {
			return node;
		}

		// Initialize node inventory if it doesn't exist
		const nodeInventory = node.inventory || {};
		let nodeMoney = node.money || 0;
		let updatedInventory = { ...nodeInventory };

		// Products that this AI node might want to buy
		// Higher level nodes (closer to top) prefer more expensive products
		const aiProducts = [...state.products].sort((a, b) => {
			// If aggressive strategy, prefer higher margin products
			if (node.aiStrategy === "aggressive") {
				const marginA = a.basePrice - a.baseCost;
				const marginB = b.basePrice - b.baseCost;
				return marginB - marginA;
			}
			// If steady strategy, prefer products that sell more consistently
			return b.baseChance - a.baseChance;
		});

		// AI nodes buy inventory if they have enough money and space
		const totalInventory = Object.values(updatedInventory).reduce(
			(sum, qty) => sum + qty,
			0,
		);
		const inventorySpace = node.maxInventory - totalInventory;

		if (inventorySpace > 0 && nodeMoney > 50) {
			// AI node decides to buy products with 60% chance
			if (Math.random() < 0.6) {
				const product = aiProducts[0]; // Pick the preferred product

				// Determine quantity based on strategy and money
				let buyQuantity;
				if (node.aiStrategy === "aggressive") {
					// Aggressive nodes spend more on inventory
					buyQuantity = Math.min(
						Math.floor(nodeMoney / (product.baseCost * 2)),
						inventorySpace,
						5 + Math.floor(Math.random() * 5), // 5-10 items
					);
				} else {
					// Steady nodes are more conservative
					buyQuantity = Math.min(
						Math.floor(nodeMoney / (product.baseCost * 3)),
						inventorySpace,
						3 + Math.floor(Math.random() * 3), // 3-5 items
					);
				}

				// Ensure at least 1 item if buying
				if (buyQuantity > 0) {
					const cost = product.baseCost * buyQuantity;

					// Update inventory and deduct money
					updatedInventory[product.id] =
						(updatedInventory[product.id] || 0) + buyQuantity;
					nodeMoney -= cost;

					console.log(
						`[AI PURCHASE] ${node.name || "AI Node"} bought ${buyQuantity} ${product.name} for $${cost}`,
					);
				}
			}
		}

		// Process random sales for AI node
		// Similar to how player would automatically sell to random people
		for (const product of state.products) {
			const productQuantity = updatedInventory[product.id] || 0;

			if (productQuantity > 0) {
				// Calculate sale chance based on node level and product
				// Higher level nodes are better at selling
				const levelBonus = (7 - node.level) * NODE_SALE_LEVEL_BONUS;
				const saleChance = Math.min(
					0.7,
					product.baseChance + NODE_RANDOM_SALE_CHANCE + levelBonus,
				);

				// Determine how many sales attempts to make based on inventory
				const saleAttempts = Math.min(
					productQuantity,
					1 + Math.floor(Math.random() * 3),
				); // 1-3 attempts

				let salesMade = 0;
				for (let i = 0; i < saleAttempts; i++) {
					if (Math.random() < saleChance) {
						salesMade++;
					}
				}

				// Process successful sales
				if (salesMade > 0) {
					// Remove sold items from inventory
					updatedInventory[product.id] = Math.max(
						0,
						productQuantity - salesMade,
					);

					// Add money from sales
					const revenue = salesMade * product.basePrice;
					nodeMoney += revenue;

					console.log(
						`[AI SALES] ${node.name || "AI Node"} sold ${salesMade} ${product.name} for $${revenue}`,
					);
				}
			}
		}

		// Return updated node
		return {
			...node,
			money: nodeMoney,
			inventory: updatedInventory,
			lastUpdated: Date.now(),
		};
	});

	// 2. Process AI recruitment behavior
	// Make the AI more competitive by giving them a chance to recruit nodes
	const aiChanceToRecruit = AI_NODE_RECRUIT_CHANCE; // Chance for AI to try recruiting
	const shouldAIRecruit = Math.random() < aiChanceToRecruit;

	if (shouldAIRecruit) {
		// Look for unowned nodes that could be recruited by the AI
		const unownedNodes = updatedNodes.filter(
			(node) =>
				!node.ownedByPlayer && !node.aiControlled && !node.isPlayerPosition,
		);

		if (unownedNodes.length > 0) {
			// Choose a random unowned node to recruit
			const targetIndex = Math.floor(Math.random() * unownedNodes.length);
			const targetNode = unownedNodes[targetIndex];

			// Find a suitable parent for the AI node (either another AI node or a neutral node)
			const potentialParentLinks = updatedLinks.filter(
				(link) => link.source === targetNode.id,
			);

			if (potentialParentLinks.length > 0) {
				// Choose a random parent
				const randomParentLink =
					potentialParentLinks[
						Math.floor(Math.random() * potentialParentLinks.length)
					];
				const parentId = randomParentLink.target;

				// Find the parent node
				const parentNodeIndex = updatedNodes.findIndex(
					(node) => node.id === parentId,
				);

				if (parentNodeIndex >= 0) {
					// Mark the parent as AI controlled if it's not player-owned
					if (!updatedNodes[parentNodeIndex].ownedByPlayer) {
						// If the parent is not already AI controlled, create a new AI identity
						const aiStrategy = Math.random() < 0.5 ? "aggressive" : "steady";
						const aiName = updatedNodes[parentNodeIndex].aiControlled
							? updatedNodes[parentNodeIndex].name
							: `Competitor ${Math.floor(Math.random() * 1000)}`;

						updatedNodes[parentNodeIndex] = {
							...updatedNodes[parentNodeIndex],
							aiControlled: true,
							aiStrategy: updatedNodes[parentNodeIndex].aiControlled
								? updatedNodes[parentNodeIndex].aiStrategy
								: aiStrategy,
							name: aiName,
							lastUpdated: Date.now(),
							inventory: updatedNodes[parentNodeIndex].inventory || {},
							maxInventory: DEFAULT_MAX_INVENTORY,
						};
					}

					// Find the index of the target node
					const nodeIndex = updatedNodes.findIndex(
						(node) => node.id === targetNode.id,
					);

					if (nodeIndex >= 0) {
						const parentNode = updatedNodes[parentNodeIndex];

						// Mark the target node as AI controlled
						updatedNodes[nodeIndex] = {
							...updatedNodes[nodeIndex],
							aiControlled: true,
							aiStrategy: parentNode.aiStrategy,
							name: `${parentNode.name}'s Recruit`,
							lastUpdated: Date.now(),
							inventory: {}, // Initialize empty inventory
							maxInventory: DEFAULT_MAX_INVENTORY,
						};

						pyramidChanged = true;

						console.log(
							`[AI RECRUITMENT] AI recruited node at level ${targetNode.level}, ID: ${targetNode.id}`,
						);

						// Build updated pyramid with newly added AI node
						updatedPyramid = {
							...updatedPyramid,
							nodes: updatedNodes,
							links: updatedLinks,
						};

						// Propagate ownership from the parent node to ensure all child nodes
						// are properly assigned to the same AI network
						updatedPyramid = propagateOwnership(
							updatedPyramid,
							parentId,
							false,
							parentNode.name,
							parentNode.aiStrategy,
						);

						// Update node references after propagation
						updatedNodes = updatedPyramid.nodes;
						updatedLinks = updatedPyramid.links;

						// Add AI expansion behavior
						if (Math.random() < AI_NODE_EXPANSION_CHANCE) {
							// Add a new potential recruit node under the AI node
							const result = addNodeToPyramid(
								updatedPyramid,
								targetNode.id,
								targetNode.level + 1,
							);
							updatedPyramid = result.pyramid;
							updatedNodes = updatedPyramid.nodes;
							updatedLinks = updatedPyramid.links;

							console.log(
								`[AI EXPANSION] AI added new potential recruit node below ${targetNode.id}`,
							);

							// Re-propagate ownership after adding new node
							updatedPyramid = propagateOwnership(
								updatedPyramid,
								parentId,
								false,
								parentNode.name,
								parentNode.aiStrategy,
							);

							// Update node references again
							updatedNodes = updatedPyramid.nodes;
							updatedLinks = updatedPyramid.links;
						}
					}
				}
			}
		}
	}

	// 3. Process inventory trading and recursive selling with commissions
	// First, make a copy of updated nodes to track changes during this process
	let nodesAfterTrading = [...updatedNodes];

	// Random chance to trade inventory from upstream to downstream nodes
	const aiNodesWithInventory = updatedNodes.filter(
		(node) =>
			node.aiControlled &&
			node.inventory &&
			Object.values(node.inventory || {}).some((qty) => qty > 0),
	);

	// For each AI node with inventory, try to trade with nodes beneath them
	for (const aiNode of aiNodesWithInventory) {
		// Find nodes directly below this AI node
		const nodesBelow = getNodesBelow(updatedPyramid, aiNode.id);
		const belowAINodes = nodesBelow.filter(
			(node) => node.aiControlled && !node.isPlayerPosition,
		);

		// Debug AI trading attempt
		console.log(
			`[DEBUG AI TRADING] AI Node ${aiNode.id} has ${Object.keys(aiNode.inventory || {}).length} product types`,
		);
		console.log(
			`[DEBUG AI TRADING] Found ${belowAINodes.length} AI nodes below for potential trading`,
		);

		// Random chance to attempt trades with downstream nodes (using adjustable constant)
		if (belowAINodes.length > 0 && Math.random() < AI_INVENTORY_TRADE_CHANCE) {
			console.log(
				`[DEBUG AI TRADING] Trade attempt passed random check (${AI_INVENTORY_TRADE_CHANCE * 100}% chance)`,
			);
			// Pick a random product to trade from inventory
			const productsInInventory = Object.entries(aiNode.inventory || {})
				.filter(([_, qty]) => (qty || 0) > 0)
				.map(([id]) => id);

			if (productsInInventory.length > 0) {
				const randomProductId =
					productsInInventory[
						Math.floor(Math.random() * productsInInventory.length)
					];
				const product = state.products.find((p) => p.id === randomProductId);

				if (product) {
					// Pick a random node below to trade with
					const targetBelowNode =
						belowAINodes[Math.floor(Math.random() * belowAINodes.length)];
					const targetNodeIndex = nodesAfterTrading.findIndex(
						(n) => n.id === targetBelowNode.id,
					);

					if (targetNodeIndex >= 0) {
						// Calculate available space in target node
						const targetInventory =
							nodesAfterTrading[targetNodeIndex].inventory || {};
						const totalTargetInventory = Object.values(targetInventory).reduce(
							(sum, qty) => sum + qty,
							0,
						);
						const availableSpace =
							nodesAfterTrading[targetNodeIndex].maxInventory -
							totalTargetInventory;

						if (availableSpace > 0) {
							// Determine quantity to trade (1-3 items)
							const tradeQuantity = Math.min(
								1 + Math.floor(Math.random() * 2),
								aiNode.inventory?.[randomProductId] || 0,
								availableSpace,
							);

							if (tradeQuantity > 0) {
								// Calculate payment from downstream node to player (wholesale price)
								// Use the downsellPrice as the wholesale price - this is what downstream nodes pay
								const paymentAmount = product.downsellPrice * tradeQuantity;

								// Check if downstream node has enough money
								const nodeHasMoney =
									(updatedNodes[targetNodeIndex].money || 0) >= paymentAmount;

								if (nodeHasMoney) {
									// AI node trading - we don't modify player inventory here
									// Instead, transfer products between AI nodes

									// Get the current inventory of the AI node
									const updatedAINodeInventory = {
										...(aiNode.inventory || {}),
									};

									// Reduce inventory in source node
									updatedAINodeInventory[randomProductId] = Math.max(
										0,
										(updatedAINodeInventory[randomProductId] || 0) -
											tradeQuantity,
									);

									// Find the AI node index to update
									const aiNodeIndex = updatedNodes.findIndex(
										(n) => n.id === aiNode.id,
									);
									if (aiNodeIndex >= 0) {
										updatedNodes[aiNodeIndex] = {
											...updatedNodes[aiNodeIndex],
											inventory: updatedAINodeInventory,
											lastUpdated: Date.now(),
										};
									}

									// Update target node's inventory
									const updatedTargetInventory = { ...targetInventory };
									updatedTargetInventory[randomProductId] =
										(updatedTargetInventory[randomProductId] || 0) +
										tradeQuantity;

									// Transfer money from node to AI node
									updatedNodes[targetNodeIndex] = {
										...updatedNodes[targetNodeIndex],
										inventory: updatedTargetInventory,
										money:
											(updatedNodes[targetNodeIndex].money || 0) -
											paymentAmount,
										lastUpdated: Date.now(),
									};

									// Add money to the AI node that sold the products
									if (aiNodeIndex >= 0) {
										updatedNodes[aiNodeIndex] = {
											...updatedNodes[aiNodeIndex],
											money:
												(updatedNodes[aiNodeIndex].money || 0) + paymentAmount,
											lastUpdated: Date.now(),
										};
									}

									console.log(
										`[AI TRADE] ${aiNode.name || "AI Node"} sold ${tradeQuantity} ${product.name} to ${nodesAfterTrading[targetNodeIndex].name || "another node"} for $${paymentAmount}`,
									);
								} else {
									console.log(
										`[DEBUG TRADING] Node has insufficient funds ($${updatedNodes[targetNodeIndex].money || 0}) to purchase ${tradeQuantity} ${product.name} for $${paymentAmount}`,
									);
								}
							} else {
								console.log(
									`[DEBUG TRADING] Trade quantity was 0, no trade occurred`,
								);
							}
						} else {
							console.log(
								`[DEBUG TRADING] Target node has no available space for new inventory`,
							);
						}
					} else {
						console.log(
							`[DEBUG TRADING] Target node not found in pyramid nodes`,
						);
					}
				} else {
					console.log(
						`[DEBUG TRADING] Product not found for ID: ${randomProductId} or quantity is 0`,
					);
				}
			}
		}
	}

	// 4. ADDED: Process player inventory trading
	// Find player node and player-owned nodes with inventory
	const playerNode = nodesAfterTrading.find((node) => node.isPlayerPosition);
	console.log(
		`[DEBUG TRADING] Player node found: ${!!playerNode}, Node ID: ${playerNode?.id}`,
	);

	// Process player inventory trading using the player stats inventory as source of truth
	const tradingResult = processPlayerInventoryTrading(
		updatedPyramid,
		playerNode || { id: "player-fallback", isPlayerPosition: true },
		nodesAfterTrading,
		state,
	);

	// Update nodes and track the updated player inventory
	nodesAfterTrading = tradingResult.updatedNodes;
	const playerInventoryAfterTrading = tradingResult.updatedPlayerInventory;
	const playerMoneyFromTrades = tradingResult.moneyFromTrades;

	// After trading, process sales and commissions recursively
	// This is the second phase where nodes try to sell products and pass commissions up
	// We need to process from bottom to top to ensure commissions flow upward correctly

	// Debug the state of all node inventories after trading for verification
	nodesAfterTrading.forEach((node) => {
		if (node.ownedByPlayer) {
			console.log(
				`Node ${node.id} (owned by player, level ${node.level}): ${JSON.stringify(node.inventory || {})}`,
			);
		}
	});

	// Get all AI nodes sorted by level (bottom to top)
	const sortedAINodes = nodesAfterTrading
		.filter((node) => node.aiControlled)
		.sort((a, b) => b.level - a.level); // Sort by level descending (bottom to top)

	// Get all player-owned nodes (except player position) sorted the same way
	const playerOwnedNodes = nodesAfterTrading
		.filter((node) => node.ownedByPlayer && !node.isPlayerPosition)
		.sort((a, b) => b.level - a.level);

	// Combine both sets of nodes for processing, ensuring player nodes are included
	const allNodesToProcess = [...sortedAINodes, ...playerOwnedNodes];

	// For each node (starting from bottom), try to sell and pass commissions up
	for (const node of allNodesToProcess) {
		// Skip if no inventory
		if (
			!node.inventory ||
			Object.values(node.inventory).every((qty) => qty === 0)
		) {
			continue;
		}

		// Calculate sales and revenue
		let nodeRevenue = 0;

		// Process random sales for this node
		for (const product of state.products) {
			const productQuantity = node.inventory[product.id] || 0;

			if (productQuantity > 0) {
				// Chance to make a sale based on level and product
				// Player-owned nodes get a bonus to sale chance
				const levelBonus = (7 - node.level) * NODE_SALE_LEVEL_BONUS;
				const ownershipBonus = node.ownedByPlayer ? PLAYER_OWNED_SALE_BONUS : 0; // 10% bonus for player-owned nodes
				const saleChance = Math.min(
					0.6, // Maximum cap on sale chance
					product.baseChance +
						NODE_RANDOM_SALE_CHANCE +
						levelBonus +
						ownershipBonus,
				);

				// Try to sell up to 2 items
				const maxSaleAttempts = Math.min(2, productQuantity);
				let salesMade = 0;

				for (let i = 0; i < maxSaleAttempts; i++) {
					if (Math.random() < saleChance) {
						salesMade++;
					}
				}

				if (salesMade > 0) {
					// Calculate revenue
					const saleRevenue = salesMade * product.basePrice;
					nodeRevenue += saleRevenue;

					// Update inventory
					const nodeIndex = nodesAfterTrading.findIndex(
						(n) => n.id === node.id,
					);
					if (nodeIndex >= 0) {
						const updatedNodeInventory = {
							...nodesAfterTrading[nodeIndex].inventory,
						};
						updatedNodeInventory[product.id] = Math.max(
							0,
							productQuantity - salesMade,
						);

						nodesAfterTrading[nodeIndex] = {
							...nodesAfterTrading[nodeIndex],
							inventory: updatedNodeInventory,
						};
					}

					const nodeType = node.ownedByPlayer
						? "Your recruit"
						: node.name || "AI Node";
					console.log(
						`[RECURSIVE SALES] ${nodeType} sold ${salesMade} ${product.name} for $${saleRevenue}`,
					);
				}
			}
		}

		// If revenue was generated, distribute commissions up the pyramid
		if (nodeRevenue > 0) {
			// Find the current node's index
			const currentNodeIndex = nodesAfterTrading.findIndex(
				(n) => n.id === node.id,
			);

			// First, the node itself keeps 80% of revenue
			nodesAfterTrading[currentNodeIndex] = {
				...nodesAfterTrading[currentNodeIndex],
				money:
					(nodesAfterTrading[currentNodeIndex].money || 0) + nodeRevenue * 0.8,
				lastUpdated: Date.now(),
			};

			// Then, distribute 20% commission to the node above
			const nodesAbove = getNodesAbove(updatedPyramid, node.id);

			if (nodesAbove.length > 0) {
				// For simplicity, we'll give commission to the first node above
				const upstreamNode = nodesAbove[0];
				const upstreamNodeIndex = nodesAfterTrading.findIndex(
					(n) => n.id === upstreamNode.id,
				);

				if (upstreamNodeIndex >= 0) {
					const commission = nodeRevenue * 0.2; // 20% commission

					// Check if the upstream node is the player's position
					if (nodesAfterTrading[upstreamNodeIndex].isPlayerPosition) {
						// If player is the upstream node, record the commission to apply later
						// We'll capture this in a variable and add it to player money at the end
						const playerCommission = commission;

						// Track commissions to add to player money at the end
						playerCommissions = (playerCommissions || 0) + commission;

						console.log(
							`[COMMISSION] You received $${commission.toFixed(2)} commission from your downstream recruit's sales`,
						);
					} else {
						// Otherwise add commission to the node's money
						nodesAfterTrading[upstreamNodeIndex] = {
							...nodesAfterTrading[upstreamNodeIndex],
							money:
								(nodesAfterTrading[upstreamNodeIndex].money || 0) + commission,
							lastUpdated: Date.now(),
						};

						const upstreamName = upstreamNode.isPlayerPosition
							? "You"
							: upstreamNode.aiControlled
								? upstreamNode.name || "AI Node"
								: "Your Network";

						const downstreamName = node.ownedByPlayer
							? "Your Recruit"
							: node.name || "Downstream Node";

						console.log(
							`[COMMISSION] ${upstreamName} received $${commission.toFixed(2)} commission from ${downstreamName}`,
						);
					}
				}
			}
		}
	}

	// Update nodes after trading and commission processing
	updatedNodes = nodesAfterTrading;

	// Update pyramid with new node states
	updatedPyramid = {
		...updatedPyramid,
		nodes: updatedNodes,
	};

	// Only increment version if the pyramid structure changed
	if (pyramidChanged) {
		updatedPyramid = incrementPyramidVersion(updatedPyramid);
		console.log(`[PYRAMID] Version updated to ${updatedPyramid.version}`);
	} else {
		updatedPyramid = {
			...updatedPyramid,
			version: updatedPyramid.version + 1, // Always update version to refresh UI
		};
		console.log(
			"[PYRAMID] No structural changes to pyramid, but refreshing UI",
		);
	}

	// Log for debugging - we now maintain player inventory in player stats only
	console.log(
		"[PLAYER INVENTORY] After trading:",
		JSON.stringify(playerInventoryAfterTrading),
	);

	// Update the player's money with commission
	console.log(
		`%c[DAY SUMMARY] You earned $${playerCommissions.toFixed(2)} in commissions from your network's sales and $${playerMoneyFromTrades.toFixed(2)} from trading products to your downstream recruits.`,
		"background: #3f51b5; color: white; padding: 3px 6px; border-radius: 3px; font-weight: bold;",
	);

	return {
		...state,
		pyramid: updatedPyramid,
		player: {
			...state.player,
			recruits: newRecruits,
			// Use the inventory from trading operations
			inventory: playerInventoryAfterTrading,
			// Add any commissions earned to player's money, plus money from trades
			money: state.player.money + playerCommissions + playerMoneyFromTrades,
		},
	};
};

// Advance game time
const advanceGameTime = (state: GameState, hours: number): GameState => {
	let updatedState = { ...state };
	let newDay = state.gameDay;
	let newHour = state.gameHour + hours;

	// Check for day rollover
	while (newHour >= 24) {
		newHour -= 24;
		newDay += 1;
	}

	// Check for energy regeneration if not resting
	if (!state.player.isResting) {
		// Energy regenerates at a rate of +1 per 3 in-game hours
		let newEnergy = state.player.energy;
		const energyGain = Math.floor(hours / 3);
		if (energyGain > 0) {
			newEnergy = Math.min(MAX_ENERGY, newEnergy + energyGain);
		}

		updatedState = {
			...updatedState,
			player: {
				...updatedState.player,
				energy: newEnergy,
			},
		};
	}

	// Process daily energy bonus when the day changes
	if (newDay > state.gameDay) {
		const currentTimestamp = Date.now();
		const hoursElapsed = Math.floor(
			(currentTimestamp - state.lastDailyEnergyBonus) / (1000 * 60 * 60),
		);

		// If it has been at least 16 real-world hours since the last bonus
		// This prevents players from burning through days too quickly to stack bonuses
		if (hoursElapsed >= 16 || state.lastDailyEnergyBonus === 0) {
			updatedState = {
				...updatedState,
				player: {
					...updatedState.player,
					energy: Math.min(MAX_ENERGY, updatedState.player.energy + 3),
				},
				lastDailyEnergyBonus: currentTimestamp,
			};

			console.log("[ENERGY] Daily energy bonus granted (+3)");
		}

		// Check if we have a week change (every 7 days)
		const isWeekChange = Math.floor(newDay / 7) > Math.floor(state.gameDay / 7);
		if (isWeekChange) {
			console.log("[TIME] Week changed, processing weekly updates");
			updatedState = processWeeklyUpdate(updatedState);
		}

		// Process day cycle (sales, recruits, etc.) for AI nodes
		updatedState = processDayCycle(updatedState);

		// Also process random sales for the player based on their inventory
		updatedState = processPlayerRandomSales(updatedState);

		// For debugging, check player's position after day cycle
		const playerNode = updatedState.pyramid.nodes.find(
			(node) => node.isPlayerPosition,
		);
		console.log(
			`[DAY COMPLETE] Player at node ${playerNode?.id}, level ${playerNode?.level}`,
		);
	}

	// Process active marketing events
	const updatedEvents = [...updatedState.marketingEvents];
	for (let i = 0; i < updatedEvents.length; i++) {
		const event = updatedEvents[i];
		// Reduce event hours
		event.remainingHours = Math.max(0, event.remainingHours - hours);

		// If event is complete, process results
		if (event.remainingHours <= 0) {
			// Depending on the event purpose, handle results
			if (event.purpose === "recruitment") {
				// Process recruitment event and get the updated state
				updatedState = processRecruitmentEvent(updatedState, event);
				// Remove the completed event
				updatedEvents.splice(i, 1);
				i--;
			}
			// Add other purposes as needed
		}
	}

	// Apply the updated marketing events list to the state
	updatedState = {
		...updatedState,
		gameDay: newDay,
		gameHour: newHour,
		marketingEvents: updatedEvents,
	};

	return updatedState;
};

// Helper function to process player's random product sales
const processPlayerRandomSales = (state: GameState): GameState => {
	console.log(`Processing player's random product sales`);

	let playerInventory = { ...state.player.inventory };
	let playerMoney = state.player.money;
	let totalSalesRandom = state.player.totalSalesRandom;
	let totalRevenue = 0;
	let totalItemsSold = 0;

	// Try to sell each product type
	for (const product of state.products) {
		const productQuantity = playerInventory[product.id] || 0;

		if (productQuantity > 0) {
			// Calculate sale chance based on charisma and product
			const charismaBonus = state.player.charisma * CHARISMA_SALE_BONUS; // 5% per charisma point
			const saleChance = Math.min(0.15, product.baseChance + charismaBonus);

			// Determine how many sales attempts based on inventory and charisma
			// More charisma = more sales attempts per day
			const saleAttempts = Math.min(
				productQuantity,
				1 +
					Math.floor(state.player.charisma / 2) +
					Math.floor(Math.random() * 3),
			);

			let salesMade = 0;
			for (let i = 0; i < saleAttempts; i++) {
				if (Math.random() < saleChance) {
					salesMade++;
				}
			}

			// Process successful sales
			if (salesMade > 0) {
				// Remove sold items from inventory
				playerInventory[product.id] = Math.max(0, productQuantity - salesMade);

				// Add money from sales
				const revenue = salesMade * product.basePrice;
				playerMoney += revenue;
				totalRevenue += revenue;
				totalItemsSold += salesMade;
				totalSalesRandom += salesMade;

				console.log(
					`[PLAYER SALES] Automatically sold ${salesMade} ${product.name} for $${revenue} (${Math.round(saleChance * 100)}% chance)`,
				);
			}
		}
	}

	if (totalItemsSold > 0) {
		console.log(
			`[PLAYER SALES] Total daily sales: ${totalItemsSold} items for $${totalRevenue}`,
		);
	} else {
		console.log(`[PLAYER SALES] No sales made today`);
	}

	// Update player stats
	return {
		...state,
		player: {
			...state.player,
			inventory: playerInventory,
			money: playerMoney,
			totalSalesRandom: totalSalesRandom,
		},
	};
};

// Helper function to generate marketing results
const generateMarketingResults = (event: MarketingEvent): number => {
	let successfulAttempts = 0;

	// Calculate additional attempts from investment
	let attemptBonus = 0;
	if (event.investmentAmount && event.purpose === "recruitment") {
		attemptBonus = Math.floor(
			event.investmentAmount * INVESTMENT_ATTEMPTS_MULTIPLIER,
		);
	}

	const totalAttempts = event.maxAttempts + attemptBonus;

	// Calculate investment-boosted success chance
	let adjustedChance = event.successChance;
	if (event.investmentAmount) {
		const investmentBonus = Math.min(
			0.15,
			event.investmentAmount * INVESTMENT_SUCCESS_MULTIPLIER,
		);
		adjustedChance = Math.min(0.95, adjustedChance + investmentBonus);
	}

	console.log(
		`[DEBUG] Running ${totalAttempts} attempts with ${Math.round(adjustedChance * 100)}% success chance each`,
	);

	// Try the maximum number of attempts
	for (let i = 0; i < totalAttempts; i++) {
		const roll = Math.random();
		const isSuccess = roll < adjustedChance;
		console.log(
			`[DEBUG] Attempt ${i + 1}: Roll ${Math.round(roll * 100)}% vs ${Math.round(adjustedChance * 100)}% chance - ${isSuccess ? "SUCCESS" : "FAILURE"}`,
		);

		if (isSuccess) {
			successfulAttempts++;
		}
	}

	// Special case for workshops: 10% chance for extra recruit for each success
	if (event.type === "workshop") {
		console.log(
			`[DEBUG] Workshop bonus: Checking for extra recruits on ${successfulAttempts} successes`,
		);
		for (let i = 0; i < successfulAttempts; i++) {
			const bonusRoll = Math.random();
			const bonusSuccess = bonusRoll < WORKSHOP_EXTRA_RECRUIT_CHANCE;
			console.log(
				`[DEBUG] Workshop bonus attempt ${i + 1}: Roll ${Math.round(bonusRoll * 100)}% vs ${Math.round(WORKSHOP_EXTRA_RECRUIT_CHANCE * 100)}% chance - ${bonusSuccess ? "SUCCESS" : "FAILURE"}`,
			);

			if (bonusSuccess) {
				successfulAttempts++;
				console.log(`Workshop bonus: Extra recruit awarded!`);
			}
		}
	}

	console.log(
		`Marketing event results: ${successfulAttempts} successes from ${totalAttempts} attempts (${Math.round(adjustedChance * 100)}% chance)`,
	);

	return successfulAttempts;
};

// Helper function to process recruitment marketing events
const processRecruitmentEvent = (
	state: GameState,
	event: MarketingEvent,
): GameState => {
	console.log(
		`[DEBUG] **** PROCESS RECRUITMENT EVENT FUNCTION CALLED **** for "${event.name}"`,
	);
	// Generate results for completed recruitment marketing event
	const successAttempts = generateMarketingResults(event);

	console.log(
		`Recruitment event "${event.name}" completed with ${successAttempts} successful recruits found`,
	);

	// If no recruits, return unchanged state
	if (successAttempts === 0) {
		console.log(`No potential recruits generated from ${event.name}`);
		return state;
	}

	// Create a copy of the pyramid to modify
	let updatedPyramid = { ...state.pyramid };
	let updatedNodes = [...updatedPyramid.nodes];
	let newRecruits = state.player.recruits;
	let pyramidChanged = false;

	// Get player node to add recruits below
	const playerNode = updatedNodes.find((node) => node.isPlayerPosition);
	if (!playerNode) {
		console.error("Player node not found");
		return state;
	}

	// Count current player-owned nodes (excluding player position)
	const currentOwnedNodes = updatedNodes.filter(
		(node) => node.ownedByPlayer && !node.isPlayerPosition,
	).length;

	console.log(
		`Current owned nodes: ${currentOwnedNodes}, Processing all ${successAttempts} successful recruits`,
	);

	// Process all successful recruitment attempts - no more maximum limit
	const attemptsToProcess = successAttempts;
	console.log(`Processing ${attemptsToProcess} successful recruits from event`);

	// Process each successful recruit attempt
	for (let i = 0; i < attemptsToProcess; i++) {
		// We already have successful attempts from the marketing event, so we'll
		// directly add them as recruits without an additional random check
		console.log(`Adding recruit attempt ${i + 1} - SUCCESS`);

		// Add new node to the pyramid below the player
		const result = addNodeToPyramid(
			updatedPyramid,
			playerNode.id,
			playerNode.level + 1,
		);

		updatedPyramid = result.pyramid;
		updatedNodes = updatedPyramid.nodes;

		// Mark the new node as owned by player
		const newNodeIndex = updatedNodes.findIndex(
			(node) => node.id === result.newNodeId,
		);

		if (newNodeIndex >= 0) {
			updatedNodes[newNodeIndex] = {
				...updatedNodes[newNodeIndex],
				ownedByPlayer: true,
				lastUpdated: Date.now(),
				// Initialize inventory
				inventory: {},
				maxInventory: DEFAULT_MAX_INVENTORY,
			};

			// Mark that the pyramid has changed and increment recruit count
			pyramidChanged = true;
			newRecruits++;

			console.log(`Recruits count increased to ${newRecruits}`);
			console.log(
				`Marketing event success: Added new recruit node at level ${playerNode.level + 1}, ID: ${result.newNodeId}`,
			);
		}
	}

	// Update the nodes in the pyramid
	updatedPyramid = {
		...updatedPyramid,
		nodes: updatedNodes,
	};

	// Update pyramid version if changed
	if (pyramidChanged) {
		updatedPyramid = incrementPyramidVersion(updatedPyramid);
	}

	// Return updated state
	return {
		...state,
		pyramid: updatedPyramid,
		player: {
			...state.player,
			recruits: newRecruits,
		},
	};
};

// Game state reducer
const gameReducer = (state: GameState, action: GameAction): GameState => {
	// If player is resting, they can only perform certain actions
	if (
		state.player.isResting &&
		action.type !== "ADVANCE_TIME" &&
		action.type !== "RESET_GAME"
	) {
		return state;
	}

	switch (action.type) {
		case "ADVANCE_TIME": {
			// Add console logging to help debug

			// Call our existing advanceGameTime function to handle the time advancement
			const newState = advanceGameTime(state, action.hours);

			return newState;
		}

		case "SET_GAME_OVER": {
			console.log(
				`[REDUCER] Setting game over: ${action.isWinner ? "WINNER" : "LOSER"}`,
			);
			return {
				...state,
				gameOver: true,
				isWinner: action.isWinner,
			};
		}

		case "NETWORK_MARKETING": {
			const {
				intensity,
				purpose = "recruitment", // Default to recruitment now
				eventName,
				investmentAmount = 0,
			} = action;
			const { player } = state;

			let duration = 0;
			let energyCost = 0;
			let eventType: "social-media" | "home-party" | "workshop";
			let baseReward = { min: 0, max: 0 };
			let displayName = "";

			// Set parameters based on intensity
			switch (intensity) {
				case "light":
					duration = SOCIAL_MEDIA_DURATION;
					energyCost = SOCIAL_MEDIA_ENERGY;
					eventType = "social-media";
					baseReward = { min: 1, max: 1 };
					displayName = eventName || "Social Media Recruitment";
					break;
				case "medium":
					duration = HOME_PARTY_DURATION;
					energyCost = HOME_PARTY_ENERGY;
					eventType = "home-party";
					baseReward = { min: 1, max: 2 };
					displayName = eventName || "Home Recruitment Party";
					break;
				case "aggressive":
					duration = PUBLIC_WORKSHOP_DURATION;
					eventType = "workshop";
					energyCost = PUBLIC_WORKSHOP_ENERGY;
					baseReward = { min: 2, max: 4 };
					displayName = eventName || "Recruitment Seminar";
					break;
				default:
					return state; // Invalid intensity
			}

			// Check if player has enough energy
			if (player.energy < energyCost) {
				console.log(`Not enough energy to start ${displayName}`);
				return state;
			}

			// Check if player has enough money for the investment (if applicable)
			if (investmentAmount > 0 && player.money < investmentAmount) {
				console.log(
					`Not enough money for the investment amount of $${investmentAmount}`,
				);
				return state;
			}

			// Calculate success chance based on event type
			const successChance =
				eventType === "social-media"
					? SOCIAL_MEDIA_SUCCESS_CHANCE
					: eventType === "home-party"
						? HOME_PARTY_SUCCESS_CHANCE
						: WORKSHOP_SUCCESS_CHANCE;

			// Calculate max attempts based on charisma
			const maxAttempts =
				intensity === "light"
					? 2 + Math.floor(player.charisma / 2)
					: intensity === "medium"
						? 4 + Math.floor(player.charisma / 2)
						: 6 + Math.floor(player.charisma / 2);

			// Create a new marketing event
			const newEvent: MarketingEvent = {
				id: `marketing-${Date.now()}`,
				type: eventType,
				purpose: "recruitment",
				name: displayName,
				remainingHours: duration,
				totalHours: duration,
				successChance,
				baseReward,
				maxAttempts,
				investmentAmount: investmentAmount > 0 ? investmentAmount : undefined,
			};

			console.log(
				`Started ${displayName} recruitment event for ${duration} hours`,
			);
			if (investmentAmount > 0) {
				console.log(`Additional investment: $${investmentAmount}`);
			}

			// Add event, deduct energy and investment amount
			return {
				...state,
				marketingEvents: [...state.marketingEvents, newEvent],
				player: {
					...player,
					energy: player.energy - energyCost,
					money: player.money - investmentAmount,
				},
			};
		}

		case "MOVE_UP": {
			// Check if player has enough energy
			if (state.player.energy < 3) {
				return state;
			}

			const targetNode = state.pyramid.nodes.find(
				(node) => node.id === action.targetNodeId,
			);
			if (!targetNode) {
				return state;
			}

			// Check if the node is above the player and directly connected
			const nodesAbove = getNodesAbove(
				state.pyramid,
				state.player.currentNodeId,
			);
			const canMoveUp = nodesAbove.some(
				(node) => node.id === action.targetNodeId,
			);

			if (!canMoveUp) {
				return state;
			}

			// Check if player has enough recruits to move up
			// Make it harder to move up levels - require more recruits per level
			const requiredRecruits = Math.ceil((7 - targetNode.level) * 1.8); // Increased from 1.5
			if (state.player.recruits < requiredRecruits) {
				return state;
			}

			// Update current position
			const updatedNodes = state.pyramid.nodes.map((node) => {
				if (node.id === state.player.currentNodeId) {
					return {
						...node,
						isPlayerPosition: false,
						lastUpdated: Date.now(),
					};
				}
				if (node.id === action.targetNodeId) {
					return {
						...node,
						isPlayerPosition: true,
						ownedByPlayer: true,
						lastUpdated: Date.now(),
					};
				}
				return node;
			});

			// Update pyramid with new player position and increment version
			let updatedPyramid = incrementPyramidVersion({
				...state.pyramid,
				nodes: updatedNodes,
			});

			// Ensure there are nodes to recruit below the new position
			updatedPyramid = ensureRecruitableNodesBelow(
				updatedPyramid,
				action.targetNodeId,
			);

			// Check if player has reached the top
			const isWinner = targetNode.level === 1;

			return {
				...state,
				pyramid: updatedPyramid,
				player: {
					...state.player,
					currentNodeId: action.targetNodeId,
					level: targetNode.level,
					energy: state.player.energy - 3,
					recruits: state.player.recruits - requiredRecruits,
				},
				turns: state.turns + 1,
				isWinner,
				gameOver: isWinner,
			};
		}

		case "COLLECT_MONEY": {
			if (state.player.energy < 1) {
				return state;
			}

			// Calculate money to collect based on owned nodes' money
			// This money is generated from the sales their downstream nodes made
			const ownedNodes = state.pyramid.nodes.filter(
				(node) => node.ownedByPlayer,
			);

			// Collect money from all owned nodes and reset their money to 0
			let moneyToCollect = 0;
			const updatedNodes = state.pyramid.nodes.map((node) => {
				if (node.ownedByPlayer && !node.isPlayerPosition && node.money > 0) {
					moneyToCollect += node.money;
					return {
						...node,
						money: 0, // Reset node money after collecting
					};
				}
				return node;
			});

			// Update pyramid with the nodes that had their money collected
			const updatedPyramid = {
				...state.pyramid,
				nodes: updatedNodes,
				version: state.pyramid.version + 1,
			};

			console.log(`[COLLECT_MONEY] Collected $${moneyToCollect} from network`);

			// Collect money without advancing time
			return {
				...state,
				pyramid: updatedPyramid,
				player: {
					...state.player,
					money: state.player.money + moneyToCollect,
					energy: state.player.energy - 1,
				},
				turns: state.turns + 1,
			};
		}

		case "UPGRADE_CHARISMA": {
			// Cost formula: 100 + (current charisma * 75)
			const cost = 100 + state.player.charisma * 75;

			// Check if player has enough money
			if (state.player.money < cost) {
				console.log(`Not enough money to upgrade charisma. Cost: $${cost}`);
				return state;
			}

			// Check if player has enough energy
			if (state.player.energy < 1) {
				console.log("Not enough energy to upgrade charisma");
				return state;
			}

			console.log(
				`[UPGRADE] Charisma upgraded from ${state.player.charisma} to ${state.player.charisma + 1} for $${cost}`,
			);

			// Apply the upgrade
			return {
				...state,
				player: {
					...state.player,
					charisma: state.player.charisma + 1,
					money: state.player.money - cost,
					energy: state.player.energy - 1,
				},
				turns: state.turns + 1,
			};
		}

		case "UPGRADE_RECRUITING": {
			// Cost formula: 150 + (current recruitingPower * 100)
			const cost = 150 + state.player.recruitingPower * 100;

			// Check if player has enough money
			if (state.player.money < cost) {
				console.log(
					`Not enough money to upgrade recruiting power. Cost: $${cost}`,
				);
				return state;
			}

			// Check if player has enough energy
			if (state.player.energy < 1) {
				console.log("Not enough energy to upgrade recruiting power");
				return state;
			}

			console.log(
				`[UPGRADE] Recruiting power upgraded from ${state.player.recruitingPower} to ${state.player.recruitingPower + 1} for $${cost}`,
			);

			// Apply the upgrade
			return {
				...state,
				player: {
					...state.player,
					recruitingPower: state.player.recruitingPower + 1,
					money: state.player.money - cost,
					energy: state.player.energy - 1,
				},
				turns: state.turns + 1,
			};
		}

		case "UPGRADE_ENERGY": {
			// Fixed cost: 800
			const cost = ENERGY_COST;

			// Check if player has enough money
			if (state.player.money < cost) {
				console.log(`Not enough money to buy energy. Cost: $${cost}`);
				return state;
			}

			console.log(`[UPGRADE] Purchased energy for $${cost}, +2 energy points`);

			// Apply the purchase (no energy cost for this action)
			return {
				...state,
				player: {
					...state.player,
					energy: state.player.energy + 2, // Gain 2 energy points
					money: state.player.money - cost,
				},
				turns: state.turns + 1,
			};
		}

		case "UPGRADE_INVENTORY": {
			// Cost increases with each upgrade
			const currentCapacity = state.player.maxInventory;
			const cost =
				INVENTORY_UPGRADE_COST +
				(currentCapacity - DEFAULT_MAX_INVENTORY) * 500;

			// Check if player has enough money
			if (state.player.money < cost) {
				console.log(`Not enough money to upgrade inventory. Cost: $${cost}`);
				return state;
			}

			console.log(
				`[UPGRADE] Increased inventory capacity for $${cost}, +5 capacity`,
			);

			// Apply the purchase (no energy cost for this action)
			return {
				...state,
				player: {
					...state.player,
					maxInventory: currentCapacity + 5, // Increase capacity by 5
					money: state.player.money - cost,
				},
				turns: state.turns + 1,
			};
		}

		case "REST": {
			const { hours } = action;

			// You can't rest if you're already resting
			if (state.player.isResting) {
				return state;
			}

			// Calculate when the player will finish resting
			const restUntil = state.gameDay * HOURS_PER_DAY + state.gameHour + hours;
			const energyRecoveryRate = REST_ENERGY_PER_HOUR; // energy per hour
			const totalEnergyRecovery = Math.min(
				hours * energyRecoveryRate,
				MAX_ENERGY - state.player.energy,
			);

			console.log(
				`[REST] Player resting for ${hours} hours, will recover ${totalEnergyRecovery} energy`,
			);

			return {
				...state,
				player: {
					...state.player,
					isResting: true,
					restUntil,
					recoveryPercentage: totalEnergyRecovery / hours, // energy per hour
				},
				turns: state.turns + 1,
			};
		}

		case "BUY_PRODUCT": {
			const { productId, quantity } = action;

			// Check if player has enough energy
			if (state.player.energy < PRODUCT_BUY_ENERGY_COST) {
				console.log(
					`Not enough energy to buy products. Required: ${PRODUCT_BUY_ENERGY_COST}`,
				);
				return state;
			}

			// Find the product
			const product = state.products.find((p) => p.id === productId);
			if (!product) {
				console.log(`Product ${productId} not found`);
				return state;
			}

			// Calculate total cost
			const totalCost = product.baseCost * quantity;

			// Check if player has enough money
			if (state.player.money < totalCost) {
				console.log(`Not enough money to buy products. Cost: $${totalCost}`);
				return state;
			}

			// Check if player has enough inventory space
			const currentInventoryCount = Object.values(
				state.player.inventory,
			).reduce((sum, count) => sum + count, 0);
			const availableSpace = state.player.maxInventory - currentInventoryCount;

			if (availableSpace < quantity) {
				console.log(`Not enough inventory space. Available: ${availableSpace}`);
				return state;
			}

			// Update player's inventory
			const updatedInventory = { ...state.player.inventory };
			updatedInventory[productId] =
				(updatedInventory[productId] || 0) + quantity;

			// Update product purchase stats for rank tracking
			const updatedProductPurchases = { ...state.player.productPurchases };
			const productStats = updatedProductPurchases[productId] || {
				totalPurchased: 0,
				weeklyPurchased: 0,
				currentRank: 0,
				lastPurchase: 0,
			};

			// Update purchase stats
			productStats.totalPurchased += quantity;
			productStats.weeklyPurchased += quantity;
			productStats.lastPurchase = Date.now();

			// Store updated stats
			updatedProductPurchases[productId] = productStats;

			// Check for rank progress
			let currentRank = productStats.currentRank;
			let newRank = currentRank;

			// Calculate rank based on weekly purchases
			for (let i = 0; i < PRODUCT_RANKS.length; i++) {
				const rank = PRODUCT_RANKS[i];
				// Scale requirement based on player level
				const levelMultiplier = Math.pow(3, state.player.level - 1);
				const scaledRequirement = Math.ceil(
					rank.weeklyRequirement * levelMultiplier,
				);

				if (productStats.weeklyPurchased >= scaledRequirement) {
					newRank = rank.level;
				} else {
					break;
				}
			}

			// If rank changed, update rank and notify
			if (newRank > currentRank) {
				productStats.currentRank = newRank;
				const rankName = PRODUCT_RANKS[newRank - 1]?.name || "Unknown Rank";
				console.log(
					`%c[RANK UP] You've achieved ${rankName} rank with ${product.name}!`,
					"background: #FFD700; color: black; padding: 3px 6px; border-radius: 3px; font-weight: bold;",
				);

				// If reached a higher rank, add +1 to reputation
				if (newRank > currentRank) {
					// Reputation gains only for new ranks, not maintaining existing ones
					const reputationGain = newRank > currentRank ? 1 : 0;

					return {
						...state,
						player: {
							...state.player,
							inventory: updatedInventory,
							money: state.player.money - totalCost,
							energy: state.player.energy - PRODUCT_BUY_ENERGY_COST,
							productPurchases: updatedProductPurchases,
							reputation: state.player.reputation + reputationGain,
						},
						turns: state.turns + 1,
					};
				}
			}

			console.log(`[BUY] Bought ${quantity} ${product.name} for $${totalCost}`);

			return {
				...state,
				player: {
					...state.player,
					inventory: updatedInventory,
					money: state.player.money - totalCost,
					energy: state.player.energy - PRODUCT_BUY_ENERGY_COST,
					productPurchases: updatedProductPurchases,
				},
				turns: state.turns + 1,
			};
		}

		case "SELL_DOWNSTREAM": {
			const { productId, targetNodeId, quantity } = action;

			// Check if player has enough energy
			if (state.player.energy < 1) {
				console.log("Not enough energy to sell to downstream node");
				return state;
			}

			// Find the product
			const product = state.products.find((p) => p.id === productId);
			if (!product) {
				console.log(`Product ${productId} not found`);
				return state;
			}

			// Check if player has enough of this product in their inventory (player stats)
			if ((state.player.inventory[productId] || 0) < quantity) {
				console.log(`Not enough ${product.name} in inventory`);
				return state;
			}

			// Find the target node
			const targetNodeIndex = state.pyramid.nodes.findIndex(
				(node) => node.id === targetNodeId,
			);
			if (targetNodeIndex === -1) {
				console.log(`Target node ${targetNodeId} not found`);
				return state;
			}

			const targetNode = state.pyramid.nodes[targetNodeIndex];

			// Check if target node is player-owned
			if (!targetNode.ownedByPlayer) {
				console.log("Can only sell to player-owned nodes");
				return state;
			}

			// Calculate max quantity based on reputation and product rank
			// Base selling capacity starts at 5
			let maxSellingCapacity = 5;

			// Add bonus from reputation (each point of reputation adds 2 to capacity)
			maxSellingCapacity += state.player.reputation * 2;

			// Add bonus from product rank if applicable
			const playerProductStats = state.player.productPurchases?.[productId];
			if (playerProductStats?.currentRank) {
				// Each rank adds 5 to the capacity (rank 5 = +25 capacity)
				maxSellingCapacity += playerProductStats.currentRank * 5;
			}

			// Check if attempting to sell more than allowed
			if (quantity > maxSellingCapacity) {
				console.log(
					`Cannot sell more than ${maxSellingCapacity} items at once due to your current reputation and product rank`,
				);
				return state;
			}

			// Calculate total price (using downsell price - selling to your own network)
			const totalPrice = product.downsellPrice * quantity;

			// Check if target node has enough room in inventory
			const targetInventory = targetNode.inventory || {};
			const currentQuantity = targetInventory[productId] || 0;

			// Calculate total inventory in target node
			const totalInventory = Object.values(targetInventory).reduce(
				(sum, qty) => sum + qty,
				0,
			);
			const availableSpace = targetNode.maxInventory - totalInventory;

			if (availableSpace < quantity) {
				console.log(
					`Target node only has space for ${availableSpace} more items`,
				);
				return state;
			}

			// Update player's inventory (directly from player stats - single source of truth)
			const updatedPlayerInventory = { ...state.player.inventory };
			updatedPlayerInventory[productId] = Math.max(
				0,
				(updatedPlayerInventory[productId] || 0) - quantity,
			);

			// Update target node inventory
			const updatedNodes = [...state.pyramid.nodes];
			const updatedTargetInventory = { ...targetInventory };
			updatedTargetInventory[productId] = currentQuantity + quantity;

			updatedNodes[targetNodeIndex] = {
				...targetNode,
				inventory: updatedTargetInventory,
				lastUpdated: Date.now(),
			};

			console.log(
				`[SELL] Sold ${quantity} ${product.name} to downstream node for $${totalPrice}`,
			);

			// Update player's total sales to downstream
			const totalSalesDownstream = state.player.totalSalesDownstream + quantity;

			return {
				...state,
				pyramid: {
					...state.pyramid,
					nodes: updatedNodes,
					version: state.pyramid.version + 1,
				},
				player: {
					...state.player,
					inventory: updatedPlayerInventory,
					money: state.player.money + totalPrice,
					energy: state.player.energy - 1,
					totalSalesDownstream,
				},
				turns: state.turns + 1,
			};
		}

		case "RESTOCK_DOWNSTREAM": {
			const { targetNodeId, productId, quantity } = action;

			// Check if player has enough energy
			if (state.player.energy < NODE_RESTOCK_ENERGY_COST) {
				console.log(
					`Not enough energy to restock. Required: ${NODE_RESTOCK_ENERGY_COST}`,
				);
				return state;
			}

			// Find the target node
			const targetNodeIndex = state.pyramid.nodes.findIndex(
				(node) => node.id === targetNodeId,
			);
			if (targetNodeIndex === -1) {
				console.log(`Target node ${targetNodeId} not found`);
				return state;
			}

			const targetNode = state.pyramid.nodes[targetNodeIndex];

			// Check if target node is player-owned
			if (!targetNode.ownedByPlayer) {
				console.log("Can only restock player-owned nodes");
				return state;
			}

			// Find the product
			const product = state.products.find((p) => p.id === productId);
			if (!product) {
				console.log(`Product ${productId} not found`);
				return state;
			}

			// Calculate total cost to restock
			const totalCost = product.baseCost * quantity;

			// Check if player has enough money
			if (state.player.money < totalCost) {
				console.log(`Not enough money to restock. Cost: $${totalCost}`);
				return state;
			}

			// Check if target node has enough room in inventory
			const targetInventory = targetNode.inventory || {};

			// Calculate total inventory in target node
			const totalInventory = Object.values(targetInventory).reduce(
				(sum, qty) => sum + qty,
				0,
			);
			const availableSpace = targetNode.maxInventory - totalInventory;

			if (availableSpace < quantity) {
				console.log(
					`Target node only has space for ${availableSpace} more items`,
				);
				return state;
			}

			// Update target node inventory
			const updatedNodes = [...state.pyramid.nodes];
			const updatedTargetInventory = { ...targetInventory };

			updatedTargetInventory[productId] =
				(updatedTargetInventory[productId] || 0) + quantity;

			updatedNodes[targetNodeIndex] = {
				...targetNode,
				inventory: updatedTargetInventory,
				lastRestocked: Date.now(),
				lastUpdated: Date.now(),
			};

			console.log(
				`[RESTOCK] Restocked downstream node with ${quantity} ${product.name} for $${totalCost}`,
			);

			return {
				...state,
				pyramid: {
					...state.pyramid,
					nodes: updatedNodes,
					version: state.pyramid.version + 1,
				},
				player: {
					...state.player,
					money: state.player.money - totalCost,
					energy: state.player.energy - NODE_RESTOCK_ENERGY_COST,
				},
				turns: state.turns + 1,
			};
		}

		case "RESET_GAME": {
			console.log("[RESET] Game reset to initial state");
			// Use our createInitialGameState function to generate a fresh game state
			return createInitialGameState();
		}

		// Handle other cases...

		default:
			return state;
	}
};

// Export the hook for use in components
export const useGameState = () => {
	const [gameState, dispatch] = useReducer(
		gameReducer,
		null,
		createInitialGameState,
	);

	// Use a ref to track the current game state
	const gameStateRef = React.useRef(gameState);

	// Update the ref whenever gameState changes
	React.useEffect(() => {
		gameStateRef.current = gameState;
	}, [gameState]);

	// Auto-advance time every second - completely rewritten to fix timer issues
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		console.log("Setting up game clock interval");

		// Use a simple interval that dispatches the ADVANCE_TIME action every second
		const interval = setInterval(() => {
			// Use the ref to access the current game state
			const currentGameState = gameStateRef.current;
			if (!currentGameState.gameOver) {
				console.log("Advancing time by 1 hour");
				dispatch({ type: "ADVANCE_TIME", hours: 1 });
			} else {
				console.log("Game is over, not advancing time");
			}
		}, 1000);

		// Important: This cleanup function will be called when the component unmounts
		// or when any dependency changes
		return () => {
			console.log("Cleaning up game clock interval");
			clearInterval(interval);
		};
	}, []); // Empty dependency array means this only runs once when component mounts

	// Check if game over due to no more energy and no money to upgrade
	useEffect(() => {
		if (
			gameState.player.energy <= 0 &&
			gameState.player.money < ENERGY_COST &&
			!gameState.gameOver
		) {
			// If player can't make any moves and isn't resting, game over
			if (!gameState.player.isResting) {
				// Don't directly modify the gameState - use dispatch instead
				// Just set game over flag without resetting game
				dispatch({ type: "SET_GAME_OVER", isWinner: false });
				console.log("GAME OVER: Out of energy and money");
			}
		}
	}, [
		gameState.player.energy,
		gameState.player.money,
		gameState.player.isResting,
		gameState.gameOver,
		// dispatch is intentionally omitted as it's stable across renders
	]);

	return { gameState, dispatch };
};

/**
 * Process player inventory trading to downstream nodes in the pyramid.
 * @param pyramid The current pyramid graph structure
 * @param playerNode The node representing the player's current position
 * @param nodesAfterTrading Current state of all nodes after previous trading operations
 * @param state The current game state
 * @returns An object containing updated nodes, player inventory, and money from trades
 */
const processPlayerInventoryTrading = (
	pyramid: PyramidGraph,
	playerNode: PyramidNode,
	nodesAfterTrading: PyramidNode[],
	state: GameState,
): {
	updatedNodes: PyramidNode[];
	updatedPlayerInventory: { [productId: string]: number };
	moneyFromTrades: number;
} => {
	// Deep clone the nodes array to avoid mutation issues
	const updatedNodes = [...nodesAfterTrading];

	// Use player stats inventory as the single source of truth
	const playerInventory = { ...state.player.inventory };

	// Track money earned from trades
	let moneyFromTrades = 0;

	console.log(
		`[DEBUG TRADING] Player inventory:`,
		Object.keys(playerInventory).length > 0
			? JSON.stringify(playerInventory)
			: "none",
	);

	if (!playerNode || Object.keys(playerInventory).length === 0) {
		console.log(`[DEBUG TRADING] Player node not found or has no inventory`);
		return {
			updatedNodes,
			updatedPlayerInventory: playerInventory,
			moneyFromTrades,
		};
	}

	// Find nodes directly below the player
	const playerNodesBelow = getNodesBelow(pyramid, playerNode.id);
	const playerOwnedNodesBelow = playerNodesBelow.filter(
		(node) => node.ownedByPlayer,
	);

	console.log(
		`[DEBUG TRADING] Found ${playerOwnedNodesBelow.length} player-owned nodes below for potential trading`,
	);

	// Debug links to verify connections
	console.log(`[DEBUG LINKS] Testing pyramid links`);
	const playerLinks = pyramid.links.filter(
		(link) => link.target === playerNode.id || link.source === playerNode.id,
	);
	console.log(
		`[DEBUG LINKS] Player node ${playerNode.id} has ${playerLinks.length} links:`,
		JSON.stringify(playerLinks),
	);

	// Try to trade with a chance determined by the constant (easier to adjust)
	if (playerOwnedNodesBelow.length === 0) {
		console.log(`[DEBUG TRADING] No downstream nodes available for trading`);
		return {
			updatedNodes,
			updatedPlayerInventory: playerInventory,
			moneyFromTrades,
		};
	}

	console.log(
		`[DEBUG TRADING] Trade attempt passed random check (${PLAYER_INVENTORY_TRADE_CHANCE * 100}% chance)`,
	);

	// Get products that the player has in inventory
	const playerProducts = Object.entries(playerInventory)
		.filter(([_, qty]) => (qty || 0) > 0)
		.map(([id]) => id);

	console.log(
		`[DEBUG TRADING] Player has ${playerProducts.length} product types in inventory for trading`,
	);

	if (playerProducts.length === 0) {
		console.log(`[DEBUG TRADING] Player has no products to trade`);
		return {
			updatedNodes,
			updatedPlayerInventory: playerInventory,
			moneyFromTrades,
		};
	}

	// Try to trade with each downstream node instead of just one random node
	// This increases the chance of successful trades
	let tradesMade = false;

	// Prioritize nodes without inventory or with space for new inventory
	playerOwnedNodesBelow.sort((a, b) => {
		const aHasInventory = a.inventory && Object.keys(a.inventory).length > 0;
		const bHasInventory = b.inventory && Object.keys(b.inventory).length > 0;
		if (aHasInventory && !bHasInventory) return 1;
		if (!aHasInventory && bHasInventory) return -1;
		return 0;
	});

	// Try to trade with each downstream node
	for (const targetNode of playerOwnedNodesBelow) {
		const targetNodeIndex = updatedNodes.findIndex(
			(n) => n.id === targetNode.id,
		);
		if (targetNodeIndex === -1) continue;

		// Pick a random product to trade
		const availableProducts = playerProducts.filter(
			(productId) => (playerInventory[productId] || 0) > 0,
		);
		if (availableProducts.length === 0) break;

		const randomProductId =
			availableProducts[Math.floor(Math.random() * availableProducts.length)];
		const product = state.products.find((p) => p.id === randomProductId);
		if (!product) continue;

		// Calculate maximum trading capacity based on player's reputation
		// Base capacity starts at 5 items
		const baseTradeCapacity = 5;
		const reputationBonus = state.player.reputation * 2; // Each point of reputation adds 2 to capacity

		// Check if player has product rank
		const playerProductStats = state.player.productPurchases?.[randomProductId];
		let rankBonus = 0;
		if (playerProductStats?.currentRank) {
			// Each rank adds 5 to capacity
			rankBonus = playerProductStats.currentRank * 5;
		}

		// Calculate max trade quantity based on all factors
		const maxTradeCapacity = baseTradeCapacity + reputationBonus + rankBonus;

		// Calculate how many we can trade (limited by player inventory and node capacity)
		const maxTradeQty = Math.min(
			maxTradeCapacity,
			playerInventory[randomProductId] || 0,
		);

		if (maxTradeQty <= 0) continue;

		// Trade a random amount between 1 and maxTradeQty
		const tradeQty = Math.max(1, Math.floor(Math.random() * maxTradeQty));

		// Calculate payment amount (node pays base cost per unit)
		const paymentAmount = product.baseCost * tradeQty;

		// Only trade if node has enough money
		if ((updatedNodes[targetNodeIndex].money || 0) < paymentAmount) {
			console.log(
				`[DEBUG TRADING] Node ${targetNode.id} doesn't have enough money (${updatedNodes[targetNodeIndex].money || 0}) to pay for trade (${paymentAmount})`,
			);
			continue;
		}

		// Update player inventory
		playerInventory[randomProductId] =
			(playerInventory[randomProductId] || 0) - tradeQty;
		if (playerInventory[randomProductId] <= 0) {
			delete playerInventory[randomProductId];
		}

		// Update node inventory and money
		updatedNodes[targetNodeIndex] = {
			...updatedNodes[targetNodeIndex],
			inventory: {
				...(updatedNodes[targetNodeIndex].inventory || {}),
				[randomProductId]:
					(updatedNodes[targetNodeIndex].inventory?.[randomProductId] || 0) +
					tradeQty,
			},
			money: (updatedNodes[targetNodeIndex].money || 0) - paymentAmount,
		};

		// Add payment to player's trade earnings
		moneyFromTrades += paymentAmount;

		console.log(
			`%c[PLAYER TRADE] You sold ${tradeQty}x ${product.name} to your downstream recruit for $${paymentAmount} ($${product.baseCost}/each)`,
			"background: #4CAF50; color: white; padding: 3px 6px; border-radius: 3px; font-weight: bold;",
		);

		console.log(
			`[DEBUG TRADING] Traded ${tradeQty}x ${product.name} to node ${targetNode.id} for $${paymentAmount}`,
		);
	}

	return {
		updatedNodes,
		updatedPlayerInventory: playerInventory,
		moneyFromTrades,
	};
};

// Function to update product ranks based on weekly purchases
const updateProductRanks = (state: GameState): GameState => {
	const updatedProductPurchases = { ...state.player.productPurchases };
	const updatedProducts = [...state.products];

	// For each product, check weekly purchase requirements
	updatedProducts.forEach((product) => {
		// Get player's current stats for this product
		const productStats = updatedProductPurchases[product.id] || {
			totalPurchased: 0,
			weeklyPurchased: 0,
			currentRank: 0,
			lastPurchase: 0,
		};

		// Determine current rank based on weekly purchases
		let newRank = 0;

		// Check which rank requirements the player meets
		for (let i = 0; i < PRODUCT_RANKS.length; i++) {
			const rank = PRODUCT_RANKS[i];
			// Calculate requirement based on player level (3x increase per level up the pyramid)
			const levelMultiplier = Math.pow(3, state.player.level - 1);
			const scaledRequirement = Math.ceil(
				rank.weeklyRequirement * levelMultiplier,
			);

			if (productStats.weeklyPurchased >= scaledRequirement) {
				newRank = rank.level;
			} else {
				// Stop checking higher ranks if current requirement not met
				break;
			}
		}

		// Update player's rank for this product
		productStats.currentRank = newRank;

		// Reset weekly purchases counter (this is called weekly)
		productStats.weeklyPurchased = 0;

		// Update product purchases tracking
		updatedProductPurchases[product.id] = productStats;

		// Update product's player rank
		const productIndex = updatedProducts.findIndex((p) => p.id === product.id);
		if (productIndex >= 0) {
			updatedProducts[productIndex] = {
				...updatedProducts[productIndex],
				playerRank: newRank,
			};
		}
	});

	return {
		...state,
		player: {
			...state.player,
			productPurchases: updatedProductPurchases,
		},
		products: updatedProducts,
	};
};

// Function to process weekly game update
const processWeeklyUpdate = (state: GameState): GameState => {
	console.log("[WEEKLY UPDATE] Processing weekly update");

	// Update product ranks
	const updatedState = updateProductRanks(state);

	// TODO: Consider adding other weekly updates here

	return updatedState;
};

// Generate a random name for AI competitors
const generateAIName = (): string => {
	const firstNames = [
		"Alpha",
		"Beta",
		"Delta",
		"Omega",
		"Golden",
		"Supreme",
		"Ultra",
		"Mega",
		"Perfect",
		"Power",
		"Peak",
		"Prime",
		"Elite",
		"Vital",
		"Global",
		"Optimum",
	];

	const lastNames = [
		"Health",
		"Wellness",
		"Life",
		"Living",
		"Vitality",
		"Nutrition",
		"Success",
		"Future",
		"Balance",
		"Harmony",
		"Essence",
		"Network",
		"Alliance",
		"Partners",
	];

	const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
	const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

	return `${firstName} ${lastName}`;
};
