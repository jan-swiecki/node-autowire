var esprima = require("esprima");
var $ = require("jquery-deferred");
var _ = require("lodash");

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
  ]
}

Injector.prototype.addImportPath = function(path) {
  this.importPath.push(path);
  return this;
}

Injector.prototype.executeInject = function(callback, args) {
  var parsedCallback = esprima.parse("("+callback+")");
  var functionName = parsedCallback.body[0].expression.id;
  var self = this;

  log("functionName = "+functionName);

  if(_.isArray(args)) {
    try {
      return {
        returnValue: callback.apply(undefined, args),
        functionName: functionName
      };
    } catch(ex) {
      log.error(ex);
      return getErrorResponse(functionName);
    }
  } else if(_.isPlainObject(args)) {
    var callbackParamNames = parsedCallback.body[0].expression.params.map(function(v) { return v.name; });

    var arrayArgs = [];
    var dfd = undefined;
    _(callbackParamNames).forEach(function(paramName,key) {

      var value = args[paramName];

      if(typeof value === 'undefined') {
        if(paramName === 'Async') {
          dfd = $.Deferred();
          log("Found Async, attaching Deferred");
          value = function(data){
            dfd.resolve(data);
          };
        } else {
          value = self.tryProvideValue(paramName);
        }
      }

      arrayArgs.push(value);
    }).value();

    log("arrayArgs = "+arrayArgs);

    try {
      return {
        returnValue: callback.apply(undefined, arrayArgs),
        functionName: functionName,
        dfd: dfd
      };
    } catch(ex) {
      log.error(ex);
      return getErrorResponse(functionName);
    }

  } else {
    throw "Unprocessable type of args: "+args;
  }
}

Injector.prototype.tryProvideValue = function(paramName) {
  var self = this;
  var ret = undefined;

  // try from modules
  _.each(self.importExtensions, function(ext) {
    var exit = false;
    _.each(self.importPaths, function(importPath) {
      var path = importPath+paramName+ext;
      try {
        log.trace("Trying "+path);
        var lib = require(path);

        log("Found lib for "+paramName+": "+path);

        ret = lib;

        return false;
      } catch(ex) {
        if(! ex.message.match(new RegExp("Cannot find module '"+path+"'"))) {
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
}

module.exports = Injector;
