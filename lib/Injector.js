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
    this.addAutowireId = false;
  } else {
    return new Injector(moduleFinder, codeMutator);
  }
}

//clone versions
Injector.prototype.setAutowireModules = function(value) {
  this.isAutowireModules = value;
  return this;
};

Injector.prototype.setAddAutowireId = function(value) {
  this.addAutowireId = value;
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
  let properties = {};

  if(! _.isFunction(func)) {
    throw new Error(`Argument not a function: ${func}`)
  }

  properties.func = func;

  // parse callback
  let funcStr = "("+properties.func+")";
  
  try {
    properties.parsedFunc = esprima.parse(funcStr);
  } catch(err) {
    console.error(`error parsing '${funcStr}'`);
    // console.error(ModuleHelper.getStackTrace().join("\n"));
    console.error(ModuleHelper.getStackTraceStr());
    throw err;
  }

  const id = properties.parsedFunc.body[0].expression.id;
  properties.funcName = id ? id.name : "[Anonymous]";

  const expression = properties.parsedFunc.body[0].expression;
  
  if(expression.type === 'FunctionExpression' || expression.type === 'ArrowFunctionExpression') {
    properties.parsedParamNames = properties.parsedFunc.body[0].expression.params.map(function(v) { return v.name; });
    properties.type = 'function';
  } else if(expression.type === 'ClassExpression') {
    const constructors = properties.parsedFunc.body[0].expression.body.body.filter(
      x => x.type === 'MethodDefinition' && x.kind === 'constructor'
    );
      
    properties.type = 'class';
    
    if(constructors.length === 0) {
      log.warn(`Cannot find constructor for class ${properties.funcName}`);
      properties.parsedParamNames = [];
    } else if(constructors.length > 1) {
      throw new Error("Too many constructors");
    } else {
      const constructor = constructors[0];
      properties.parsedParamNames = constructor.value.params.map(function(v) { return v.name; });
    }
  } else {
    throw new Error("Unsupported type: "+expression.type);
  }

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
 * @param deepInject if true then map will be injected in all subsequent
 *                   class instances instantiated by autowire starting
 *                   at this execution tree
 */
Injector.prototype.exec = function(func, map, deepInject = false) {
  log.trace("exec");
  return this.applyMap(func, undefined, map, deepInject);
};

/**
 * @param func function or class
 * @param map
 * @param deepInject if true then map will be injected in all subsequent
 *                   class instances instantiated by autowire starting
 *                   at this execution tree
 */
Injector.prototype.getWiredParameters = function(funcProperties, map, deepInject = false) {
  const self = this;
  map = map || {};
  return _(funcProperties.parsedParamNames).map(function(parsedParamName) {
    var wiredValue = map[parsedParamName];

    if(typeof wiredValue === 'undefined' && self.isAutowireModules === true) {
      if(deepInject) {
        wiredValue = self.getInstance(parsedParamName, map);
      } else {
        wiredValue = self.getInstance(parsedParamName);
      }
    }

    log("[getWiredParameters] parsedParamName=%s, wiredValue=%s", parsedParamName, wiredValue);

    if(typeof wiredValue === 'undefined' && self.safe) {
      var path = self.moduleFinder.currentPath + PATH.sep + self.moduleFinder.parentModuleName;
      throw new Error("Cannot inject variable \""+parsedParamName+"\" in function \""+funcProperties.funcName+"\" in file \""+path+"\": cannot find matching parameter (injecting in safe mode)");
    }

    return wiredValue;
  }).value();
}

/**
 * @param name
 * @param map
 */
Injector.prototype.getInstance = function(name, overrideMap = {}) {
  // first time it will be slow, next time it should use cache
  let wiredValue = this.moduleFinder.discoverModuleByName(name);
  wiredValue = this.maybeInstantiate(wiredValue, name, overrideMap);
  wiredValue = this.wrapWiredValue(name, wiredValue);
  return wiredValue;
}

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
Injector.prototype.applyMap = function(func, bindTo, map, deepInject = false) {
  log("applyMap, contextPath = %s", this.moduleFinder.currentPath);
  var self = this;

  if(! func) {
    throw new Error("No function defined");
  }

  // var funcProperties = funcProperties || self.parseFunction(func);
  var funcProperties = self.parseFunction(func);

  // get array of values to inject
  const arrayArgs = self.getWiredParameters(funcProperties, map, deepInject);
  
  return func.apply(bindTo, arrayArgs);
};

Injector.prototype.getUniqueId = function(name) {
  return (name ? name+'@' : '')+Math.random().toString(36).substring(2, 8);
}

Injector.prototype.maybeInstantiate = function(clazz, name, overrideMap = {}) {
  var self = this;

  if(_.isUndefined(clazz)) {
    return clazz
  } else if(clazz && _.isFunction(clazz)) {
    var instantiate = _.get(clazz, "autowire.instantiate");
    if(! instantiate) {
      self.moduleFinder.addToCache(name, clazz);

      if(self.addAutowireId && _.isObject(clazz)) {
        clazz._autowireId = self.getUniqueId(name);
        clazz._autowireIsInstance = false;
      }
      
      return clazz;
    } else {
      log("Instantiating %s", clazz.name);
      var instance = self.instantiateClass(clazz, overrideMap);
      
      if(self.addAutowireId) {
        instance._autowireId = self.getUniqueId(name);
        instance._autowireIsInstance = true;
      }

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
    if(self.addAutowireId && _.isObject(clazz)) {
      clazz._autowireId = self.getUniqueId(name);
      clazz._autowireIsInstance = false;
    }
    return clazz;
  }
};

Injector.prototype.instantiateClass = function(clazz, overrideMap = {}) {
  const funcProperties = this.parseFunction(clazz);

  let obj;
  if(funcProperties.type === 'function') {
    log("Instantiating as function prototype");
    obj = Object.create(clazz["prototype"]);
    this.applyMap(clazz, obj, overrideMap);
  } else if(funcProperties.type === 'class') {
    log("Instantiating as class");
    const arrayArgs = this.getWiredParameters(funcProperties, overrideMap);
    obj = new (Function.prototype.bind.apply(clazz, [null].concat(arrayArgs)));
  } else {
    throw new Error("Undefined type: "+funcProperties.type);
  }

  let proxyName = _.get(clazz, "autowire.proxy");
  if(proxyName) {
    // inject proxy by name
    let proxy = this.getInstance(proxyName);

    // wrap by proxy
    return proxy(obj);
  } else {
    return obj;
  }
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