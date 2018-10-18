var PATH = require("path");
var Promise = require("bluebird");
var _ = require("lodash");
var fs = require("fs");

var log = require("./DebugLogger.js").getLogger().withParentPrefix().withColor(4);
var ClassHelper = require("./helpers/ClassHelper.js");

/**
 * Initialization steps:
 *   moduleFinder.setCurrentPath(parsed.dir);
 *   moduleFinder.setParentModuleName(parsed.base);
 *   moduleFinder.findProjectRoot();
 *   [moduleFinder.addIgnoreFolders(Autowire.moduleFinderIgnoreFolders);]
 *   moduleFinder.generateNameCache();
 */
function ModuleFinder() {
  this.currentPath = "";

  this.moduleCache = {};
  this.notFoundCache = {};
  this.alias = {};
  this.wiredClasses = {};
  this.markedAsClass = {};

  // module name to absolute module root file path mapping
  this.nameCache = {};
  this.projectRoot = undefined;
  this.ignoreFolders = [];
}

ModuleFinder.prototype.addAlias = function(alias, realname) {
  this.alias[alias] = realname;
  return this;
};

ModuleFinder.prototype.addIgnoreFolders = function(paths) {
  if(_.isString(paths)) {
    this.ignoreFolders.push(paths);
  } else {
    this.ignoreFolders = this.ignoreFolders.concat(paths);
  }
}

ClassHelper.attachClone(ModuleFinder);

ModuleFinder.prototype.setCurrentPath = function(currentPath) {
  var self = this;
  log.trace("setCurrentPath", currentPath);
  self.currentPath = currentPath;
  self._currentName = PATH.parse(self.currentPath).base;
  return self;
};

ModuleFinder.prototype.setParentModuleName = function(parentModuleName) {
  this.parentModuleName = parentModuleName;
};

/**
 * Alias name to realname.
 *
 * e.g. addAlias("_", "lodash")
 *
 * @param alias
 * @param realname
 */
ModuleFinder.prototype.addAlias = function(alias, realname) {
  log("Aliasing \"%s\" = \"%s\"", alias, realname);
  this.alias[alias] = realname;
};

/**
 * Attach object to name, so it is saved in cache
 * and returned when discovery is in place.
 *
 * @param name
 * @param object
 */
ModuleFinder.prototype.wire = function(name, object) {
  this.moduleCache[name] = object;
};

ModuleFinder.prototype.addToCache = function(paramName, _module) {
  log.trace("Adding to cache \"%s\"", paramName);
  this.moduleCache[paramName] = _module;
};

ModuleFinder.prototype.markAsNotFound = function(paramName) {
  this.notFoundCache[paramName] = true;
};

ModuleFinder.prototype.invalidateCache = function() {
  this.nameCache = {};
  this.moduleCache = {};
  this.notFoundCache = {};
};

//ModuleFinder.prototype.maybeInstantiate = function(clazz, name) {
//  var self = this;
//
//  if(clazz && _.isFunction(clazz)) {
//    var instantiate = _.get(clazz, "autowire.instantiate");
//    if(! instantiate) {
//      self.addToCache(name, clazz);
//      return clazz;
//    } else {
//      log("[%s] instantiating %s", this.parentModuleName, clazz.name);
//      var instance = self.instantiateClass(clazz);
//
//      var singleton = _.get(clazz, "autowire.singleton");
//      if(singleton) {
//        log("[%s] saving as singleton %s", this.parentModuleName, clazz.name);
//        self.addToCache(name, instance);
//      }
//      return instance;
//    }
//  } else {
//    self.addToCache(name, clazz);
//    return clazz;
//  }
//};

//ModuleFinder.prototype.instantiateClass = function(clazz) {
//  var obj = Object.create(clazz["prototype"]);
//  this.injector.applyMap(clazz, obj);
//  return obj;
//};

ModuleFinder.prototype.findWiredClass = function(clazz, className) {
  return _.find(this.wiredClasses, function(c){
    return c.wiredClasses === clazz || c.className === className;
  });
};

/**
 * Extend impot paths based on current context. Import up the directory tree until package.json is found.
 *
 * @param importPaths
 */
ModuleFinder.prototype.getExtendedImportPaths = function(importPaths) {
  var _importPaths = _.clone(importPaths);

  var i = 10; // MAX_DEPTH

  var path = "./";
  var lastRealPath = -1;
  while(i--) {
    path += "../";
    var realPath = PATH.resolve(path)+PATH.sep;
    if(fs.existsSync(realPath+"package.json")) {
      _importPaths.push(realPath);
      break;
    }

    if(lastRealPath === realPath) {
      break;
    }

    _importPaths.push(realPath);

    lastRealPath = realPath;
  }

  return _importPaths;
};

/**
 * Attempt to auto discover module by name.
 *
 * @param paramName by which we seek module
 * @returns imported module or undefined
 */
ModuleFinder.prototype.discoverModuleByName = function(paramName) {
  var self = this;
  
  // compute alias
  var alias = this.alias[paramName];
  if(alias) {
    if(!_.isString(alias)) {
      throw new Error("Alias must be a string alias = \""+JSON.stringify(alias)+"\"");
    }
    log.debug("[%s] Discover module \"%s\" (alias of \"%s\")", self.parentModuleName, paramName, alias);
    paramName = alias;
  } else {
    log.debug("[%s] Discover module \"%s\"", self.parentModuleName, paramName);
  }

  // try cache
  if(this.notFoundCache[paramName]) {
    log.trace("[%s] Marked as not found \"%s\"", self.parentModuleName, paramName);
    return _return(undefined);
  }

  if(this.moduleCache[paramName]) {
    log.trace("[%s] Found in cache \"%s\"", self.parentModuleName, paramName);
    return _return(this.moduleCache[paramName]);
  }

  var ret = undefined;

  // try node_modules
  if(tryImport(paramName)) {
    //return self.maybeInstantiate(ret, paramName);
    return _return(ret);
  }

  // try stored name
  var absPath = self.nameCache[paramName];

  if(absPath) {
    log.trace("[%s] Found in name cache \"%s\" at \"%s\"", self.parentModuleName, paramName, absPath);
    if(tryImport(absPath)) {
      //return self.maybeInstantiate(ret, paramName);
      return _return(ret);
    }
  }

  // try sub module
  var _paramName = paramName.replace(/\$/g, '/');
  if(_paramName.indexOf('/') !== -1) {
    log.trace("[%s] Resolving submodule \"%s\"", self.parentModuleName, paramName)
    var ps = _paramName.split('/');
    var p = ps.shift();
    var subPath = ps.join('/');
    absPath = self.nameCache[p];
    log(`[${self.parentModuleName}] absPath = self.nameCache['${p}'];`);
    log(`[${self.parentModuleName}] absPath = ${absPath};`);
    if(absPath) {
      log.trace("[%s] Trying as sub module of \"%s\"", self.parentModuleName, p);

      log(`absPath = ${absPath}`);
      log(`subPath = ${subPath}`);
      var subAbsPath = PATH.resolve(PATH.parse(absPath).dir+PATH.sep+subPath);
      if(tryImport(subAbsPath)) {
        return _return(ret);
      }
    }
  }

  log.trace("[%s] Module not found \"%s\"", self.parentModuleName, paramName);

  // mark as not found
  this.notFoundCache[paramName] = true;
  return _return(ret);

  function _return(ret) {
    if(! _.isUndefined(ret)) {
      log("[%s] Returning found \"%s\"", self.parentModuleName, paramName);
    } else {
      log("[%s] Returning undefined, module \"%s\" not found", self.parentModuleName, paramName);
    }
    return ret;
  }

  function tryImport(name) {
    try {
      log.trace("[%s] Trying \"%s\"", self.parentModuleName, name);

      var lib = require(name);

      log("[%s] Found lib: \"%s\" resolved to \"%s\"", self.parentModuleName, paramName, name);

      ret = lib;

      return true;
    } catch(ex) {
      //if(! ex.message.match(new RegExp("Cannot find module "))) {
      if(! ex.message.match(new RegExp("Cannot find module '"+ _.escapeRegExp(name)+"'"))) {
        exit = true;
        log.error("[%s] Error while discovering for \"%s\"", self.parentModuleName, paramName, ex);
        throw ex;
      }
      //else {
      //  log("[%s] marking as not found \"%s\"", self.parentModuleName, name);
      //  self.notFoundCache[name] = true;
      //}
      return false;
    }
  }
};

/**
 * This is global, cross npm module object
 */
ModuleFinder.globalNameCache = {};
ModuleFinder.globalModuleCache = {};
ModuleFinder.globalAliases = {};

ModuleFinder.prototype.updateNameCache = function(name, absPath) {
  var self = this;
  /**
   * Don't store this names
   */
  var blackList = {
    "package": true
  };

  name = nameMapper(name);

  if(self.nameCache[name]) {
    log.error("[%s] Conflicting names \"%s\" at paths: \"%s\" and \"%s\")",
      self.parentModuleName, name, absPath, self.nameCache[name]);
  }

  if(blackList[name]) {
    log("[%s] Blacklisted \"%s\" at path \"%s\"", self.parentModuleName, name, absPath);
  } else {
    log("[%s] Saving %s -> %s", self.parentModuleName, name, absPath);
    self.nameCache[name] = absPath;
  }

  return self;

  function nameMapper(name) {
    // to camelCase
    if(name.indexOf('-') !== -1) {
      return name.split('-').map(function(str, i) {
        return (i === 0 ? str[0] : str[0].toUpperCase()) + str.substring(1);
      }).join('');
    }
    return name;
  }
};

ModuleFinder.prototype.findProjectRoot = function() {
  if(this.projectRoot) {
    return this.projectRoot;
  }

  let rootPath = findProjectRoot(this.currentPath);
  if(! rootPath) {
    throw new Error("Cannot find project root path from currentPath = \""+self.currentPath+"\"");
  }

  this.projectRoot = rootPath;

  /**
   * Going up the folder tree returns the first
   * folder with package.json present.
   *
   * @param startPath
   * @returns {*}
   */
  function findProjectRoot(startPath) {
    log.trace("findProjectRoot startPath = %s", startPath);
    if(isDiskRoot()) {
      if(hasPackageJson()) {
        return startPath;
      } else {
        throw new Error("Cannot find project root");
      }
    } else if(hasPackageJson()) {
      return startPath;
    } else {
      return findProjectRoot(PATH.resolve(startPath+PATH.sep+".."));
    }

    function hasPackageJson() {
      return fs.existsSync(startPath+PATH.sep+"package.json");
    }

    function isDiskRoot() {
      return startPath.match(/^([A-Z]:\\\\|\/)$/);
    }
  }
}

ModuleFinder.prototype.generateNameCache = function() {
  var self = this;

  var list = fs.readdirSync(self.currentPath);
  var rootPath = this.findProjectRoot();

  log("[%s] Project root \"%s\"", self.parentModuleName, rootPath);

  if(ModuleFinder.globalNameCache[rootPath]) {
    log("[%s] Found cached nameCache for current project root", self.parentModuleName);
    self.nameCache = ModuleFinder.globalNameCache[rootPath];
    self.moduleCache = ModuleFinder.globalModuleCache[rootPath];
    self.alias = ModuleFinder.globalAliases[rootPath];
    return ModuleFinder.globalNameCache[rootPath];
  }

  self.nameCache = ModuleFinder.globalNameCache[rootPath] = {};
  self.moduleCache = ModuleFinder.globalModuleCache[rootPath] = {};
  self.alias = ModuleFinder.globalAliases[rootPath] = {
    '_': 'lodash'
  };

  mapAllNames(rootPath);
  mapNodeModules(rootPath);

  /**
   * Saves absPath -> filename mapping in the map
   * @param path
   */
  function mapAllNames(path) {
    log("[%s] Mapping %s", self.parentModuleName, path);
    fs.readdirSync(path).forEach(function(p){
      var absPath = PATH.resolve(path+PATH.sep+p);
      var lstat = fs.lstatSync(absPath);

      if(lstat.isFile() && isModule(p)) {
        var name = getModuleName(p);
        self.updateNameCache(name, absPath);
      } else if(! isIgnoreFolder(p) && lstat.isDirectory()) {
        mapAllNames(absPath);
      }
    });

    function isIgnoreFolder(folderName) {
      return !folderName || folderName === 'node_modules' || folderName[0] === '.' || self.ignoreFolders.includes(folderName);
    }

    function isModule(p) {
      return p.match(/\.(js|json)$/);
    }

    function getModuleName(p) {
      return p.replace(/\.(js|json)$/, '');
    }
  }

  function mapNodeModules(rootPath) {
    var nodeModulesPath = rootPath+PATH.sep+"node_modules";
    if(fs.existsSync(nodeModulesPath)) {
      log("[%s] Mapping node_modules at \"%s\"", self.parentModuleName, nodeModulesPath);
      fs.readdirSync(nodeModulesPath).forEach(function(dir){
        var dirAbsPath = nodeModulesPath+PATH.sep+dir;
        if(fs.lstatSync(dirAbsPath).isDirectory()) {

          var packageJsonPath = dirAbsPath+PATH.sep+"package.json";

          if(fs.existsSync(packageJsonPath)) {
            var packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
            var moduleName = packageJson.name;
            var moduleMain = packageJson.main;

            if(moduleName && moduleMain) {
              var absPath = PATH.resolve(dirAbsPath+PATH.sep+moduleMain);
              self.updateNameCache(moduleName, absPath);
            }

          }

        }
      });

    }
  }
};

module.exports = ModuleFinder;
