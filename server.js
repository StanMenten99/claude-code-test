// Instagram Proxy Server
// This server acts as a proxy to fetch Instagram profile data and avoid CORS issues

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Instagram API Configuration (optional - for official API access)
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || null;
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || null;

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

        // Method 1: Try Instagram's profile page with full browser headers
        try {
            const response = await axios.get(`https://www.instagram.com/${username}/`, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Cache-Control': 'max-age=0'
                },
                timeout: 10000,
                maxRedirects: 5
            });

            const html = response.data;

            // Try multiple extraction methods
            // Method 1a: Extract from meta tags (most reliable)
            const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
            if (ogImageMatch && ogImageMatch[1]) {
                const picUrl = ogImageMatch[1].replace(/&amp;/g, '&');
                const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
                const titleText = ogTitleMatch ? ogTitleMatch[1] : username;
                const nameMatch = titleText.match(/^([^(•]+)/);
                const displayName = nameMatch ? nameMatch[1].trim() : username;

                profileData = {
                    username: username,
                    fullName: displayName,
                    profilePicUrl: picUrl,
                    isPrivate: false
                };
                console.log('Method 1a succeeded: Found data in meta tags');
            }

            // Method 1b: Extract from inline JSON
            if (!profileData) {
                const profilePicHdMatch = html.match(/"profile_pic_url_hd":"(https:[^"]+)"/);
                const profilePicMatch = html.match(/"profile_pic_url":"(https:[^"]+)"/);
                const matchedUrl = profilePicHdMatch || profilePicMatch;

                if (matchedUrl && matchedUrl[1]) {
                    let picUrl = matchedUrl[1]
                        .replace(/\\u002F/g, '/')
                        .replace(/\\u0026/g, '&')
                        .replace(/\\\//g, '/');

                    const fullNameMatch = html.match(/"full_name":"([^"]+)"/);
                    const fullName = fullNameMatch ? fullNameMatch[1] : username;

                    profileData = {
                        username: username,
                        fullName: fullName,
                        profilePicUrl: picUrl,
                        isPrivate: false
                    };
                    console.log('Method 1b succeeded: Found data in inline JSON');
                }
            }
        } catch (error) {
            console.log('Method 1 failed:', error.response?.status || error.message);
            if (error.response?.status === 403 && error.response?.data) {
                console.log('Instagram 403 response:', typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.response.data);
            }
        }

        // Method 2: Try Instagram's oembed API (more reliable, no auth required)
        if (!profileData) {
            await waitForInstagramRateLimit();
            try {
                // First get the profile URL to check if it exists
                const profileCheckResponse = await axios.get(`https://www.instagram.com/${username}/`, {
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 8000,
                    maxRedirects: 5,
                    validateStatus: (status) => status < 400 // Accept any status < 400
                });

                // If we got a valid response, try to extract profile data from meta tags
                const html = profileCheckResponse.data;

                // Try to extract profile picture from og:image meta tag
                const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
                if (ogImageMatch && ogImageMatch[1]) {
                    // Clean up the URL
                    const picUrl = ogImageMatch[1].replace(/&amp;/g, '&');

                    // Try to extract username and name
                    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/);
                    const titleText = ogTitleMatch ? ogTitleMatch[1] : username;

                    // Parse title like "John Doe (@username) • Instagram photos and videos"
                    const nameMatch = titleText.match(/^([^(]+)\s*\(@/);
                    const displayName = nameMatch ? nameMatch[1].trim() : username;

                    profileData = {
                        username: username,
                        fullName: displayName,
                        profilePicUrl: picUrl,
                        isPrivate: false
                    };

                    console.log('Method 2 succeeded: Profile found via meta tags');
                }
            } catch (error) {
                console.log('Method 2 failed:', error.message);
            }
        }

        // Method 3: Try extracting embedded JSON data from profile page
        if (!profileData) {
            await waitForInstagramRateLimit();
            try {
                const response = await axios.get(`https://www.instagram.com/${username}/`, {
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    timeout: 10000,
                    maxRedirects: 5
                });

                const html = response.data;

                // Method 3a: Try to extract from embedded JSON-LD
                const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
                if (jsonLdMatch) {
                    try {
                        const jsonData = JSON.parse(jsonLdMatch[1]);
                        if (jsonData && jsonData.image) {
                            profileData = {
                                username: username,
                                fullName: jsonData.name || username,
                                profilePicUrl: jsonData.image,
                                isPrivate: false
                            };
                            console.log('Method 3a succeeded: Found data in JSON-LD');
                        }
                    } catch (jsonError) {
                        console.log('Failed to parse JSON-LD:', jsonError.message);
                    }
                }

                // Method 3b: Try to find profile pic in inline JavaScript
                if (!profileData || !profileData.profilePicUrl) {
                    // Look for profile_pic_url_hd first (higher quality)
                    const profilePicHdMatch = html.match(/"profile_pic_url_hd":"(https:\\u002F\\u002F[^"]+)"/);
                    const profilePicMatch = html.match(/"profile_pic_url":"(https:\\u002F\\u002F[^"]+)"/);

                    // Also try unescaped versions
                    const profilePicHdMatch2 = html.match(/"profile_pic_url_hd":"(https:\/\/[^"]+)"/);
                    const profilePicMatch2 = html.match(/"profile_pic_url":"(https:\/\/[^"]+)"/);

                    const matchedUrl = profilePicHdMatch || profilePicMatch || profilePicHdMatch2 || profilePicMatch2;

                    if (matchedUrl && matchedUrl[1]) {
                        // Unescape the URL
                        let picUrl = matchedUrl[1]
                            .replace(/\\u002F/g, '/')
                            .replace(/\\u0026/g, '&')
                            .replace(/\\\//g, '/');

                        // Try to extract full name
                        const fullNameMatch = html.match(/"full_name":"([^"]+)"/);
                        const fullName = fullNameMatch ? fullNameMatch[1] : username;

                        profileData = {
                            username: username,
                            fullName: fullName,
                            profilePicUrl: picUrl,
                            isPrivate: false
                        };

                        console.log('Method 3b succeeded: Found data in inline JavaScript');
                    }
                }

                // Method 3c: Extract from shared data script tag
                if (!profileData || !profileData.profilePicUrl) {
                    const sharedDataMatch = html.match(/window\._sharedData = ({.*?});<\/script>/s);
                    if (sharedDataMatch) {
                        try {
                            const sharedData = JSON.parse(sharedDataMatch[1]);
                            const userData = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;

                            if (userData && (userData.profile_pic_url_hd || userData.profile_pic_url)) {
                                profileData = {
                                    username: userData.username || username,
                                    fullName: userData.full_name || username,
                                    profilePicUrl: userData.profile_pic_url_hd || userData.profile_pic_url,
                                    isPrivate: userData.is_private || false,
                                    followers: userData.edge_followed_by?.count || 0
                                };
                                console.log('Method 3c succeeded: Found data in _sharedData');
                            }
                        } catch (jsonError) {
                            console.log('Failed to parse _sharedData:', jsonError.message);
                        }
                    }
                }
            } catch (error) {
                console.log('Method 3 failed:', error.message);
            }
        }

        // Method 4: Try with minimal headers to avoid detection
        if (!profileData) {
            await waitForInstagramRateLimit();
            try {
                const response = await axios.get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
                    headers: {
                        'User-Agent': userAgent,
                        'Accept': '*/*',
                        'X-IG-App-ID': '936619743392459'
                    },
                    timeout: 8000
                });

                const user = response.data?.data?.user;
                if (user && (user.profile_pic_url_hd || user.profile_pic_url)) {
                    profileData = {
                        username: user.username || username,
                        fullName: user.full_name || username,
                        profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url,
                        isPrivate: user.is_private || false
                    };
                    console.log('Method 4 succeeded: Found via API endpoint');
                }
            } catch (error) {
                console.log('Method 4 failed:', error.response?.status || error.message);
            }
        }

        // Method 5: Try Googlebot user agent (search engines sometimes get preferential treatment)
        if (!profileData) {
            await waitForInstagramRateLimit();
            try {
                const response = await axios.get(`https://www.instagram.com/${username}/`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                    },
                    timeout: 8000
                });

                const html = response.data;

                // Try to find any image URL in meta tags
                const metaImagePatterns = [
                    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
                    /<meta\s+name="twitter:image"\s+content="([^"]+)"/i,
                    /<link\s+rel="image_src"\s+href="([^"]+)"/i
                ];

                for (const pattern of metaImagePatterns) {
                    const match = html.match(pattern);
                    if (match && match[1]) {
                        profileData = {
                            username: username,
                            fullName: username,
                            profilePicUrl: match[1].replace(/&amp;/g, '&'),
                            isPrivate: false
                        };
                        console.log('Method 5 succeeded: Found image in meta tags via Googlebot');
                        break;
                    }
                }
            } catch (error) {
                console.log('Method 5 failed:', error.response?.status || error.message);
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

        // If all methods failed, return error with helpful message
        const errorMessage = INSTAGRAM_ACCESS_TOKEN
            ? 'Could not fetch Instagram profile. The profile may be private or the username may not exist.'
            : 'Instagram is blocking automated requests. Consider setting up Instagram API credentials (INSTAGRAM_ACCESS_TOKEN) for reliable access. Using placeholder image instead.';

        console.log(`All methods failed for username: ${username}. ${errorMessage}`);

        return res.status(404).json({
            error: 'Profile not found',
            message: errorMessage,
            fallback: true,
            suggestion: !INSTAGRAM_ACCESS_TOKEN ? 'Set INSTAGRAM_ACCESS_TOKEN environment variable for Instagram API access' : null
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
