// Battle Arena Game Engine

// Player Class
class Player {
    constructor(username, image, x, y, playerNumber) {
        this.username = username;
        this.image = image;
        this.x = x;
        this.y = y;
        this.radius = 40;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.health = 100;
        this.maxHealth = 100;
        this.playerNumber = playerNumber;
        this.power = 1;
        this.speed = 1;
        this.shield = false;
        this.powerupTimer = 0;
    }

    update(canvasWidth, canvasHeight) {
        // Update position
        this.x += this.vx * this.speed;
        this.y += this.vy * this.speed;

        // Bounce off walls
        if (this.x - this.radius <= 0 || this.x + this.radius >= canvasWidth) {
            this.vx *= -1;
            this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
        }

        if (this.y - this.radius <= 0 || this.y + this.radius >= canvasHeight) {
            this.vy *= -1;
            this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));
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
        // Draw shield if active
        if (this.shield) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.7)';
            ctx.lineWidth = 5;
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
        ctx.strokeStyle = this.playerNumber === 1 ? '#ff6b6b' : '#4ecdc4';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw power indicator
        if (this.power > 1) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚡', this.x, this.y - this.radius - 10);
        }
    }

    takeDamage(amount) {
        if (!this.shield) {
            this.health = Math.max(0, this.health - amount);
        }
    }

    applyPowerup(powerup) {
        this.powerupTimer = 300; // 5 seconds at 60fps

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
                break;
        }
    }

    resetPowerup() {
        this.power = 1;
        this.speed = 1;
        this.shield = false;
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
            health: { color: '#ff6b6b', emoji: '❤️', name: 'Health' }
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

        this.powerupSpawnTimer = 0;
        this.powerupSpawnInterval = 180; // Spawn every 3 seconds

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Player input handlers
        const player1Input = document.getElementById('player1Username');
        const player2Input = document.getElementById('player2Username');

        player1Input.addEventListener('input', async (e) => {
            await this.previewPlayer(e.target.value, 'player1Preview');
        });

        player2Input.addEventListener('input', async (e) => {
            await this.previewPlayer(e.target.value, 'player2Preview');
        });

        // Game control handlers
        document.getElementById('startBattle').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.playAgain());
    }

    async previewPlayer(username, previewId) {
        const preview = document.getElementById(previewId);

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
        const username1 = document.getElementById('player1Username').value.trim();
        const username2 = document.getElementById('player2Username').value.trim();

        if (!username1 || !username2) {
            alert('Please enter both usernames!');
            return;
        }

        try {
            // Fetch profile pictures
            const image1Url = await instagramFetcher.fetchProfilePicture(username1);
            const image2Url = await instagramFetcher.fetchProfilePicture(username2);

            // Preload images
            const image1 = await instagramFetcher.preloadImage(image1Url);
            const image2 = await instagramFetcher.preloadImage(image2Url);

            // Initialize players
            this.players = [
                new Player(username1, image1, 200, 400, 1),
                new Player(username2, image2, 600, 400, 2)
            ];

            // Update UI
            document.getElementById('p1Name').textContent = username1;
            document.getElementById('p2Name').textContent = username2;

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
                    powerup.active = false;
                }
            });
        });

        // Update health bars
        this.updateHealthBars();

        // Check for game over
        if (this.players[0].health <= 0 || this.players[1].health <= 0) {
            this.endGame();
        }
    }

    checkPlayerCollision() {
        const [p1, p2] = this.players;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < p1.radius + p2.radius) {
            // Collision detected - apply damage and bounce
            const damage = 2;
            p1.takeDamage(damage * p2.power);
            p2.takeDamage(damage * p1.power);

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

    spawnPowerup() {
        const types = ['speed', 'power', 'shield', 'health'];
        const type = types[Math.floor(Math.random() * types.length)];

        const x = 100 + Math.random() * (this.canvas.width - 200);
        const y = 100 + Math.random() * (this.canvas.height - 200);

        this.powerups.push(new Powerup(x, y, type));
    }

    updateHealthBars() {
        const p1HealthPercent = (this.players[0].health / this.players[0].maxHealth) * 100;
        const p2HealthPercent = (this.players[1].health / this.players[1].maxHealth) * 100;

        document.getElementById('p1Health').style.width = p1HealthPercent + '%';
        document.getElementById('p2Health').style.width = p2HealthPercent + '%';
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

        // Determine winner
        let winnerText = '';
        if (this.players[0].health <= 0 && this.players[1].health <= 0) {
            winnerText = "It's a tie!";
        } else if (this.players[0].health <= 0) {
            winnerText = `${this.players[1].username} wins!`;
        } else if (this.players[1].health <= 0) {
            winnerText = `${this.players[0].username} wins!`;
        } else {
            // Time ran out - higher health wins
            if (this.players[0].health > this.players[1].health) {
                winnerText = `${this.players[0].username} wins!`;
            } else if (this.players[1].health > this.players[0].health) {
                winnerText = `${this.players[1].username} wins!`;
            } else {
                winnerText = "It's a tie!";
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
window.addEventListener('load', () => {
    new BattleArena();
});
