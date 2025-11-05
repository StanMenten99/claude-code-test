// Instagram Profile Picture Fetcher
class InstagramFetcher {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Fetches Instagram profile picture for a given username
     * @param {string} username - Instagram username
     * @returns {Promise<string>} - URL of the profile picture
     */
    async fetchProfilePicture(username) {
        if (!username || username.trim() === '') {
            throw new Error('Username is required');
        }

        // Check cache first
        if (this.cache.has(username)) {
            return this.cache.get(username);
        }

        try {
            // Method 1: Try using Instagram's public endpoint
            const url = await this.tryPublicEndpoint(username);
            if (url) {
                this.cache.set(username, url);
                return url;
            }
        } catch (error) {
            console.warn('Public endpoint failed:', error);
        }

        // Fallback: Generate a placeholder avatar
        return this.generatePlaceholder(username);
    }

    /**
     * Attempts to fetch from Instagram's public endpoint
     * @param {string} username - Instagram username
     * @returns {Promise<string|null>} - Profile picture URL or null
     */
    async tryPublicEndpoint(username) {
        try {
            // Using Instagram's public profile endpoint (may be rate-limited)
            const response = await fetch(`https://www.instagram.com/${username}/?__a=1&__d=dis`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Navigate through the JSON structure to find profile pic
            const user = data?.graphql?.user || data?.user;
            if (user && user.profile_pic_url_hd) {
                return user.profile_pic_url_hd;
            } else if (user && user.profile_pic_url) {
                return user.profile_pic_url;
            }

            return null;
        } catch (error) {
            console.error('Failed to fetch from Instagram:', error);
            return null;
        }
    }

    /**
     * Generates a colorful placeholder avatar with initials
     * @param {string} username - Username for generating the avatar
     * @returns {string} - Data URL of the generated image
     */
    generatePlaceholder(username) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // Generate a consistent color based on username
        const color = this.stringToColor(username);

        // Draw background
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 200, 200);

        // Draw initials
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const initial = username.charAt(0).toUpperCase();
        ctx.fillText(initial, 100, 100);

        // Add username text at bottom
        ctx.font = 'bold 20px Arial';
        ctx.fillText(username, 100, 170);

        return canvas.toDataURL();
    }

    /**
     * Converts a string to a consistent color
     * @param {string} str - Input string
     * @returns {string} - Hex color code
     */
    stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 50%)`;
    }

    /**
     * Validates if a username is valid
     * @param {string} username - Username to validate
     * @returns {boolean} - True if valid
     */
    isValidUsername(username) {
        // Instagram usernames: 1-30 characters, letters, numbers, periods, underscores
        const regex = /^[a-zA-Z0-9._]{1,30}$/;
        return regex.test(username);
    }

    /**
     * Preloads an image
     * @param {string} url - Image URL
     * @returns {Promise<HTMLImageElement>} - Loaded image element
     */
    async preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = url;
        });
    }
}

// Export for use in game.js
const instagramFetcher = new InstagramFetcher();
