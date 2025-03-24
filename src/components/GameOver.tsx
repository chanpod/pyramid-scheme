import React from "react";
import styled from "styled-components";
import { GameAction, PlayerStats } from "../types";

interface GameOverProps {
	isWinner: boolean;
	playerStats: PlayerStats;
	turns: number;
	dispatch: React.Dispatch<GameAction>;
}

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background-color: white;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  max-width: 600px;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const Title = styled.h1<{ win: boolean }>`
  margin-top: 0;
  color: ${(props) => (props.win ? "#4CAF50" : "#F44336")};
  font-size: 36px;
`;

const Message = styled.p`
  font-size: 18px;
  margin: 20px 0;
  line-height: 1.5;
  color: #333;
`;

const StatItem = styled.div`
  margin: 8px 0;
  font-size: 16px;
`;

const StatValue = styled.span`
  font-weight: bold;
  color: #2196F3;
`;

const Stats = styled.div`
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  text-align: left;
`;

const PlayAgainButton = styled.button`
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 25px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #388E3C;
  }
`;

const GameOver: React.FC<GameOverProps> = ({
	isWinner,
	playerStats,
	turns,
	dispatch,
}) => {
	return (
		<Overlay>
			<Modal>
				<Title win={isWinner}>{isWinner ? "You Won!" : "Game Over"}</Title>

				<Message>
					{isWinner
						? "Congratulations! You made it to the top of the pyramid scheme. You are now officially a successful pyramid scheme entrepreneur!"
						: "You ran out of resources and couldn't progress any further in the pyramid. Better luck next time!"}
				</Message>

				<Stats>
					<h3>Final Stats</h3>
					<StatItem>
						Level Reached: <StatValue>{playerStats.level}</StatValue>
					</StatItem>
					<StatItem>
						Final Money: <StatValue>${playerStats.money}</StatValue>
					</StatItem>
					<StatItem>
						Total Recruits: <StatValue>{playerStats.recruits}</StatValue>
					</StatItem>
					<StatItem>
						Charisma Level: <StatValue>{playerStats.charisma}</StatValue>
					</StatItem>
					<StatItem>
						Recruiting Power:{" "}
						<StatValue>{playerStats.recruitingPower}</StatValue>
					</StatItem>
					<StatItem>
						Total Turns: <StatValue>{turns}</StatValue>
					</StatItem>
				</Stats>

				<PlayAgainButton onClick={() => dispatch({ type: "RESET_GAME" })}>
					Play Again
				</PlayAgainButton>
			</Modal>
		</Overlay>
	);
};

export default GameOver;
