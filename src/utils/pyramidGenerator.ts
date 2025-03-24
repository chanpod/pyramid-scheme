import { PyramidGraph, PyramidNode, PyramidLink } from "../types";

// Helper to create a unique ID
const createId = (): string => {
	return Math.random().toString(36).substring(2, 10);
};

// Helper to get nodes above the current node
export const getNodesAbove = (
	pyramid: PyramidGraph,
	nodeId: string,
): PyramidNode[] => {
	const connections = pyramid.links.filter((link) => link.source === nodeId);
	return pyramid.nodes.filter((node) =>
		connections.some((link) => link.target === node.id),
	);
};

// Helper to get nodes below the current node
export const getNodesBelow = (
	pyramid: PyramidGraph,
	nodeId: string,
): PyramidNode[] => {
	const connections = pyramid.links.filter((link) => link.target === nodeId);
	return pyramid.nodes.filter((node) =>
		connections.some((link) => link.source === node.id),
	);
};

// Helper to calculate node positions in a level (row)
const calculateNodePositions = (
	levelNodes: PyramidNode[],
	level: number,
	levelWidth: number,
): PyramidNode[] => {
	return levelNodes.map((node, index) => {
		// Calculate x position based on index and total nodes in this level
		const spacing = levelWidth / (levelNodes.length + 1);
		const x = spacing * (index + 1);

		return {
			...node,
			x,
			y: level * 100, // Vertical spacing between levels
		};
	});
};

/**
 * Add a new node to the pyramid under a parent node
 * @param pyramid The current pyramid
 * @param parentId The ID of the parent node
 * @param level The level of the new node
 * @returns Updated pyramid and the ID of the new node
 */
export const addNodeToPyramid = (
	pyramid: PyramidGraph,
	parentId: string,
	level: number,
): { pyramid: PyramidGraph; newNodeId: string } => {
	// Create a new node
	const newNodeId = createId();
	const newNode: PyramidNode = {
		id: newNodeId,
		level,
		x: 0, // Will be positioned properly
		y: level * 100,
		money: level * 10, // Money increases with level
		recruits: 0,
		isPlayerPosition: false,
		ownedByPlayer: false,
		inventory: {}, // Initialize empty inventory
		maxInventory: 20, // Default inventory capacity
	};

	// Create a link from parent to new node
	// For consistency: lower levels (higher numbers) are sources that connect to targets above
	const newLink: PyramidLink = {
		source: newNodeId, // The new node is the source (lower level)
		target: parentId, // The parent is the target (higher level)
	};

	// Add the new node and link to the pyramid
	const updatedNodes = [...pyramid.nodes, newNode];
	const updatedLinks = [...pyramid.links, newLink];

	// Get all nodes at this level to reposition them
	const nodesAtLevel = updatedNodes.filter((node) => node.level === level);

	// Calculate levelWidth based on the total number of levels
	const levelWidth = 800; // Fixed width for visualization

	// Update positions of all nodes at this level
	const repositionedNodes = updatedNodes.map((node) => {
		if (node.level === level) {
			// Find index of this node in its level
			const levelIndex = nodesAtLevel.findIndex((n) => n.id === node.id);
			const spacing = levelWidth / (nodesAtLevel.length + 1);
			const x = spacing * (levelIndex + 1);

			return {
				...node,
				x,
			};
		}
		return node;
	});

	return {
		pyramid: {
			...pyramid,
			nodes: repositionedNodes,
			links: updatedLinks,
			version: (pyramid.version || 0) + 1, // Increment version when adding nodes
		},
		newNodeId,
	};
};

// Helper function to check if a node already has a parent
export const hasParent = (pyramid: PyramidGraph, nodeId: string): boolean => {
	return pyramid.links.some((link) => link.source === nodeId);
};

// Function to update pyramid generation to ensure single parent property
export const generatePyramid = (
	numLevels: number,
	playerStartLevel: number,
): PyramidGraph => {
	// Create initial nodes
	const nodes: PyramidNode[] = [];
	const links: PyramidLink[] = [];

	// Create a set number of nodes at each level
	for (let level = 1; level <= numLevels; level++) {
		// Top level has few nodes, more nodes at lower levels
		const numNodesAtLevel = Math.max(1, Math.floor(level * 1.5));

		for (let i = 0; i < numNodesAtLevel; i++) {
			const isPlayerNode =
				level === playerStartLevel && i === Math.floor(numNodesAtLevel / 2);
			nodes.push({
				id: createId(),
				level,
				isPlayerPosition: isPlayerNode,
				ownedByPlayer: isPlayerNode, // Player starts owning their node
				money: level * 10, // Nodes at higher levels are worth more
				recruits: 0,
				inventory: {}, // Initialize empty inventory
				maxInventory: 20, // Default inventory capacity
			});
		}
	}

	// Sort nodes by level for easier processing
	const sortedNodes = [...nodes].sort((a, b) => a.level - b.level);

	// Create a simple pyramid where each node connects to exactly one node above
	// Start from level 2 (since level 1 is the top and has no parent)
	for (let level = 2; level <= numLevels; level++) {
		// Get nodes at current level
		const nodesAtLevel = sortedNodes.filter((node) => node.level === level);
		// Get nodes at level above
		const nodesAbove = sortedNodes.filter((node) => node.level === level - 1);

		// Make sure there's at least one node above to connect to
		if (nodesAbove.length > 0) {
			// For each node at this level, connect to exactly one node above
			for (const node of nodesAtLevel) {
				// Calculate which node above to connect to
				// This distributes nodes more evenly across the pyramid
				const targetNodeIndex = Math.min(
					Math.floor(
						(nodesAbove.length * nodesAtLevel.indexOf(node)) /
							nodesAtLevel.length,
					),
					nodesAbove.length - 1,
				);
				const targetNode = nodesAbove[targetNodeIndex];

				// Create single upward connection
				links.push({
					source: node.id, // Current node (lower level) is source
					target: targetNode.id, // Node above is target
				});
			}
		}
	}

	// Calculate node positions level by level
	const levelWidth = 800;
	let positionedNodes: PyramidNode[] = [];

	for (let level = 1; level <= numLevels; level++) {
		const nodesInLevel = sortedNodes.filter((node) => node.level === level);
		const positionedNodesInLevel = calculateNodePositions(
			nodesInLevel,
			level,
			levelWidth,
		);
		positionedNodes = [...positionedNodes, ...positionedNodesInLevel];
	}

	// Add version number to track changes
	return {
		nodes: positionedNodes,
		links,
		version: 1,
	};
};
