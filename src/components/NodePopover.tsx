import React, { useState } from "react";
import styled from "styled-components";
import { PyramidNode, Product } from "../types";

interface NodePopoverProps {
	node: PyramidNode;
	position: { x: number; y: number };
	onClose: () => void;
	canMoveUp?: boolean;
	playerStats?: any;
	dispatch?: any;
	products?: Product[];
}

const PopoverContainer = styled.div<{ x: number; y: number }>`
  position: absolute;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y - 30}px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 15px;
  width: 280px;
  z-index: 10;
  transform: translate(-50%, -100%);
  
  &::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid white;
  }
`;

const PopoverHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
`;

const PopoverTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-size: 18px;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: #333;
  }
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
`;

const Label = styled.span`
  color: #666;
`;

const Value = styled.span`
  color: #333;
  font-weight: 500;
`;

const ActionButton = styled.button<{ primary?: boolean; disabled?: boolean }>`
  background-color: ${(props) =>
		props.disabled ? "#e0e0e0" : props.primary ? "#2196F3" : "#f5f5f5"};
  color: ${(props) =>
		props.disabled ? "#999" : props.primary ? "white" : "#333"};
  border: ${(props) => (props.primary ? "none" : "1px solid #ddd")};
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 10px;
  width: 100%;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    background-color: ${(props) =>
			props.disabled ? "#e0e0e0" : props.primary ? "#1976D2" : "#e8f4fd"};
    transform: ${(props) => (props.disabled ? "none" : "translateY(-2px)")};
    box-shadow: ${(props) => (props.disabled ? "none" : "0 4px 8px rgba(0, 0, 0, 0.1)")};
  }
`;

const ActionIcon = styled.span`
  margin-right: 8px;
  font-size: 16px;
`;

const StatusTag = styled.span<{ isPositive?: boolean }>`
  background-color: ${(props) => (props.isPositive ? "#e8f5e9" : "#ffebee")};
  color: ${(props) => (props.isPositive ? "#388e3c" : "#d32f2f")};
  border-radius: 3px;
  padding: 3px 6px;
  font-size: 11px;
  margin-left: 5px;
`;

const InventorySection = styled.div`
  margin-top: 15px;
  border-top: 1px solid #eee;
  padding-top: 10px;
`;

const InventoryTitle = styled.h4`
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
`;

const ProductItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  font-size: 13px;
  padding: 5px;
  border-radius: 4px;
  background-color: #f5f5f5;
`;

const ProductName = styled.span`
  color: #333;
`;

const ProductCount = styled.span<{ isEmpty?: boolean }>`
  color: ${(props) => (props.isEmpty ? "#d32f2f" : "#388e3c")};
  font-weight: 500;
`;

const Tabs = styled.div`
  display: flex;
  margin-top: 15px;
  border-bottom: 1px solid #eee;
`;

const Tab = styled.div<{ active: boolean }>`
  padding: 5px 10px;
  margin-right: 5px;
  cursor: pointer;
  font-size: 13px;
  color: ${(props) => (props.active ? "#2196F3" : "#666")};
  border-bottom: ${(props) => (props.active ? "2px solid #2196F3" : "none")};
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
  width: 24px;
  height: 24px;
  border-radius: 3px;
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
  font-weight: bold;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const QuantityInput = styled.input`
  width: 40px;
  height: 24px;
  text-align: center;
  margin: 0 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
`;

const ProductDropdown = styled.select`
  width: 100%;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
  margin-top: 5px;
  font-size: 13px;
`;

const NodePopover: React.FC<NodePopoverProps> = ({
	node,
	position,
	onClose,
	canMoveUp,
	playerStats,
	dispatch,
	products = [],
}) => {
	const [activeTab, setActiveTab] = useState("info");
	const [selectedProduct, setSelectedProduct] = useState("");
	const [quantity, setQuantity] = useState(1);

	// Generate node title based on node properties
	const getNodeTitle = () => {
		if (node.isPlayerPosition) return "Your Position";
		if (node.ownedByPlayer) return "Your Network Member";
		if (node.aiControlled) return "Competitor's Member";
		return "Unaffiliated Person";
	};

	// Calculate required recruits to move up
	const requiredRecruits = canMoveUp ? Math.ceil((7 - node.level) * 1.5) : 0;

	// Check if player has enough energy
	const hasEnergyToMoveUp = playerStats && playerStats.energy >= 3;
	const hasEnergyToSell = playerStats && playerStats.energy >= 1;
	const hasEnergyToRestock = playerStats && playerStats.energy >= 1;

	// Check if player has enough recruits to move up
	const hasEnoughRecruits =
		playerStats && playerStats.recruits >= requiredRecruits;

	// Check if this node is a player's downstream node
	// Only show sell/restock tab for player's direct downstream nodes
	const isPlayerDownstreamNode = node.ownedByPlayer && !node.isPlayerPosition;

	// Handle move up action
	const handleMoveUp = () => {
		if (
			dispatch &&
			node &&
			canMoveUp &&
			hasEnoughRecruits &&
			hasEnergyToMoveUp
		) {
			dispatch({
				type: "MOVE_UP",
				targetNodeId: node.id,
			});
			onClose();
		}
	};

	// Handle sell to downstream
	const handleSellToDownstream = () => {
		if (!selectedProduct || quantity <= 0 || !hasEnergyToSell) return;

		// Check if player has enough inventory
		const playerInventory = playerStats?.inventory || {};
		const playerQuantity = playerInventory[selectedProduct] || 0;

		if (playerQuantity < quantity) {
			console.log("Not enough product in inventory");
			return;
		}

		// Check if node has enough capacity
		const nodeInventory = node.inventory || {};
		const nodeCurrentQuantity = nodeInventory[selectedProduct] || 0;
		const totalNodeInventory = Object.values(nodeInventory).reduce(
			(sum, qty) => sum + qty,
			0,
		);
		const availableCapacity =
			node.maxInventory - totalNodeInventory + nodeCurrentQuantity;

		if (quantity > availableCapacity) {
			console.log("Not enough capacity in downstream node");
			return;
		}

		dispatch({
			type: "SELL_DOWNSTREAM",
			targetNodeId: node.id,
			productId: selectedProduct,
			quantity,
		});

		setQuantity(1);
		onClose();
	};

	// Handle restock downstream
	const handleRestockDownstream = () => {
		if (!selectedProduct || quantity <= 0 || !hasEnergyToRestock) return;

		// Get product price
		const product = products.find((p) => p.id === selectedProduct);
		if (!product) return;

		// Check if player has enough money
		const totalCost = product.downsellPrice * quantity;
		if (playerStats.money < totalCost) {
			console.log("Not enough money to restock");
			return;
		}

		// Check if node has enough capacity
		const nodeInventory = node.inventory || {};
		const nodeCurrentQuantity = nodeInventory[selectedProduct] || 0;
		const totalNodeInventory = Object.values(nodeInventory).reduce(
			(sum, qty) => sum + qty,
			0,
		);
		const availableCapacity =
			node.maxInventory - totalNodeInventory + nodeCurrentQuantity;

		if (quantity > availableCapacity) {
			console.log("Not enough capacity in downstream node");
			return;
		}

		dispatch({
			type: "RESTOCK_DOWNSTREAM",
			targetNodeId: node.id,
			productId: selectedProduct,
			quantity,
		});

		setQuantity(1);
		onClose();
	};

	// Calculate available space in node inventory
	const calculateAvailableSpace = () => {
		const totalItems = Object.values(node.inventory || {}).reduce(
			(sum, qty) => sum + qty,
			0,
		);
		return node.maxInventory - totalItems;
	};

	const availableSpace = calculateAvailableSpace();

	return (
		<PopoverContainer x={position.x} y={position.y}>
			<PopoverHeader>
				<PopoverTitle>{getNodeTitle()}</PopoverTitle>
				<CloseButton onClick={onClose}>×</CloseButton>
			</PopoverHeader>

			{node.ownedByPlayer && (
				<Tabs>
					<Tab
						active={activeTab === "info"}
						onClick={() => setActiveTab("info")}
					>
						Info
					</Tab>
					<Tab
						active={activeTab === "inventory"}
						onClick={() => setActiveTab("inventory")}
					>
						Inventory
					</Tab>
					{isPlayerDownstreamNode &&
						playerStats &&
						playerStats.currentNodeId && (
							<Tab
								active={activeTab === "sell"}
								onClick={() => setActiveTab("sell")}
							>
								Sell/Restock
							</Tab>
						)}
				</Tabs>
			)}

			{activeTab === "info" && (
				<>
					<InfoRow>
						<Label>Level:</Label>
						<Value>{node.level}</Value>
					</InfoRow>

					<InfoRow>
						<Label>Recruits:</Label>
						<Value>{node.recruits}</Value>
					</InfoRow>

					<InfoRow>
						<Label>Money:</Label>
						<Value>${node.money}</Value>
					</InfoRow>

					<InfoRow>
						<Label>Status:</Label>
						<Value>
							{node.ownedByPlayer
								? "Owned by You"
								: node.aiControlled
									? "Owned by Another Player"
									: "Not Owned"}
						</Value>
					</InfoRow>

					{node.ownedByPlayer && (
						<InfoRow>
							<Label>Inventory Space:</Label>
							<Value>
								{availableSpace} of {node.maxInventory} available
							</Value>
						</InfoRow>
					)}

					{canMoveUp && dispatch && (
						<ActionButton
							primary
							disabled={!hasEnoughRecruits || !hasEnergyToMoveUp}
							onClick={handleMoveUp}
						>
							<ActionIcon>⬆️</ActionIcon> Move Up Here
							{!hasEnoughRecruits && (
								<StatusTag isPositive={false}>
									Need {requiredRecruits} Recruits
								</StatusTag>
							)}
							{!hasEnergyToMoveUp && (
								<StatusTag isPositive={false}>Need Energy</StatusTag>
							)}
						</ActionButton>
					)}
				</>
			)}

			{activeTab === "inventory" && node.ownedByPlayer && (
				<InventorySection>
					<InventoryTitle>Current Inventory</InventoryTitle>
					{products.map((product) => {
						const quantity = node.inventory?.[product.id] || 0;
						return (
							<ProductItem key={product.id}>
								<ProductName>{product.name}</ProductName>
								<ProductCount isEmpty={quantity === 0}>{quantity}</ProductCount>
							</ProductItem>
						);
					})}

					<InfoRow style={{ marginTop: 10 }}>
						<Label>Total Items:</Label>
						<Value>
							{Object.values(node.inventory || {}).reduce(
								(sum, qty) => sum + qty,
								0,
							)}{" "}
							/ {node.maxInventory}
						</Value>
					</InfoRow>
				</InventorySection>
			)}

			{activeTab === "sell" && node.ownedByPlayer && !node.isPlayerPosition && (
				<InventorySection>
					<InventoryTitle>Sell or Restock</InventoryTitle>

					<ProductDropdown
						value={selectedProduct}
						onChange={(e) => setSelectedProduct(e.target.value)}
					>
						<option value="">Select a product</option>
						{products.map((product) => (
							<option key={product.id} value={product.id}>
								{product.name} - ${product.downsellPrice}
							</option>
						))}
					</ProductDropdown>

					{selectedProduct && (
						<>
							<QuantityControls>
								<QuantityButton
									onClick={() => setQuantity(Math.max(1, quantity - 1))}
									disabled={quantity <= 1}
								>
									-
								</QuantityButton>
								<QuantityInput
									type="number"
									min="1"
									value={quantity}
									onChange={(e) =>
										setQuantity(Math.max(1, parseInt(e.target.value) || 1))
									}
								/>
								<QuantityButton onClick={() => setQuantity(quantity + 1)}>
									+
								</QuantityButton>
							</QuantityControls>

							<ActionButton
								onClick={handleSellToDownstream}
								disabled={!hasEnergyToSell || !selectedProduct}
								style={{ marginBottom: 5 }}
							>
								<ActionIcon>💰</ActionIcon> Sell to Downstream
								{!hasEnergyToSell && (
									<StatusTag isPositive={false}>No Energy</StatusTag>
								)}
							</ActionButton>

							<ActionButton
								onClick={handleRestockDownstream}
								disabled={!hasEnergyToRestock || !selectedProduct}
							>
								<ActionIcon>📦</ActionIcon> Restock Downstream
								{!hasEnergyToRestock && (
									<StatusTag isPositive={false}>No Energy</StatusTag>
								)}
							</ActionButton>
						</>
					)}
				</InventorySection>
			)}
		</PopoverContainer>
	);
};

export default NodePopover;
