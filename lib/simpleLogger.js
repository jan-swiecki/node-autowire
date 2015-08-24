var PATH = require("path");
var stackTrace = require('stack-trace');
var _ = require("lodash");

function SimpleLogger(name) {
	this.date = true;
	this.level = 0;
	this.stackTraceDepth = 0;
	this.name = name;
	this.levelToCode = ["", "FATAL", "ERROR", "WARNING", "INFO", "DEBUG", "TRACE"];
	this.loggerNameSeparator = "";
}

SimpleLogger.prototype.init = function() {
	if(! this.name) {
		this.updateLoggerName();
	}
};

SimpleLogger.prototype.updateLoggerName = function() {
	this.name = this.getLoggerName().toUpperCase();
};

SimpleLogger.prototype.noDate = function() {
	this.date = false;
	require.cache[module.id].exports = this;
	return this;
};

SimpleLogger.prototype.setLevel = function(level) {
	this.level = level;
	require.cache[module.id].exports = this;
	return this;
};

SimpleLogger.prototype.formatDate = function(date) {
	var str = date.toISOString().replace(/T/, " ");
	var ret = str.substring(0,str.length - 2);
	return "["+ret+"]";
};

SimpleLogger.prototype.getLoggerName = function() {
	var self = this;
	var parentFilename = stackTrace.get()[self.stackTraceDepth].getFileName();

	var loggerName = PATH.parse(parentFilename).base
		.replace(/\.[A-z]+$/, "")
		.replace(/([A-Z])/g, function(m, char) {
			return self.loggerNameSeparator+m;
		});

	if(loggerName[0] === self.loggerNameSeparator) {
		loggerName = loggerName.substr(1, loggerName.length - 1);
	}

	return loggerName;
};

SimpleLogger.prototype.log = function(message, level) {
	var self = this;

	var msg = [];

	level = level || 0;

	if(level < self.level) {
		return false;
	}

	if(level === 0) {
		msg.push("["+self.name+"]");
	} else if(level === 1 || level === 2 || level === 3) {
		msg.push("["+self.name+"] ["+self.levelToCode[level]+"]");
		if(message instanceof Error) {
			message = message.toString()+"\n"+message.stack;
		}
	} else {
		msg.push("["+self.name+"] ["+self.levelToCode[level]+"]");
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

function X() {
}

var x = new X();

module.exports = SimpleLogger;

function instantiate(clazz, name) {
	var logger = Object.create(clazz.prototype);
	clazz.call(logger, name);
	logger.init();
	return logger;
};

// attach logger (class instance) methods
// as fn properties (fn is function, or any object).
function extend(fn, logger, proto) {
	_.each(proto, function(f, fName){
		fn[fName] = function() {
			var args = Array.prototype.slice.call(arguments);
			logger[fName].apply(logger, args);
		}
	});
}

module.exports.getLogger = function(name, clazz, extendPrototypes) {
	clazz = clazz || SimpleLogger;
	extendPrototypes = extendPrototypes || [];

	extendPrototypes.push(SimpleLogger.prototype);

	var logger = instantiate(clazz, name);

	var ret = function(message, level) {
		logger.log(message, level);
	};

	_.each(extendPrototypes, function(proto){
		extend(ret, logger, proto);
	});

	return ret;
};