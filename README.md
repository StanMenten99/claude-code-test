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

### Technologies Used

- HTML5 Canvas for rendering
- Vanilla JavaScript for game logic
- CSS3 for styling and animations
- Instagram public endpoints for profile pictures (with fallback to generated avatars)

## Instagram Profile Picture Fetching

The game attempts to fetch real Instagram profile pictures. Due to Instagram's API restrictions:

- **Primary Method**: Tries to fetch from Instagram's public endpoints
- **Fallback**: Generates colorful placeholder avatars with initials if fetching fails
- **Cache**: Caches fetched images to reduce API calls

## Browser Compatibility

Works best in modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Running Locally

Simply open `index.html` in your web browser. No server or build process required!

```bash
# Option 1: Direct file open
open index.html

# Option 2: Using a local server (optional)
python -m http.server 8000
# Then visit http://localhost:8000
```

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
