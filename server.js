// Instagram Proxy Server
// This server acts as a proxy to fetch Instagram profile data and avoid CORS issues

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Rate limiting and caching
const requestCache = new Map(); // Cache for profile data
const requestTimestamps = new Map(); // Track request timing per IP
const blockList = new Map(); // Track blocked IPs with backoff
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP
const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between Instagram API calls
let lastInstagramRequest = 0;

// User agent rotation
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Rate limiting middleware
function rateLimitMiddleware(req, res, next) {
    const clientIp = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Check if IP is currently blocked
    if (blockList.has(clientIp)) {
        const blockInfo = blockList.get(clientIp);
        if (now < blockInfo.until) {
            const waitTime = Math.ceil((blockInfo.until - now) / 1000);
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: `Please wait ${waitTime} seconds before making more requests`,
                retryAfter: waitTime,
                fallback: true
            });
        } else {
            blockList.delete(clientIp);
        }
    }

    // Initialize or clean up old timestamps
    if (!requestTimestamps.has(clientIp)) {
        requestTimestamps.set(clientIp, []);
    }

    const timestamps = requestTimestamps.get(clientIp);
    const recentRequests = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);

    // Check if rate limit exceeded
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        const blockDuration = 60 * 1000; // Block for 1 minute
        blockList.set(clientIp, {
            until: now + blockDuration,
            attempts: (blockList.get(clientIp)?.attempts || 0) + 1
        });

        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please slow down.',
            retryAfter: 60,
            fallback: true
        });
    }

    // Add current request timestamp
    recentRequests.push(now);
    requestTimestamps.set(clientIp, recentRequests);

    next();
}

// Global rate limiting for Instagram API
async function waitForInstagramRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastInstagramRequest;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastInstagramRequest = Date.now();
}

// Proxy endpoint for Instagram profile pictures (with rate limiting)
app.get('/api/instagram/:username', rateLimitMiddleware, async (req, res) => {
    const { username } = req.params;

    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Check cache first
    const cacheKey = username.toLowerCase();
    if (requestCache.has(cacheKey)) {
        const cached = requestCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`Cache hit for username: ${username}`);
            return res.json(cached.data);
        } else {
            requestCache.delete(cacheKey);
        }
    }

    try {
        // Wait for rate limit before making Instagram request
        await waitForInstagramRateLimit();

        // Try multiple methods to fetch Instagram profile data
        let profileData = null;
        const userAgent = getRandomUserAgent();

        // Method 1: Try Instagram's public profile endpoint
        try {
            const response = await axios.get(`https://www.instagram.com/${username}/?__a=1&__d=dis`, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.instagram.com/',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin'
                },
                timeout: 8000
            });

            const user = response.data?.graphql?.user || response.data?.user;
            if (user && (user.profile_pic_url_hd || user.profile_pic_url)) {
                profileData = {
                    username: user.username,
                    fullName: user.full_name,
                    profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url,
                    isPrivate: user.is_private,
                    followers: user.edge_followed_by?.count || 0
                };
            }
        } catch (error) {
            console.log('Method 1 failed:', error.message);
        }

        // Method 2: Try alternative Instagram API endpoint
        if (!profileData) {
            await waitForInstagramRateLimit();
            try {
                const response = await axios.get(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
                    headers: {
                        'User-Agent': userAgent,
                        'X-Ig-App-Id': '936619743392459',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.instagram.com/',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin'
                    },
                    timeout: 8000
                });

                const user = response.data?.data?.user;
                if (user && (user.profile_pic_url_hd || user.profile_pic_url)) {
                    profileData = {
                        username: user.username,
                        fullName: user.full_name,
                        profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url,
                        isPrivate: user.is_private,
                        followers: user.edge_followed_by?.count || 0
                    };
                }
            } catch (error) {
                console.log('Method 2 failed:', error.message);
            }
        }

        // Method 3: Try scraping Instagram profile page
        if (!profileData) {
            await waitForInstagramRateLimit();
            try {
                const response = await axios.get(`https://www.instagram.com/${username}/`, {
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.instagram.com/',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none'
                    },
                    timeout: 8000
                });

                const html = response.data;

                // Extract JSON data from the HTML
                const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
                if (jsonMatch) {
                    const jsonData = JSON.parse(jsonMatch[1]);
                    if (jsonData.mainEntityofPage && jsonData.mainEntityofPage.interactionStatistic) {
                        profileData = {
                            username: username,
                            fullName: jsonData.name || username,
                            profilePicUrl: jsonData.mainEntityofPage.image || null,
                            isPrivate: false
                        };
                    }
                }

                // If that didn't work, try to find the profile pic URL in the HTML
                if (!profileData || !profileData.profilePicUrl) {
                    const profilePicMatch = html.match(/"profile_pic_url":"(https:[^"]+)"/);
                    const profilePicHdMatch = html.match(/"profile_pic_url_hd":"(https:[^"]+)"/);

                    if (profilePicHdMatch || profilePicMatch) {
                        const picUrl = (profilePicHdMatch ? profilePicHdMatch[1] : profilePicMatch[1]).replace(/\\u0026/g, '&');

                        profileData = {
                            username: username,
                            fullName: username,
                            profilePicUrl: picUrl,
                            isPrivate: false
                        };
                    }
                }
            } catch (error) {
                console.log('Method 3 failed:', error.message);
            }
        }

        if (profileData) {
            // Cache the successful result
            requestCache.set(cacheKey, {
                data: profileData,
                timestamp: Date.now()
            });

            return res.json(profileData);
        }

        // If all methods failed, return error
        return res.status(404).json({
            error: 'Profile not found',
            message: 'Could not fetch Instagram profile. The profile may be private or the username may not exist.',
            fallback: true
        });

    } catch (error) {
        console.error('Error fetching Instagram profile:', error.message);
        return res.status(500).json({
            error: 'Failed to fetch profile',
            message: error.message,
            fallback: true
        });
    }
});

// Image proxy endpoint to avoid CORS issues
app.get('/api/instagram-image', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
        // Fetch the image with proper headers
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://www.instagram.com/'
            },
            responseType: 'arraybuffer',
            timeout: 10000
        });

        // Set appropriate headers for image response
        const contentType = response.headers['content-type'] || 'image/jpeg';
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'Access-Control-Allow-Origin': '*'
        });

        // Send the image data
        res.send(Buffer.from(response.data));
    } catch (error) {
        console.error('Error fetching image:', error.message);
        res.status(500).json({
            error: 'Failed to fetch image',
            message: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Instagram proxy server is running' });
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Instagram Battle Arena server running on http://localhost:${PORT}`);
    console.log(`Proxy endpoint: http://localhost:${PORT}/api/instagram/:username`);
    console.log(`Rate limiting: Max ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW / 1000} seconds per IP`);
    console.log(`Instagram API throttle: Min ${MIN_REQUEST_INTERVAL / 1000} seconds between requests`);
});
