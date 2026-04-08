const axios = require('axios');
require('dotenv').config();

let accessToken = null;
let tokenExpiry = null;

/**
 * Authenticate with HDS API and get bearer token
 */
async function authenticateHDS() {
  try {
    const response = await axios.post(
      `${process.env.HDS_API_URL}/api/authenticate`,
      {
        email: process.env.HDS_EMAIL,
        password: process.env.HDS_PASSWORD,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.access_token) {
      accessToken = response.data.access_token;
      // Token typically lasts 315360000 seconds (~10 years), but set practical expiry
      tokenExpiry = Date.now() + (response.data.expires_in || 86400000) * 1000;
      console.log('✅ HDS Authentication successful');
      return accessToken;
    } else {
      throw new Error('No access token in response');
    }
  } catch (error) {
    console.error('❌ HDS Authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get valid bearer token (refresh if needed)
 */
async function getBearerToken() {
  if (!accessToken || (tokenExpiry && Date.now() > tokenExpiry)) {
    console.log('🔄 Refreshing HDS token...');
    await authenticateHDS();
  }
  return accessToken;
}

/**
 * Check if suburb is serviceable
 */
async function checkSuburbServiceable(suburb, postcode) {
  const token = await getBearerToken();
  
  try {
    const response = await axios.get(
      `${process.env.HDS_API_URL}/api/serviceable`,
      {
        params: {
          suburb: suburb,
          postcode: postcode,
        },
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(`❌ Serviceability check failed for ${suburb} ${postcode}:`, error.message);
    throw error;
  }
}

/**
 * Get service schedule for suburb
 */
async function getServiceSchedule(suburb, postcode) {
  const token = await getBearerToken();
  
  try {
    const response = await axios.get(
      `${process.env.HDS_API_URL}/api/serviceable/service-days`,
      {
        params: {
          suburb: suburb,
          postcode: postcode,
        },
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(`❌ Service schedule failed for ${suburb} ${postcode}:`, error.message);
    throw error;
  }
}

/**
 * Get full service schedule with line haul info
 */
async function getServiceScheduleWithLineHaul(suburb, postcode) {
  const token = await getBearerToken();
  
  try {
    const response = await axios.get(
      `${process.env.HDS_API_URL}/api/serviceable/full-schedule`,
      {
        params: {
          suburb: suburb,
          postcode: postcode,
        },
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(`❌ Service schedule with line haul failed for ${suburb} ${postcode}:`, error.message);
    throw error;
  }
}

module.exports = {
  authenticateHDS,
  getBearerToken,
  checkSuburbServiceable,
  getServiceSchedule,
  getServiceScheduleWithLineHaul,
};
