// In-memory store for regions
// Matches the approach used for schedules

console.log('🔄 Loading regions-store.js...');

let regions = [
  // NSW (6 zones)
  { id: 1, name: 'NSW Sydney Metro', hds_zone: 'NSW Sydney Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 2, name: 'NSW Newcastle', hds_zone: 'NSW Newcastle', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 3, name: 'NSW Wollongong Coast', hds_zone: 'NSW Wollongong Coast', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 4, name: 'NSW Coffs Harbour', hds_zone: 'NSW Coffs Harbour', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 5, name: 'NSW Armidale', hds_zone: 'NSW Armidale', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 6, name: 'NSW Tamworth', hds_zone: 'NSW Tamworth', enabled: true, created_at: new Date(), updated_at: new Date() },
  // VIC (7 zones)
  { id: 7, name: 'VIC Melbourne Metro', hds_zone: 'VIC Melbourne Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 8, name: 'VIC Geelong', hds_zone: 'VIC Geelong', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 9, name: 'VIC Ballarat', hds_zone: 'VIC Ballarat', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 10, name: 'VIC Bendigo', hds_zone: 'VIC Bendigo', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 11, name: 'VIC Shepparton', hds_zone: 'VIC Shepparton', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 12, name: 'VIC Regional West - Warrnambool', hds_zone: 'VIC Regional West - Warrnambool', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 13, name: 'VIC Albury Wodonga', hds_zone: 'VIC Albury Wodonga', enabled: true, created_at: new Date(), updated_at: new Date() },
  // QLD (7 zones)
  { id: 14, name: 'QLD Brisbane Metro', hds_zone: 'QLD Brisbane Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 15, name: 'QLD Toowoomba', hds_zone: 'QLD Toowoomba', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 16, name: 'QLD Lismore', hds_zone: 'QLD Lismore', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 17, name: 'QLD-FNQ Cairns', hds_zone: 'QLD-FNQ Cairns', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 18, name: 'QLD-FNQ Townsville', hds_zone: 'QLD-FNQ Townsville', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 19, name: 'QLD-FNQ Rockhampton', hds_zone: 'QLD-FNQ Rockhampton', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 20, name: 'QLD-FNQ Mackay', hds_zone: 'QLD-FNQ Mackay', enabled: true, created_at: new Date(), updated_at: new Date() },
  // WA (3 zones)
  { id: 21, name: 'WA Perth Metro', hds_zone: 'WA Perth Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 22, name: 'WA South Coast - Bunbury 2 - Busselton', hds_zone: 'WA South Coast - Bunbury 2 - Busselton', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 23, name: 'WA Fremantle', hds_zone: 'WA Fremantle', enabled: true, created_at: new Date(), updated_at: new Date() },
  // SA (1 zone)
  { id: 24, name: 'SA Adelaide Metro', hds_zone: 'SA Adelaide Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  // ACT (1 zone)
  { id: 25, name: 'ACT Canberra Metro', hds_zone: 'ACT Canberra Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  // TAS (2 zones)
  { id: 26, name: 'TAS Hobart Metro', hds_zone: 'TAS Hobart Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  { id: 27, name: 'TAS Launceston Metro', hds_zone: 'TAS Launceston Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
  // NT (1 zone)
  { id: 28, name: 'NT Darwin Metro', hds_zone: 'NT Darwin Metro', enabled: true, created_at: new Date(), updated_at: new Date() },
];

let nextId = 29;

module.exports = {
  regions,
  nextId,

  getAll() {
    return [...regions];
  },

  getById(id) {
    return regions.find(r => r.id === parseInt(id)) || null;
  },

  create(data) {
    const newRegion = {
      id: nextId++,
      name: data.name,
      description: data.description || '',
      enabled: data.enabled !== false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    regions.push(newRegion);
    return newRegion;
  },

  toggle(id) {
    const region = regions.find(r => r.id === parseInt(id));
    if (!region) return null;
    region.enabled = !region.enabled;
    region.updated_at = new Date();
    return region;
  },

  enable(id) {
    const region = regions.find(r => r.id === parseInt(id));
    if (!region) return null;
    region.enabled = true;
    region.updated_at = new Date();
    return region;
  },

  disable(id) {
    const region = regions.find(r => r.id === parseInt(id));
    if (!region) return null;
    region.enabled = false;
    region.updated_at = new Date();
    return region;
  },

  toggleMultiple(ids) {
    return ids
      .map(id => this.toggle(id))
      .filter(r => r !== null);
  },

  enableMultiple(ids) {
    return ids
      .map(id => this.enable(id))
      .filter(r => r !== null);
  },

  disableMultiple(ids) {
    return ids
      .map(id => this.disable(id))
      .filter(r => r !== null);
  },

  update(id, data) {
    const region = regions.find(r => r.id === parseInt(id));
    if (!region) return null;
    
    if (data.name) region.name = data.name;
    if (data.description !== undefined) region.description = data.description;
    if (data.enabled !== undefined) region.enabled = data.enabled;
    region.updated_at = new Date();
    
    return region;
  },

  delete(id) {
    const index = regions.findIndex(r => r.id === parseInt(id));
    if (index === -1) return false;
    regions.splice(index, 1);
    return true;
  },
};
