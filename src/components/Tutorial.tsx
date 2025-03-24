import React, { useState } from "react";
import styled from "styled-components";

interface TutorialProps {
	onClose: () => void;
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
  padding: 30px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const Title = styled.h1`
  margin-top: 0;
  color: #2196F3;
  font-size: 28px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 15px;
`;

const Section = styled.div`
  margin-bottom: 25px;
`;

const SectionTitle = styled.h2`
  color: #333;
  font-size: 20px;
  margin-bottom: 10px;
`;

const Text = styled.p`
  font-size: 16px;
  line-height: 1.6;
  color: #444;
  margin-bottom: 15px;
`;

const CloseButton = styled.button`
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 20px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #1976D2;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
`;

const List = styled.ul`
  padding-left: 20px;
`;

const ListItem = styled.li`
  margin-bottom: 8px;
  line-height: 1.5;
`;

const Tutorial: React.FC<TutorialProps> = ({ onClose }) => {
	return (
		<Overlay>
			<Modal>
				<Title>Pyramid Scheme Game Tutorial</Title>

				<Section>
					<SectionTitle>Game Objective</SectionTitle>
					<Text>
						Welcome to the Pyramid Scheme game! Your goal is to climb your way
						to the top of the pyramid. You start near the bottom and must
						recruit others below you to gain enough influence and resources to
						move up in the hierarchy.
					</Text>
				</Section>

				<Section>
					<SectionTitle>Getting Started</SectionTitle>
					<Text>
						You start at the bottom of the pyramid scheme. Your goal is to
						recruit people below you, generate sales, and eventually climb to
						the top position (Level 1).
					</Text>
					<Text>
						You have limited energy points to perform actions. Some actions,
						like recruiting, require energy. Energy replenishes over time, or
						you can spend money to buy more.
					</Text>
				</Section>

				<Section>
					<SectionTitle>Network Marketing</SectionTitle>
					<Text>
						When you're low on money and products, hosting a marketing event can
						help generate immediate cash. This should be viewed as a last resort
						when you're in a tight spot, as it costs significant energy.
					</Text>
					<Text>Click the "Host an Event" button to see your options:</Text>
					<Text>
						<strong>Social Media Blitz:</strong> The most affordable option at 2
						energy, with decent success rates. Create targeted posts across your
						social networks.
					</Text>
					<Text>
						<strong>Home Party:</strong> A medium-sized investment of 5 energy
						with better potential returns. Host people at your home for
						demonstrations.
					</Text>
					<Text>
						<strong>Public Workshop:</strong> The most expensive at 8 energy but
						offers the largest potential payouts. Rent a space for a large
						promotional event.
					</Text>
					<Text>
						All events' success rates are enhanced by your Charisma and
						Reputation attributes, making these more effective as you progress
						in the game.
					</Text>
				</Section>

				<Section>
					<SectionTitle>Game Mechanics</SectionTitle>
					<List>
						<ListItem>
							<strong>The Pyramid:</strong> The game shows a network of
							connected nodes arranged in a pyramid structure. Each node
							represents a position in the pyramid scheme. The top nodes (Level
							1, 2, etc.) are more valuable but harder to reach.
						</ListItem>
						<ListItem>
							<strong>Your Position:</strong> Your current position is marked
							with a green circle. You can only interact with nodes that are
							directly connected to your position.
						</ListItem>
						<ListItem>
							<strong>Time System:</strong> The game operates on a day/hour
							system. Time passes automatically (1 hour every second), and
							recruitment results are processed at the end of each day. Unlike
							other actions, resting will lock you out of performing actions
							until the specified time has passed.
						</ListItem>
						<ListItem>
							<strong>Recruiting:</strong> When you attempt to recruit someone,
							your request is queued and will be processed at the end of the
							day. The success chance is based on your Charisma and Recruiting
							Power. Successful recruits will become part of your network and
							increase your recruit count.
						</ListItem>
						<ListItem>
							<strong>Moving Up:</strong> To move up to a higher position, you
							need to have enough recruits. The higher the position, the more
							recruits you need. Moving up consumes your recruits and energy.
						</ListItem>
						<ListItem>
							<strong>Energy:</strong> Most actions consume energy. You have a
							maximum of 20 energy points. When you run out, you need to rest to
							recover or purchase more energy (which is expensive). You
							automatically gain 3 energy at the start of each new day as a
							daily bonus.
						</ListItem>
						<ListItem>
							<strong>Money:</strong> Collect money from your network to upgrade
							your stats. Money is primarily earned from nodes you've
							successfully recruited.
						</ListItem>
					</List>
				</Section>

				<Section>
					<SectionTitle>Actions</SectionTitle>
					<List>
						<ListItem>
							<strong>Recruit:</strong> Queue a recruitment attempt for a node
							below you (costs 2 Energy). Results will be known at the end of
							the day. Each recruitment has a chance to succeed based on your
							stats. When a recruitment is successful, there's also a chance
							that new potential recruits will appear below the node you just
							recruited.
						</ListItem>
						<ListItem>
							<strong>Move Up:</strong> Move to a node above you (costs 3 Energy
							and recruits). Higher positions require more recruits. When you
							move up, new potential recruits will appear below your new
							position.
						</ListItem>
						<ListItem>
							<strong>Collect Money:</strong> Collect money from your network
							(costs 1 Energy). The amount collected depends on how many nodes
							you own and their position in the pyramid.
						</ListItem>
						<ListItem>
							<strong>Short Rest:</strong> Rest for 8 hours to recover energy.
							You cannot take actions while resting, and must wait for the time
							to pass.
						</ListItem>
						<ListItem>
							<strong>Long Rest:</strong> Rest for 16 hours to recover more
							energy. You cannot take actions while resting, and must wait for
							the time to pass.
						</ListItem>
						<ListItem>
							<strong>Upgrade Charisma:</strong> Increase your recruitment
							success chance (costs money). The cost increases with each
							upgrade.
						</ListItem>
						<ListItem>
							<strong>Upgrade Recruiting Power:</strong> Increase your
							recruitment success chance further (costs money). The cost
							increases with each upgrade.
						</ListItem>
						<ListItem>
							<strong>Buy Energy:</strong> Purchase 5 more energy points (costs
							$800). There is a maximum limit of 20 energy points.
						</ListItem>
					</List>
				</Section>

				<Section>
					<SectionTitle>Recruitment Strategy</SectionTitle>
					<Text>
						The key to success is strategic recruiting. Focus on recruiting
						nodes at higher levels first, as they provide more income. Upgrade
						your charisma and recruiting power to increase your success rate.
						Remember that recruitment results are only known at the end of the
						day, so plan accordingly.
					</Text>
				</Section>

				<Section>
					<SectionTitle>Time Management</SectionTitle>
					<Text>
						Managing your time effectively is crucial. Resting gives you energy
						but prevents you from taking actions while the rest period is
						ongoing. The only action that locks you out of doing other things is
						resting - all other actions can be performed without waiting.
					</Text>
					<Text>
						Plan your recruitment attempts strategically, as results are only
						processed at the end of each day.
					</Text>
				</Section>

				<Section>
					<SectionTitle>Winning the Game</SectionTitle>
					<Text>
						The game is won when you successfully reach the top position (Level
						1) of the pyramid. You lose if you run out of energy and don't have
						enough money to buy more, leaving you unable to progress.
					</Text>
					<Text>
						Remember: Unlike real pyramid schemes, this game is actually
						winnable! Good luck!
					</Text>
				</Section>

				<ButtonContainer>
					<CloseButton onClick={onClose}>Got It!</CloseButton>
				</ButtonContainer>
			</Modal>
		</Overlay>
	);
};

export default Tutorial;
