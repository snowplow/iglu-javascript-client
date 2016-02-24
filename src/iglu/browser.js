'use strict';

var Schema = require('./schema');
var Resolver = require('./resolver');
var IgluClient = require('./iglu-client');

module.exports.IgluClient = IgluClient;
module.exports.Resolver = Resolver;
module.exports.Schema = Schema;
