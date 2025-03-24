import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import PyramidFlowGraph from "./components/PyramidFlowGraph";
import PlayerStatsDisplay from "./components/PlayerStats";
import ActionPanel from "./components/ActionPanel";
import GameOver from "./components/GameOver";
import Tutorial from "./components/Tutorial";
import { useGameState } from "./hooks/useGameState";
import { getNodesAbove, getNodesBelow } from "./utils/pyramidGenerator";
import { PyramidNode } from "./types";

const AppContainer = styled.div`
  max-width: 1800px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Arial', sans-serif;
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Use full viewport height */
`;

const Header = styled.header`
  margin-bottom: 20px;
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

const GameContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 3fr 1fr;
  gap: 20px;
  flex: 1;
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
`;

const CenterPanel = styled.div`
  display: flex;
  flex-direction: column;
`;

const RightPanel = styled.div`
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
  background: linear-gradient(to right, #2196F3, #03A9F4);
  border-radius: 8px;
  padding: 12px 20px;
  font-weight: bold;
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  
  &.pulse {
    animation: pulse 0.6s ease-out;
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(33, 150, 243, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
    }
  }
`;

const TimeIcon = styled.span`
  margin-right: 10px;
  font-size: 18px;
`;

const DayInfo = styled.span`
  font-weight: bold;
  margin-right: 10px;
`;

const TimeInfo = styled.span`
  font-weight: bold;
`;

const RestingIndicator = styled.span`
  background-color: #FFD54F;
  color: #795548;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 10px;
  font-size: 12px;
  animation: blink 1.5s infinite;
  
  @keyframes blink {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
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
	const [pulseClock, setPulseClock] = useState(false);
	const prevHourRef = useRef(gameState.gameHour);

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

	// Effect to pulse the clock when time changes
	useEffect(() => {
		if (prevHourRef.current !== gameState.gameHour) {
			setPulseClock(true);
			const timer = setTimeout(() => setPulseClock(false), 600);
			prevHourRef.current = gameState.gameHour;
			return () => clearTimeout(timer);
		}
	}, [gameState.gameHour]);

	return (
		<AppContainer>
			<Header>
				<Title>Pyramid Scheme: The Game</Title>
				<Subtitle>Climb to the top of the pyramid... if you can!</Subtitle>
				<HeaderControls>
					<TutorialButton onClick={() => setShowTutorial(true)}>
						How To Play
					</TutorialButton>
					<TurnCounter className={pulseClock ? "pulse" : ""}>
						<TimeIcon>🕒</TimeIcon>
						<DayInfo>Day {gameState.gameDay}</DayInfo>
						<TimeInfo>{formatTime(gameState.gameHour)}</TimeInfo>
						{gameState.player.isResting && (
							<RestingIndicator>Resting</RestingIndicator>
						)}
					</TurnCounter>
				</HeaderControls>
			</Header>

			<GameContainer>
				<LeftPanel>
					<PlayerStatsDisplay
						stats={gameState.player}
						lastDailyEnergyBonus={gameState.lastDailyEnergyBonus}
						dispatch={dispatch}
						pyramid={gameState.pyramid}
						playerNodeId={playerNode?.id || null}
					/>
				</LeftPanel>

				<CenterPanel>
					<PyramidFlowGraph
						pyramid={gameState.pyramid}
						onNodeClick={handleNodeClick}
						selectedNodeId={selectedNodeId || undefined}
						canMoveUp={canMoveUp}
						canRecruit={canRecruit}
						playerStats={gameState.player}
						dispatch={dispatch}
						products={gameState.products}
					/>
				</CenterPanel>

				<RightPanel>
					<ActionPanel
						dispatch={dispatch}
						playerStats={gameState.player}
						gameDay={gameState.gameDay}
						gameHour={gameState.gameHour}
						pendingRecruits={gameState.pendingRecruits}
						products={gameState.products}
						marketingEvents={gameState.marketingEvents}
					/>
				</RightPanel>
			</GameContainer>

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
