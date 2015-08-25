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
var Instantiator = require("./lib/Instantiator.js");

var codeMutator = new CodeMutator();
var instantiator = new Instantiator();
var moduleFinder = new ModuleFinder(instantiator);

var injector = Injector.create(moduleFinder, codeMutator).withAutowireModules();

// injector depends on moduleFinder depends on instantiator depends on injector #yolo
instantiator.setInjector(injector);

var API = function(func) {
  var filename = ModuleHelper.getParentModule(1).filename;
  var parsed = PATH.parse(filename);
  log.info("Autowiring module \"%s\" with rootPath \"%s\"", parsed.base, parsed.dir);

  var inj = injector.withFunc(func).withRootPath(parsed.dir, parsed.base);
  log("inj.rootPath = %s", inj.moduleFinder.rootPath);
  return inj.exec();
  //return injector(func);
};

function getParentModuleName() {
  var parentFilename = ModuleHelper.getParentModule(1).filename;
  return PATH.parse(parentFilename).base;
}

API.instantiate = function(clazz) {
  var obj = Object.create(clazz["prototype"]);
  var constructor = injector.attachSafe(clazz).autoWireModules();
  constructor.applyInject(obj);
  return obj;
};

API.wireClass = function(className, clazz, singleton) {
  moduleFinder.wireClass(className, clazz, singleton);
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
  moduleFinder.addImportPath(absPath);
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


