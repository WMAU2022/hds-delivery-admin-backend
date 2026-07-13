const express = require('express');
const axios = require('axios');
const router = express.Router();

const SHOPIFY_CLIENT_ID = '2c919acb4882767a7294a8f97a4fe7f5';
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_HDS_CLIENT_SECRET || 'shpss_890f2c054b9a1b9ffd8ca7fc5320f85';
const SHOPIFY_STORE = 'staging-workoutmeals';

/**
 * POST /api/auth/token
 * Exchange Shopify OAuth code for access token
 */
router.post('/token', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange code for access token with Shopify
    const tokenResponse = await axios.post(
      `https://${SHOPIFY_STORE}.myshopify.com/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      }
    );

    const { access_token, scope } = tokenResponse.data;

    if (!access_token) {
      return res.status(401).json({ error: 'Failed to obtain access token' });
    }

    // Verify the token by checking if it can access the Shopify API
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

      // Return token to client
      res.json({
        access_token,
        scope,
        store: SHOPIFY_STORE,
        shop: shop.name
      });
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError.message);
      return res.status(401).json({ error: 'Invalid access token' });
    }
  } catch (error) {
    console.error('OAuth token exchange failed:', error.message);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

module.exports = router;
