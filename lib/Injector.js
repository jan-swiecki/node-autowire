var esprima = require("esprima");
var $ = require("jquery-deferred");
var _ = require("lodash");
var PATH = require("path");

var Promise = require("bluebird");

var log = require("./DebugLogger.js").getLogger().withParentPrefix();

var Functionize = require("./Functionize.js");

function getErrorResponse(functionName) {
  return {
    functionName: functionName,
    error: true
  };
}

function Injector(moduleFinder, codeMutator) {
  this.moduleFinder = moduleFinder;
  this.codeMutator = codeMutator;
  this.codeMutator.setInjector(this);

  this.safe = true;
  this.isAutowireModules = false;
}

/**
 * Reset state
 */
Injector.prototype.reset = function() {
  Injector.call(this, this.moduleFinder, this.codeMutator);
  this.moduleFinder.reset();
  this.codeMutator.reset();
};


Injector.prototype.clone = function() {
  var ret = module.exports.create(this.moduleFinder.clone(), this.codeMutator.clone());
  //var ret = new Injector(this.moduleFinder, this.codeMutator);
  // commented out because ret is Function _.extend misbehaves
  // _.extend(ret, this);
  //ret.extend(this);

  // TODO: read `extend`s TODO and make this automatic
  ret.safe = this.safe;
  ret.isAutowireModules = this.isAutowireModules;
  ret.func = this.func;
  ret.funcName = this.funcName;
  ret.parsedFunc = this.parsedFunc;
  ret.parsedParamNames = this.parsedParamNames;

  return ret;
};

/**
 * TODO: ClassHelper prototypes problems.
 *       Right now this will NOT WORK (methods
 *       are directly wired and they are
 *       own properties).
 *
 * @param source
 */
Injector.prototype.extend = function(source) {
  var self = this;
  _.each(Object.keys(source), function(key){
    // TODO: Not working, methods return true on hasOwnProperty
    if(key !== "_uuid" && source.hasOwnProperty(key)) {
      self[key] = source[key];
    }
  });
};

Injector.prototype.addImportPath = function(path) {
  this.importPath.push(path);
  return this;
};

//Injector.prototype.withAutowireModules = function() {
//  this.isAutowireModules = true;
//  return this;
//};
//
//Injector.prototype.withUnsafe = function() {
//  this.safe = false;
//  return this;
//};

//clone versions
Injector.prototype.withAutowireModules = function() {
  var clone = this.clone();
  clone.isAutowireModules = true;
  return clone;
};

Injector.prototype.withUnsafe = function() {
  var clone = this.clone();
  clone.safe = false;
  return clone;
};

Injector.prototype.withRootPath = function(rootPath, parentModule) {
  log.trace("withRootPath", rootPath);
  var clone = this.clone();
  clone.moduleFinder.setRootPath(rootPath);
  clone.moduleFinder.setParentModuleName(parentModule);
  return clone;
};

Injector.prototype.setRootPath = function(rootPath, parentModule) {
  this.moduleFinder.setRootPath(rootPath);
  this.moduleFinder.setParentModuleName(parentModule);
  return this;
};


/**
 * Adds function func, parses it and stores data in injector.
 *
 * @param {Function} func
 * @returns {Injector} clone of this
 */
Injector.prototype.withFunc = function(func) {
  var clone = this.clone();

  clone.func = func;

  // parse callback
  clone.parsedFunc = esprima.parse("("+clone.func+")");

  clone.funcName = clone.parsedFunc.body[0].expression.id;
  clone.funcName = clone.funcName ? clone.funcName.name : "[Anonymous]";

  clone.parsedParamNames = clone.parsedFunc.body[0].expression.params.map(function(v) { return v.name; });

  return clone;
};

/**
 * Execute inject. Similar to applyMap, but
 * without bindTo argument.
 *
 * By default it is executed in safe mode,
 * which doesn't allow undefined values.
 *
 * @param map object of keys mapped to values
 */
Injector.prototype.exec = function(map) {
  log.trace("exec");
  return this.applyMap(undefined, map);
};

/**
 * Same as apply but match key names with argument names
 * and inject values accordingly.
 *
 * By default it is executed in safe mode,
 * which doesn't allow undefined values.
 *
 * @param map object of keys mapped to values
 */
Injector.prototype.applyMap = function(bindTo, map) {
  log("applyMap, rootPath = %s", this.moduleFinder.rootPath);
  var self = this;

  if(! self.func) {
    throw new Error("No function defined");
  }

  map = map || {};

  var arrayArgs = [];

  // get array of values to inject
  _(self.parsedParamNames).forEach(function(parsedParamName) {
    var wiredValue = map[parsedParamName];

    if(typeof wiredValue === 'undefined' && self.isAutowireModules === true) {
      // first time it will be slow, next time it should use cache
      wiredValue = self.moduleFinder.discoverModuleByName(parsedParamName);
    }

    if(typeof wiredValue === 'undefined' && self.safe) {
      throw new Error("Cannot inject variable \""+parsedParamName+"\" in function "+self.funcName+": cannot find matching parameter (injecting in safe mode)");
    }

    arrayArgs.push(wiredValue);
  }).value();

  return self.func.apply(bindTo, arrayArgs);
};

module.exports = {};

module.exports.create = function(moduleFinder, codeMutator) {
  return Functionize(Injector, [moduleFinder, codeMutator], function(callback) {
    var f = this.withFunc(callback);
    return f.exec();
  });
};
