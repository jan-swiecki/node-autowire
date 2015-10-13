var PATH = require("path");
var stackTrace = require('stack-trace');
var _ = require("lodash");

var Functionize = require("./Functionize.js");

function SimpleLogger(loggerName) {
  this.date = true;
  this.stackTraceDepth = 0;
  this.loggerName = loggerName;
  this.levelToCode = ["", "FATAL", "ERROR", "WARNING", "INFO", "DEBUG", "TRACE"];
  this.codeToLevel = {
    "NONE": 0,
    "DISABLE": 0,
    "FATAL": 1,
    "ERROR": 2,
    "WARNING": 3,
    "INFO": 4,
    "DEBUG": 5,
    "TRACE": 6
  };

  this.level = this.codeToLevel["INFO"];

  this.loggerNameSeparator = "";
  this.initialized = false;

  // dynamic interval for changing
  // of debug dynamic levels
  this.dynamicInterval = 0;
}

SimpleLogger.prototype.initIfNeeded = function() {
  if(! this.initialized) {
    this.init();
  }
};

SimpleLogger.prototype.init = function() {
  var self = this;

  this.updateLoggerName();
  console.log("DEBUG_LEVEL", process.env["DEBUG_LEVEL"]);
  if(process.env["DEBUG_LEVEL"]) {
    self.updateLevelFromEnv();
  }

  if(process.env["DEBUG_DYNAMIC"]) {
    this.dynamicInterval = setInterval(function(){
      self.updateLevelFromEnv();
    }, 1000);
  }

  this.initialized = true;
};

SimpleLogger.prototype.updateLevelFromEnv = function() {
  var level = this.getLevelFromEnv();
  if(level !== -1) {
    //console.log("["+this.loggerName+"]", "setting level", level);
    this.level = level;
  }
};

SimpleLogger.prototype.getLevelFromEnv = function() {
  var self = this;
  var levels = process.env["DEBUG_LEVEL"];

  if(level && levels === this._lastDebugLevel) {
    return -1;
  }

  this._lastDebugLevel = levels;

  if(levels) {
    var level = _(levels.split(";"))
      .map(function(x){
        return x.split("=");
      }).filter(function(x){
        return x[0] === self.loggerName;
      }).map(function(x){
        return x[1];
      })
      .first();
    if(level) {
      return self.codeToLevel[level.toUpperCase()];
    } else {
      return -1;
    }
  } else {
    return -1;
  }
};

SimpleLogger.prototype.getLoggerName = function() {
  return this.loggerName;
};

SimpleLogger.prototype.updateLoggerName = function() {
  if(! this.loggerName) {
    var self = this;

    this.loggerName = this.loggerName
      .replace(/([A-Z])/g, function(m, char) {
        return self.loggerNameSeparator+m;
      });

    if(this.loggerName[0] === self.loggerNameSeparator) {
      this.loggerName = this.loggerName.substr(1, this.loggerName.length - 1);
    }

    this.loggerName = this.loggerName.toUpperCase();
  }
};

SimpleLogger.prototype.noDate = function() {
  this.date = false;
  return this;
};

SimpleLogger.prototype.setLevel = function(level) {
  if(_.isString(level)) {
    this.level = this.codeToLevel[level.toUpperCase()];
  } else {
    this.level = level;
  }
  return this;
};

// check DebugLogger
SimpleLogger.prototype.withParentPrefix = function() {
  return this;
};

SimpleLogger.prototype.formatDate = function(date) {
  var str = date.toISOString().replace(/T/, " ");
  var ret = str.substring(0,str.length - 2);
  return "["+ret+"]";
};

//SimpleLogger.prototype.computeLoggerName = function() {
//  var self = this;
//  var parentFilename = stackTrace.get()[self.stackTraceDepth].getFileName();
//
//  var loggerName = PATH.parse(parentFilename).base
//    .replace(/\.[A-z]+$/, "")
//    .replace(/([A-Z])/g, function(m, char) {
//      return self.loggerNameSeparator+m;
//    });
//
//  if(loggerName[0] === self.loggerNameSeparator) {
//    loggerName = loggerName.substr(1, loggerName.length - 1);
//  }
//
//  return loggerName;
//};

SimpleLogger.prototype.log = function(message, level) {
  var self = this;

  self.initIfNeeded();

  var msg = [];

  level = level || 0;

  if(level > self.level) {
    return false;
  }

  if(level === 0) {
    msg.push("["+self.loggerName+"]");
  } else if(level === 1 || level === 2 || level === 3) {
    msg.push("["+self.loggerName+"] ["+self.levelToCode[level]+"]");
    if(message instanceof Error) {
      message = message.toString()+"\n"+message.stack;
    }
  } else {
    msg.push("["+self.loggerName+"] ["+self.levelToCode[level]+"]");
  }

  if(self.date) {
    msg.push(self.formatDate(new Date()));
  }

  msg.push(message);

  process.stdout.write(msg.join(" ")+"\n");
};

SimpleLogger.prototype.fatal = function(message) {
  this.log(message, 1);
};

SimpleLogger.prototype.error = function(message) {
  this.log(message, 2);
};

SimpleLogger.prototype.warn = function(message) {
  this.log(message, 3);
};

SimpleLogger.prototype.info = function(message) {
  this.log(message, 4);
};

SimpleLogger.prototype.debug = function(message) {
  this.log(message, 5);
};

SimpleLogger.prototype.trace = function(message) {
  this.log(message, 6);
};

module.exports = SimpleLogger;

module.exports.getLogger = function(name, prefix, clazz) {
  var args = [name, prefix];

  clazz = clazz || SimpleLogger;

  return Functionize(clazz, args, function () {
    var args = Array.prototype.slice.call(arguments);
    args.push(4);
    //console.log(this);
    this.log.apply(this, args);
  });
};

module.exports.resolvePrefix = function(parentModule) {
  var name = _.result(parentModule, "simpleLogger.getName");

  if(name) {
    return name;
  } else {
    return false;
  }
};