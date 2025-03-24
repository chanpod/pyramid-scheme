import { useReducer, useEffect } from "react";
import { GameState, GameAction, PlayerStats, PyramidGraph } from "../types";
import {
	generatePyramid,
	getNodesAbove,
	getNodesBelow,
	addNodeToPyramid,
	hasParent,
} from "../utils/pyramidGenerator";

// Constants for game mechanics
const HOURS_PER_DAY = 24;
const MAX_ENERGY = 20;
const REST_ENERGY_PER_HOUR = 0.5; // Energy gained per hour of rest
const ENERGY_COST = 800; // Cost to buy energy
const PRODUCT_BUY_ENERGY_COST = 5; // Energy cost to buy products
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

// Investment multipliers for recruitment events
const MIN_INVESTMENT = 50;
const MAX_INVESTMENT = 500;
const INVESTMENT_SUCCESS_MULTIPLIER = 0.0005; // 0.05% per dollar invested
const INVESTMENT_ATTEMPTS_MULTIPLIER = 0.002; // 0.2% per dollar invested

// Initial player stats
const initialPlayerStats: PlayerStats = {
	money: 500,
	recruits: 0,
	level: 6, // Starting at level 6 (near the bottom)
	currentNodeId: "",
	recruitingPower: 1,
	charisma: 1,
	energy: 10,
	reputation: 1,
	isResting: false,
	restUntil: 0,
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

// Create initial game state
const createInitialGameState = (): GameState => {
	const pyramid = generatePyramid(7, 6); // 7 levels total, player starts at level 6
	const playerNode = pyramid.nodes.find((node) => node.isPlayerPosition);

	// For debugging, log the pyramid structure
	console.log(
		"Initial pyramid structure:",
		`Total nodes: ${pyramid.nodes.length}`,
		`Player node: ${playerNode?.id} at level ${playerNode?.level}`,
	);

	// Initialize all nodes with inventory and max capacity
	const initializedNodes = pyramid.nodes.map((node) => ({
		...node,
		inventory: {},
		maxInventory: DEFAULT_MAX_INVENTORY,
	}));
	pyramid.nodes = initializedNodes;

	// Make sure there are recruitable nodes below the player's position
	// If player is not at the bottom level, check if there are nodes below
	if (playerNode && playerNode.level < 7) {
		// Get all nodes directly below the player
		const nodesBelow = pyramid.nodes.filter(
			(node) =>
				node.level === playerNode.level + 1 &&
				pyramid.links.some(
					(link) => link.source === node.id && link.target === playerNode.id,
				),
		);

		console.log(`Found ${nodesBelow.length} nodes directly below player`);

		// If there are no nodes below, add 2-3 nodes for initial recruitment targets
		if (nodesBelow.length === 0) {
			const numNodesToAdd = Math.floor(Math.random() * 2) + 2; // 2-3 nodes
			console.log(`Adding ${numNodesToAdd} initial recruitment targets`);

			for (let i = 0; i < numNodesToAdd; i++) {
				// Add new node to the pyramid
				const result = addNodeToPyramid(
					pyramid,
					playerNode.id,
					playerNode.level + 1,
				);

				pyramid.nodes = result.pyramid.nodes;
				pyramid.links = result.pyramid.links;

				// Mark new nodes as potential recruits
				const newNodeIndex = pyramid.nodes.findIndex(
					(node) => node.id === result.newNodeId,
				);
				if (newNodeIndex >= 0) {
					pyramid.nodes[newNodeIndex] = {
						...pyramid.nodes[newNodeIndex],
						isPotentialRecruit: true,
						inventory: {},
						maxInventory: DEFAULT_MAX_INVENTORY,
					};
				}

				console.log(
					`Added initial recruitment target at level ${playerNode.level + 1}, nodeId: ${result.newNodeId}`,
				);
			}
		}
	}

	// Add version number to track changes
	pyramid.version = 1;

	// Initialize player inventory with some product
	const playerInventory = {};
	productDefinitions.forEach((product) => {
		playerInventory[product.id] = 5; // Start with 5 of each product
	});

	return {
		pyramid,
		player: {
			...initialPlayerStats,
			currentNodeId: playerNode?.id || "",
			inventory: playerInventory,
		},
		gameLevel: 1,
		turns: 0,
		gameDay: 1,
		gameHour: 9, // Start at 9 AM
		gameOver: false,
		isWinner: false,
		pendingRecruits: [],
		lastDailyEnergyBonus: 0,
		products: productDefinitions,
		aiUpdateCounter: 0,
		pyramidVersion: 0,
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
const ensureRecruitableNodesBelow = (
	pyramidGraph: PyramidGraph,
	playerNodeId: string,
) => {
	console.log(`Ensuring recruitable nodes below player ${playerNodeId}`);

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

	// If there are fewer than 2 nodes below, add new ones
	let updatedPyramid = { ...pyramidGraph };
	if (nodesBelow.length < 2 && playerNode.level < 7) {
		const numNodesToAdd = 2 - nodesBelow.length;
		console.log(`Adding ${numNodesToAdd} new recruitment targets`);

		for (let i = 0; i < numNodesToAdd; i++) {
			// Add new node to the pyramid
			const result = addNodeToPyramid(
				updatedPyramid,
				playerNode.id,
				playerNode.level + 1,
			);

			updatedPyramid = result.pyramid;

			// Mark the new node as a potential recruit
			const newNodeIndex = updatedPyramid.nodes.findIndex(
				(node) => node.id === result.newNodeId,
			);
			if (newNodeIndex >= 0) {
				updatedPyramid.nodes[newNodeIndex] = {
					...updatedPyramid.nodes[newNodeIndex],
					isPotentialRecruit: true,
				};
			}

			console.log(
				`Added new recruitment target at level ${playerNode.level + 1}, nodeId: ${result.newNodeId}`,
			);
		}

		// Increment the version to trigger a re-render
		updatedPyramid = incrementPyramidVersion(updatedPyramid);
	}

	return updatedPyramid;
};

// Process day cycle - resolve recruitment attempts
const processDayCycle = (state: GameState): GameState => {
	// Process any pending recruitment attempts
	const successfulRecruits = [];
	let updatedNodes = [...state.pyramid.nodes];
	let updatedLinks = [...state.pyramid.links];
	let newRecruits = state.player.recruits;
	let updatedPyramid = {
		...state.pyramid,
		nodes: updatedNodes,
		links: updatedLinks,
	};
	let pyramidChanged = false;

	// Debug log with more detailed information
	console.log(
		`%c[DAY CYCLE] Processing day ${state.gameDay}, Pending recruits: ${state.pendingRecruits.length}`,
		"background: #3f51b5; color: white; padding: 2px 5px; border-radius: 3px;",
	);

	// 1. Generate potential recruits based on charisma
	// Higher charisma = more potential recruits generated
	const charismaGenerationChance = 0.08 + state.player.charisma * 0.015; // Reduced from 0.12 + charisma * 0.025
	const shouldGenerateNewRecruits = Math.random() < charismaGenerationChance;

	console.log(
		`%c[CHARISMA GENERATION] Chance to generate new recruits: ${Math.round(charismaGenerationChance * 100)}%, Result: ${shouldGenerateNewRecruits ? "GENERATING" : "NOT GENERATING"}`,
		"background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px;",
	);

	if (shouldGenerateNewRecruits) {
		// Find player node
		const playerNode = updatedNodes.find((node) => node.isPlayerPosition);
		if (playerNode) {
			// Calculate number of new nodes based on charisma (1-3 nodes)
			const numNewNodes = Math.min(
				3,
				Math.max(
					1,
					Math.floor(Math.random() * (state.player.charisma / 2)) + 1,
				),
			);

			console.log(
				`[CHARISMA GENERATION] Generating ${numNewNodes} new potential recruits near player`,
			);

			// Add new potential recruits around the player's network
			// First, get all nodes owned by player to potentially place recruits below them
			const ownedNodes = updatedNodes.filter((node) => node.ownedByPlayer);

			if (ownedNodes.length > 0) {
				for (let i = 0; i < numNewNodes; i++) {
					// Choose a random owned node as parent
					const parentNode =
						ownedNodes[Math.floor(Math.random() * ownedNodes.length)];
					const newLevel = parentNode.level + 1;

					// Don't add nodes beyond level 10
					if (newLevel <= 10) {
						const result = addNodeToPyramid(
							updatedPyramid,
							parentNode.id,
							newLevel,
						);
						updatedPyramid = result.pyramid;
						updatedNodes = updatedPyramid.nodes;
						updatedLinks = updatedPyramid.links;

						// Mark the new node as a potential recruit
						const newNodeIndex = updatedNodes.findIndex(
							(node) => node.id === result.newNodeId,
						);
						if (newNodeIndex >= 0) {
							updatedNodes[newNodeIndex] = {
								...updatedNodes[newNodeIndex],
								isPotentialRecruit: true,
							};
							updatedPyramid.nodes = updatedNodes;
						}

						pyramidChanged = true;

						console.log(
							`[CHARISMA GENERATION] Added new potential recruit below node at level ${parentNode.level}, ID: ${result.newNodeId.substring(0, 6)}...`,
						);
					}
				}
			} else {
				// If no owned nodes yet, add below player position
				for (let i = 0; i < numNewNodes; i++) {
					if (playerNode.level < 7) {
						const result = addNodeToPyramid(
							updatedPyramid,
							playerNode.id,
							playerNode.level + 1,
						);
						updatedPyramid = result.pyramid;
						updatedNodes = updatedPyramid.nodes;
						updatedLinks = updatedPyramid.links;

						// Mark the new node as a potential recruit
						const newNodeIndex = updatedNodes.findIndex(
							(node) => node.id === result.newNodeId,
						);
						if (newNodeIndex >= 0) {
							updatedNodes[newNodeIndex] = {
								...updatedNodes[newNodeIndex],
								isPotentialRecruit: true,
							};
							updatedPyramid.nodes = updatedNodes;
						}

						pyramidChanged = true;

						console.log(
							`[CHARISMA GENERATION] Added new potential recruit below player, ID: ${result.newNodeId.substring(0, 6)}...`,
						);
					}
				}
			}
		}
	}

	// 2. Process AI node recruitment and expansion
	// This simulates competition in the pyramid
	const aiNodes = updatedNodes.filter((node) => node.aiControlled);
	if (aiNodes.length > 0) {
		console.log(
			`[AI ACTIVITY] Processing ${aiNodes.length} AI-controlled nodes`,
		);

		for (const aiNode of aiNodes) {
			// AI nodes can recruit unowned nodes below them
			const nodesBelow = updatedNodes.filter(
				(node) =>
					node.level === aiNode.level + 1 &&
					!node.ownedByPlayer &&
					!node.aiControlled &&
					updatedPyramid.links.some(
						(link) => link.source === node.id && link.target === aiNode.id,
					),
			);

			// Try to recruit unowned nodes (can potentially "snipe" player's targets)
			if (nodesBelow.length > 0 && Math.random() < AI_NODE_RECRUIT_CHANCE) {
				const targetNode =
					nodesBelow[Math.floor(Math.random() * nodesBelow.length)];
				const nodeIndex = updatedNodes.findIndex(
					(node) => node.id === targetNode.id,
				);

				if (nodeIndex >= 0) {
					// AI successfully recruits the node
					updatedNodes[nodeIndex] = {
						...updatedNodes[nodeIndex],
						aiControlled: true,
						lastUpdated: Date.now(),
					};

					pyramidChanged = true;
					console.log(
						`[AI RECRUITMENT] AI node ${aiNode.id.substring(0, 6)}... recruited node ${targetNode.id.substring(0, 6)}...`,
					);

					// AI nodes can also expand the pyramid (generate new potential recruits)
					if (Math.random() < AI_NODE_EXPANSION_CHANCE) {
						const newLevel = targetNode.level + 1;
						if (newLevel <= 10) {
							const numNodesToAdd = Math.floor(Math.random() * 2) + 1;

							for (let i = 0; i < numNodesToAdd; i++) {
								const result = addNodeToPyramid(
									updatedPyramid,
									targetNode.id,
									newLevel,
								);
								updatedPyramid = result.pyramid;
								updatedNodes = updatedPyramid.nodes;
								updatedLinks = updatedPyramid.links;
								pyramidChanged = true;

								console.log(
									`[AI EXPANSION] AI created new node ${result.newNodeId.substring(0, 6)}... at level ${newLevel}`,
								);
							}
						}
					}
				}
			}
		}
	}

	// 3. Process natural recruitment (if no player-initiated recruits)
	if (state.pendingRecruits.length === 0) {
		console.log(
			"[DAY CYCLE] No pending recruits to process, checking for natural recruits",
		);

		// Find player node
		const playerNode = updatedNodes.find((node) => node.isPlayerPosition);
		if (playerNode) {
			// Get nodes directly below the player
			const nodesBelow = updatedNodes.filter(
				(node) =>
					node.level === playerNode.level + 1 &&
					updatedPyramid.links.some(
						(link) => link.source === node.id && link.target === playerNode.id,
					),
			);

			// Find nodes that aren't already owned by player or AI
			const unownedNodesBelow = nodesBelow.filter(
				(node) => !node.ownedByPlayer && !node.aiControlled,
			);
			console.log(
				`[NATURAL RECRUITS] Found ${unownedNodesBelow.length} potential unowned nodes below player`,
			);

			// If there are unowned nodes, add some of them to pending recruits
			if (unownedNodesBelow.length > 0) {
				// Recruiting chance influenced by charisma for GENERATION only
				const naturalRecruitChance = 0.12 + state.player.charisma * 0.02; // Reduced from 0.2 + charisma * 0.03
				const shouldAddNaturalRecruits = Math.random() < naturalRecruitChance;

				if (shouldAddNaturalRecruits) {
					// Calculate recruitment chance based on player stats
					// Recruiting power is the main factor for success chance
					let baseChance =
						BASE_RECRUITMENT_CHANCE + state.player.recruitingPower * 0.06; // Changed from 0.04
					// Charisma no longer affects recruitment success chance
					// Money provides a small boost
					baseChance += state.player.money * MONEY_RECRUITMENT_FACTOR;
					baseChance += 0.01; // Reduced from 0.02
					const recruitmentChance = Math.min(baseChance, 0.65); // Reduced from 0.75

					// Take up to 2 random unowned nodes and add them to pending recruits
					const numToAdd = Math.min(2, unownedNodesBelow.length);
					const shuffled = [...unownedNodesBelow].sort(
						() => 0.5 - Math.random(),
					);
					const selected = shuffled.slice(0, numToAdd);

					// Create new pending recruits
					const naturalRecruits = selected.map((node) => ({
						nodeId: node.id,
						chance: recruitmentChance,
					}));

					console.log(
						`[NATURAL RECRUITS] Added ${naturalRecruits.length} natural recruitment attempts for next day`,
					);

					// Process these natural recruits immediately
					for (const recruit of naturalRecruits) {
						const roll = Math.random();
						const isSuccessful = roll < recruit.chance;

						console.log(
							`%c[NATURAL RECRUITMENT] Node ${recruit.nodeId.substring(0, 6)}... 
							Chance: ${(recruit.chance * 100).toFixed(1)}% (${isSuccessful ? "SUCCESS" : "FAILURE"}) 
							Roll: ${(roll * 100).toFixed(1)}% < ${(recruit.chance * 100).toFixed(1)}%`,
							`background: ${isSuccessful ? "#4caf50" : "#f44336"}; color: white; padding: 2px 5px; border-radius: 3px;`,
						);

						if (isSuccessful) {
							// Find the node and mark as owned
							const nodeIndex = updatedNodes.findIndex(
								(node) => node.id === recruit.nodeId,
							);

							if (nodeIndex >= 0) {
								console.log(
									`[NATURAL SUCCESS] Node at index ${nodeIndex} marked as owned`,
								);

								updatedNodes[nodeIndex] = {
									...updatedNodes[nodeIndex],
									ownedByPlayer: true,
									isPotentialRecruit: false,
									lastUpdated: Date.now(),
								};

								pyramidChanged = true;
								successfulRecruits.push(recruit.nodeId);
								newRecruits++;

								// Generate new potential recruits below (influenced by charisma)
								const newNodeChance =
									NEW_RECRUIT_CHANCE + state.player.charisma * 0.04;
								if (Math.random() < newNodeChance) {
									// Add 1-2 new nodes below this newly recruited node
									const numNewNodes = Math.floor(Math.random() * 2) + 1;
									console.log(
										`[NATURAL SUCCESS] Generating ${numNewNodes} new recruits below node ${recruit.nodeId.substring(0, 6)}...`,
									);

									const parentNode = updatedNodes[nodeIndex];
									const newLevel = parentNode.level + 1;

									if (newLevel <= 10) {
										for (let i = 0; i < numNewNodes; i++) {
											const result = addNodeToPyramid(
												updatedPyramid,
												parentNode.id,
												newLevel,
											);

											updatedPyramid = result.pyramid;
											updatedNodes = updatedPyramid.nodes;
											updatedLinks = updatedPyramid.links;
											pyramidChanged = true;
										}
									}
								}
							}
						}
					}
				}
			} else {
				// If no unowned nodes, check if we need to add some
				if (nodesBelow.length < 2) {
					console.log(
						"[NATURAL RECRUITS] Not enough nodes below player, adding new ones",
					);

					// Add 1-2 new potential recruits
					const numToAdd = 2 - nodesBelow.length;
					for (let i = 0; i < numToAdd; i++) {
						const result = addNodeToPyramid(
							updatedPyramid,
							playerNode.id,
							playerNode.level + 1,
						);

						updatedPyramid = result.pyramid;
						updatedNodes = updatedPyramid.nodes;
						updatedLinks = updatedPyramid.links;
						pyramidChanged = true;

						console.log(
							`[NATURAL RECRUITS] Added new potential recruit node ${result.newNodeId.substring(0, 6)}...`,
						);
					}
				}
			}
		}

		// If there are still no pending recruits, just return the updated state
		if (state.pendingRecruits.length === 0 && successfulRecruits.length === 0) {
			if (pyramidChanged) {
				updatedPyramid = incrementPyramidVersion(updatedPyramid);
				console.log(
					`[PYRAMID] Version updated to ${updatedPyramid.version} due to natural recruit changes`,
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
		}
	}

	// Log player stats for debugging with more details
	console.log(
		`%c[PLAYER STATS] Charisma: ${state.player.charisma}, Recruiting Power: ${state.player.recruitingPower}, Money: $${state.player.money}`,
		"background: #4caf50; color: white; padding: 2px 5px; border-radius: 3px;",
	);

	// 4. Process player-initiated recruitment attempts
	// Calculate base formula for recruitment chance
	// Recruiting power has the strongest effect on recruitment success
	let baseFormula =
		BASE_RECRUITMENT_CHANCE + state.player.recruitingPower * 0.06; // Changed from 0.04
	// Charisma no longer affects recruitment success
	// Money provides a smaller boost
	baseFormula += state.player.money * MONEY_RECRUITMENT_FACTOR;
	// Smaller base bonus
	baseFormula += 0.01; // Reduced from 0.02
	// Cap at 65%
	const cappedFormula = Math.min(0.65, baseFormula); // Reduced from 0.75

	console.log(
		`%c[RECRUIT CHANCE] Base formula: ${BASE_RECRUITMENT_CHANCE} + (${state.player.recruitingPower} × 0.06) + ($${state.player.money} × ${MONEY_RECRUITMENT_FACTOR}) + 0.01 bonus = ${baseFormula.toFixed(2)} → capped at ${cappedFormula.toFixed(2)} (${Math.round(cappedFormula * 100)}%)`,
		"background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;",
	);

	for (const pendingRecruit of state.pendingRecruits) {
		// Apply the formula for this specific recruitment
		const recruitChance = Math.min(
			0.65, // Cap at 65% max (reduced from 70%)
			pendingRecruit.chance + 0.03, // Add 3% bonus to stored chance (reduced from 5%)
		);

		const roll = Math.random();
		const isSuccessful = roll < recruitChance;

		// More visible and detailed recruitment attempt log
		console.log(
			`%c[RECRUITMENT ATTEMPT] Node ${pendingRecruit.nodeId.substring(0, 6)}... 
			Chance: ${(recruitChance * 100).toFixed(1)}% (${isSuccessful ? "SUCCESS" : "FAILURE"}) 
			Roll: ${(roll * 100).toFixed(1)}% < ${(recruitChance * 100).toFixed(1)}%`,
			`background: ${isSuccessful ? "#4caf50" : "#f44336"}; color: white; padding: 2px 5px; border-radius: 3px;`,
		);

		if (isSuccessful) {
			// Find the node and mark as owned
			const nodeIndex = updatedNodes.findIndex(
				(node) => node.id === pendingRecruit.nodeId,
			);

			if (nodeIndex >= 0) {
				// Make sure it hasn't been sniped by AI
				if (updatedNodes[nodeIndex].aiControlled) {
					console.log(
						`[FAILURE] Node ${pendingRecruit.nodeId.substring(0, 6)}... was already recruited by AI!`,
					);
					continue;
				}

				console.log(
					`[SUCCESS] Found node at index ${nodeIndex}, marking as owned`,
				);

				updatedNodes[nodeIndex] = {
					...updatedNodes[nodeIndex],
					ownedByPlayer: true,
					isPotentialRecruit: false,
					lastUpdated: Date.now(),
				};

				// Find and mark the parent node (target of the link) as owned as well
				// This ensures the connection in the pyramid is complete
				const targetLink = updatedPyramid.links.find(
					(link) => link.source === pendingRecruit.nodeId,
				);
				if (targetLink) {
					const parentNodeIndex = updatedNodes.findIndex(
						(node) => node.id === targetLink.target,
					);
					if (
						parentNodeIndex >= 0 &&
						!updatedNodes[parentNodeIndex].ownedByPlayer
					) {
						console.log(
							`[SUCCESS] Also marking parent node ${targetLink.target.substring(0, 6)}... as owned`,
						);
						updatedNodes[parentNodeIndex] = {
							...updatedNodes[parentNodeIndex],
							ownedByPlayer: true,
							isPotentialRecruit: false,
							lastUpdated: Date.now(),
						};
					}
				}

				pyramidChanged = true;
				successfulRecruits.push(pendingRecruit.nodeId);
				newRecruits++;

				console.log(
					`[SUCCESS] Recruited node ${pendingRecruit.nodeId.substring(0, 6)}..., new recruit count: ${newRecruits}`,
				);

				// Chance to generate new potential recruits below this node
				// Based on charisma (more charisma = more likely to expand network)
				const expansionChance =
					NEW_RECRUIT_CHANCE + state.player.charisma * 0.04;
				const shouldGenerateNewRecruits = Math.random() < expansionChance;

				if (shouldGenerateNewRecruits) {
					// Add 1-3 new nodes below this newly recruited node
					// More recruiting power = more nodes generated
					const maxNodes = Math.max(
						1,
						Math.min(3, Math.ceil(state.player.recruitingPower / 2)),
					);
					const numNewNodes = Math.floor(Math.random() * maxNodes) + 1;
					console.log(
						`[SUCCESS] Generating ${numNewNodes} new potential recruits below node ${pendingRecruit.nodeId.substring(0, 6)}...`,
					);

					const parentNode = updatedNodes[nodeIndex];
					const newLevel = parentNode.level + 1;

					// Don't add nodes beyond level 10 to prevent excessive growth
					if (newLevel <= 10) {
						for (let i = 0; i < numNewNodes; i++) {
							// Add new node to the pyramid
							const result = addNodeToPyramid(
								updatedPyramid,
								parentNode.id,
								newLevel,
							);

							updatedPyramid = result.pyramid;
							updatedNodes = updatedPyramid.nodes;
							updatedLinks = updatedPyramid.links;

							pyramidChanged = true;

							console.log(
								`[SUCCESS] Added new potential recruit: Node ${result.newNodeId.substring(0, 6)}... at level ${newLevel}`,
							);
						}
					}
				} else {
					console.log("[SUCCESS] No new recruits generated below this node");
				}
			} else {
				console.error(
					`[ERROR] Could not find node with ID ${pendingRecruit.nodeId} in the pyramid`,
				);
			}
		} else {
			console.log(
				`[FAILURE] Recruitment attempt for node ${pendingRecruit.nodeId.substring(0, 6)}... failed. Try improving Recruiting Power!`,
			);
		}
	}

	// Detailed summary logging
	console.log(
		`%c[RECRUITMENT SUMMARY] ${successfulRecruits.length}/${state.pendingRecruits.length} successful recruits, total recruits now: ${newRecruits}`,
		"background: #9c27b0; color: white; padding: 2px 5px; border-radius: 3px;",
	);

	// Log node ownership stats
	const ownedNodes = updatedNodes.filter((node) => node.ownedByPlayer).length;
	const aiNodeCount = updatedNodes.filter((node) => node.aiControlled).length;
	const totalNodes = updatedNodes.length;
	const playerPercentage = ((ownedNodes / totalNodes) * 100).toFixed(1);
	const aiPercentage = ((aiNodeCount / totalNodes) * 100).toFixed(1);
	console.log(
		`[PYRAMID STATUS] Owned nodes: ${ownedNodes} (${playerPercentage}%), AI nodes: ${aiNodeCount} (${aiPercentage}%), Total: ${totalNodes} nodes`,
	);

	// Process automatic sales from downstream nodes
	// This simulates your recruits selling products to random people
	const playerOwnedNodes = updatedNodes.filter(
		(node) => node.ownedByPlayer && !node.isPlayerPosition,
	);

	if (playerOwnedNodes.length > 0) {
		console.log(
			`[DOWNSTREAM SALES] Processing sales from ${playerOwnedNodes.length} owned nodes`,
		);

		// Keep track of total profit from downstream sales
		let totalDownstreamProfit = 0;
		let totalDownstreamSales = 0;

		// Calculate commission percentage based on player's charisma and reputation
		// Higher charisma and reputation means higher percentage of downstream sales
		const baseCommissionPercentage = 0.3; // 30% base
		const charismaBonus = state.player.charisma * 0.03; // 3% per charisma point
		const reputationBonus = state.player.reputation * 0.05; // 5% per reputation point
		const commissionPercentage = Math.min(
			0.8,
			baseCommissionPercentage + charismaBonus + reputationBonus,
		);

		console.log(
			`[DOWNSTREAM COMMISSION] Your commission rate is ${(commissionPercentage * 100).toFixed(1)}% (Base: 30%, Charisma: +${(charismaBonus * 100).toFixed(1)}%, Reputation: +${(reputationBonus * 100).toFixed(1)}%)`,
		);

		// First, automatically restock nodes with low inventory
		const updatedPlayerInventory = { ...state.player.inventory };
		let restockCost = 0;

		console.log(
			`[DOWNSTREAM RESTOCK] Automatically checking nodes that need restocking`,
		);

		// For each owned node, process sales based on their inventory
		const nodesWithSales = playerOwnedNodes.map((node) => {
			// Check if node needs restocking (less than 25% capacity)
			const totalInventory = Object.values(node.inventory || {}).reduce(
				(sum, qty) => sum + qty,
				0,
			);
			const needsRestock = totalInventory < node.maxInventory * 0.25;

			// Automatically restock if inventory is low
			let updatedNodeInventory = { ...node.inventory };

			if (needsRestock) {
				console.log(
					`[DOWNSTREAM RESTOCK] Node ${node.id.substring(0, 6)}... is low on inventory (${totalInventory}/${node.maxInventory})`,
				);

				// Look through player's inventory and restock one product at a time
				// Prioritize products that the node already sells
				let availableSpace = node.maxInventory - totalInventory;

				// First try to restock products the node already has
				for (const [productId, quantity] of Object.entries(
					updatedNodeInventory,
				)) {
					if (quantity <= 2 && availableSpace > 0) {
						// Only restock if less than 2 items left
						const product = state.products.find((p) => p.id === productId);
						if (!product) continue;

						// Check if player has this product
						const playerQuantity = updatedPlayerInventory[productId] || 0;
						if (playerQuantity > 0) {
							// Calculate how much to restock
							const restockQuantity = Math.min(
								Math.floor(node.maxInventory * 0.5) - quantity, // Restock to 50% capacity
								playerQuantity, // Limited by player inventory
								availableSpace, // Limited by available space
							);

							if (restockQuantity > 0) {
								// Update node and player inventory
								updatedNodeInventory[productId] =
									(updatedNodeInventory[productId] || 0) + restockQuantity;
								updatedPlayerInventory[productId] =
									playerQuantity - restockQuantity;
								availableSpace -= restockQuantity;

								// Add to restock cost (player gets wholesale price)
								restockCost += product.downsellPrice * restockQuantity;

								console.log(
									`[DOWNSTREAM RESTOCK] Restocked ${restockQuantity} ${product.name} to node ${node.id.substring(0, 6)}... for $${product.downsellPrice * restockQuantity}`,
								);
							}
						}
					}
				}

				// If the node still has space and few or no products, add some new products
				if (
					availableSpace > 0 &&
					(Object.keys(updatedNodeInventory).length === 0 ||
						totalInventory < node.maxInventory * 0.1)
				) {
					// Try to add new products the player has
					for (const product of state.products) {
						// Skip if node already has this product
						if (
							updatedNodeInventory[product.id] &&
							updatedNodeInventory[product.id] > 0
						) {
							continue;
						}

						// Check if player has this product
						const playerQuantity = updatedPlayerInventory[product.id] || 0;
						if (playerQuantity > 0) {
							// Calculate how much to stock
							const stockQuantity = Math.min(
								Math.floor(node.maxInventory * 0.3), // Stock to 30% capacity
								playerQuantity, // Limited by player inventory
								availableSpace, // Limited by available space
							);

							if (stockQuantity > 0) {
								// Update node and player inventory
								updatedNodeInventory[product.id] = stockQuantity;
								updatedPlayerInventory[product.id] =
									playerQuantity - stockQuantity;
								availableSpace -= stockQuantity;

								// Add to restock cost (player gets wholesale price)
								restockCost += product.downsellPrice * stockQuantity;

								console.log(
									`[DOWNSTREAM RESTOCK] Added new product: ${stockQuantity} ${product.name} to node ${node.id.substring(0, 6)}... for $${product.downsellPrice * stockQuantity}`,
								);
							}
						}
					}
				}
			}

			// Process sales for this node
			let nodeProfit = 0;
			let nodeSalesCount = 0;

			// Skip if node has no inventory after restocking
			if (
				!updatedNodeInventory ||
				Object.values(updatedNodeInventory).reduce(
					(sum, qty) => sum + qty,
					0,
				) === 0
			) {
				return {
					...node,
					inventory: updatedNodeInventory,
				};
			}

			// Calculate node-specific selling factors
			// Nodes higher in the pyramid (lower level numbers) are better at selling
			const levelFactor = Math.max(0, (7 - node.level) * 0.03); // 0% to 18% bonus based on level

			// Nodes that have been owned longer have better reputation
			const ageBonus = node.lastUpdated
				? Math.min(
						0.1,
						((Date.now() - node.lastUpdated) / (1000 * 60 * 60 * 24)) * 0.01,
					) // Up to 10% bonus for 10+ days owned
				: 0;

			// For each product in inventory, attempt to sell some
			for (const [productId, quantity] of Object.entries(
				updatedNodeInventory,
			)) {
				if (quantity <= 0) continue;

				// Find product details
				const product = state.products.find((p) => p.id === productId);
				if (!product) continue;

				// Calculate max items they can sell per day based on level
				// Higher levels (lower numbers) can sell more items
				const maxSellAttempts = Math.min(
					quantity,
					Math.floor(1 + (7 - node.level) * 0.7), // Increased from 0.5 to make higher levels more effective
				);

				if (maxSellAttempts <= 0) continue;

				// Calculate chance of successful sale for this specific node and product
				// Base chance from product
				const nodeBaseSaleChance = Math.min(0.8, product.baseChance + 0.08);

				// Apply node-specific factors
				const nodeSaleChance = Math.min(
					0.9,
					nodeBaseSaleChance + levelFactor + ageBonus,
				);

				console.log(
					`[DOWNSTREAM SALES] Node ${node.id.substring(0, 6)}... selling ${product.name}: Base chance ${(nodeBaseSaleChance * 100).toFixed(1)}% + Level bonus ${(levelFactor * 100).toFixed(1)}% + Age bonus ${(ageBonus * 100).toFixed(1)}% = Final chance ${(nodeSaleChance * 100).toFixed(1)}%`,
				);

				// Attempt to sell items
				let soldItems = 0;
				for (let i = 0; i < maxSellAttempts; i++) {
					if (Math.random() < nodeSaleChance) {
						soldItems++;
					}
				}

				if (soldItems > 0) {
					// Calculate profit
					const salesRevenue = soldItems * product.basePrice;
					nodeProfit += salesRevenue;
					nodeSalesCount += soldItems;

					// Update inventory
					updatedNodeInventory[productId] = quantity - soldItems;

					console.log(
						`[DOWNSTREAM SALES] Node ${node.id.substring(0, 6)}... sold ${soldItems}/${maxSellAttempts} ${product.name} for $${salesRevenue}`,
					);
				}
			}

			// Split profits - node keeps (1-commission)%, player gets commission%
			const playerCommission = Math.floor(nodeProfit * commissionPercentage);
			const nodeKeeps = nodeProfit - playerCommission;

			// Update totals
			totalDownstreamProfit += playerCommission;
			totalDownstreamSales += nodeSalesCount;

			// Update node with new inventory and add profit
			return {
				...node,
				inventory: updatedNodeInventory,
				money: node.money + nodeKeeps, // Node keeps its portion of sales
				lastRestocked: needsRestock ? Date.now() : node.lastRestocked,
			};
		});

		// Update nodes in the pyramid
		updatedNodes = updatedNodes.map((node) => {
			const updatedNode = nodesWithSales.find((n) => n.id === node.id);
			if (updatedNode) {
				return updatedNode;
			}
			return node;
		});

		updatedPyramid = {
			...updatedPyramid,
			nodes: updatedNodes,
		};

		// Update player with new inventory, money (adding commission), and sales count
		let updatedPlayer = { ...state.player };

		// Apply restocking cost to player's money
		updatedPlayer.money = Math.max(0, updatedPlayer.money - restockCost);

		// Add commission from sales to player's money
		updatedPlayer.money += totalDownstreamProfit;

		// Update player inventory after restocking
		updatedPlayer.inventory = updatedPlayerInventory;

		// Update total sales to downstream count
		updatedPlayer.totalSalesDownstream =
			(updatedPlayer.totalSalesDownstream || 0) + totalDownstreamSales;

		if (restockCost > 0) {
			console.log(`[DOWNSTREAM RESTOCK] Total restock cost: $${restockCost}`);
			pyramidChanged = true;
		}

		// If downstream nodes made sales, indicate pyramid changed
		if (totalDownstreamProfit > 0) {
			pyramidChanged = true;
			console.log(
				`[DOWNSTREAM SALES] Your commission from downstream sales: $${totalDownstreamProfit} (${totalDownstreamSales} units sold)`,
			);
		} else {
			console.log(
				`[DOWNSTREAM SALES] No sales made by your downstreams today.`,
			);
		}
	}

	// Process automatic sales from player's inventory to random people
	// This happens at the end of each day and doesn't cost energy
	let updatedPlayer = { ...state.player };
	const processPlayerRandomSales = () => {
		console.log(
			`[PLAYER RANDOM SALES] Processing automatic sales from player's inventory`,
		);

		// Skip if player has no inventory
		if (
			!updatedPlayer.inventory ||
			Object.values(updatedPlayer.inventory).reduce(
				(sum, qty) => sum + qty,
				0,
			) === 0
		) {
			console.log(`[PLAYER RANDOM SALES] No inventory to sell`);
			return;
		}

		let totalSales = 0;
		let totalRevenue = 0;
		const updatedInventory = { ...updatedPlayer.inventory };

		// For each product in player's inventory, attempt to sell some
		for (const [productId, quantity] of Object.entries(updatedInventory)) {
			if (quantity <= 0) continue;

			// Find product details
			const product = state.products.find((p) => p.id === productId);
			if (!product) continue;

			// Calculate max items player can sell per day
			// This depends on charisma - higher charisma means more sales attempts
			const maxSellAttempts = Math.min(
				quantity,
				Math.floor(3 + updatedPlayer.charisma),
			);

			if (maxSellAttempts <= 0) continue;

			// Calculate sale chance based on charisma and product base chance
			const saleChance = Math.min(
				0.98, // Increased max cap from 0.95
				product.baseChance + updatedPlayer.charisma * 0.06, // Increased charisma impact from 0.05
			);

			// Attempt to sell items
			let soldItems = 0;
			for (let i = 0; i < maxSellAttempts; i++) {
				if (Math.random() < saleChance) {
					soldItems++;
				}
			}

			if (soldItems > 0) {
				// Calculate revenue
				const salesRevenue = soldItems * product.basePrice;
				totalRevenue += salesRevenue;
				totalSales += soldItems;

				// Update inventory
				updatedInventory[productId] = quantity - soldItems;

				console.log(
					`[PLAYER RANDOM SALES] Sold ${soldItems}/${maxSellAttempts} ${product.name} for $${salesRevenue}`,
				);
			}
		}

		// Update player with new inventory and money
		if (totalSales > 0) {
			updatedPlayer = {
				...updatedPlayer,
				inventory: updatedInventory,
				money: updatedPlayer.money + totalRevenue,
				totalSalesRandom: (updatedPlayer.totalSalesRandom || 0) + totalSales,
			};

			console.log(
				`[PLAYER RANDOM SALES] Total sales: ${totalSales} items for $${totalRevenue}`,
			);
		} else {
			console.log(`[PLAYER RANDOM SALES] No successful sales today`);
		}
	};

	// Process player random sales
	processPlayerRandomSales();

	// Only increment version if the pyramid structure changed
	if (pyramidChanged) {
		updatedPyramid = incrementPyramidVersion(updatedPyramid);
		console.log(`[PYRAMID] Version updated to ${updatedPyramid.version}`);
	} else {
		console.log("[PYRAMID] No changes to pyramid structure");
	}

	return {
		...state,
		pyramid: updatedPyramid,
		player: {
			...updatedPlayer,
			recruits: newRecruits,
		},
		pendingRecruits: [], // Clear pending recruits after processing
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

		// Now process day cycle for recruitment attempts
		updatedState = processDayCycle(updatedState);
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

	// Generate potential recruits
	const newRecruits: { nodeId: string; chance: number }[] = [];

	for (let i = 0; i < successAttempts; i++) {
		// Calculate recruitment chance based on player stats and event
		const baseChance = 0.12 + state.player.charisma * 0.02;
		const recruitingBonus = state.player.recruitingPower * 0.06;
		const reputationBonus = state.player.reputation * 0.04;

		// Investment provides additional bonus
		const investmentBonus = event.investmentAmount
			? Math.min(0.2, event.investmentAmount * INVESTMENT_SUCCESS_MULTIPLIER)
			: 0;

		// Calculate final chance, capped at 65%
		let recruitChance = Math.min(
			0.65,
			baseChance + recruitingBonus + reputationBonus + investmentBonus,
		);

		// Generate a unique node ID for the potential recruit
		const potentialNodeId = `potential-${Date.now()}-${i}`;

		newRecruits.push({
			nodeId: potentialNodeId,
			chance: recruitChance,
		});

		console.log(
			`Generated potential recruit with ${Math.round(recruitChance * 100)}% chance of success`,
		);
	}

	// Add new potential recruits to the state
	return {
		...state,
		pendingRecruits: [...state.pendingRecruits, ...newRecruits],
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

			// Calculate success chance based on charisma and reputation
			const baseChance =
				intensity === "light"
					? 0.5 + player.charisma * 0.05
					: intensity === "medium"
						? 0.35 + player.charisma * 0.06
						: 0.2 + player.charisma * 0.07;

			const successChance = Math.min(
				0.85,
				baseChance + player.reputation * 0.02,
			);

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

		case "RECRUIT": {
			const targetNodeId = action.targetNodeId;

			// Only allow recruiting if the player has enough energy
			if (state.player.energy < 2) {
				return state;
			}

			console.log(`[RECRUIT] Attempting to recruit node ${targetNodeId}`);

			// Calculate recruitment chance based on player stats
			// Recruiting power has the strongest effect
			let baseChance =
				BASE_RECRUITMENT_CHANCE + state.player.recruitingPower * 0.06; // Changed from 0.04
			// Charisma no longer affects recruitment success
			// Money provides a smaller boost
			baseChance += state.player.money * MONEY_RECRUITMENT_FACTOR;
			// Smaller base bonus
			baseChance += 0.01; // Reduced from 0.02

			// Cap at 65%
			const recruitmentChance = Math.min(baseChance, 0.65); // Reduced from 0.75

			// Add to pending recruits for processing at day cycle
			const pendingRecruits = [
				...state.pendingRecruits,
				{
					nodeId: targetNodeId,
					chance: recruitmentChance,
				},
			];

			console.log(
				`[RECRUIT] Recruitment chance: ${Math.round(recruitmentChance * 100)}% (RecruitingPower: ${state.player.recruitingPower}, Money: $${state.player.money})`,
			);
			console.log(
				`[RECRUIT] pendingRecruits updated. Current count: ${pendingRecruits.length}`,
			);
			console.debug("[RECRUIT] Pending recruits:", pendingRecruits);

			return {
				...state,
				player: {
					...state.player,
					energy: state.player.energy - 2,
				},
				pendingRecruits,
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
			const upgradeCost = state.player.charisma * 200;

			if (state.player.money < upgradeCost) {
				return state;
			}

			// Upgrade charisma without advancing time
			return {
				...state,
				player: {
					...state.player,
					charisma: state.player.charisma + 1,
					money: state.player.money - upgradeCost,
				},
				turns: state.turns + 1,
			};
		}

		case "UPGRADE_ENERGY": {
			// Increased cost for buying energy
			const upgradeCost = ENERGY_COST;

			if (
				state.player.money < upgradeCost ||
				state.player.energy >= MAX_ENERGY
			) {
				return state;
			}

			// Buy energy without advancing time
			const energyToAdd = 5;
			const newEnergy = Math.min(MAX_ENERGY, state.player.energy + energyToAdd);

			return {
				...state,
				player: {
					...state.player,
					energy: newEnergy,
					money: state.player.money - upgradeCost,
				},
				turns: state.turns + 1,
			};
		}

		case "BUY_PRODUCT": {
			const { productId, quantity } = action;

			// Check if player has enough energy - buying product costs energy
			if (state.player.energy < PRODUCT_BUY_ENERGY_COST) {
				console.log(
					`Not enough energy to buy products. Need ${PRODUCT_BUY_ENERGY_COST} energy.`,
				);
				return state;
			}

			// Find the product
			const product = state.products.find((p) => p.id === productId);
			if (!product) {
				console.error(`Product ${productId} not found`);
				return state;
			}

			// Check if player has enough money
			const totalCost = product.baseCost * quantity;
			if (state.player.money < totalCost) {
				console.log(
					`Not enough money to buy ${quantity} ${product.name}. Need $${totalCost}`,
				);
				return state;
			}

			// Update player inventory
			const currentQuantity = state.player.inventory[productId] || 0;
			const updatedInventory = {
				...state.player.inventory,
				[productId]: currentQuantity + quantity,
			};

			return {
				...state,
				player: {
					...state.player,
					money: state.player.money - totalCost,
					inventory: updatedInventory,
					energy: state.player.energy - PRODUCT_BUY_ENERGY_COST, // Deduct energy for buying products
				},
				turns: state.turns + 1,
			};
		}

		case "SELL_DOWNSTREAM": {
			const { productId, targetNodeId, quantity } = action;

			// Find the product
			const product = state.products.find((p) => p.id === productId);
			if (!product) {
				console.error(`Product ${productId} not found`);
				return state;
			}

			// Find the target node
			const targetNodeIndex = state.pyramid.nodes.findIndex(
				(node) => node.id === targetNodeId && node.ownedByPlayer,
			);

			if (targetNodeIndex === -1) {
				console.error(
					`Target node ${targetNodeId} not found or not owned by player`,
				);
				return state;
			}

			const targetNode = state.pyramid.nodes[targetNodeIndex];

			// Check if player has enough inventory
			const playerCurrentQuantity = state.player.inventory[productId] || 0;
			if (playerCurrentQuantity < quantity) {
				console.log(
					`Not enough ${product.name} in inventory. Have ${playerCurrentQuantity}, need ${quantity}`,
				);
				return state;
			}

			// Check if target node has enough space
			const targetCurrentQuantity = targetNode.inventory?.[productId] || 0;
			const totalInventoryAfterSale =
				Object.values(targetNode.inventory || {}).reduce(
					(sum, qty) => sum + qty,
					0,
				) +
				quantity -
				targetCurrentQuantity;

			if (totalInventoryAfterSale > targetNode.maxInventory) {
				console.log(`Target downstream doesn't have enough inventory space`);
				return state;
			}

			// Calculate revenue (discounted price for downstream sales)
			const revenue = quantity * product.downsellPrice;

			// Update player inventory
			const updatedPlayerInventory = {
				...state.player.inventory,
				[productId]: playerCurrentQuantity - quantity,
			};

			// Update target node inventory
			const updatedNodes = state.pyramid.nodes.map((node) => {
				if (node.id === targetNodeId) {
					const nodeInventory = node.inventory || {};

					return {
						...node,
						inventory: {
							...nodeInventory,
							[productId]: (nodeInventory[productId] || 0) + quantity,
						},
						lastRestocked: Date.now(),
					};
				}
				return node;
			});

			console.log(
				`Manually sold ${quantity} ${product.name} to downstream for $${revenue}`,
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
					money: state.player.money + revenue,
					inventory: updatedPlayerInventory,
					totalSalesDownstream: state.player.totalSalesDownstream + quantity,
				},
				turns: state.turns + 1,
			};
		}

		case "RESTOCK_DOWNSTREAM": {
			const { targetNodeId, productId, quantity } = action;

			// Find the product
			const product = state.products.find((p) => p.id === productId);
			if (!product) {
				console.error(`Product ${productId} not found`);
				return state;
			}

			// Find the target node
			const targetNodeIndex = state.pyramid.nodes.findIndex(
				(node) => node.id === targetNodeId && node.ownedByPlayer,
			);

			if (targetNodeIndex === -1) {
				console.error(
					`Target node ${targetNodeId} not found or not owned by player`,
				);
				return state;
			}

			const targetNode = state.pyramid.nodes[targetNodeIndex];

			// Check if player has enough inventory
			const playerCurrentQuantity = state.player.inventory[productId] || 0;
			if (playerCurrentQuantity < quantity) {
				console.log(
					`Not enough ${product.name} in inventory. Have ${playerCurrentQuantity}, need ${quantity}`,
				);
				return state;
			}

			// Check if target node has enough space
			const targetCurrentQuantity = targetNode.inventory?.[productId] || 0;
			const totalInventoryAfterRestock =
				Object.values(targetNode.inventory || {}).reduce(
					(sum, qty) => sum + qty,
					0,
				) +
				quantity -
				targetCurrentQuantity;

			if (totalInventoryAfterRestock > targetNode.maxInventory) {
				console.log(`Target downstream doesn't have enough inventory space`);
				return state;
			}

			// Calculate cost for the downstream node (at wholesale price)
			const restockCost = quantity * product.downsellPrice;

			// Check if the node has enough money to pay for the restock
			if (targetNode.money < restockCost) {
				console.log(
					`Downstream node doesn't have enough money (needs $${restockCost}), has $${targetNode.money}`,
				);
				return state;
			}

			// Update player inventory
			const updatedPlayerInventory = {
				...state.player.inventory,
				[productId]: playerCurrentQuantity - quantity,
			};

			// Update target node inventory and deduct money
			const updatedNodes = state.pyramid.nodes.map((node) => {
				if (node.id === targetNodeId) {
					const nodeInventory = node.inventory || {};

					return {
						...node,
						inventory: {
							...nodeInventory,
							[productId]: (nodeInventory[productId] || 0) + quantity,
						},
						money: node.money - restockCost, // Deduct money from the node
						lastRestocked: Date.now(),
					};
				}
				return node;
			});

			console.log(
				`Restocked ${quantity} ${product.name} to downstream for $${restockCost}`,
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
					money: state.player.money + restockCost, // Player gains the money
					inventory: updatedPlayerInventory,
					energy: state.player.energy - NODE_RESTOCK_ENERGY_COST, // Deduct energy
				},
				turns: state.turns + 1,
			};
		}

		case "REST": {
			const { hours } = action;
			const { gameDay, gameHour } = state;

			// Calculate when rest will end
			const restUntil = gameDay * HOURS_PER_DAY + gameHour + hours;

			// Calculate a random energy recovery percentage between 60-100%
			const recoveryPercentage = 0.6 + Math.random() * 0.4;

			// Store the recovery percentage and energy gain for later use when rest is completed
			console.log(
				`Starting rest for ${hours} hours. Current energy: ${state.player.energy}, 
				Recovery rate: ${Math.round(recoveryPercentage * 100)}%`,
			);

			// Set resting state (but don't advance time yet)
			return {
				...state,
				player: {
					...state.player,
					isResting: true,
					restUntil: restUntil,
					// Store the recovery percentage for later use
					recoveryPercentage: recoveryPercentage,
				},
				turns: state.turns + 1,
			};
		}

		case "ADVANCE_TIME": {
			let updatedState = advanceGameTime(state, action.hours);

			// Check if the player is resting and if rest should be completed
			if (state.player.isResting) {
				const currentTotalHours =
					state.gameDay * HOURS_PER_DAY + state.gameHour + action.hours;

				// If current time has reached or passed the restUntil time
				if (currentTotalHours >= state.player.restUntil) {
					// Calculate how many hours the player actually rested
					const hoursRested =
						state.player.restUntil -
						(state.gameDay * HOURS_PER_DAY + state.gameHour);

					// Calculate energy gain based on rest duration and stored recovery percentage
					const recoveryPercentage = state.player.recoveryPercentage || 0.8; // Default if not stored
					const energyGain = Math.min(
						MAX_ENERGY - state.player.energy,
						Math.ceil(hoursRested * recoveryPercentage * 1.5), // Scaled to be more generous than previous system
					);

					console.log(
						`Rest completed after ${hoursRested} hours. Energy gain: ${energyGain}, 
						Recovery: ${Math.round(recoveryPercentage * 100)}%`,
					);

					// Update player energy and end resting state
					updatedState = {
						...updatedState,
						player: {
							...updatedState.player,
							energy: Math.min(MAX_ENERGY, state.player.energy + energyGain),
							isResting: false,
							restUntil: 0,
							recoveryPercentage: undefined,
						},
					};
				}
			} else {
				// Check for game over condition if not resting
				// Only trigger game over if they're completely out of options
				if (
					updatedState.player.energy <= 0 &&
					updatedState.player.money < ENERGY_COST &&
					!updatedState.gameOver
				) {
					// Set game over but not a winner
					updatedState = {
						...updatedState,
						gameOver: true,
						isWinner: false,
					};
					console.log("GAME OVER after time advance: Out of energy and money");
				}
			}

			return updatedState;
		}

		case "RESET_GAME": {
			return createInitialGameState();
		}

		case "SET_GAME_OVER": {
			return {
				...state,
				gameOver: true,
				isWinner: action.isWinner,
			};
		}

		default:
			return state;
	}
};

export const useGameState = () => {
	const [gameState, dispatch] = useReducer(
		gameReducer,
		null,
		createInitialGameState,
	);

	// Auto-advance time every few seconds to simulate game time passing
	useEffect(() => {
		const timeInterval = setInterval(() => {
			if (!gameState.gameOver) {
				dispatch({ type: "ADVANCE_TIME", hours: 1 });
			}
		}, 1000); // Advance 1 hour every 1 second of real time

		return () => clearInterval(timeInterval);
	}, [gameState.gameOver]); // Only dependency is gameOver state to prevent constant re-renders

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
		dispatch,
	]);

	return { gameState, dispatch };
};
