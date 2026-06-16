const express = require('express');
const router = express.Router();

router.get('/vars', (req, res) => {
  // DO NOT log the actual URL, but show its length and first/last chars as proof
  const url = process.env.DATABASE_URL;
  let urlDebug = 'NOT SET';
  if (url) {
    // Show structure without exposing password
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (match) {
      urlDebug = {
        scheme: 'postgresql',
        user: match[1],
        password_length: match[2].length,
        password_first_10: match[2].substring(0, 10),
        host: match[3],
        port: match[4],
        database: match[5]
      };
    } else {
      urlDebug = `URL present but malformed (length: ${url.length})`;
    }
  }

  res.json({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL_structure: urlDebug,
    PGHOST: process.env.PGHOST || 'NOT SET',
    PGUSER: process.env.PGUSER || 'NOT SET',
    PGPASSWORD_length: process.env.PGPASSWORD ? process.env.PGPASSWORD.length : 'NOT SET'
  });
});

module.exports = router;
