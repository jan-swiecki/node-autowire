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

function short(obj) {
  const str = ""+obj;
  if(str.length > 20) {
    return str.substring(0, 20) + "...";
  } else {
    return str;
  }
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
    properties.parsedParams = properties.parsedFunc.body[0].expression.params.map(parseParam);
    properties.type = 'function';
  } else if(expression.type === 'ClassExpression') {
    const constructors = properties.parsedFunc.body[0].expression.body.body.filter(
      x => x.type === 'MethodDefinition' && x.kind === 'constructor'
    );
      
    properties.type = 'class';
    
    if(constructors.length === 0) {
      log.warn(`Cannot find constructor for class ${properties.funcName}`);
      properties.parsedParams = [];
    } else if(constructors.length > 1) {
      throw new Error("Too many constructors");
    } else {
      const constructor = constructors[0];
      properties.parsedParams = constructor.value.params.map(parseParam);
    }
  } else {
    throw new Error("Unsupported type: "+expression.type);
  }

  return properties;

  function parseParam(v) {
    const ret = {};
    if(v.type === 'Identifier') {
      ret.name = v.name;
    } else if(v.type === 'AssignmentPattern') {
      ret.name = v.left.name;
      ret.defaultValue = v.right.value;
    } else {
      throw new Error(`Injector: parseFunction: unrecognized type: ${v.type}`);
    }

    return ret;
  }
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
  return _(funcProperties.parsedParams).map(function(parsedParam) {
    var wiredValue = typeof map[parsedParam.name] !== 'undefined' ? map[parsedParam.name] : parsedParam.defaultValue;

    if(typeof wiredValue === 'undefined' && self.isAutowireModules === true) {
      if(deepInject) {
        wiredValue = self.getInstance(parsedParam.name, map);
      } else {
        wiredValue = self.getInstance(parsedParam.name);
      }
    }

    log("[getWiredParameters] parsedParam=%s, wiredValue=%s", parsedParam.name, short(wiredValue));

    if(typeof wiredValue === 'undefined' && self.safe) {
      var path = self.moduleFinder.currentPath + PATH.sep + self.moduleFinder.parentModuleName;
      throw new Error("Cannot inject variable \""+parsedParam.name+"\" in function \""+funcProperties.funcName+"\" in file \""+path+"\": cannot find matching parameter (injecting in safe mode)");
    }

    return wiredValue;
  }).value();
}

/**
 * @param name name of class name or class itself
 * @param overrideMap parameters to override during injection phase
 */
Injector.prototype.getInstance = function(name, overrideMap = {}) {
  let wiredValue;

  if(_.isString(name)) {
    // first time it will be slow, next time it should use cache
    wiredValue = this.moduleFinder.discoverModuleByName(name);
  } else {
    wiredValue = name;
    name = undefined;
  }
  wiredValue = this.maybeMixClass(wiredValue, name);
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

// PROTOTYPE FEATURE
// There we want to mix static class properties and methods with mixin
Injector.prototype.maybeMixClass = function(clazz, name) {
  const is_class = _.isFunction(clazz) && _.isFunction(clazz.constructor);

  if(! is_class) {
    return clazz;
  }

  let mixins = _.get(clazz, "autowire.mixins");
  if(mixins) {
    if(! _.isArray(mixins)) {
      mixins = [mixins];
    }

    const iMax = mixins.length;
    let i = 0;
    for(; i < iMax; i++) {
      log("(WARNING PROTOTYPE FEATURE) Mixing class with "+mixins[i]);

      // mix class with mixin_class
      // TODO PROTOTYPE this is potentially dangerous
      let mixin_class = this.getInstance(mixins[i]);
      _.mixin(clazz, mixin_class);
    }
  }

  return clazz;
}

Injector.prototype.maybeInstantiate = function(clazz, name, overrideMap = {}) {
  var self = this;

  if(_.isUndefined(clazz)) {
    return clazz;
  } else if(clazz && _.isFunction(clazz)) {
    var instantiate = _.get(clazz, "autowire.instantiate");
    if(! instantiate) {
      if(name) {
        self.moduleFinder.addToCache(name, clazz);
      }

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
        if(! name) {
          throw new Error('Cannot save instance as singleton if name is undefined');
        }
        self.moduleFinder.addToCache(name, instance);
      }
      return instance;
    }
  } else {
    if(name && ! self.moduleFinder.moduleCache[name]) {
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
    log("Instantiating as function prototype: "+clazz.name);
    obj = Object.create(clazz["prototype"]);
    this.applyMap(clazz, obj, overrideMap);
  } else if(funcProperties.type === 'class') {
    log("Instantiating as class: "+clazz.name);
    const arrayArgs = this.getWiredParameters(funcProperties, overrideMap);
    obj = new (Function.prototype.bind.apply(clazz, [null].concat(arrayArgs)));
  } else {
    throw new Error("Undefined type: "+funcProperties.type);
  }

  let mixins = _.get(clazz, "autowire.mixins");
  if(mixins) {
    if(! _.isArray(mixins)) {
      mixins = [mixins];
    }

    const iMax = mixins.length;
    let i = 0;
    for(; i < iMax; i++) {
      log("Mixing instance with instance of "+mixins[i]);
      
      // mix instantiated instance with mixin instance
      let mixin_class = this.getInstance(mixins[i]);
      if(! mixin_class) {
        throw new Error('Cannot find mixin_class for: '+mixins[i]);
      }
      let mixin_instance = this.instantiateClass(mixin_class);
      _.mixin(obj, mixin_instance);
      
      // mix methods because lodash doesn't do that
      Object.getOwnPropertyNames(mixin_class.prototype)
      .filter(p => p !== 'constructor')
      .forEach(p => {
        const method = mixin_instance[p];
        if(_.isFunction(method)) {
          obj[p] = method.bind(obj);
        }
      });
    }
  }

  let proxyName = _.get(clazz, "autowire.proxy");
  if(proxyName) {
    log("Proxying with "+proxyName);
    // inject proxy by name
    let proxy = this.getInstance(proxyName);

    // wrap by proxy
    obj = proxy(obj);
  }

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