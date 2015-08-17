var Injector = require("./lib/Injector.js");

var log = require("./lib/SimpleLogger.js").getLogger();

injector = new Injector();

module.exports = function(callback) {
  return injector.executeInject(callback, {});
}

module.exports.Injector = Injector;
