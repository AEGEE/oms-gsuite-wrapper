process.env['NODE_CONFIG_DIR'] = __dirname;
const config = require('config');

config.GsuiteKeys = require('./myaegee-serviceaccount.json');
config.GsuiteKeys.delegatedUser = require('./secrets.json').delegatedUser;

module.exports = config;
// module.exports = exports = config ;
