const express = require('express');
const axios = require('axios');
const router = express.Router();
const crypto = require('crypto');

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_HDS_CLIENT_ID || '2c919acb4882767a7294a8f97a4fe7f5';
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_HDS_CLIENT_SECRET;
const SHOPIFY_STORE = process.env.SHOPIFY_HDS_STORE || 'staging-workoutmeals';

if (!SHOPIFY_CLIENT_SECRET) {
  console.warn('⚠️  SHOPIFY_HDS_CLIENT_SECRET not set - OAuth will fail');
}

/**
 * GET /api/auth/shopify
 * Initiate OAuth flow with Shopify
 */
router.get('/shopify', (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const scopes = 'read_products,write_products';
    
    // Store state in a session or memory (for validation on callback)
    // For simplicity, we'll validate it loosely
    res.cookie('oauth_state', state, { 
      httpOnly: true, 
      maxAge: 600000, // 10 min
      sameSite: 'lax'
    });

    const authUrl = `https://${SHOPIFY_STORE}.myshopify.com/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_CLIENT_ID}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `redirect_uri=${encodeURIComponent(`${getOrigin(req)}/api/auth/callback`)}&` +
      `state=${state}`;

    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth initiation failed:', error.message);
    res.status(500).json({ error: 'OAuth initiation failed' });
  }
});

/**
 * GET /api/auth/callback
 * Handle Shopify OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;

    if (!code || !state || state !== storedState) {
      return res.status(400).send('Invalid state or missing code');
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      `https://${SHOPIFY_STORE}.myshopify.com/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code: code
      }
    );

    const { access_token, scope } = tokenResponse.data;

    if (!access_token) {
      return res.status(401).send('Failed to obtain access token');
    }

    // Verify the token by checking if it can access Shopify API
    try {
      const verifyResponse = await axios.get(
        `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-01/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': access_token,
            'Content-Type': 'application/json'
          }
        }
      );

      const shop = verifyResponse.data.shop;
      console.log(`✅ OAuth successful for store: ${shop.name}`);

      // Clear the oauth_state cookie
      res.clearCookie('oauth_state');

      // Redirect to frontend with token in query param
      // Frontend will save it to localStorage
      res.redirect(`/?token=${encodeURIComponent(access_token)}`);
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError.message);
      return res.status(401).send('Invalid access token');
    }
  } catch (error) {
    console.error('OAuth callback failed:', error.message);
    res.status(500).send('OAuth callback failed');
  }
});

/**
 * Helper: Get origin URL (handle both localhost and production)
 */
function getOrigin(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

// Validate on startup
if (SHOPIFY_CLIENT_SECRET) {
  console.log('✅ Shopify OAuth configured');
}

module.exports = router;
