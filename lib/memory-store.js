// In-memory store for schedules (temporary while debugging database)
// Data persists during server lifetime

let schedules = [
  { id: 1, region_id: 1, cutoff_day: 4, pack_day: 6, delivery_day: 0, hours: 'AM', enabled: true, is_default: true, created_at: new Date(), updated_at: new Date() },
  { id: 2, region_id: 1, cutoff_day: 4, pack_day: 6, delivery_day: 0, hours: 'Business Hours', enabled: true, is_default: false, created_at: new Date(), updated_at: new Date() },
  { id: 3, region_id: 2, cutoff_day: 4, pack_day: 5, delivery_day: 5, hours: 'AM', enabled: true, is_default: true, created_at: new Date(), updated_at: new Date() },
  { id: 4, region_id: 2, cutoff_day: 4, pack_day: 5, delivery_day: 5, hours: 'Business Hours', enabled: true, is_default: false, created_at: new Date(), updated_at: new Date() },
];

let nextId = 5;

const DAY_MAP = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

const REVERSE_DAY_MAP = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

module.exports = {
  schedules,
  nextId,
  
  getAll() {
    return schedules.map(s => ({
      ...s,
      cutoff_day_name: REVERSE_DAY_MAP[s.cutoff_day],
      pack_day_name: REVERSE_DAY_MAP[s.pack_day],
      delivery_day_name: REVERSE_DAY_MAP[s.delivery_day],
    }));
  },
  
  getById(id) {
    const s = schedules.find(x => x.id === parseInt(id));
    if (!s) return null;
    return {
      ...s,
      cutoff_day_name: REVERSE_DAY_MAP[s.cutoff_day],
      pack_day_name: REVERSE_DAY_MAP[s.pack_day],
      delivery_day_name: REVERSE_DAY_MAP[s.delivery_day],
    };
  },
  
  getByRegion(regionId) {
    return schedules
      .filter(s => s.region_id === parseInt(regionId))
      .map(s => ({
        ...s,
        cutoff_day_name: REVERSE_DAY_MAP[s.cutoff_day],
        pack_day_name: REVERSE_DAY_MAP[s.pack_day],
        delivery_day_name: REVERSE_DAY_MAP[s.delivery_day],
      }));
  },
  
  create(data) {
    const dayNameToNum = (dayName) => {
      if (typeof dayName === 'number') return dayName;
      return DAY_MAP[dayName];
    };
    
    const newSchedule = {
      id: nextId++,
      region_id: data.region_id,
      cutoff_day: dayNameToNum(data.cutoff_day),
      pack_day: dayNameToNum(data.pack_day),
      delivery_day: dayNameToNum(data.delivery_day),
      hours: data.hours,
      enabled: data.enabled !== false,
      is_default: data.is_default === true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    schedules.push(newSchedule);
    return this.getById(newSchedule.id);
  },
  
  update(id, data) {
    const schedule = schedules.find(s => s.id === parseInt(id));
    if (!schedule) return null;
    
    const dayNameToNum = (dayName) => {
      if (dayName === undefined) return undefined;
      if (typeof dayName === 'number') return dayName;
      return DAY_MAP[dayName];
    };
    
    if (data.cutoff_day !== undefined) schedule.cutoff_day = dayNameToNum(data.cutoff_day);
    if (data.pack_day !== undefined) schedule.pack_day = dayNameToNum(data.pack_day);
    if (data.delivery_day !== undefined) schedule.delivery_day = dayNameToNum(data.delivery_day);
    if (data.hours !== undefined) schedule.hours = data.hours;
    if (data.enabled !== undefined) schedule.enabled = data.enabled;
    if (data.is_default !== undefined) schedule.is_default = data.is_default;
    schedule.updated_at = new Date();
    
    return this.getById(schedule.id);
  },
  
  delete(id) {
    const index = schedules.findIndex(s => s.id === parseInt(id));
    if (index === -1) return false;
    schedules.splice(index, 1);
    return true;
  },
};
