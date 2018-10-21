/**
 * Autowire module.
 *
 * @author Jan Święcki <jan.swiecki@gmail.com>
 */

// get modules
var PATH = require("path");
var fs = require("fs");
var _ = require('lodash');

var log = require("./lib/DebugLogger.js").getLogger("autowire");
log.uniqueId = Math.random().toString(36).substring(2, 6);
log(`Initializing Autowire module v${require('./package.json').version}`);

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

  log.trace("[getModuleFinder] parentModule.filename = %s", parentModule.filename);

  var parsed = PATH.parse(filename);

  var moduleFinder = new ModuleFinder();

  moduleFinder.setCurrentPath(parsed.dir);
  moduleFinder.setParentModuleName(parsed.base);
  moduleFinder.findProjectRoot();

  return moduleFinder;
}

function loadLocalConfig(projectRoot, autowireInstance) {
  let p = PATH.join(projectRoot, 'autowire.js');
  if(fs.existsSync(p)) {
    let f = require(p);
    if(! _.isFunction(f)) {
      throw new Error(`Config from '${p}' is not a function`);
    }
    log.info("Loading local config from \"%s\"", p);
    f(autowireInstance);
  }
}

function init() {
  if(! Autowire.initialized) {
    log.info("Initializing");

    let moduleFinder = getModuleFinder();
  
    Autowire.moduleFinder = moduleFinder;
  
    let codeMutator = new CodeMutator();
  
    log("========= LEVEL %s =========", level);
    log("Autowiring module \"%s\" with rootPath \"%s\"", moduleFinder.currentPath, moduleFinder.parentModuleName);
  
    loadLocalConfig(moduleFinder.projectRoot, Autowire);
  
    if(Autowire.moduleFinderIgnoreFolders) {
      log.info('Ignoring folders: %s', Autowire.moduleFinderIgnoreFolders);
      moduleFinder.addIgnoreFolders(Autowire.moduleFinderIgnoreFolders);
    }
    moduleFinder.generateNameCache();

    let injector = Injector(moduleFinder, codeMutator)
      .setAutowireModules(true);
  
    if(Autowire.addAutowireId) {
      log.info('Setting addAutowireId = true');
      injector.setAddAutowireId(true);
    }
  
    Autowire.injector = injector;
    Autowire.initialized = true;
  }
}

function Autowire(func) {
  level = level + 1;
  
  init();

  var ret = Autowire.injector.exec(func);

  log("========= /LEVEL %s =========", level);

  level = level - 1;

  return ret;
}

Autowire.getModuleByName = function(moduleName) {
  init();
  var fn = new Function(moduleName, "return "+moduleName+";");
  return Autowire(fn);
};

Autowire.alias = function(alias, realname) {
  init();
  log("aliasing %s=%s", alias, realname);
  Autowire.moduleFinder.addAlias(alias, realname);
};

Autowire.wire = function(name, object) {
  init();
  log("wiring object as %s", name);
  Autowire.moduleFinder.addToCache(name, object);
};

Autowire.getInjector = function() {
  init();
  return Autowire.injector;
}

/**
 * Include submodule e.g. Autowire.include('urijs/src/URITemplate')
 * or include module at other path e.g. Autowire.include('c:\my_modules\urijs')
 *
 * In second case module must have package.json present in its folder.
 *
 * @param path
 */
Autowire.include = function(path) {
  init();
  log("include path %s", path);
  var p = PATH.resolve(path);

  // if file doesn't exists or if it exists then if it is file
  if(! fs.existsSync(p) || fs.lstatSync(p).isFile()) {
    Autowire.alias(PATH.parse(p).base.replace(/\.(?:js|json)$/, ''), path);
  } else if(fs.lstatSync(p).isDirectory()) {
    var packageJsonPath = p+PATH.sep+"package.json";
    if(fs.existsSync(packageJsonPath)) {
      var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      var absPath = PATH.resolve(p+PATH.sep+packageJson.main);

      Autowire.moduleFinder.updateNameCache(packageJson.name, absPath);
    } else {
      throw new Error("Cannot include library, cannot find package.json at \""+packageJsonPath+"\"");
    }
  } else {
    log.error("Cannot include path \""+path+"\"");
  }
};

module.exports = Autowire;