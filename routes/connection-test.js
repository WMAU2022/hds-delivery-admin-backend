const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

router.get('/ping-postgres', async (req, res) => {
  try {
    // Try to ping the host
    const { stdout, stderr } = await execAsync('ping -c 1 postgres.railway.internal', { timeout: 5000 }).catch(e => ({ stdout: '', stderr: e.message }));
    
    res.json({
      ping_result: stdout || stderr,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      type: error.code
    });
  }
});

router.get('/dns-lookup', async (req, res) => {
  try {
    const dns = require('dns').promises;
    const address = await dns.resolve4('postgres.railway.internal');
    
    res.json({
      hostname: 'postgres.railway.internal',
      addresses: address,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: error.code,
      hostname: 'postgres.railway.internal'
    });
  }
});

module.exports = router;
