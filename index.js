var log = require("./lib/SimpleLogger.js").getLogger();

var Injector = require("./lib/Injector.js");
var injector = new Injector();

var API = function(callback) {
  return injector.executeInject(callback, {});
};

API.Injector = Injector;
API._isAutowireModule = true;

module.exports = API;


