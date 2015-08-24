var util = require("util");
var SimpleLogger = require("./SimpleLogger.js");
var debug = require("debug");
var _ = require("lodash");
var stackTrace = require("stack-trace");
var PATH = require("path");

var ModuleHelper = require("./ModuleHelper.js");

function DebugLogger(loggerName, prefix) {
	SimpleLogger.call(this, loggerName);
	this.prefix = prefix;
	this.updatePrefix = false;
	this.stackTraceDepth = 7;
}

util.inherits(DebugLogger, SimpleLogger);

DebugLogger.prototype.init = function() {
	SimpleLogger.prototype.init.call(this);

	this.levelToCode = _.map(this.levelToCode, function(code) {
		return code.toLowerCase();
	});

	this.debug = debug(this.loggerName);
};

DebugLogger.prototype.updateLoggerName = function() {
	//console.log("yepp " + this.loggerName, this.prefix, this.updatePrefix);
	//console.log(ModuleHelper.getStackTrace());
	if(this.prefix && this.updatePrefix) {
		this.loggerName = this.prefix + ":" + this.loggerName;
	}

	this.loggerName = this.loggerName.toLowerCase();
};


DebugLogger.prototype.withParentPrefix = function() {
	this.updatePrefix = true;
	this.initIfNeeded();
	return this;
};

DebugLogger.prototype.log = function(message, level) {
	var self = this;

	self.initIfNeeded();

	var msg = [];

	level = level || 0;

	//console.log(self.loggerName, level, self.level);

	if(level > self.level) {
		return false;
	}

	if(level === 0) {
	} else if(level === 1 || level === 2 || level === 3) {
		msg.push(self.levelToCode[level]);
		if(message instanceof Error) {
			message = message.toString()+"\n"+message.stack;
		}
	} else {
		msg.push(self.levelToCode[level]);
	}

	//if(self.date) {
	//	msg.push(self.formatDate(new Date()));
	//}

	msg.push(message);

	//process.stdout.write(msg.join(" ")+"\n");

	this.debug.apply(undefined, msg);
};

module.exports = DebugLogger;

module.exports.getLogger = function(name) {
	// compute prefix
	var parentParentModule = ModuleHelper.getParentModule(2);
	var prefix = SimpleLogger.resolvePrefix(parentParentModule);

	// compute name
	var parentModule = ModuleHelper.getParentModule(1);
	if(! name) {
		name = PATH.parse(parentModule.filename).base.replace(/\.js$/, "");
	}

	var logger = SimpleLogger.getLogger(name, prefix, DebugLogger, [DebugLogger.prototype]);

	// register itself inside parent module
	parentModule.simpleLogger = {
		// logger name could be changed (logger modifies name passed to it)
		getName: function() {
			return logger.getLoggerName()
		}
	};

	//if(name === "test") {
	//	console.log("parent ->", _.get(parentModule, "filename"));
	//	console.log("parent parent ->", _.get(parentParentModule, "filename"), _.result(parentParentModule, "simpleLogger.getName"));
	//	console.log("prefix ->", prefix);
	//	console.log("===================");
	//
	//	setTimeout(logger.getLoggerName, 1000);
	//}

	return logger;
};
