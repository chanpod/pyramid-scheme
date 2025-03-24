import { useReducer, useEffect } from "react";
import {
	GameState,
	GameAction,
	PlayerStats,
	PyramidGraph,
	MarketingEvent,
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
const HOURS_PER_DAY = 24;
const MAX_ENERGY = 20;
const REST_ENERGY_PER_HOUR = 0.5; // Energy gained per hour of rest
const ENERGY_COST = 800; // Cost to buy energy
export const PRODUCT_BUY_ENERGY_COST = 5; // Energy cost to buy products
const NEW_RECRUIT_CHANCE = 0.08; // Chance for a successful recruit to generate new potential recruits (significantly reduced from 0.15)
const MONEY_RECRUITMENT_FACTOR = 0.00005; // How much money affects recruitment (reduced from 0.00008)
const BASE_RECRUITMENT_CHANCE = 0.12; // Base recruitment success chance (significantly reduced from 0.25)
const AI_NODE_RECRUIT_CHANCE = 0.3; // Increased AI node recruitment chance to make competition harder
const AI_NODE_EXPANSION_CHANCE = 0.4; // Increased AI expansion chance to make competition harder
const DEFAULT_MAX_INVENTORY = 20; // Default maximum inventory capacity for nodes
const NODE_RESTOCK_ENERGY_COST = 1; // Energy cost to restock a downstream node

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
const MIN_INVESTMENT = 50;
const MAX_INVESTMENT = 500;
const INVESTMENT_SUCCESS_MULTIPLIER = 0.0005; // 0.05% per dollar invested
const INVESTMENT_ATTEMPTS_MULTIPLIER = 0.002; // 0.2% per dollar invested

// Initial player stats
const initialPlayerStats: PlayerStats = {
	money: 1000,
	recruits: 0,
	level: 5, // Start at level 5 of the pyramid
	currentNodeId: "",
	charisma: 1,
	recruitingPower: 1,
	energy: MAX_ENERGY, // Start with full energy
	reputation: 1,
	isResting: false,
	restUntil: 0,
	recoveryPercentage: undefined,
	inventory: {},
	totalSalesRandom: 0,
	totalSalesDownstream: 0,
};

// Product definitions
const productDefinitions = [
	{
		id: "essential-oils",
		name: "Essential Oils",
		baseCost: 10,
		basePrice: 25,
		downsellPrice: 15,
		baseChance: 0.25, // 25% base chance to sell to a random person (increased from 0.2)
	},
	{
		id: "wellness-supplements",
		name: "Wellness Supplements",
		baseCost: 20,
		basePrice: 45,
		downsellPrice: 30,
		baseChance: 0.2, // 20% base chance to sell to a random person (increased from 0.15)
	},
	{
		id: "lifestyle-kit",
		name: "Lifestyle Enhancement Kit",
		baseCost: 50,
		basePrice: 120,
		downsellPrice: 80,
		baseChance: 0.15, // 15% base chance to sell to a random person (increased from 0.1)
	},
];

// Helper function to propagate ownership down the network
const propagateOwnership = (
	pyramid: PyramidGraph,
	startNodeId: string,
	isPlayer: boolean = true,
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
							lastUpdated: Date.now(),
						};

						// Only continue propagation if we haven't reached the limit
						if (playerOwnedCount < 2) {
							// Process children of this node recursively
							processNode(link.source);
						}
					}
				} else {
					// For AI network (not modified)
					if (!updatedNodes[childNodeIndex].ownedByPlayer) {
						// Don't take over player nodes
						updatedNodes[childNodeIndex] = {
							...updatedNodes[childNodeIndex],
							aiControlled: true,
							ownedByPlayer: false,
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
	// Generate basic pyramid structure
	const pyramid = generatePyramid(7, 5); // 7 levels total, player starts at level 5

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
		recruits: 0,
		level: 5, // Start at level 5 of the pyramid
		currentNodeId: "",
		charisma: 1,
		recruitingPower: 1,
		energy: MAX_ENERGY, // Start with full energy
		reputation: 1,
		isResting: false,
		restUntil: 0,
		recoveryPercentage: undefined,
		inventory: {},
		totalSalesRandom: 0,
		totalSalesDownstream: 0,
	};

	// Step 1: Place player at a node in level 5
	const level5Nodes = pyramid.nodes.filter((node) => node.level === 5);
	// Place player at a random position in level 5, not always in the center
	const playerNodeIndex = Math.floor(Math.random() * level5Nodes.length);
	const playerNode = level5Nodes[playerNodeIndex];

	// Mark the player's node
	if (playerNode) {
		playerNode.isPlayerPosition = true;
		playerNode.ownedByPlayer = true;
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

	// Create AI competitors
	for (let i = 0; i < Math.min(numAICompetitors, shuffledAINodes.length); i++) {
		const aiNode = shuffledAINodes[i];
		const aiName = `Competitor ${i + 1}`;
		const aiStrategy = Math.random() < 0.5 ? "aggressive" : "steady";

		aiNode.aiControlled = true;
		aiNode.name = aiName;
		aiNode.aiStrategy = aiStrategy;
		aiNode.maxInventory = DEFAULT_MAX_INVENTORY;

		// Initialize AI inventory with a few products
		aiNode.inventory = {};

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
	}

	// Step 3: Assign nodes to networks based on hierarchy
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

	// Step 4: Assign any remaining unowned nodes randomly
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

	// Add version number to track changes
	pyramid.version = 1;

	// Initialize player inventory with some product
	const playerInventory = {};
	productDefinitions.forEach((product) => {
		playerInventory[product.id] = 5; // Start with 5 of each product
	});

	// Calculate initial recruit count based on owned nodes
	const playerOwnedNodes = pyramid.nodes.filter(
		(node) => node.ownedByPlayer && !node.isPlayerPosition,
	);

	// Instead of just unmarking excess nodes, we'll remove them completely
	let initialRecruits = playerOwnedNodes.length;

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

	return {
		pyramid,
		player: {
			...initialPlayerStats,
			currentNodeId: playerNode?.id || "",
			inventory: playerInventory,
			recruits: initialRecruits,
		},
		gameLevel: 1,
		turns: 0,
		gameDay: 1,
		gameHour: 9, // Start at 9 AM
		gameOver: false,
		isWinner: false,
		lastDailyEnergyBonus: 0,
		products: productDefinitions,
		marketingEvents: [], // Initialize empty marketing events array
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
const processDayCycle = (state: GameState): GameState => {
	// Initialize variables for tracking changes
	let updatedNodes = [...state.pyramid.nodes];
	let updatedLinks = [...state.pyramid.links];
	let newRecruits = state.player.recruits;
	let updatedPyramid = {
		...state.pyramid,
		nodes: updatedNodes,
		links: updatedLinks,
	};
	let pyramidChanged = false;

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
				const levelBonus = (7 - node.level) * 0.02;
				const saleChance = Math.min(0.7, product.baseChance + levelBonus);

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

	// 2. Process AI recruitment behavior (keeping existing logic)
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
						updatedNodes[parentNodeIndex] = {
							...updatedNodes[parentNodeIndex],
							aiControlled: true,
							aiStrategy: Math.random() < 0.5 ? "aggressive" : "steady",
							name: `Competitor ${Math.floor(Math.random() * 1000)}`,
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
						// Mark the target node as AI controlled
						updatedNodes[nodeIndex] = {
							...updatedNodes[nodeIndex],
							aiControlled: true,
							aiStrategy: updatedNodes[parentNodeIndex].aiStrategy,
							name: `${updatedNodes[parentNodeIndex].name}'s Recruit`,
							lastUpdated: Date.now(),
							inventory: {}, // Initialize empty inventory
							maxInventory: DEFAULT_MAX_INVENTORY,
						};

						pyramidChanged = true;

						console.log(
							`[AI RECRUITMENT] AI recruited node at level ${targetNode.level}, ID: ${targetNode.id}`,
						);

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

		// Random chance to attempt trades with downstream nodes (40% chance)
		if (belowAINodes.length > 0 && Math.random() < 0.4) {
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
								// Update seller's inventory
								const sellerNodeIndex = nodesAfterTrading.findIndex(
									(n) => n.id === aiNode.id,
								);
								const sellerInventory = {
									...nodesAfterTrading[sellerNodeIndex].inventory,
								};
								sellerInventory[randomProductId] = Math.max(
									0,
									(sellerInventory[randomProductId] || 0) - tradeQuantity,
								);

								// Update buyer's inventory
								const buyerInventory = { ...targetInventory };
								buyerInventory[randomProductId] =
									(buyerInventory[randomProductId] || 0) + tradeQuantity;

								// Even trade - no money exchanges hands in trading phase
								// Update seller
								nodesAfterTrading[sellerNodeIndex] = {
									...nodesAfterTrading[sellerNodeIndex],
									inventory: sellerInventory,
									lastUpdated: Date.now(),
								};

								// Update buyer
								nodesAfterTrading[targetNodeIndex] = {
									...nodesAfterTrading[targetNodeIndex],
									inventory: buyerInventory,
									lastUpdated: Date.now(),
								};

								console.log(
									`[INVENTORY TRADE] ${aiNode.name || "AI Node"} traded ${tradeQuantity} ${product.name} to ${nodesAfterTrading[targetNodeIndex].name || "downstream"}`,
								);
							}
						}
					}
				}
			}
		}
	}

	// 4. ADDED: Process player inventory trading
	// Find player node and player-owned nodes with inventory
	const playerNode = nodesAfterTrading.find((node) => node.isPlayerPosition);
	if (playerNode && playerNode.inventory) {
		// Find nodes directly below the player
		const playerNodesBelow = getNodesBelow(updatedPyramid, playerNode.id);
		const playerOwnedNodesBelow = playerNodesBelow.filter(
			(node) => node.ownedByPlayer,
		);

		// Only attempt trades if player has downstream nodes and there's a 50% chance (higher than AI)
		if (playerOwnedNodesBelow.length > 0 && Math.random() < 0.5) {
			// Get products that the player has in inventory
			const playerProducts = Object.entries(playerNode.inventory)
				.filter(([_, qty]) => (qty || 0) > 0)
				.map(([id]) => id);

			if (playerProducts.length > 0) {
				// Pick a random product to trade
				const randomProductId =
					playerProducts[Math.floor(Math.random() * playerProducts.length)];
				const product = state.products.find((p) => p.id === randomProductId);

				if (product) {
					// Pick a random downstream node to trade with
					const targetNode =
						playerOwnedNodesBelow[
							Math.floor(Math.random() * playerOwnedNodesBelow.length)
						];
					const targetNodeIndex = nodesAfterTrading.findIndex(
						(n) => n.id === targetNode.id,
					);

					if (targetNodeIndex >= 0) {
						// Calculate available space
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
							// Determine trade quantity (1-3 items)
							const tradeQuantity = Math.min(
								1 + Math.floor(Math.random() * 2),
								playerNode.inventory[randomProductId] || 0,
								availableSpace,
							);

							if (tradeQuantity > 0) {
								// Update player's inventory
								const playerNodeIndex = nodesAfterTrading.findIndex(
									(n) => n.id === playerNode.id,
								);
								const updatedPlayerInventory = {
									...nodesAfterTrading[playerNodeIndex].inventory,
								};
								updatedPlayerInventory[randomProductId] = Math.max(
									0,
									(updatedPlayerInventory[randomProductId] || 0) -
										tradeQuantity,
								);

								// Update target node's inventory
								const updatedTargetInventory = { ...targetInventory };
								updatedTargetInventory[randomProductId] =
									(updatedTargetInventory[randomProductId] || 0) +
									tradeQuantity;

								// Update player node
								nodesAfterTrading[playerNodeIndex] = {
									...nodesAfterTrading[playerNodeIndex],
									inventory: updatedPlayerInventory,
									lastUpdated: Date.now(),
								};

								// Update target node
								nodesAfterTrading[targetNodeIndex] = {
									...nodesAfterTrading[targetNodeIndex],
									inventory: updatedTargetInventory,
									lastUpdated: Date.now(),
								};

								console.log(
									`[PLAYER TRADE] You traded ${tradeQuantity} ${product.name} to your downstream recruit`,
								);

								// Also update player's actual inventory in the game state
								state = {
									...state,
									player: {
										...state.player,
										inventory: updatedPlayerInventory,
									},
								};
							}
						}
					}
				}
			}
		}
	}

	// After trading, process sales and commissions recursively
	// This is the second phase where nodes try to sell products and pass commissions up
	// We need to process from bottom to top to ensure commissions flow upward correctly

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
				const levelBonus = (7 - node.level) * 0.02;
				const ownershipBonus = node.ownedByPlayer ? 0.1 : 0; // 10% bonus for player-owned nodes
				const saleChance = Math.min(
					0.6, // Increased max chance
					product.baseChance + levelBonus + ownershipBonus,
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
						// If player is the upstream node, add commission to player's money directly
						state = {
							...state,
							player: {
								...state.player,
								money: state.player.money + commission,
							},
						};

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

	return {
		...state,
		pyramid: updatedPyramid,
		player: {
			...state.player,
			recruits: newRecruits,
		},
	};
};

// Advance game time
const advanceGameTime = (state: GameState, hours: number): GameState => {
	let newHour = state.gameHour + hours;
	let newDay = state.gameDay;
	let updatedState = { ...state };
	let dayChanged = false;

	// Handle day change
	while (newHour >= HOURS_PER_DAY) {
		newHour -= HOURS_PER_DAY;
		newDay++;
		dayChanged = true;
	}

	// If a day has changed, give player 3 free energy at the start of the day
	if (dayChanged) {
		// Add 3 energy at the start of each day, but don't exceed MAX_ENERGY
		const currentEnergy = updatedState.player.energy;
		const newEnergy = Math.min(currentEnergy + 3, MAX_ENERGY);

		console.log(
			`New day: Adding 3 energy. Before: ${currentEnergy}, After: ${newEnergy}`,
		);

		updatedState = {
			...updatedState,
			player: {
				...updatedState.player,
				energy: newEnergy,
			},
			lastDailyEnergyBonus: Date.now(), // Set the timestamp when the bonus was given
		};

		// Now process day cycle for recruitment attempts, AI behavior, etc.
		updatedState = processDayCycle(updatedState);

		// Process player's automatic product sales to random people
		updatedState = processPlayerRandomSales(updatedState);
	}

	// Process active marketing events
	if (state.marketingEvents.length > 0) {
		const activeEvents = [...state.marketingEvents];
		const completedEvents = [];
		const updatedEvents = [];

		for (let event of activeEvents) {
			// Decrease remaining hours
			event = {
				...event,
				remainingHours: event.remainingHours - hours,
			};

			// Check if event is completed
			if (event.remainingHours <= 0) {
				completedEvents.push(event);
			} else {
				updatedEvents.push(event);
			}
		}

		// Process completed events
		if (completedEvents.length > 0) {
			for (const event of completedEvents) {
				// For recruitment events, generate potential recruits
				updatedState = processRecruitmentEvent(updatedState, event);
			}
		}

		// Update remaining events
		updatedState = {
			...updatedState,
			marketingEvents: updatedEvents,
		};
	}

	// Return updated state with new time
	return {
		...updatedState,
		gameHour: newHour,
		gameDay: newDay,
	};
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
			const charismaBonus = state.player.charisma * 0.05; // 5% per charisma point
			const saleChance = Math.min(0.95, product.baseChance + charismaBonus);

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

// Helper function to process recruitment marketing events
const processRecruitmentEvent = (
	state: GameState,
	event: MarketingEvent,
): GameState => {
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

	// Only process recruitment if we have fewer than 2 recruits
	const maxRecruits = 2;
	const remainingSlots = Math.max(0, maxRecruits - currentOwnedNodes);

	if (remainingSlots <= 0) {
		console.log(
			`Already at maximum ${maxRecruits} recruits, no new recruits will be added`,
		);
		return state;
	}

	// Process only as many recruits as we have slots for
	const attemptsToProcess = Math.min(successAttempts, remainingSlots);
	console.log(
		`Processing ${attemptsToProcess} out of ${successAttempts} successful recruits`,
	);

	// Process each successful recruit attempt
	for (let i = 0; i < attemptsToProcess; i++) {
		// Calculate recruitment chance based on player stats and event
		const baseChance = 0.12 + state.player.charisma * 0.02;
		const recruitingBonus = state.player.recruitingPower * 0.06;
		const reputationBonus = state.player.reputation * 0.04;

		// Investment provides additional bonus
		const investmentBonus = event.investmentAmount
			? Math.min(0.2, event.investmentAmount * INVESTMENT_SUCCESS_MULTIPLIER)
			: 0;

		// Calculate final chance, capped at 65%
		const recruitChance = Math.min(
			0.65,
			baseChance + recruitingBonus + reputationBonus + investmentBonus,
		);

		// Roll for recruitment success
		const roll = Math.random();
		const isSuccessful = roll < recruitChance;

		console.log(
			`Marketing recruitment attempt ${i + 1}: Chance ${Math.round(recruitChance * 100)}%, Roll ${Math.round(roll * 100)}% - ${isSuccessful ? "SUCCESS" : "FAILURE"}`,
		);

		if (isSuccessful) {
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

				// Instead of propagating ownership, just mark this new node
				// This avoids exceeding our 2-recruit limit
				pyramidChanged = true;
				newRecruits++;

				console.log(`Recruits count increased to ${newRecruits}`);
				console.log(
					`Marketing event success: Added new recruit node at level ${playerNode.level + 1}, ID: ${result.newNodeId}`,
				);
			}
		}
	}

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

	// Try the maximum number of attempts
	for (let i = 0; i < totalAttempts; i++) {
		if (Math.random() < adjustedChance) {
			successfulAttempts++;
		}
	}

	// Special case for workshops: 10% chance for extra recruit for each success
	if (event.type === "workshop") {
		for (let i = 0; i < successfulAttempts; i++) {
			if (Math.random() < WORKSHOP_EXTRA_RECRUIT_CHANCE) {
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
			console.log(
				`[REDUCER] Processing ADVANCE_TIME action: ${action.hours} hours`,
			);
			// Call our existing advanceGameTime function to handle the time advancement
			const newState = advanceGameTime(state, action.hours);
			console.log(
				`[REDUCER] Time advanced from ${state.gameDay}:${state.gameHour} to ${newState.gameDay}:${newState.gameHour}`,
			);
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
				console.log(
					`Not enough money to buy ${quantity} ${product.name}. Cost: $${totalCost}`,
				);
				return state;
			}

			// Check if player has enough energy
			if (state.player.energy < PRODUCT_BUY_ENERGY_COST) {
				console.log(
					`Not enough energy to buy products. Required: ${PRODUCT_BUY_ENERGY_COST}`,
				);
				return state;
			}

			// Update inventory
			const updatedInventory = { ...state.player.inventory };
			updatedInventory[productId] =
				(updatedInventory[productId] || 0) + quantity;

			console.log(
				`[PURCHASE] Bought ${quantity} ${product.name} for $${totalCost}`,
			);

			return {
				...state,
				player: {
					...state.player,
					inventory: updatedInventory,
					money: state.player.money - totalCost,
					energy: state.player.energy - PRODUCT_BUY_ENERGY_COST,
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

			// Check if player has enough of this product
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

			// Calculate sale price (downsell price)
			const totalPrice = product.downsellPrice * quantity;

			// Update player inventory and money
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
