/**
 * Initial seed data for suburbs
 * Based on HDS API checks from 2026-04-14
 * Maps HDS zones to regions and provides initial suburb data
 */

module.exports = [
  // NSW - Region 1
  { name: 'Sydney', postcode: '2000', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', hds_zone_code: 'NSMET', serviceable: true },
  { name: 'Parramatta', postcode: '2150', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', hds_zone_code: 'NSMET', serviceable: true },
  { name: 'Penrith', postcode: '2750', state: 'NSW', region_id: 1, hds_zone: 'NSW Sydney Metro', hds_zone_code: 'NSMET', serviceable: true },
  { name: 'Newcastle', postcode: '2300', state: 'NSW', region_id: 2, hds_zone: 'NSW Newcastle', hds_zone_code: 'NSNEW', serviceable: true },
  { name: 'Wollongong', postcode: '2500', state: 'NSW', region_id: 3, hds_zone: 'NSW Wollongong Coast', hds_zone_code: 'NSWOL', serviceable: true },
  { name: 'Coffs Harbour', postcode: '2450', state: 'NSW', region_id: 4, hds_zone: 'NSW Coffs Harbour', hds_zone_code: 'NSCOF', serviceable: true },
  { name: 'Armidale', postcode: '2350', state: 'NSW', region_id: 7, hds_zone: 'NSW Armidale', hds_zone_code: 'NSARM', serviceable: true },
  { name: 'Tamworth', postcode: '2340', state: 'NSW', region_id: 8, hds_zone: 'NSW Tamworth', hds_zone_code: 'NSTAM', serviceable: true },
  { name: 'Bathurst', postcode: '2795', state: 'NSW', region_id: 9, hds_zone: 'NSW Bathurst/Orange', hds_zone_code: 'NSBAT', serviceable: true },
  { name: 'Orange', postcode: '2800', state: 'NSW', region_id: 9, hds_zone: 'NSW Bathurst/Orange', hds_zone_code: 'NSBAT', serviceable: true },
  
  // VIC - Regions 7-13
  { name: 'Melbourne', postcode: '3000', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', hds_zone_code: 'VICMEL', serviceable: true },
  { name: 'South Yarra', postcode: '3141', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', hds_zone_code: 'VICMEL', serviceable: true },
  { name: 'Carlton', postcode: '3053', state: 'VIC', region_id: 7, hds_zone: 'VIC Melbourne Metro', hds_zone_code: 'VICMEL', serviceable: true },
  { name: 'Geelong', postcode: '3220', state: 'VIC', region_id: 8, hds_zone: 'VIC Geelong', hds_zone_code: 'VICGEE', serviceable: true },
  { name: 'Ballarat', postcode: '3350', state: 'VIC', region_id: 9, hds_zone: 'VIC Ballarat', hds_zone_code: 'VICBAL', serviceable: true },
  { name: 'Bendigo', postcode: '3550', state: 'VIC', region_id: 10, hds_zone: 'VIC Bendigo', hds_zone_code: 'VICBEN', serviceable: true },
  { name: 'Shepparton', postcode: '3630', state: 'VIC', region_id: 11, hds_zone: 'VIC Shepparton', hds_zone_code: 'VICSHEP', serviceable: true },
  { name: 'Warrnambool', postcode: '3280', state: 'VIC', region_id: 12, hds_zone: 'VIC Regional West - Warrnambool', hds_zone_code: 'VICWAR', serviceable: true },
  { name: 'Albury', postcode: '2640', state: 'VIC/NSW', region_id: 13, hds_zone: 'VIC Albury Wodonga', hds_zone_code: 'VICALB', serviceable: true },
  
  // QLD - Regions 14-20
  { name: 'Brisbane', postcode: '4000', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', hds_zone_code: 'QLDBRI', serviceable: true },
  { name: 'South Bank', postcode: '4101', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', hds_zone_code: 'QLDBRI', serviceable: true },
  { name: 'Southside', postcode: '4215', state: 'QLD', region_id: 14, hds_zone: 'QLD Brisbane Metro', hds_zone_code: 'QLDBRI', serviceable: true },
  { name: 'Toowoomba', postcode: '4350', state: 'QLD', region_id: 15, hds_zone: 'QLD Toowoomba', hds_zone_code: 'QLDTOO', serviceable: true },
  { name: 'Cairns', postcode: '4870', state: 'QLD', region_id: 17, hds_zone: 'QLD-FNQ Cairns', hds_zone_code: 'QLDCAI', serviceable: true },
  { name: 'Townsville', postcode: '4810', state: 'QLD', region_id: 18, hds_zone: 'QLD-FNQ Townsville', hds_zone_code: 'QLDTOW', serviceable: true },
  { name: 'Rockhampton', postcode: '4700', state: 'QLD', region_id: 19, hds_zone: 'QLD-FNQ Rockhampton', hds_zone_code: 'QLDROCK', serviceable: true },
  { name: 'Mackay', postcode: '4740', state: 'QLD', region_id: 20, hds_zone: 'QLD-FNQ Mackay', hds_zone_code: 'QLDMAC', serviceable: true },
  
  // WA - Regions 21-23
  { name: 'Perth', postcode: '6000', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', hds_zone_code: 'WAPER', serviceable: true },
  { name: 'Fremantle', postcode: '6160', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', hds_zone_code: 'WAPER', serviceable: true },
  { name: 'Mandurah', postcode: '6210', state: 'WA', region_id: 21, hds_zone: 'WA Perth Metro', hds_zone_code: 'WAPER', serviceable: true },
  { name: 'Bunbury', postcode: '6230', state: 'WA', region_id: 22, hds_zone: 'WA South Coast - Bunbury 2 - Busselton', hds_zone_code: 'WABUN', serviceable: true },
  
  // SA - Region 24
  { name: 'Adelaide', postcode: '5000', state: 'SA', region_id: 24, hds_zone: 'SA Adelaide Metro', hds_zone_code: 'SAADE', serviceable: true },
  { name: 'Hindmarsh', postcode: '5007', state: 'SA', region_id: 24, hds_zone: 'SA Adelaide Metro', hds_zone_code: 'SAADE', serviceable: true },
  
  // ACT - Region 25
  { name: 'Canberra', postcode: '2600', state: 'ACT', region_id: 25, hds_zone: 'ACT Canberra Metro', hds_zone_code: 'ACTCAN', serviceable: true },
  
  // TAS - Regions 26-27
  { name: 'Hobart', postcode: '7000', state: 'TAS', region_id: 26, hds_zone: 'TAS Hobart Metro', hds_zone_code: 'TASHOB', serviceable: true },
  { name: 'Launceston', postcode: '7250', state: 'TAS', region_id: 27, hds_zone: 'TAS Launceston Metro', hds_zone_code: 'TASLAU', serviceable: true },
  
  // NT - Region 28
  { name: 'Darwin', postcode: '0800', state: 'NT', region_id: 28, hds_zone: 'NT Darwin Metro', hds_zone_code: 'NTDAR', serviceable: true },
];
