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

	// Create a set number of nodes at each level with better horizontal distribution
	for (let level = 1; level <= numLevels; level++) {
		// More consistent node distribution - use an odd number for better centering
		const nodesPerLevel = Math.max(
			level === 1 ? 1 : 3, // At least 3 nodes per level (except top)
			Math.floor(level * 1.8) | 1, // Make it odd for better centering (using bitwise OR with 1)
		);

		for (let i = 0; i < nodesPerLevel; i++) {
			nodes.push({
				id: createId(),
				level,
				isPlayerPosition: false, // Default to false, will be set later
				ownedByPlayer: false, // Default to false, will be set later
				money: level * 10, // Nodes at higher levels are worth more
				recruits: 0,
				inventory: {}, // Initialize empty inventory
				maxInventory: 20, // Default inventory capacity
			});
		}
	}

	// Sort nodes by level for easier processing
	const sortedNodes = [...nodes].sort((a, b) => a.level - b.level);

	// Create a more balanced pyramid where connections are more evenly distributed
	// but with some randomness to create a more natural structure
	for (let level = 2; level <= numLevels; level++) {
		// Get nodes at current level
		const nodesAtLevel = sortedNodes.filter((node) => node.level === level);
		// Get nodes at level above
		const nodesAbove = sortedNodes.filter((node) => node.level === level - 1);

		// Make sure there's at least one node above to connect to
		if (nodesAbove.length > 0) {
			// For each node at this level, connect to exactly one node above
			for (let i = 0; i < nodesAtLevel.length; i++) {
				const node = nodesAtLevel[i];

				// Calculate a preferred index in upper level based on relative position
				const relativePosition = i / (nodesAtLevel.length - 1 || 1);
				const preferredIndex = Math.min(
					Math.floor(relativePosition * nodesAbove.length),
					nodesAbove.length - 1,
				);

				// Add some randomness to the target selection
				// For a more organic structure - can vary by +/- 1 position if possible
				const randomOffset = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
				let targetIndex = preferredIndex + randomOffset;

				// Make sure the target index is within bounds
				targetIndex = Math.max(0, Math.min(targetIndex, nodesAbove.length - 1));

				const targetNode = nodesAbove[targetIndex];

				// Create upward connection
				links.push({
					source: node.id, // Current node (lower level) is source
					target: targetNode.id, // Node above is target
				});
			}
		}
	}

	// Calculate node positions level by level with even spacing
	const levelWidth = 800;
	let positionedNodes: PyramidNode[] = [];

	for (let level = 1; level <= numLevels; level++) {
		const nodesInLevel = sortedNodes.filter((node) => node.level === level);

		// Position nodes with equal spacing
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
