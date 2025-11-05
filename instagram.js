// Instagram Profile Picture Fetcher
class InstagramFetcher {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = new Map(); // Track cache expiration
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
        this.pendingRequests = new Map(); // Track pending requests to avoid duplicates
        this.debounceTimers = new Map(); // Debounce timers per username
        this.retryAttempts = new Map(); // Track retry attempts for exponential backoff
    }

    /**
     * Debounced version of fetchProfilePicture to prevent rapid-fire requests
     * @param {string} username - Instagram username
     * @param {boolean} forceRefresh - Force refresh from server
     * @param {number} debounceDelay - Debounce delay in milliseconds (default: 500ms)
     * @returns {Promise<string>} - URL of the profile picture
     */
    async fetchProfilePictureDebounced(username, forceRefresh = false, debounceDelay = 500) {
        if (!username || username.trim() === '') {
            throw new Error('Username is required');
        }

        const cacheKey = username.toLowerCase();

        // Clear existing debounce timer for this username
        if (this.debounceTimers.has(cacheKey)) {
            clearTimeout(this.debounceTimers.get(cacheKey));
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(async () => {
                this.debounceTimers.delete(cacheKey);
                try {
                    const result = await this.fetchProfilePicture(username, forceRefresh);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, debounceDelay);

            this.debounceTimers.set(cacheKey, timer);
        });
    }

    /**
     * Fetches Instagram profile picture for a given username (real-time)
     * @param {string} username - Instagram username
     * @param {boolean} forceRefresh - Force refresh from server
     * @returns {Promise<string>} - URL of the profile picture
     */
    async fetchProfilePicture(username, forceRefresh = false) {
        if (!username || username.trim() === '') {
            throw new Error('Username is required');
        }

        const cacheKey = username.toLowerCase();

        // If there's already a pending request for this username, return that promise
        if (this.pendingRequests.has(cacheKey)) {
            console.log(`Reusing pending request for: ${username}`);
            return this.pendingRequests.get(cacheKey);
        }

        // Check cache validity
        const now = Date.now();
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const expiry = this.cacheExpiry.get(cacheKey);
            if (expiry && expiry > now) {
                console.log(`Cache hit for: ${username}`);
                return this.cache.get(cacheKey);
            }
        }

        // Create the request promise
        const requestPromise = (async () => {
            try {
                // Method 1: Try multiple Instagram endpoints
                let url = await this.tryMultipleEndpoints(username);
                if (url) {
                    this.cache.set(cacheKey, url);
                    this.cacheExpiry.set(cacheKey, now + this.cacheTimeout);
                    this.retryAttempts.delete(cacheKey); // Reset retry attempts on success
                    return url;
                }
            } catch (error) {
                console.warn('All endpoints failed:', error);

                // Check if it's a rate limit error
                if (error.retryAfter) {
                    const attempts = (this.retryAttempts.get(cacheKey) || 0) + 1;
                    this.retryAttempts.set(cacheKey, attempts);

                    if (attempts < 3) {
                        console.log(`Rate limited. Retry attempt ${attempts}/3 after ${error.retryAfter} seconds`);
                        // Wait and retry
                        await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
                        this.pendingRequests.delete(cacheKey);
                        return this.fetchProfilePicture(username, forceRefresh);
                    }
                }
            } finally {
                this.pendingRequests.delete(cacheKey);
            }

            // Fallback: Generate a placeholder avatar
            const placeholder = this.generatePlaceholder(username);
            this.cache.set(cacheKey, placeholder);
            this.cacheExpiry.set(cacheKey, now + this.cacheTimeout);
            return placeholder;
        })();

        this.pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    /**
     * Try multiple methods to fetch Instagram profile picture
     * @param {string} username - Instagram username
     * @returns {Promise<string|null>} - Profile picture URL or null
     */
    async tryMultipleEndpoints(username) {
        // Use local proxy server to avoid CORS issues
        let url = await this.tryProxyServer(username);
        if (url) return url;

        return null;
    }

    /**
     * Fetch Instagram profile through local proxy server
     * @param {string} username - Instagram username
     * @returns {Promise<string|null>} - Profile picture URL or null
     */
    async tryProxyServer(username) {
        try {
            // Determine the API endpoint based on the current location
            const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? `http://localhost:3000/api/instagram/${username}`
                : `/api/instagram/${username}`;

            const response = await fetch(apiUrl);

            // Check if the response is JSON before trying to parse
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.log('Proxy server not available (non-JSON response), using fallback');
                return null;
            }

            if (!response.ok) {
                // If the server responds with 404 or 500, check if fallback is needed
                try {
                    const errorData = await response.json();

                    // Handle rate limiting
                    if (response.status === 429 && errorData.retryAfter) {
                        console.log(`Rate limited by server. Retry after ${errorData.retryAfter} seconds`);
                        const error = new Error('Rate limit exceeded');
                        error.retryAfter = errorData.retryAfter;
                        throw error;
                    }

                    if (errorData.fallback) {
                        console.log('Profile not found, using fallback placeholder');
                        return null;
                    }
                } catch (jsonError) {
                    if (jsonError.retryAfter) {
                        throw jsonError; // Re-throw rate limit error
                    }
                    console.log('Could not parse error response, using fallback');
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.profilePicUrl) {
                // Proxy the image through our server to avoid CORS issues
                const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? 'http://localhost:3000'
                    : '';
                return `${baseUrl}/api/instagram-image?url=${encodeURIComponent(data.profilePicUrl)}`;
            }

            return null;
        } catch (error) {
            if (error.retryAfter) {
                throw error; // Re-throw rate limit errors
            }
            console.log('Proxy server not available, using fallback:', error.message);
            return null;
        }
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
     * Alternative endpoint method
     * @param {string} username - Instagram username
     * @returns {Promise<string|null>} - Profile picture URL or null
     */
    async tryAlternativeEndpoint(username) {
        try {
            const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'X-Ig-App-Id': '936619743392459'
                }
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const user = data?.data?.user;

            if (user && user.profile_pic_url_hd) {
                return user.profile_pic_url_hd;
            } else if (user && user.profile_pic_url) {
                return user.profile_pic_url;
            }

            return null;
        } catch (error) {
            console.error('Alternative endpoint failed:', error);
            return null;
        }
    }

    /**
     * Proxy endpoint method using third-party service
     * @param {string} username - Instagram username
     * @returns {Promise<string|null>} - Profile picture URL or null
     */
    async tryProxyEndpoint(username) {
        try {
            // Using imgInn or similar proxy service
            const response = await fetch(`https://imginn.com/${username}/`);

            if (!response.ok) {
                return null;
            }

            const html = await response.text();

            // Extract profile picture URL from HTML
            const match = html.match(/property="og:image"\s+content="([^"]+)"/);
            if (match && match[1]) {
                return match[1];
            }

            return null;
        } catch (error) {
            console.error('Proxy endpoint failed:', error);
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
