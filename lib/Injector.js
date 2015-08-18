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

function Injector() {
  this.importExtensions = ["", ".js", ".json"];
  this.importPaths = [
    "",
    "./",
    "./lib/"
  ];
  this.silently = false;
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
Injector.prototype.executeInjectObject = function(callback, keyToValue, parsedCallback, functionName) {
  var self = this;
  return new Promise(function(resolve, reject){
    var parsedParamNames = parsedCallback.body[0].expression.params.map(function(v) { return v.name; });

    var arrayArgs = [];
    var promise = undefined;

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
        resolve(returnValue, promise);
      } catch(ex) {
        //log.error(ex);
        reject(ex);
      }
    }
  });
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
      return resolve(self.executeInjectArray(callback, args, parsedCallback, functionName));
    } else if(_.isPlainObject(args)) {
      return resolve(self.executeInjectObject(callback, args, parsedCallback, functionName));
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

Injector.prototype.discoverValue = function(paramName) {
  var self = this;
  var ret = undefined;

  // resolve paths relative to current execution path
  var importPaths = _.map(self.importPaths, function(path) {
    if(path !== "") {
      return PATH.resolve(path)+PATH.sep;
    } else {
      return path;
    }
  });

  // try from modules
  _.each(self.importExtensions, function(ext) {
    var exit = false;
    _.each(importPaths, function(importPath) {
      var path = importPath+paramName+ext;
      try {
        log.trace("Trying "+path);
        var lib = require(path);

        log("Found lib for "+paramName+": "+path);

        ret = lib;

        return false;
      } catch(ex) {
        //if(! ex.message.match(new RegExp("Cannot find module '"+ _.escapeRegExp(path)+"'"))) {
        if(! ex.message.match(new RegExp("Cannot find module "))) {
          log.error(ex);
          exit = true;
          return false;
        }
      }
    });
    if(typeof ret !== 'undefined' || exit === true) {
      return false;
    }
  });

  return ret;
};

module.exports = Injector;
