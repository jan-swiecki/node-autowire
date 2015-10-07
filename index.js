/**
 * Autowire module.
 *
 * @author Jan Święcki <jan.swiecki@gmail.com>
 */

// get modules
var PATH = require("path");

var log = require("./lib/DebugLogger.js").getLogger("autowire");
log("Initializing Autowire module");

// get helpers
var ModuleHelper = require("./lib/ModuleHelper.js");
var ClassHelper = require("./lib/helpers/ClassHelper.js");
var Functionize = require("./lib/Functionize.js");

// get classes
var Injector = require("./lib/Injector.js");
var ModuleFinder = require("./lib/ModuleFinder.js");
var CodeMutator = require("./lib/CodeMutator.js");

// constants
var PARENT_DEPTH = 1;

function getParentModuleName() {
  var parentFilename = ModuleHelper.getParentModule(PARENT_DEPTH).filename;
  return PATH.parse(parentFilename).base;
}

var level = 0;

function getModuleFinder() {
  var parentModule = ModuleHelper.getParentModule(PARENT_DEPTH);

  if(! parentModule) {
    throw new Error("Cannot find parent module, depth = "+PARENT_DEPTH);
  }

  var filename = parentModule.filename;

  var parsed = PATH.parse(filename);

  log("========= LEVEL %s =========", level);
  log.info("Autowiring module \"%s\" with rootPath \"%s\"", parsed.base, parsed.dir);

  var moduleFinder = new ModuleFinder();

  moduleFinder.setCurrentPath(parsed.dir);
  moduleFinder.setParentModuleName(parsed.base);
  moduleFinder.generateNameCache();

  return moduleFinder;
}

function Autowire(func) {
  level = level + 1;

  var moduleFinder = getModuleFinder();

  var codeMutator = new CodeMutator();

  var injector = Injector(moduleFinder, codeMutator)
    .setAutowireModules(true);

  var ret = injector.exec(func);

  log("========= /LEVEL %s =========", level);

  level = level - 1;

  return ret;
}

Autowire.getModuleByName = function(moduleName) {
  var fn = new Function(moduleName, "return "+moduleName+";");
  return Autowire(fn);
};

Autowire.alias = function(alias, realname) {
  var moduleFinder = getModuleFinder();
  moduleFinder.addAlias(alias, realname);
};

Autowire.wire = function(name, object) {
  var moduleFinder = getModuleFinder();
  moduleFinder.addToCache(name, object);
};

// instantiate Autowire
module.exports = Autowire;