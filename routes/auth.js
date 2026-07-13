const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Simple admin password (should be moved to env var for production)
const ADMIN_PASSWORD = process.env.HDS_ADMIN_PASSWORD || 'deliver2024';

/**
 * POST /api/auth/login
 * Simple password authentication
 */
router.post('/login', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    if (password !== ADMIN_PASSWORD) {
      console.warn('❌ Invalid password attempt');
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate a simple token (in production, use JWT)
    const token = crypto.randomBytes(32).toString('hex');

    console.log('✅ Admin login successful');

    res.json({
      token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/verify
 * Verify token
 */
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ valid: false });
    }

    // For simple tokens, any valid-looking token is OK
    // In production, use JWT verification
    if (token.length === 64) {
      return res.json({ valid: true });
    }

    res.status(401).json({ valid: false });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

console.log('✅ Password authentication configured');

module.exports = router;
