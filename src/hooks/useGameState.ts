import { useReducer, useEffect } from "react";
import { GameState, GameAction, PlayerStats, PyramidGraph } from "../types";
import {
	generatePyramid,
	getNodesAbove,
	getNodesBelow,
	addNodeToPyramid,
	hasParent,
} from "../utils/pyramidGenerator";

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
};

// Constants for game mechanics
const HOURS_PER_DAY = 3; // Game day is 12 hours (9 AM to 9 PM)
const MAX_ENERGY = 20;
const REST_ENERGY_PER_HOUR = 1; // Energy gained per hour of rest
const SHORT_REST_HOURS = 8; // Short rest period (8 hours)
const LONG_REST_HOURS = 16; // Long rest period (16 hours)
const ENERGY_COST = 800; // Cost to buy energy
const NEW_RECRUIT_CHANCE = 0.1; // Chance for a successful recruit to generate new potential recruits (reduced from 0.3)
const MONEY_RECRUITMENT_FACTOR = 0.00005; // How much money affects recruitment (reduced from 0.0001)
const BASE_RECRUITMENT_CHANCE = 0.03; // Base recruitment success chance (reduced from 0.08)
const AI_NODE_RECRUIT_CHANCE = 0.3; // Chance for AI nodes to recruit per day cycle (increased from 0.2)
const AI_NODE_EXPANSION_CHANCE = 0.4; // Chance for AI nodes to expand and create new nodes (increased from 0.3)

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

	return {
		pyramid,
		player: {
			...initialPlayerStats,
			currentNodeId: playerNode?.id || "",
		},
		gameLevel: 1,
		turns: 0,
		gameDay: 1,
		gameHour: 9, // Start at 9 AM
		gameOver: false,
		isWinner: false,
		pendingRecruits: [],
		lastDailyEnergyBonus: 0,
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
	const charismaGenerationChance = 0.15 + state.player.charisma * 0.03; // Reduced from 0.3 + charisma * 0.05
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
				const naturalRecruitChance = 0.2 + state.player.charisma * 0.03; // Reduced from 0.35 + charisma * 0.05
				const shouldAddNaturalRecruits = Math.random() < naturalRecruitChance;

				if (shouldAddNaturalRecruits) {
					// Calculate recruitment chance based on player stats
					// Recruiting power is the main factor for success chance
					let baseChance =
						BASE_RECRUITMENT_CHANCE + state.player.recruitingPower * 0.04; // Reduced from 0.06
					// Charisma no longer affects recruitment success chance
					// Money provides a small boost
					baseChance += state.player.money * MONEY_RECRUITMENT_FACTOR;
					baseChance += 0.02; // Reduced from 0.05
					const recruitmentChance = Math.min(baseChance, 0.75); // Reduced from 0.9

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
		BASE_RECRUITMENT_CHANCE + state.player.recruitingPower * 0.04; // Reduced from 0.06
	// Charisma no longer affects recruitment success
	// Money provides a small boost to recruitment success
	baseFormula += state.player.money * MONEY_RECRUITMENT_FACTOR;
	// Add smaller base bonus
	baseFormula += 0.02; // Reduced from 0.05
	// Cap at 75%
	const cappedFormula = Math.min(0.75, baseFormula); // Reduced from 0.9

	console.log(
		`%c[RECRUIT CHANCE] Base formula: ${BASE_RECRUITMENT_CHANCE} + (${state.player.recruitingPower} × 0.04) + ($${state.player.money} × ${MONEY_RECRUITMENT_FACTOR}) + 0.02 bonus = ${baseFormula.toFixed(2)} → capped at ${cappedFormula.toFixed(2)} (${Math.round(cappedFormula * 100)}%)`,
		"background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;",
	);

	for (const pendingRecruit of state.pendingRecruits) {
		// Apply the formula for this specific recruitment
		const recruitChance = Math.min(
			0.75, // Cap at 75% max (reduced from 90%)
			pendingRecruit.chance + 0.05, // Add 5% bonus to stored chance (reduced from 10%)
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
			...state.player,
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

	// Update energy if resting
	const player = { ...updatedState.player };
	if (player.isResting) {
		// Accumulate rest energy
		const energyGained = Math.min(
			MAX_ENERGY - player.energy,
			hours * REST_ENERGY_PER_HOUR,
		);
		player.energy += energyGained;

		// Check if rest period is over
		if (newDay * HOURS_PER_DAY + newHour >= player.restUntil) {
			player.isResting = false;
		}
	}

	return {
		...updatedState,
		gameHour: newHour,
		gameDay: newDay,
		player,
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
				BASE_RECRUITMENT_CHANCE + state.player.recruitingPower * 0.04; // Reduced from 0.06
			// Charisma no longer affects recruitment success
			// Money provides a small boost
			baseChance += state.player.money * MONEY_RECRUITMENT_FACTOR;
			// Add small base bonus
			baseChance += 0.02; // Reduced from 0.05

			// Cap at 75%
			const recruitmentChance = Math.min(baseChance, 0.75); // Reduced from 0.9

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
			const requiredRecruits = Math.ceil((7 - targetNode.level) * 1.5); // Increased from just (7 - targetNode.level)
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

			// Calculate money to collect based on owned nodes
			const ownedNodes = state.pyramid.nodes.filter(
				(node) => node.ownedByPlayer,
			);
			const moneyToCollect = ownedNodes.reduce(
				(sum, node) => sum + node.level * 20,
				0,
			);

			// Collect money without advancing time
			return {
				...state,
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

		case "UPGRADE_RECRUITING": {
			const upgradeCost = state.player.recruitingPower * 250;

			if (state.player.money < upgradeCost) {
				return state;
			}

			// Upgrade recruiting power without advancing time
			return {
				...state,
				player: {
					...state.player,
					recruitingPower: state.player.recruitingPower + 1,
					money: state.player.money - upgradeCost,
				},
				turns: state.turns + 1,
			};
		}

		case "REST": {
			const hours = action.hours; // Either SHORT_REST_HOURS or LONG_REST_HOURS

			// Calculate when rest will end
			const totalGameHours = state.gameDay * HOURS_PER_DAY + state.gameHour;
			const restUntil = totalGameHours + hours;

			// Start rest period (don't advance time immediately, time will pass naturally)
			return {
				...state,
				player: {
					...state.player,
					isResting: true,
					restUntil: restUntil,
				},
				turns: state.turns + 1,
			};
		}

		case "ADVANCE_TIME": {
			return advanceGameTime(state, action.hours);
		}

		case "RESET_GAME": {
			return createInitialGameState();
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
				const updatedGameState = {
					...gameState,
					gameOver: true,
					isWinner: false,
				};
				// We can't use dispatch here as it would cause an infinite loop
				// This is just a check to inform the UI
			}
		}
	}, [gameState]);

	return { gameState, dispatch };
};
