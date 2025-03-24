# Pyramid Scheme: The Game

A browser-based simulation game that lets you experience the mechanics of a pyramid scheme in a fun and educational way. Unlike real pyramid schemes, this game is actually winnable!

## Game Overview

In Pyramid Scheme: The Game, you start near the bottom of a pyramid structure and must recruit others below you to gain enough influence and resources to move up in the hierarchy. Your ultimate goal is to reach the top of the pyramid.

## Key Features

- Visual pyramid structure with interactive nodes
- Time-based game mechanics with day/night cycle
- Recruitment system with success chances based on your stats
- Energy management system
- Money collection and upgrade mechanics
- Resting periods to recover energy

## Game Mechanics

### Time System
- The game operates on a day/hour system (24-hour days)
- Each game hour advances automatically every second of real time
- A full game day passes in about 24 seconds
- Recruitment attempts are processed at the end of each day
- Resting is the only action that locks you out based on time passage

### Actions
- **Recruit**: Queue a recruitment attempt for someone below you (costs energy)
- **Move Up**: Climb to a higher position in the pyramid (costs energy and recruits)
- **Collect Money**: Collect money from your network (costs energy)
- **Rest**: Take a short (8 hour) or long (16 hour) rest to recover energy. You cannot take any actions until the rest period ends.
- **Upgrade Stats**: Improve your recruitment success chance (costs money)

## How to Play

1. **Clone the repository**
   ```
   git clone https://github.com/yourusername/pyramid-scheme.git
   cd pyramid-scheme
   ```

2. **Install dependencies**
   ```
   pnpm install
   ```

3. **Start the development server**
   ```
   pnpm dev
   ```

4. **Open your browser** and navigate to http://localhost:5173

## Building for Production

```
pnpm build
```

## Technologies Used

- React with TypeScript
- Vite
- D3.js for visualization
- Styled Components

## Development

- Node.js v18+
- pnpm
- Vite
- TypeScript

## License

MIT
