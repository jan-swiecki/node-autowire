var esprima = require("esprima");
var $ = require("jquery-deferred");
var _ = require("lodash");
var PATH = require("path");

var Promise = require("bluebird");

var log = require("./DebugLogger.js").getLogger();

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
}

Injector.prototype.addImportPath = function(path) {
  this.importPath.push(path);
  return this;
};

Injector.prototype.wrapSafe = function(callback) {
  return this.wrap(callback, true);
};

Injector.prototype.wrap = function(callback, safe) {
  var fn = this.attach(callback, safe);
  return function(keyToValue) {
    return fn.executeInject(keyToValue);
  }
};

Injector.prototype.attachSafe = function(callback) {
  return this.attach(callback, true);
};

Injector.prototype.attach = function(callback, safe) {
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

  newCallback.originalName = functionName;
  newCallback.executeInject = function(keyToValue, bindTo) {
    keyToValue = keyToValue || {};

    var isAutoDiscoverModules = false;

    var callbackContext = this;
    var arrayArgs = [];

    // get array of values to inject
    _(parsedParamNames).forEach(function(parsedParamName) {
      var wiredValue = keyToValue[parsedParamName];

      if(typeof wiredValue === 'undefined' && isAutoDiscoverModules === true) {
        // first time it will be slow, next time it should use cache
        log("discoverModuleByName -> "+parsedParamName);
        wiredValue = self.moduleFinder.discoverModuleByName(parsedParamName);
        log("parsedParamName -> "+parsedParamName+", "+(!!wiredValue));
      }


      if(typeof wiredValue === 'undefined' && safe) {
        throw new Error("Cannot inject variable \""+parsedParamName+"\" in function "+functionName+": cannot find matching parameter (injecting in safe mode)");
      }

      arrayArgs.push(wiredValue);
    }).value();

    return callback.apply(bindTo, arrayArgs);
  };

  newCallback.applyInject = function(bindTo, keyToValue) {
    return newCallback.executeInject(keyToValue, bindTo);
  };

  // enable autowiring of modules
  newCallback.autoWireModules = function() {
    var _newCallback = newCallback.bind({});

    _newCallback.originalName = newCallback.originalName;

    // replace executeInject with new executeInject with modified value of variable isAutoDiscoverModules
    _newCallback.executeInject =
        self.codeMutator
            .withScope({
              parsedParamNames: parsedParamNames,
              self: self,
              safe: safe,
              callback: callback,
              functionName: functionName,
              log: log
            })
            .newVariableDeclarationValue(newCallback.executeInject, "isAutoDiscoverModules", true);

    _newCallback.applyInject = function(bindTo, keyToValue) {
      return _newCallback.executeInject(keyToValue, bindTo);
    };

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
      return resolve(self.executeInject(callback, args, parsedCallback, functionName));
    } else {
      return reject(new Error("Unprocessable type of args: "+args));
    }
  });
};

Injector.prototype.getFunctionName = function(callback) {
  var callbackString;
  var isNative = _.isNative(callback);
  if(isNative) {
    callbackString = callback.toString().replace(/\[native code\]/, "");
  } else {
    callbackString = callback.toString();
  }
  var parsedCallback = esprima.parse("("+callbackString+")");
  var functionName = parsedCallback.body[0].expression.id;
  return functionName ? functionName.name :
      (isNative ? "[native]" : "[annonymous]");
};

module.exports = Injector;
