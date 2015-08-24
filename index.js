/**
 * Autowire module, singleton.
 *
 * @author Jan Œwiêcki <jan.swiecki@gmail.com>
 */
var stackTrace = require('stack-trace');
var PATH = require("path");

var log = require("./lib/DebugLogger.js").getLogger("autowire");

log("Initializing Autowire module");

var ModuleHelper = require("./lib/ModuleHelper.js");

var Injector = require("./lib/Injector.js");
var ModuleFinder = require("./lib/ModuleFinder.js");
var CodeMutator = require("./lib/CodeMutator.js");

var codeMutator = new CodeMutator();
var moduleFinder = new ModuleFinder();

var injector = Injector.create(moduleFinder, codeMutator).withAutowireModules();

var API = function(func) {
  var parentModuleName = getParentModuleName();
  log.info("Autowiring module: "+parentModuleName);

  return injector(func);
};

function getParentModuleName() {
  var parentFilename = stackTrace.get()[2].getFileName();
  return PATH.parse(parentFilename).base;
}

API.instantiate = function(clazz) {
  var obj = Object.create(clazz["prototype"]);
  var constructor = injector.attachSafe(clazz).autoWireModules();
  constructor.applyInject(obj);
  return obj;
};

/**
 * Add path to moduleFinder.
 *
 * Path is resolved to absolute path from callee context.
 *
 * @param path
 */
API.addImportPath = function(path) {
  var absPath = PATH.join(PATH.parse(ModuleHelper.getParentModule(1).filename).dir, path);
  moduleFinder.addImportPath(path);
};

API.alias = function(alias, realname) {
  moduleFinder.addAlias(alias, realname);
};

API.wire = function(name, object) {
  moduleFinder.wire(name, object);
};

API.Injector = Injector;
API.ModuleFinder = ModuleFinder;
API.CodeMutator = CodeMutator;
API._isAutowireModule = true;

module.exports = API;


