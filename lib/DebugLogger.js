var util = require("util");
var SimpleLogger = require("./SimpleLogger.js");
var debug = require("debug");

function DebugLogger(name) {
	SimpleLogger.call(this, name);
	this.stackTraceDepth = 7;
}

util.inherits(DebugLogger, SimpleLogger);

DebugLogger.prototype.init = function() {
	SimpleLogger.prototype.init.call(this);
	this.debug = debug(this.name);
};

DebugLogger.prototype.log = function(message, level) {
	var self = this;

	var msg = [];

	level = level || 0;

	if(level < self.level) {
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

DebugLogger.prototype.updateLoggerName = function() {
	this.name = this.getLoggerName();
};

module.exports = DebugLogger;

module.exports.getLogger = function(name) {
	return SimpleLogger.getLogger(name, DebugLogger, [DebugLogger.prototype]);
};
