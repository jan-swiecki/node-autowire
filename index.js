var log = require("./lib/SimpleLogger.js").getLogger();

var Injector = require("./lib/Injector.js");
var ModuleFinder = require("./lib/ModuleFinder.js");
var CodeMutator = require("./lib/CodeMutator.js");

var codeMutator = new CodeMutator();
var moduleFinder = new ModuleFinder();

var injector = new Injector(moduleFinder, codeMutator);

var API = function(callback) {
  var wrapped = injector.attachSafe(callback).autoWireModules();
  return wrapped.applyInject();
};

API.Injector = Injector;
API.ModuleFinder = ModuleFinder;
API.CodeMutator = CodeMutator;
API._isAutowireModule = true;

module.exports = API;


