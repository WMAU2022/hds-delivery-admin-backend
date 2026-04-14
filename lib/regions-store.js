// In-memory store for regions
// Matches the approach used for schedules

let regions = [
  {
    id: 1,
    name: 'NSW Sydney Metro',
    description: 'Sydney, Parramatta, Western Sydney',
    hds_zone: 'NSW Sydney Metro',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 2,
    name: 'NSW Newcastle',
    description: 'Newcastle and surrounding areas',
    hds_zone: 'NSW Newcastle',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 3,
    name: 'VIC Melbourne Metro',
    description: 'Melbourne CBD and Metro areas',
    hds_zone: 'VIC Melbourne Metro',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 4,
    name: 'VIC Geelong',
    description: 'Geelong and surrounding areas',
    hds_zone: 'VIC Geelong',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 5,
    name: 'QLD Brisbane Metro',
    description: 'Brisbane, Southbank, and surrounding suburbs',
    hds_zone: 'QLD Brisbane Metro',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 6,
    name: 'WA Perth Metro',
    description: 'Perth CBD and Metro areas',
    hds_zone: 'WA Perth Metro',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 7,
    name: 'SA Adelaide Metro',
    description: 'Adelaide CBD and Metro areas',
    hds_zone: 'SA Adelaide Metro',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 8,
    name: 'ACT Canberra Metro',
    description: 'Canberra and surrounding areas',
    hds_zone: 'ACT Canberra Metro',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 9,
    name: 'TAS Hobart Metro',
    description: 'Hobart and surrounding areas',
    hds_zone: 'TAS Hobart Metro',
    enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

let nextId = 10;

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
