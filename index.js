var stackTrace = require('stack-trace');
var PATH = require("path");

var log = require("./lib/DebugLogger.js").getLogger("autowire");

log("Initializing Autowire module");

var Injector = require("./lib/Injector.js");
var ModuleFinder = require("./lib/ModuleFinder.js");
var CodeMutator = require("./lib/CodeMutator.js");

var codeMutator = new CodeMutator();
var moduleFinder = new ModuleFinder();

var injector = Injector.create(moduleFinder, codeMutator).withAutowireModules();

//log("injector.uuid = "+injector._uuid);
//var x = injector(function(lodash){ return lodash; });
//console.log(x.isAutowireModules);
//return;

var API = function(func) {
  var parentModuleName = getParentModuleName();
  log.info("Autowiring module: "+parentModuleName);

  return injector(func);

  //var wrapped = injector.attachSafe(func).autoWireModules();
  //return wrapped.executeInject();
};

function getParentModuleName() {
  var parentFilename = stackTrace.get()[2].getFileName();
  var name = PATH.parse(parentFilename).base;
  return name;
}

API.instantiate = function(clazz) {
  var obj = Object.create(clazz["prototype"]);
  var constructor = injector.attachSafe(clazz).autoWireModules();
  constructor.applyInject(obj);
  return obj;
};

API.addImportPath = function(path) {
  moduleFinder.addImportPath(path);
};

API.Injector = Injector;
API.ModuleFinder = ModuleFinder;
API.CodeMutator = CodeMutator;
API._isAutowireModule = true;

module.exports = API;


