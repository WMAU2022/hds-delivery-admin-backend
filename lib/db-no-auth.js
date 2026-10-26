// Kept so existing require('../lib/db-no-auth') calls keep working; the single
// shared pool and its connection settings live in lib/db.js.
module.exports = require('./db');
