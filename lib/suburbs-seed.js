/**
 * Initial seed data for suburbs
 * Based on HDS API checks from 2026-04-14
 * Comprehensive list of serviceable suburbs across all 27 HDS zones
 */

module.exports = [
  // NSW - Region 1: Sydney Metro
  { name: 'Sydney', postcode: '2000', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Parramatta', postcode: '2150', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Penrith', postcode: '2750', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Hornsby', postcode: '2077', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Manly', postcode: '2095', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Bondi', postcode: '2026', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Zetland', postcode: '2017', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Glebe', postcode: '2037', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Alexandria', postcode: '2015', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  { name: 'Camperdown', postcode: '2050', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', serviceable: true },
  
  // NSW - Region 2: Newcastle
  { name: 'Newcastle', postcode: '2300', state: 'NSW', region_id: 2, hds_zone: 'NSW Newcastle', serviceable: true },
  { name: 'Mayfield', postcode: '2304', state: 'NSW', region_id: 2, hds_zone: 'NSW Newcastle', serviceable: true },
  { name: 'Stockton', postcode: '2295', state: 'NSW', region_id: 2, hds_zone: 'NSW Newcastle', serviceable: true },
  { name: 'Hamilton', postcode: '2303', state: 'NSW', region_id: 2, hds_zone: 'NSW Newcastle', serviceable: true },
  
  // NSW - Region 3: Wollongong Coast
  { name: 'Wollongong', postcode: '2500', state: 'NSW', region_id: 3, hds_zone: 'NSW Wollongong Coast', serviceable: true },
  { name: 'Shellharbour', postcode: '2529', state: 'NSW', region_id: 3, hds_zone: 'NSW Wollongong Coast', serviceable: true },
  { name: 'Figtree', postcode: '2525', state: 'NSW', region_id: 3, hds_zone: 'NSW Wollongong Coast', serviceable: true },
  
  // NSW - Region 4: Coffs Harbour
  { name: 'Coffs Harbour', postcode: '2450', state: 'NSW', region_id: 4, hds_zone: 'NSW Coffs Harbour', serviceable: true },
  { name: 'Nambucca Heads', postcode: '2448', state: 'NSW', region_id: 4, hds_zone: 'NSW Coffs Harbour', serviceable: true },
  
  // NSW - Region 5: Armidale
  { name: 'Armidale', postcode: '2350', state: 'NSW', region_id: 5, hds_zone: 'NSW Armidale', serviceable: true },
  
  // NSW - Region 6: Tamworth
  { name: 'Tamworth', postcode: '2340', state: 'NSW', region_id: 6, hds_zone: 'NSW Tamworth', serviceable: true },
  
  // VIC - Region 7: Melbourne Metro
  { name: 'Melbourne', postcode: '3000', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  { name: 'South Yarra', postcode: '3141', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  { name: 'Carlton', postcode: '3053', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  { name: 'Fitzroy', postcode: '3065', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  { name: 'Collingwood', postcode: '3066', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  { name: 'Brunswick', postcode: '3056', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  { name: 'Coburg', postcode: '3058', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  { name: 'Essendon', postcode: '3040', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', serviceable: true },
  
  // VIC - Region 8: Geelong
  { name: 'Geelong', postcode: '3220', state: 'VIC', region_id: 8, hds_zone: 'VIC Geelong', serviceable: true },
  { name: 'Bellerine', postcode: '3280', state: 'VIC', region_id: 8, hds_zone: 'VIC Geelong', serviceable: true },
  
  // VIC - Region 9: Ballarat
  { name: 'Ballarat', postcode: '3350', state: 'VIC', region_id: 9, hds_zone: 'VIC Ballarat', serviceable: true },
  { name: 'Sebastopol', postcode: '3356', state: 'VIC', region_id: 9, hds_zone: 'VIC Ballarat', serviceable: true },
  
  // VIC - Region 10: Bendigo
  { name: 'Bendigo', postcode: '3550', state: 'VIC', region_id: 10, hds_zone: 'VIC Bendigo', serviceable: true },
  { name: 'Golden Square', postcode: '3555', state: 'VIC', region_id: 10, hds_zone: 'VIC Bendigo', serviceable: true },
  
  // VIC - Region 11: Shepparton
  { name: 'Shepparton', postcode: '3630', state: 'VIC', region_id: 11, hds_zone: 'VIC Shepparton', serviceable: true },
  { name: 'Mooroopna', postcode: '3629', state: 'VIC', region_id: 11, hds_zone: 'VIC Shepparton', serviceable: true },
  
  // VIC - Region 12: Warrnambool
  { name: 'Warrnambool', postcode: '3280', state: 'VIC', region_id: 12, hds_zone: 'VIC Regional West - Warrnambool', serviceable: true },
  { name: 'Koroit', postcode: '3282', state: 'VIC', region_id: 12, hds_zone: 'VIC Regional West - Warrnambool', serviceable: true },
  
  // VIC - Region 13: Albury Wodonga
  { name: 'Albury', postcode: '2640', state: 'VIC/NSW', region_id: 13, hds_zone: 'VIC Albury Wodonga', serviceable: true },
  { name: 'Wodonga', postcode: '3690', state: 'VIC', region_id: 13, hds_zone: 'VIC Albury Wodonga', serviceable: true },
  
  // QLD - Region 14: Brisbane Metro
  { name: 'Brisbane', postcode: '4000', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', serviceable: true },
  { name: 'South Bank', postcode: '4101', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', serviceable: true },
  { name: 'Southside', postcode: '4215', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', serviceable: true },
  { name: 'Fortitude Valley', postcode: '4006', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', serviceable: true },
  { name: 'West End', postcode: '4101', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', serviceable: true },
  { name: 'Kangaroo Point', postcode: '4169', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', serviceable: true },
  
  // QLD - Region 15: Toowoomba
  { name: 'Toowoomba', postcode: '4350', state: 'QLD', region_id: 15, hds_zone: 'QLD Toowoomba', serviceable: true },
  { name: 'Rangeville', postcode: '4350', state: 'QLD', region_id: 15, hds_zone: 'QLD Toowoomba', serviceable: true },
  
  // QLD - Region 16: Lismore
  { name: 'Lismore', postcode: '2480', state: 'QLD/NSW', region_id: 16, hds_zone: 'QLD Lismore', serviceable: true },
  
  // QLD - Region 17: Cairns
  { name: 'Cairns', postcode: '4870', state: 'QLD', region_id: 17, hds_zone: 'QLD-FNQ Cairns', serviceable: true },
  { name: 'Smithfield', postcode: '4878', state: 'QLD', region_id: 17, hds_zone: 'QLD-FNQ Cairns', serviceable: true },
  
  // QLD - Region 18: Townsville
  { name: 'Townsville', postcode: '4810', state: 'QLD', region_id: 18, hds_zone: 'QLD-FNQ Townsville', serviceable: true },
  { name: 'Wulguru', postcode: '4811', state: 'QLD', region_id: 18, hds_zone: 'QLD-FNQ Townsville', serviceable: true },
  
  // QLD - Region 19: Rockhampton
  { name: 'Rockhampton', postcode: '4700', state: 'QLD', region_id: 19, hds_zone: 'QLD-FNQ Rockhampton', serviceable: true },
  { name: 'Berserker', postcode: '4701', state: 'QLD', region_id: 19, hds_zone: 'QLD-FNQ Rockhampton', serviceable: true },
  
  // QLD - Region 20: Mackay
  { name: 'Mackay', postcode: '4740', state: 'QLD', region_id: 20, hds_zone: 'QLD-FNQ Mackay', serviceable: true },
  { name: 'Beaconsfield', postcode: '4740', state: 'QLD', region_id: 20, hds_zone: 'QLD-FNQ Mackay', serviceable: true },
  
  // WA - Region 21: Perth Metro
  { name: 'Perth', postcode: '6000', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', serviceable: true },
  { name: 'Fremantle', postcode: '6160', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', serviceable: true },
  { name: 'Mandurah', postcode: '6210', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', serviceable: true },
  { name: 'Subiaco', postcode: '6008', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', serviceable: true },
  { name: 'Cottesloe', postcode: '6011', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', serviceable: true },
  
  // WA - Region 22: South Coast
  { name: 'Bunbury', postcode: '6230', state: 'WA', region_id: 22, hds_zone: 'WA South Coast - Bunbury 2 - Busselton', serviceable: true },
  { name: 'Busselton', postcode: '6280', state: 'WA', region_id: 22, hds_zone: 'WA South Coast - Bunbury 2 - Busselton', serviceable: true },
  
  // WA - Region 23: Fremantle (additional)
  { name: 'East Fremantle', postcode: '6158', state: 'WA', region_id: 23, hds_zone: 'WA Fremantle', serviceable: true },
  { name: 'Melville', postcode: '6156', state: 'WA', region_id: 23, hds_zone: 'WA Fremantle', serviceable: true },
  
  // SA - Region 24: Adelaide Metro
  { name: 'Adelaide', postcode: '5000', state: 'SA', region_id: 24, hds_zone: 'SA Adelaide Metro', serviceable: true },
  { name: 'Hindmarsh', postcode: '5007', state: 'SA', region_id: 24, hds_zone: 'SA Adelaide Metro', serviceable: true },
  { name: 'North Adelaide', postcode: '5006', state: 'SA', region_id: 24, hds_zone: 'SA Adelaide Metro', serviceable: true },
  { name: 'Norwood', postcode: '5067', state: 'SA', region_id: 24, hds_zone: 'SA Adelaide Metro', serviceable: true },
  { name: 'Glenelg', postcode: '5045', state: 'SA', region_id: 24, hds_zone: 'SA Adelaide Metro', serviceable: true },
  
  // ACT - Region 25: Canberra Metro
  { name: 'Canberra', postcode: '2600', state: 'ACT', region_id: 25, hds_zone: 'ACT Canberra Metro', serviceable: true },
  { name: 'Belconnen', postcode: '2616', state: 'ACT', region_id: 25, hds_zone: 'ACT Canberra Metro', serviceable: true },
  { name: 'Tuggeranong', postcode: '2900', state: 'ACT', region_id: 25, hds_zone: 'ACT Canberra Metro', serviceable: true },
  { name: 'Woden Valley', postcode: '2606', state: 'ACT', region_id: 25, hds_zone: 'ACT Canberra Metro', serviceable: true },
  
  // TAS - Region 26: Hobart Metro
  { name: 'Hobart', postcode: '7000', state: 'TAS', region_id: 26, hds_zone: 'TAS Hobart Metro', serviceable: true },
  { name: 'South Hobart', postcode: '7004', state: 'TAS', region_id: 26, hds_zone: 'TAS Hobart Metro', serviceable: true },
  { name: 'Sandy Bay', postcode: '7005', state: 'TAS', region_id: 26, hds_zone: 'TAS Hobart Metro', serviceable: true },
  
  // TAS - Region 27: Launceston Metro
  { name: 'Launceston', postcode: '7250', state: 'TAS', region_id: 27, hds_zone: 'TAS Launceston Metro', serviceable: true },
  { name: 'Invermay', postcode: '7248', state: 'TAS', region_id: 27, hds_zone: 'TAS Launceston Metro', serviceable: true },
  
  // NT - Region 28: Darwin Metro
  { name: 'Darwin', postcode: '0800', state: 'NT', region_id: 28, hds_zone: 'NT Darwin Metro', serviceable: true },
  { name: 'Palmerston', postcode: '0830', state: 'NT', region_id: 28, hds_zone: 'NT Darwin Metro', serviceable: true },
];
