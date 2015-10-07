/**
 * Autowire module, singleton.
 *
 * @author Jan Święcki <jan.swiecki@gmail.com>
 */

// get modules
var PATH = require("path");

var log = require("./lib/DebugLogger.js").getLogger("autowire");
log("Initializing Autowire module");

//GLOBAL.trace = function(expr) {
//  log("TRACE -> %s", expr);
//  return expr;
//};

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
  // depth=2 because we are functionized

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

Autowire.prototype.getModuleByName = function(moduleName) {
  var fn = new Function(moduleName, "return "+moduleName);
  return this(fn);
};

Autowire.alias = function(alias, realname) {
  var moduleFinder = getModuleFinder();
  moduleFinder.addAlias(alias, realname);
};

Autowire.wire = function(name, object) {
  var moduleFinder = getModuleFinder();
  moduleFinder.addToCache(name, object);
};

Autowire.newInstance = function() {
  var dependencies = Autowire.getNewDependencies();

  var autowire = Autowire.getInstance(dependencies.injector);

  autowire.Injector = Injector;
  autowire.ModuleFinder = ModuleFinder;
  autowire.CodeMutator = CodeMutator;
  autowire.Autowire = Autowire;
  autowire.newInstance = Autowire.newInstance;
  autowire.getInstance = Autowire.getInstance;
  autowire.resetModule = Autowire.resetModule;
  autowire.getNewDependencies = Autowire.getNewDependencies;

  return autowire;
};

// instantiate Autowire
module.exports = Autowire;