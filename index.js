/**
 * Autowire module, singleton.
 *
 * @author Jan �wi�cki <jan.swiecki@gmail.com>
 */

// get modules
var stackTrace = require('stack-trace');
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
var Instantiator = require("./lib/Instantiator.js");

function Autowire(codeMutator, moduleFinder, injector, instantiator) {
  this.moduleFinder = moduleFinder;
  this.codeMutator = codeMutator;
  this.injector = injector;
  this.instantiator = instantiator;
}

Autowire.prototype.reset = function() {
  var dependencies = Autowire.getNewDependencies();

  this.codeMutator = dependencies.codeMutator;
  this.moduleFinder = dependencies.moduleFinder;
  this.injector = dependencies.injector;
  this.instantiator = dependencies.instantiator;

  //this.moduleFinder.reset();
  //this.codeMutator.reset();
  //this.injector.reset();
  //this.instantiator.reset();
};

/**
 * Execute autowire logic on func
 *
 * Wire dependencies and execute then return result
 *
 * @param func
 * @returns {Array|{index: number, input: string}}
 */
Autowire.prototype.run = function(func) {
  var filename = ModuleHelper.getParentModule(1).filename;
  var parsed = PATH.parse(filename);
  log.info("Autowiring module \"%s\" with rootPath \"%s\"", parsed.base, parsed.dir);

  var inj = this.injector.withFunc(func).withRootPath(parsed.dir, parsed.base);
  log("inj.rootPath = %s", inj.moduleFinder.rootPath);
  return inj.exec();
  //return injector(func);
};

function getParentModuleName() {
  var parentFilename = ModuleHelper.getParentModule(1).filename;
  return PATH.parse(parentFilename).base;
}

Autowire.instantiate = function(clazz) {
  throw "todo";
  var obj = Object.create(clazz["prototype"]);
  var constructor = injector.attachSafe(clazz).autoWireModules();
  constructor.applyInject(obj);
  return obj;
};

Autowire.prototype.wireClass = function(className, clazz, singleton) {
  this.moduleFinder.wireClass(className, clazz, singleton);
};

/**
 * Add path to moduleFinder.
 *
 * Path is resolved to absolute path from callee context.
 *
 * @param path
 */
Autowire.prototype.addImportPath = function(path) {
  var absPath = PATH.join(PATH.parse(ModuleHelper.getParentModule(1).filename).dir, path);
  this.moduleFinder.addImportPath(absPath);
};

Autowire.prototype.alias = function(alias, realname) {
  this.moduleFinder.addAlias(alias, realname);
};

Autowire.prototype.wire = function(name, object) {
  this.moduleFinder.wire(name, object);
};

//ClassHelper.attachClone(Autowire);

Autowire.prototype.clone = function() {
  return new Autowire(codeMutator.clone(), moduleFinder.clone(), injector.clone(), instantiator.clone());
};

//Autowire.prototype.getInstance = function() {
//  return this.clone();
//};

Autowire.getInstance = function(codeMutator, moduleFinder, injector, instantiator) {
  return Functionize(Autowire, [codeMutator, moduleFinder, injector, instantiator], function(func) {
    // depth=2 because we are functionized
    var filename = ModuleHelper.getParentModule(2).filename;
    var parsed = PATH.parse(filename);
    log.info("Autowiring module \"%s\" with rootPath \"%s\"", parsed.base, parsed.dir);

    return this.injector
        .withFunc(func)
        .withRootPath(parsed.dir, parsed.base)
        .exec();
  });
};

Autowire.resetModule = function() {
  throw "todo";
  //log.warn("Resetting global module instance of Autowire");
  //require.cache[module.filename].exports = Autowire.newInstance();
};

Autowire.getNewDependencies = function() {
  // instantiate classes
  var codeMutator = new CodeMutator();
  var instantiator = new Instantiator();
  var moduleFinder = new ModuleFinder(instantiator);
  var injector = Injector.create(moduleFinder, codeMutator).withAutowireModules();

  // #yolo
  // injector depends on moduleFinder depends on instantiator depends on injector
  instantiator.setInjector(injector);

  return {
    codeMutator: codeMutator,
    instantiator: instantiator,
    moduleFinder: moduleFinder,
    injector: injector
  };

};

Autowire.newInstance = function() {
  var dependencies = Autowire.getNewDependencies();

  var autowire = Autowire.getInstance(
      dependencies.codeMutator,
      dependencies.moduleFinder,
      dependencies.injector,
      dependencies.instantiator
  );

  autowire.Injector = Injector;
  autowire.ModuleFinder = ModuleFinder;
  autowire.CodeMutator = CodeMutator;
  autowire.Autowire = Autowire;
  autowire.newInstance = Autowire.newInstance;
  autowire.getInstance = Autowire.getInstance;
  autowire.resetModule = Autowire.resetModule;

  return autowire;
};

// instantiate Autowire
module.exports = Autowire.newInstance();