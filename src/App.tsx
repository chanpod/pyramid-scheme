import { useState, useEffect } from "react";
import styled from "styled-components";
import PyramidGraph from "./components/PyramidGraph";
import PlayerStatsDisplay from "./components/PlayerStats";
import ActionPanel from "./components/ActionPanel";
import GameOver from "./components/GameOver";
import Tutorial from "./components/Tutorial";
import { useGameState } from "./hooks/useGameState";
import { getNodesAbove, getNodesBelow } from "./utils/pyramidGenerator";
import { PyramidNode } from "./types";

const AppContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Arial', sans-serif;
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Use full viewport height */
`;

const Header = styled.header`
  margin-bottom: 30px;
  text-align: center;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
`;

const Title = styled.h1`
  color: #2196F3;
  font-size: 36px;
  margin-bottom: 5px;
`;

const Subtitle = styled.p`
  color: #666;
  font-size: 18px;
  margin-top: 0;
`;

const FlexContainer = styled.div`
  display: flex;
  gap: 20px;
  margin-top: 20px;
  flex-wrap: wrap;
  flex: 1; /* Take available space */
  
  @media (max-width: 992px) {
    flex-direction: column;
  }
`;

const LeftColumn = styled.div`
  flex: 3; /* Give the graph more space */
  min-width: 300px;
  display: flex;
  flex-direction: column;
`;

const RightColumn = styled.div`
  flex: 2; /* Give the controls less space */
  min-width: 300px;
  display: flex;
  flex-direction: column;
`;

const TutorialButton = styled.button`
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-right: 10px;
  
  &:hover {
    background-color: #1976D2;
  }
`;

const HeaderControls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
`;

const TurnCounter = styled.div`
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 8px 15px;
  font-weight: bold;
  color: #555;
  display: inline-block;
`;

const Footer = styled.footer`
  text-align: center;
  padding: 20px 0;
  margin-top: 30px;
  color: #666;
  font-size: 14px;
  border-top: 1px solid #eee;
`;

// Format time for display (12-hour format with AM/PM)
const formatTime = (hour: number) => {
	const period = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
	return `${displayHour}:00 ${period}`;
};

function App() {
	const { gameState, dispatch } = useGameState();
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [showTutorial, setShowTutorial] = useState(true);

	const playerNode =
		gameState.pyramid.nodes.find((node) => node.isPlayerPosition) || null;
	const selectedNode = selectedNodeId
		? gameState.pyramid.nodes.find((node) => node.id === selectedNodeId) || null
		: null;

	const nodesAbove = playerNode
		? getNodesAbove(gameState.pyramid, playerNode.id)
		: [];

	const nodesBelow = playerNode
		? getNodesBelow(gameState.pyramid, playerNode.id)
		: [];

	const canMoveUp = selectedNode
		? nodesAbove.some((node) => node.id === selectedNode.id)
		: false;

	const canRecruit = selectedNode
		? nodesBelow.some((node) => node.id === selectedNode.id)
		: false;

	const handleNodeClick = (nodeId: string) => {
		setSelectedNodeId(nodeId);
	};

	return (
		<AppContainer>
			<Header>
				<Title>Pyramid Scheme: The Game</Title>
				<Subtitle>Climb to the top of the pyramid... if you can!</Subtitle>
				<HeaderControls>
					<TutorialButton onClick={() => setShowTutorial(true)}>
						How To Play
					</TutorialButton>
					<TurnCounter>
						Day {gameState.gameDay} - {formatTime(gameState.gameHour)}
						{gameState.player.isResting && " (Resting)"}
					</TurnCounter>
				</HeaderControls>
			</Header>

			<FlexContainer>
				<LeftColumn>
					<PyramidGraph
						pyramid={gameState.pyramid}
						onNodeClick={handleNodeClick}
						selectedNodeId={selectedNodeId || undefined}
					/>
				</LeftColumn>

				<RightColumn>
					<PlayerStatsDisplay
						stats={gameState.player}
						lastDailyEnergyBonus={gameState.lastDailyEnergyBonus}
						dispatch={dispatch}
						pyramid={gameState.pyramid}
						playerNodeId={playerNode?.id || null}
					/>

					<ActionPanel
						dispatch={dispatch}
						selectedNodeId={selectedNodeId}
						playerNode={playerNode}
						selectedNode={selectedNode}
						playerStats={gameState.player}
						canMoveUp={canMoveUp}
						canRecruit={canRecruit}
						nodesAbove={nodesAbove}
						nodesBelow={nodesBelow}
						gameDay={gameState.gameDay}
						gameHour={gameState.gameHour}
						pendingRecruits={gameState.pendingRecruits}
					/>
				</RightColumn>
			</FlexContainer>

			{gameState.gameOver && (
				<GameOver
					isWinner={gameState.isWinner}
					playerStats={gameState.player}
					turns={gameState.turns}
					dispatch={dispatch}
				/>
			)}

			{showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

			<Footer>
				Pyramid Scheme: The Game - Build your network and climb to success!
			</Footer>
		</AppContainer>
	);
}

export default App;
