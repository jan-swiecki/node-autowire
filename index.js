var log = require("./lib/SimpleLogger.js").getLogger();

var Injector = require("./lib/Injector.js");
var ModuleFinder = require("./lib/ModuleFinder.js");

var injector = new Injector();

var API = function(callback) {
  return injector.applyInjectAutoDiscover(callback, {});
};

API.Injector = Injector;
API.ModuleFinder = ModuleFinder;
API._isAutowireModule = true;

module.exports = API;


