var esprima = require("esprima");
var $ = require("jquery-deferred");
var _ = require("lodash");
var PATH = require("path");

var Promise = require("bluebird");

var log = require("./SimpleLogger.js").getLogger();

function getErrorResponse(functionName) {
  return {
    functionName: functionName,
    error: true
  };
}

function Injector(moduleFinder, codeMutator) {
  this.silently = false;
  this.moduleFinder = moduleFinder;
  this.codeMutator = codeMutator;
  this.codeMutator.setInjector(this);
}

Injector.prototype.addImportPath = function(path) {
  this.importPath.push(path);
  return this;
};

Injector.prototype.silently = function() {
  this.silently = true;
  return this;
};

Injector.prototype.executeInjectArray = function(callback, argsArray, parsedCallback, functionName) {
  return new Promise(function(resolve, reject){
    try {
      var returnValue = callback.apply(undefined, argsArray);
      resolve(returnValue);
    } catch(ex) {
      //log.error(ex);
      reject(ex);
    }
  });
};

/**
 *
 * @param callback
 * @param keyToValue mapping of keys to values which should be wired to arguments (by keys)
 * @param parsedCallback
 * @param functionName
 * @returns {bluebird|exports|module.exports} Promise resolved with returnValue, functionName (parsed) and (optional) promise.
 */
Injector.prototype.applyInjectAutoDiscover = function(callback, keyToValue, parsedCallback, functionName) {
  var self = this;
  return new Promise(function(resolve, reject){
    var parsedParamNames = parsedCallback.body[0].expression.params.map(function(v) { return v.name; });

    var arrayArgs = [];

    _(parsedParamNames).forEach(function(parsedParamName, index) {
      var wiredValue = keyToValue[parsedParamName];

      if(typeof wiredValue === 'undefined') {
        wiredValue = self.discoverValue(parsedParamName);
      }

      if(typeof wiredValue === 'undefined' && self.silently === false) {
        throw new Error("Cannot wire variable "+parsedParamName+" in function "+functionName);
      }

      arrayArgs.push(wiredValue);
    }).value();

    log("arrayArgs = "+arrayArgs);

    if(! self.silently && _.any(arrayArgs, _.isUndefined)) {
      log.debug("Cannot match all arguments in function. keyToValue = "+JSON.stringify(keyToValue)+", function: "+functionName);
      reject("Cannot match all arguments in function");
    } else {
      try {
        var returnValue = callback.apply(undefined, arrayArgs);
        resolve(returnValue);
      } catch(ex) {
        reject(ex);
      }
    }
  });
};

Injector.prototype.applyInject = function(callback, keyToValue, parsedCallback, functionName) {
  var self = this;
  return new Promise(function(resolve, reject){
    var parsedParamNames = parsedCallback.body[0].expression.params.map(function(v) { return v.name; });

    var arrayArgs = [];

    _(parsedParamNames).forEach(function(parsedParamName, index) {
      var wiredValue = keyToValue[parsedParamName];

      if(typeof wiredValue === 'undefined') {
        wiredValue = self.discoverValue(parsedParamName);
      }

      if(typeof wiredValue === 'undefined' && self.silently === false) {
        throw new Error("Cannot wire variable "+parsedParamName+" in function "+functionName);
      }

      arrayArgs.push(wiredValue);
    }).value();

    log("arrayArgs = "+arrayArgs);

    if(! self.silently && _.any(arrayArgs, _.isUndefined)) {
      log.debug("Cannot match all arguments in function. keyToValue = "+JSON.stringify(keyToValue)+", function: "+functionName);
      reject("Cannot match all arguments in function");
    } else {
      try {
        var returnValue = callback.apply(undefined, arrayArgs);
        resolve(returnValue);
      } catch(ex) {
        reject(ex);
      }
    }
  });
};

Injector.prototype.wrapSafe = function(callback) {
  return this.wrap(callback, true);
};

Injector.prototype.wrap = function(callback, safe) {
  var self = this;

  if(typeof safe === 'undefined') {
    safe = false;
  }

  // parse callback
  var parsedCallback = esprima.parse("("+callback+")");
  var functionName = parsedCallback.body[0].expression.id;

  functionName = functionName ? functionName.name : "[Anonymous]";

  var parsedParamNames = parsedCallback.body[0].expression.params.map(function(v) { return v.name; });

  // create wrapper callback
  var newCallback = callback.bind({});

  newCallback.applyInject = function(keyToValue) {
    var isAutoDiscoverModules = false;

    var callbackContext = this;
    var arrayArgs = [];

    // get array of values to inject
    _(parsedParamNames).forEach(function(parsedParamName) {
      var wiredValue = keyToValue[parsedParamName];

      if(typeof wiredValue === 'undefined' && isAutoDiscoverModules === true) {
        // first time it will be slow, next time it should use cache
        wiredValue = self.moduleFinder.discoverModuleByName(parsedParamName);
      }

      if(typeof wiredValue === 'undefined' && safe) {
        throw new Error("Cannot inject variable "+parsedParamName+" in function "+functionName+": cannot find matching parameter (injecting in safe mode)");
      }

      arrayArgs.push(wiredValue);
    }).value();

    return callback.apply(undefined, arrayArgs);
  };

  // enable autowiring of modules
  newCallback.autoWireModules = function() {
    var _newCallback = newCallback.bind({});

    // replace applyInject with new applyInject with modified value of variable isAutoDiscoverModules
    _newCallback.applyInject =
        self.codeMutator
            .withScope({
              parsedParamNames: parsedParamNames,
              self: self,
              safe: safe,
              callback: callback
            })
            .newVariableDeclarationValue(newCallback.applyInject, "isAutoDiscoverModules", true);

    return _newCallback;
  };

  return newCallback;
};

// args - if object -> wire to callback arguments by key
//      - if array  -> callback.apply(undefined, args)
Injector.prototype.executeInject = function(callback, args) {
  var self = this;

  var parsedCallback = esprima.parse("("+callback+")");
  var functionName = parsedCallback.body[0].expression.id;

  functionName = functionName ? functionName.name : "[Anonymous]";

  log("Inject into "+functionName);

  return new Promise(function(resolve, reject){
    if(_.isArray(args)) {
      return resolve(callback.apply(undefined, args));
    } else if(_.isPlainObject(args)) {
      return resolve(self.applyInject(callback, args, parsedCallback, functionName));
    } else {
      return reject(new Error("Unprocessable type of args: "+args));
    }
  });
};

Injector.prototype.getFunctionName = function(callback) {
  var parsedCallback = esprima.parse("("+callback+")");
  var functionName = parsedCallback.body[0].expression.id;
  return functionName ? functionName.name : null;
}


module.exports = Injector;
