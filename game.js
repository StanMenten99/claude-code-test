// Battle Arena Game Engine

// Player Class
class Player {
    constructor(username, image, x, y, playerNumber) {
        this.username = username;
        this.image = image;
        this.x = x;
        this.y = y;
        this.radius = 40;
        this.baseRadius = 40;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.health = 100;
        this.maxHealth = 100;
        this.playerNumber = playerNumber;
        this.power = 1;
        this.speed = 1;
        this.shield = false;
        this.invisible = false;
        this.vampire = false;
        this.ghost = false;
        this.powerupTimer = 0;
        this.powerupType = null;
    }

    update(canvasWidth, canvasHeight) {
        // Update position
        this.x += this.vx * this.speed;
        this.y += this.vy * this.speed;

        // Bounce off walls (unless ghost mode)
        if (!this.ghost) {
            if (this.x - this.radius <= 0 || this.x + this.radius >= canvasWidth) {
                this.vx *= -1;
                this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
            }

            if (this.y - this.radius <= 0 || this.y + this.radius >= canvasHeight) {
                this.vy *= -1;
                this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));
            }
        } else {
            // Ghost mode - wrap around edges
            if (this.x - this.radius > canvasWidth) this.x = -this.radius;
            if (this.x + this.radius < 0) this.x = canvasWidth + this.radius;
            if (this.y - this.radius > canvasHeight) this.y = -this.radius;
            if (this.y + this.radius < 0) this.y = canvasHeight + this.radius;
        }

        // Update powerup timer
        if (this.powerupTimer > 0) {
            this.powerupTimer--;
            if (this.powerupTimer === 0) {
                this.resetPowerup();
            }
        }
    }

    draw(ctx) {
        // Apply invisibility effect
        if (this.invisible) {
            ctx.globalAlpha = 0.3;
        }

        // Draw shield if active
        if (this.shield) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.7)';
            ctx.lineWidth = 5;
            ctx.stroke();
        }

        // Draw ghost aura if active
        if (this.ghost) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(200, 100, 255, 0.5)';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Draw player image in circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
            this.image,
            this.x - this.radius,
            this.y - this.radius,
            this.radius * 2,
            this.radius * 2
        );

        ctx.restore();

        // Draw border
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.color || '#ff6b6b';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Reset alpha
        ctx.globalAlpha = 1;

        // Draw powerup indicators
        if (this.power > 1 || this.vampire) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.vampire ? '🧛' : '⚡', this.x, this.y - this.radius - 10);
        }
    }

    takeDamage(amount, attacker = null) {
        if (!this.shield && !this.invisible) {
            this.health = Math.max(0, this.health - amount);

            // If attacker has vampire, heal them
            if (attacker && attacker.vampire) {
                attacker.health = Math.min(attacker.maxHealth, attacker.health + amount * 0.5);
            }
        }
    }

    applyPowerup(powerup) {
        // Reset previous powerup
        this.resetPowerup();

        this.powerupTimer = 300; // 5 seconds at 60fps
        this.powerupType = powerup.type;

        switch (powerup.type) {
            case 'speed':
                this.speed = 2;
                break;
            case 'power':
                this.power = 2;
                break;
            case 'shield':
                this.shield = true;
                break;
            case 'health':
                this.health = Math.min(this.maxHealth, this.health + 30);
                this.powerupTimer = 0; // Instant effect
                break;
            case 'freeze':
                // This affects other players, handled in game logic
                break;
            case 'invisible':
                this.invisible = true;
                break;
            case 'size':
                this.radius = this.baseRadius * 1.5;
                this.power = 1.5;
                break;
            case 'shrink':
                this.radius = this.baseRadius * 0.6;
                this.speed = 1.5;
                break;
            case 'teleport':
                // Handled in game logic
                this.powerupTimer = 0; // Instant effect
                break;
            case 'rage':
                this.power = 2.5;
                break;
            case 'vampire':
                this.vampire = true;
                this.power = 1.3;
                break;
            case 'ghost':
                this.ghost = true;
                break;
        }
    }

    resetPowerup() {
        this.power = 1;
        this.speed = 1;
        this.shield = false;
        this.invisible = false;
        this.vampire = false;
        this.ghost = false;
        this.radius = this.baseRadius;
        this.powerupType = null;
    }
}

// Powerup Class
class Powerup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.type = type;
        this.lifetime = 600; // 10 seconds at 60fps
        this.active = true;

        // Define powerup properties
        this.types = {
            speed: { color: '#00d2ff', emoji: '⚡', name: 'Speed Boost' },
            power: { color: '#ffd700', emoji: '💪', name: 'Power Up' },
            shield: { color: '#64c8ff', emoji: '🛡️', name: 'Shield' },
            health: { color: '#ff6b6b', emoji: '❤️', name: 'Health' },
            freeze: { color: '#88e0ff', emoji: '❄️', name: 'Freeze Others' },
            invisible: { color: '#c8a2ff', emoji: '👻', name: 'Invisibility' },
            size: { color: '#ff8c42', emoji: '🔺', name: 'Size Up' },
            shrink: { color: '#a29bfe', emoji: '🔻', name: 'Shrink' },
            teleport: { color: '#fd79a8', emoji: '✨', name: 'Teleport' },
            rage: { color: '#ff3838', emoji: '😡', name: 'Rage Mode' },
            vampire: { color: '#8b0000', emoji: '🧛', name: 'Vampire' },
            ghost: { color: '#9b59b6', emoji: '👁️', name: 'Ghost' }
        };
    }

    update() {
        this.lifetime--;
        if (this.lifetime <= 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const props = this.types[this.type];

        // Draw powerup circle with pulsing effect
        const pulse = Math.sin(this.lifetime * 0.1) * 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = props.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw emoji
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(props.emoji, this.x, this.y);
    }

    checkCollision(player) {
        if (!this.active) return false;

        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < this.radius + player.radius;
    }
}

// Main Game Class
class BattleArena {
    constructor() {
        this.canvas = document.getElementById('battleArena');
        this.ctx = this.canvas.getContext('2d');
        this.players = [];
        this.powerups = [];
        this.gameLoop = null;
        this.gameTime = 60;
        this.gameActive = false;
        this.paused = false;
        this.playerCount = 2;
        this.maxPlayers = 8;
        this.playerColors = ['#ff6b6b', '#4ecdc4', '#45b7af', '#ffd93d', '#6bcf7f', '#a29bfe', '#fd79a8', '#fab1a0'];

        this.powerupSpawnTimer = 0;
        this.powerupSpawnInterval = 180; // Spawn every 3 seconds

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Setup player input listeners
        this.setupPlayerInputListeners();

        // Add player button
        document.getElementById('addPlayerBtn').addEventListener('click', () => this.addPlayer());

        // Game control handlers
        document.getElementById('startBattle').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.playAgain());
    }

    setupPlayerInputListeners() {
        const playerInputs = document.querySelectorAll('.player-username');
        playerInputs.forEach(input => {
            input.addEventListener('input', async (e) => {
                const playerNum = e.target.getAttribute('data-player');
                await this.previewPlayer(e.target.value, playerNum);
            });
        });
    }

    addPlayer() {
        if (this.playerCount >= this.maxPlayers) {
            alert(`Maximum ${this.maxPlayers} players allowed!`);
            return;
        }

        this.playerCount++;
        const playersContainer = document.getElementById('playersContainer');

        const playerSetup = document.createElement('div');
        playerSetup.className = 'player-setup';
        playerSetup.setAttribute('data-player', this.playerCount);

        playerSetup.innerHTML = `
            <div class="player-header">
                <h2>Player ${this.playerCount}</h2>
                <button class="remove-player-btn" onclick="battleArena.removePlayer(${this.playerCount})">Remove</button>
            </div>
            <input type="text" class="player-username" data-player="${this.playerCount}" placeholder="Instagram Username">
            <div class="player-preview" data-player="${this.playerCount}">Enter username</div>
        `;

        playersContainer.appendChild(playerSetup);

        // Re-setup listeners for new input
        this.setupPlayerInputListeners();
    }

    removePlayer(playerNum) {
        if (this.playerCount <= 2) {
            alert('Minimum 2 players required!');
            return;
        }

        const playerSetup = document.querySelector(`.player-setup[data-player="${playerNum}"]`);
        if (playerSetup) {
            playerSetup.remove();
            this.playerCount--;
        }
    }

    async previewPlayer(username, playerNum) {
        const preview = document.querySelector(`.player-preview[data-player="${playerNum}"]`);

        if (!preview) return;

        if (!username || username.trim() === '') {
            preview.innerHTML = 'Enter username';
            return;
        }

        try {
            preview.innerHTML = 'Loading...';
            const imageUrl = await instagramFetcher.fetchProfilePicture(username);
            preview.innerHTML = `<img src="${imageUrl}" alt="${username}">`;
        } catch (error) {
            preview.innerHTML = 'Failed to load';
            console.error('Error loading preview:', error);
        }
    }

    async startGame() {
        // Get all player inputs
        const playerInputs = document.querySelectorAll('.player-username');
        const usernames = [];

        // Collect all usernames
        playerInputs.forEach(input => {
            const username = input.value.trim();
            if (username) {
                usernames.push(username);
            }
        });

        if (usernames.length < 2) {
            alert('Please enter at least 2 usernames!');
            return;
        }

        try {
            // Fetch and preload all profile pictures
            this.players = [];
            const positions = this.calculatePlayerPositions(usernames.length);

            for (let i = 0; i < usernames.length; i++) {
                const username = usernames[i];
                const imageUrl = await instagramFetcher.fetchProfilePicture(username, true);
                const image = await instagramFetcher.preloadImage(imageUrl);

                const player = new Player(
                    username,
                    image,
                    positions[i].x,
                    positions[i].y,
                    i + 1
                );

                // Assign unique color to each player
                player.color = this.playerColors[i % this.playerColors.length];

                this.players.push(player);
            }

            // Update UI with player health bars
            this.createHealthBars();

            // Show game container
            document.getElementById('setupPanel').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';

            // Start game loop
            this.gameActive = true;
            this.gameTime = 60;
            this.powerups = [];
            this.startGameLoop();

        } catch (error) {
            alert('Error starting game: ' + error.message);
            console.error(error);
        }
    }

    calculatePlayerPositions(numPlayers) {
        const positions = [];
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const padding = 100;

        if (numPlayers === 2) {
            positions.push({ x: padding + 100, y: canvasHeight / 2 });
            positions.push({ x: canvasWidth - padding - 100, y: canvasHeight / 2 });
        } else {
            // Arrange players in a circle
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const radius = Math.min(canvasWidth, canvasHeight) / 2 - padding;

            for (let i = 0; i < numPlayers; i++) {
                const angle = (i / numPlayers) * Math.PI * 2 - Math.PI / 2;
                positions.push({
                    x: centerX + Math.cos(angle) * radius,
                    y: centerY + Math.sin(angle) * radius
                });
            }
        }

        return positions;
    }

    createHealthBars() {
        const healthContainer = document.getElementById('playersHealthContainer');
        healthContainer.innerHTML = '';

        this.players.forEach(player => {
            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';
            playerInfo.innerHTML = `
                <div class="player-name" style="color: ${player.color}">${player.username}</div>
                <div class="health-bar">
                    <div class="health-fill" id="p${player.playerNumber}Health" style="background: ${player.color}"></div>
                </div>
            `;
            healthContainer.appendChild(playerInfo);
        });
    }

    startGameLoop() {
        let lastTime = Date.now();
        let frameCount = 0;

        const loop = () => {
            if (!this.gameActive) return;

            const now = Date.now();
            const delta = now - lastTime;

            if (delta >= 1000) {
                // Update timer every second
                this.gameTime--;
                lastTime = now;
                document.getElementById('timer').textContent = this.gameTime;

                if (this.gameTime <= 0) {
                    this.endGame();
                    return;
                }
            }

            if (!this.paused) {
                this.update();
                this.render();
                frameCount++;
            }

            this.gameLoop = requestAnimationFrame(loop);
        };

        loop();
    }

    update() {
        // Update players
        this.players.forEach(player => {
            player.update(this.canvas.width, this.canvas.height);
        });

        // Check player collision
        this.checkPlayerCollision();

        // Spawn powerups
        this.powerupSpawnTimer++;
        if (this.powerupSpawnTimer >= this.powerupSpawnInterval) {
            this.spawnPowerup();
            this.powerupSpawnTimer = 0;
        }

        // Update powerups
        this.powerups = this.powerups.filter(powerup => powerup.active);
        this.powerups.forEach(powerup => {
            powerup.update();

            // Check powerup collision with players
            this.players.forEach(player => {
                if (powerup.checkCollision(player)) {
                    player.applyPowerup(powerup);

                    // Handle special powerups
                    if (powerup.type === 'freeze') {
                        // Freeze all other players
                        this.players.forEach(otherPlayer => {
                            if (otherPlayer !== player && otherPlayer.health > 0) {
                                otherPlayer.speed = 0.3;
                                otherPlayer.powerupTimer = 180; // 3 seconds
                            }
                        });
                    } else if (powerup.type === 'teleport') {
                        // Teleport player to random position
                        player.x = 100 + Math.random() * (this.canvas.width - 200);
                        player.y = 100 + Math.random() * (this.canvas.height - 200);
                    }

                    powerup.active = false;
                }
            });
        });

        // Update health bars
        this.updateHealthBars();

        // Check for game over - count alive players
        const alivePlayers = this.players.filter(p => p.health > 0);
        if (alivePlayers.length <= 1) {
            this.endGame();
        }
    }

    checkPlayerCollision() {
        // Check collision between all pairs of players
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const p1 = this.players[i];
                const p2 = this.players[j];

                // Skip collision if either player is a ghost
                if (p1.ghost || p2.ghost) continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < p1.radius + p2.radius) {
                    // Collision detected - apply damage and bounce
                    const damage = 2;
                    p1.takeDamage(damage * p2.power, p2);
                    p2.takeDamage(damage * p1.power, p1);

                    // Bounce players apart
                    const angle = Math.atan2(dy, dx);
                    const targetX = p1.x + Math.cos(angle) * (p1.radius + p2.radius);
                    const targetY = p1.y + Math.sin(angle) * (p1.radius + p2.radius);

                    const ax = (targetX - p2.x) * 0.05;
                    const ay = (targetY - p2.y) * 0.05;

                    p1.vx -= ax;
                    p1.vy -= ay;
                    p2.vx += ax;
                    p2.vy += ay;

                    // Add some randomness to prevent getting stuck
                    p1.vx += (Math.random() - 0.5) * 0.5;
                    p1.vy += (Math.random() - 0.5) * 0.5;
                    p2.vx += (Math.random() - 0.5) * 0.5;
                    p2.vy += (Math.random() - 0.5) * 0.5;
                }
            }
        }
    }

    spawnPowerup() {
        const types = [
            'speed', 'power', 'shield', 'health',
            'freeze', 'invisible', 'size', 'shrink',
            'teleport', 'rage', 'vampire', 'ghost'
        ];
        const type = types[Math.floor(Math.random() * types.length)];

        const x = 100 + Math.random() * (this.canvas.width - 200);
        const y = 100 + Math.random() * (this.canvas.height - 200);

        this.powerups.push(new Powerup(x, y, type));
    }

    updateHealthBars() {
        this.players.forEach(player => {
            const healthPercent = (player.health / player.maxHealth) * 100;
            const healthBar = document.getElementById(`p${player.playerNumber}Health`);
            if (healthBar) {
                healthBar.style.width = healthPercent + '%';
            }
        });
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw powerups
        this.powerups.forEach(powerup => powerup.draw(this.ctx));

        // Draw players
        this.players.forEach(player => player.draw(this.ctx));

        // Draw pause overlay
        if (this.paused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;

        const gridSize = 50;

        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    togglePause() {
        this.paused = !this.paused;
        document.getElementById('pauseBtn').textContent = this.paused ? 'Resume' : 'Pause';
    }

    resetGame() {
        this.gameActive = false;
        if (this.gameLoop) {
            cancelAnimationFrame(this.gameLoop);
        }

        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('setupPanel').style.display = 'flex';
        document.getElementById('gameOver').style.display = 'none';
    }

    endGame() {
        this.gameActive = false;
        if (this.gameLoop) {
            cancelAnimationFrame(this.gameLoop);
        }

        // Determine winner(s)
        const alivePlayers = this.players.filter(p => p.health > 0);
        let winnerText = '';

        if (alivePlayers.length === 0) {
            winnerText = "Everyone was eliminated - It's a tie!";
        } else if (alivePlayers.length === 1) {
            winnerText = `${alivePlayers[0].username} wins!`;
        } else {
            // Multiple players alive - find highest health
            const sortedPlayers = [...alivePlayers].sort((a, b) => b.health - a.health);
            const maxHealth = sortedPlayers[0].health;
            const winners = sortedPlayers.filter(p => p.health === maxHealth);

            if (winners.length === 1) {
                winnerText = `${winners[0].username} wins with ${Math.round(maxHealth)} HP!`;
            } else {
                const winnerNames = winners.map(p => p.username).join(', ');
                winnerText = `Tie between: ${winnerNames}!`;
            }
        }

        document.getElementById('winnerText').textContent = winnerText;
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('gameOver').style.display = 'block';
    }

    playAgain() {
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('setupPanel').style.display = 'flex';
    }
}

// Initialize game when page loads
let battleArena;
window.addEventListener('load', () => {
    battleArena = new BattleArena();
});
