var esprima = require("esprima");
var $ = require("jquery-deferred");
var _ = require("lodash");
var PATH = require("path");
var ModuleHelper = require('./ModuleHelper')

var log = require("./DebugLogger.js").getLogger().withParentPrefix();

function getErrorResponse(functionName) {
  return {
    functionName: functionName,
    error: true
  };
}

function Injector(moduleFinder, codeMutator) {
  if(this instanceof Injector) {
    this.moduleFinder = moduleFinder;
    this.codeMutator = codeMutator;
    this.codeMutator.setInjector(this);

    this.safe = true;
    this.isAutowireModules = false;
  } else {
    return new Injector(moduleFinder, codeMutator);
  }
}

//clone versions
Injector.prototype.setAutowireModules = function(value) {
  this.isAutowireModules = value;
  return this;
};

Injector.prototype.setUnsafe = function() {
  this.safe = false;
  return this;
};

/**
 * Adds function func, parses it and stores data in injector.
 *
 * @param {Function} func
 * @returns {Injector} clone of this
 */
Injector.prototype.parseFunction = function(func) {
  var properties = {};

  if(! _.isFunction(func)) {
    throw new Error(`Argument not a function: ${func}`)
  }

  properties.func = func;


  // parse callback
  var funcStr = "("+properties.func+")";
  
  try {
    properties.parsedFunc = esprima.parse(funcStr);
  } catch(err) {
    console.error(`error parsing '${funcStr}'`);
    // console.error(ModuleHelper.getStackTrace().join("\n"));
    console.error(ModuleHelper.getStackTraceStr());
    throw err;
  }

  properties.funcName = properties.parsedFunc.body[0].expression.id;
  properties.funcName = properties.funcName ? properties.funcName.name : "[Anonymous]";

  properties.parsedParamNames = properties.parsedFunc.body[0].expression.params.map(function(v) { return v.name; });

  return properties;
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
Injector.prototype.exec = function(func, map) {
  log.trace("exec");
  return this.applyMap(func, undefined, map);
};

/**
 * Same as apply but match key names with argument names
 * and inject values accordingly.
 *
 * By default it is executed in safe mode,
 * which doesn't allow undefined values.
 *
 * @param func
 * @param bindTo
 * @param map object of keys mapped to values
 */
Injector.prototype.applyMap = function(func, bindTo, map) {
  log("applyMap, contextPath = %s", this.moduleFinder.currentPath);
  var self = this;

  if(! func) {
    throw new Error("No function defined");
  }

  var funcProperties = self.parseFunction(func);

  map = map || {};

  var arrayArgs = [];

  // get array of values to inject
  _(funcProperties.parsedParamNames).forEach(function(parsedParamName) {
    var wiredValue = map[parsedParamName];

    if(typeof wiredValue === 'undefined' && self.isAutowireModules === true) {
      // first time it will be slow, next time it should use cache
      wiredValue = self.moduleFinder.discoverModuleByName(parsedParamName);
      wiredValue = self.maybeInstantiate(wiredValue, parsedParamName);
      wiredValue = self.wrapWiredValue(parsedParamName, wiredValue);
    }

    if(typeof wiredValue === 'undefined' && self.safe) {
      var path = self.moduleFinder.currentPath + PATH.sep + self.moduleFinder.parentModuleName;
      throw new Error("Cannot inject variable \""+parsedParamName+"\" in function \""+funcProperties.funcName+"\" in file \""+path+"\": cannot find matching parameter (injecting in safe mode)");
    }

    arrayArgs.push(wiredValue);
  });

  return func.apply(bindTo, arrayArgs);
};

Injector.prototype.maybeInstantiate = function(clazz, name) {
  var self = this;

  if(_.isUndefined(clazz)) {
    return clazz
  } else if(clazz && _.isFunction(clazz)) {
    var instantiate = _.get(clazz, "autowire.instantiate");
    if(! instantiate) {
      self.moduleFinder.addToCache(name, clazz);
      return clazz;
    } else {
      log("Instantiating %s", clazz.name);
      var instance = self.instantiateClass(clazz);

      var singleton = _.get(clazz, "autowire.singleton");
      if(singleton) {
        log("Saving as singleton %s", clazz.name);
        self.moduleFinder.addToCache(name, instance);
      }
      return instance;
    }
  } else {
    if(! self.moduleFinder.moduleCache[name]) {
      self.moduleFinder.addToCache(name, clazz);
    }
    return clazz;
  }
};

Injector.prototype.instantiateClass = function(clazz) {
  var obj = Object.create(clazz["prototype"]);
  this.applyMap(clazz, obj);
  return obj;
};

Injector.prototype.wrapWiredValue = function(name, value) {
  if(_.isFunction(value) && value.executeOnEachImport === true) {
    log.trace("executing \"%s\" as function", name);
    return value();
  } else {
    return value;
  }
};

module.exports = Injector;