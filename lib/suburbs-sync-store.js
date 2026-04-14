// In-memory store for suburbs with HDS sync metadata
// Stores suburb data with HDS zone mappings, serviceability status, and sync tracking

let suburbs = [];
let nextId = 1;

// HDS Zone to Region mapping
const HDS_ZONE_TO_REGION = {
  'NSW Sydney Metro': 1,
  'NSW Sydney North': 1,
  'NSW Sydney South': 1,
  'NSW Sydney West': 1,
  'NSW Sydney Central': 1,
  'VIC Melbourne Metro': 2,
  'VIC Melbourne North': 2,
  'VIC Melbourne South': 2,
  'VIC Melbourne East': 2,
  'VIC Melbourne West': 2,
  // Add more as needed
};

const REGION_NAMES = {
  1: 'Sydney Metro',
  2: 'Melbourne Metro',
  3: 'Brisbane',
  4: 'Gold Coast',
  5: 'Sunshine Coast',
  6: 'Newcastle',
  7: 'Central Coast NSW',
  8: 'Canberra',
  9: 'Geelong',
};

module.exports = {
  suburbs,
  nextId,

  /**
   * Get all suburbs
   */
  getAll() {
    return suburbs.map(s => ({
      ...s,
      region_name: REGION_NAMES[s.region_id] || 'Unknown',
    }));
  },

  /**
   * Get suburb by ID
   */
  getById(id) {
    const suburb = suburbs.find(s => s.id === parseInt(id));
    if (!suburb) return null;
    return {
      ...suburb,
      region_name: REGION_NAMES[suburb.region_id] || 'Unknown',
    };
  },

  /**
   * Get suburbs by region ID
   */
  getByRegion(regionId) {
    return suburbs
      .filter(s => s.region_id === parseInt(regionId))
      .map(s => ({
        ...s,
        region_name: REGION_NAMES[s.region_id] || 'Unknown',
      }));
  },

  /**
   * Get suburbs by serviceability status
   */
  getByServiceable(serviceable = true) {
    return suburbs
      .filter(s => s.serviceable === serviceable)
      .map(s => ({
        ...s,
        region_name: REGION_NAMES[s.region_id] || 'Unknown',
      }));
  },

  /**
   * Get suburbs by HDS zone
   */
  getByHDSZone(hdsZone) {
    return suburbs
      .filter(s => s.hds_zone === hdsZone)
      .map(s => ({
        ...s,
        region_name: REGION_NAMES[s.region_id] || 'Unknown',
      }));
  },

  /**
   * Create or update suburb from HDS serviceability check
   * Returns: { isNew: boolean, suburb: object, changes: object }
   */
  upsertFromHDS(data) {
    const {
      name,
      postcode,
      state,
      is_serviceable,
      hds_zone,
      hds_zone_code,
      depot,
      depot_state,
    } = data;

    // Determine region from HDS zone
    let region_id = HDS_ZONE_TO_REGION[hds_zone];
    if (!region_id) {
      // Fallback: determine region from state
      if (state === 'NSW') region_id = 1;
      else if (state === 'VIC') region_id = 2;
      else if (state === 'QLD') region_id = 3;
      else region_id = 1; // Default fallback
    }

    // Check if suburb exists
    const existingIndex = suburbs.findIndex(
      s => s.name === name && s.postcode === postcode && s.state === state
    );

    const changes = {};

    if (existingIndex !== -1) {
      // Update existing suburb
      const existing = suburbs[existingIndex];

      // Track changes
      if (existing.serviceable !== is_serviceable) changes.serviceable = { old: existing.serviceable, new: is_serviceable };
      if (existing.hds_zone !== hds_zone) changes.hds_zone = { old: existing.hds_zone, new: hds_zone };
      if (existing.hds_zone_code !== hds_zone_code) changes.hds_zone_code = { old: existing.hds_zone_code, new: hds_zone_code };
      if (existing.region_id !== region_id) changes.region_id = { old: existing.region_id, new: region_id };

      // Update fields
      existing.serviceable = is_serviceable;
      existing.hds_zone = hds_zone;
      existing.hds_zone_code = hds_zone_code;
      existing.depot = depot;
      existing.depot_state = depot_state;
      existing.region_id = region_id;
      existing.last_synced = new Date();
      existing.updated_at = new Date();

      return {
        isNew: false,
        suburb: this.getById(existing.id),
        changes: Object.keys(changes).length > 0 ? changes : null,
      };
    } else {
      // Create new suburb
      const newSuburb = {
        id: nextId++,
        name,
        postcode,
        state,
        region_id,
        serviceable: is_serviceable,
        hds_zone,
        hds_zone_code,
        depot,
        depot_state,
        last_synced: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      suburbs.push(newSuburb);

      return {
        isNew: true,
        suburb: this.getById(newSuburb.id),
        changes: null,
      };
    }
  },

  /**
   * Create a new suburb (manual)
   */
  create(data) {
    const newSuburb = {
      id: nextId++,
      name: data.name,
      postcode: data.postcode,
      state: data.state,
      region_id: data.region_id || 1,
      serviceable: data.serviceable !== false,
      hds_zone: data.hds_zone || null,
      hds_zone_code: data.hds_zone_code || null,
      depot: data.depot || null,
      depot_state: data.depot_state || null,
      last_synced: data.last_synced || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    suburbs.push(newSuburb);
    return this.getById(newSuburb.id);
  },

  /**
   * Update a suburb
   */
  update(id, data) {
    const suburb = suburbs.find(s => s.id === parseInt(id));
    if (!suburb) return null;

    if (data.name !== undefined) suburb.name = data.name;
    if (data.postcode !== undefined) suburb.postcode = data.postcode;
    if (data.state !== undefined) suburb.state = data.state;
    if (data.region_id !== undefined) suburb.region_id = data.region_id;
    if (data.serviceable !== undefined) suburb.serviceable = data.serviceable;
    if (data.hds_zone !== undefined) suburb.hds_zone = data.hds_zone;
    if (data.hds_zone_code !== undefined) suburb.hds_zone_code = data.hds_zone_code;
    if (data.depot !== undefined) suburb.depot = data.depot;
    if (data.depot_state !== undefined) suburb.depot_state = data.depot_state;
    if (data.last_synced !== undefined) suburb.last_synced = data.last_synced;

    suburb.updated_at = new Date();
    return this.getById(suburb.id);
  },

  /**
   * Delete a suburb
   */
  delete(id) {
    const index = suburbs.findIndex(s => s.id === parseInt(id));
    if (index === -1) return false;
    suburbs.splice(index, 1);
    return true;
  },

  /**
   * Get suburbs that haven't been synced recently
   * @param {number} hoursOld - Minimum hours since last sync (default: 24)
   */
  getStaleSuburbs(hoursOld = 24) {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    return suburbs
      .filter(s => !s.last_synced || new Date(s.last_synced) < cutoffTime)
      .map(s => ({
        ...s,
        region_name: REGION_NAMES[s.region_id] || 'Unknown',
      }));
  },

  /**
   * Clear all suburbs (for full resync)
   */
  clear() {
    suburbs = [];
    nextId = 1;
  },

  /**
   * Get statistics about suburbs
   */
  getStats() {
    const total = suburbs.length;
    const serviceable = suburbs.filter(s => s.serviceable).length;
    const notServiceable = suburbs.filter(s => !s.serviceable).length;
    const byRegion = {};

    suburbs.forEach(s => {
      if (!byRegion[s.region_id]) {
        byRegion[s.region_id] = {
          name: REGION_NAMES[s.region_id] || 'Unknown',
          total: 0,
          serviceable: 0,
        };
      }
      byRegion[s.region_id].total += 1;
      if (s.serviceable) byRegion[s.region_id].serviceable += 1;
    });

    return {
      total,
      serviceable,
      notServiceable,
      byRegion,
      lastSyncTime: suburbs.length > 0 ? Math.max(...suburbs.map(s => s.last_synced ? new Date(s.last_synced).getTime() : 0)) : null,
    };
  },
};
