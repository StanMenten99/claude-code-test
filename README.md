# Instagram Battle Arena

A fun, interactive battle arena game where Instagram profiles fight each other in a square battlefield using powerups!

## Features

- **Square Battlefield**: Simple arena where players bounce around
- **Instagram Integration**: Enter Instagram usernames to fetch profile pictures
- **Physics-Based Combat**: Players bounce into each other dealing damage
- **Powerup System**: Collect powerups to gain advantages
- **Real-Time Battle**: Watch the battle unfold in real-time with health bars and timer

## How to Play

1. **Open the Game**: Open `index.html` in a web browser
2. **Enter Usernames**: Type in two Instagram usernames (one for each player)
3. **Preview**: Profile pictures will be loaded automatically (or placeholder avatars will be generated)
4. **Start Battle**: Click "Start Battle!" to begin
5. **Watch the Action**: Players will automatically bounce around and collide with each other
6. **Collect Powerups**: Players automatically collect powerups when they touch them

## Powerups

- **⚡ Speed Boost** (Blue): Increases movement speed
- **💪 Power Up** (Gold): Doubles damage dealt
- **🛡️ Shield** (Light Blue): Protects from damage
- **❤️ Health** (Red): Restores 30 health points

## Game Mechanics

- **Collision Damage**: When players bounce into each other, they both take damage
- **Health System**: Each player starts with 100 health
- **Time Limit**: 60 seconds per battle
- **Victory Conditions**:
  - Player with health remaining when opponent reaches 0 wins
  - If time runs out, player with higher health wins
  - Tie if both reach 0 health or have equal health at time limit

## Controls

- **Pause**: Pause/resume the game
- **Reset**: Return to the setup screen
- **Play Again**: Start a new battle after game over

## Technical Details

### Files

- `index.html`: Main HTML structure
- `style.css`: Styling and responsive design
- `instagram.js`: Instagram profile picture fetching logic
- `game.js`: Game engine, physics, and battle mechanics
- `server.js`: Node.js/Express proxy server for Instagram API requests
- `package.json`: Node.js dependencies and scripts

### Technologies Used

- HTML5 Canvas for rendering
- Vanilla JavaScript for game logic
- CSS3 for styling and animations
- Node.js/Express for proxy server
- Axios for HTTP requests
- Instagram public endpoints for profile pictures (with fallback to generated avatars)

## Instagram Profile Picture Fetching

The game attempts to fetch real Instagram profile pictures through a proxy server to avoid CORS issues:

- **Proxy Server**: Node.js server acts as a middleware to fetch Instagram data
- **Multiple Methods**: Tries various Instagram endpoints to maximize success rate
- **Fallback System**: Automatically generates colorful placeholder avatars with initials when Instagram blocks requests
- **Cache**: Caches fetched images for 5 minutes to reduce API calls and improve performance
- **CORS Solution**: Proxy server eliminates browser CORS restrictions

**Note**: Instagram has strict anti-scraping measures and may block requests. The fallback placeholder system ensures the game always works.

## Browser Compatibility

Works best in modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Running Locally

**IMPORTANT**: Due to CORS restrictions, you need to run the Node.js proxy server to fetch Instagram profile pictures.

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Setup and Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```

3. **Open the Game**:
   - The server will start on `http://localhost:3000`
   - Open your browser and visit: `http://localhost:3000`
   - The game will automatically load

### Development Mode

For development with auto-restart on file changes:

```bash
npm run dev
```

### How It Works

The application uses a Node.js/Express proxy server to:
- Serve the static HTML, CSS, and JavaScript files
- Act as a proxy to fetch Instagram profile pictures (avoiding CORS issues)
- Provide fallback placeholder avatars when Instagram blocks requests

**Note**: Instagram has strict anti-scraping measures. If profile pictures fail to load, the game will automatically use colorful placeholder avatars with user initials.

## Customization

You can customize the game by modifying:

- **Canvas Size**: Change width/height in `index.html` (line with `<canvas>`)
- **Game Duration**: Modify `this.gameTime = 60` in `game.js`
- **Player Speed**: Adjust velocity values in `Player` constructor
- **Damage Amount**: Change `damage` value in `checkPlayerCollision()`
- **Powerup Spawn Rate**: Modify `powerupSpawnInterval` in `BattleArena` constructor
- **Player Size**: Change `radius` in `Player` constructor

## Future Enhancements

Potential features to add:
- Multiple game modes (timed, elimination, best of 3)
- More powerup types (freeze, teleport, size change)
- Sound effects and background music
- Leaderboard system
- Multiplayer with keyboard controls
- Special abilities for each player
- Different arena shapes and obstacles

## License

Free to use and modify for personal and educational purposes.

## Credits

Created with Claude Code - An AI-powered coding assistant.
