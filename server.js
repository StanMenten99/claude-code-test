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

// Proxy endpoint for Instagram profile pictures
app.get('/api/instagram/:username', async (req, res) => {
    const { username } = req.params;

    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        // Try multiple methods to fetch Instagram profile data
        let profileData = null;

        // Method 1: Try Instagram's public profile endpoint
        try {
            const response = await axios.get(`https://www.instagram.com/${username}/?__a=1&__d=dis`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.instagram.com/',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 5000
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
            try {
                const response = await axios.get(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'X-Ig-App-Id': '936619743392459',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.instagram.com/',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    timeout: 5000
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
            try {
                const response = await axios.get(`https://www.instagram.com/${username}/`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 5000
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
});
