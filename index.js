/**
 * Autowire module.
 *
 * @author Jan Święcki <jan.swiecki@gmail.com>
 */

// get modules
var PATH = require("path");
var fs = require("fs");

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

  log.trace("[getModuleFinder] parentModule.filename = %s", parentModule.filename);

  var parsed = PATH.parse(filename);

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

  log("========= LEVEL %s =========", level);
  log.info("Autowiring module \"%s\" with rootPath \"%s\"", moduleFinder.currentPath, moduleFinder.parentModuleName);

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

/**
 * Include submodule e.g. Autowire.include('urijs/src/URITemplate')
 * or include module at other path e.g. Autowire.include('c:\my_modules\urijs')
 *
 * In second case module must have package.json present in its folder.
 *
 * @param path
 */
Autowire.include = function(path) {
  var p = PATH.resolve(path);
  if(! fs.existsSync(p) || fs.lstatSync(p).isFile()) {
    Autowire.alias(PATH.parse(p).base.replace(/\.(?:js|json)$/, ''), path);
  } else if(fs.lstatSync(p).isDirectory()) {
    var packageJsonPath = p+PATH.sep+"package.json";
    if(fs.existsSync(packageJsonPath)) {
      var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      var moduleFinder = getModuleFinder();

      var absPath = PATH.resolve(p+PATH.sep+packageJson.main);

      moduleFinder.updateNameCache(packageJson.name, absPath);
    } else {
      throw new Error("Cannot include library, cannot find package.json at \""+packageJsonPath+"\"");
    }
  } else {
    log.error("Cannot include path \""+path+"\"");
  }
};

module.exports = Autowire;