var util = require("util");
var SimpleLogger = require("./SimpleLogger.js");
var debug = require("debug");
var _ = require("lodash");
var stackTrace = require("stack-trace");
var PATH = require("path");

var ModuleHelper = require("./ModuleHelper.js");

var CodeMutator = require("./CodeMutator.js");
var codeMutator = new CodeMutator();

// TODO: Switch API from
// TODO:     var log = require("simple-logger").getLogger()
// TODO: to
// TODO:     var log = require("simple-logger")
// TODO: Do automatic function/instance rewiring and context switching on first run.
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

	this._debug = debug(this.loggerName);
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

DebugLogger.prototype.withColor = function(color) {
	this.initIfNeeded();
	this._debug.color = color;
	return this;
};

DebugLogger.prototype.log = function() {
	var self = this;

	var args = Array.prototype.slice.call(arguments);
	var level = args[args.length - 1];

	if(level > self.level) {
		return false;
	}

	self.initIfNeeded();

	args = _.slice(args, 0, args.length - 1);

	_.each(args, function(v, k){
		if(v instanceof Error) {
			args[k] = v.toString()+"\n"+v.stack;
		}
	});

	//args[0] = self.levelToCode[level] + " " + args[0];

	this._debug.apply(undefined, args);
};

function wireLoggers() {
	var levelToCodeExpr = codeMutator.getRValue(SimpleLogger, {
		"left": {
			"property": {
				"name": "levelToCode"
			}
		}
	});

	// remove first element
	levelToCodeExpr.ast.elements = _.slice(levelToCodeExpr.ast.elements, 1, levelToCodeExpr.ast.length);

	var levelToCode = levelToCodeExpr.toValue();

	_.each(levelToCode, function(code, level) {
		level = level + 1; // because we removed first element

		// actual logger function alias
		// e.g. log.info = ...
		DebugLogger.prototype[code.toLowerCase()] = function(message) {
			var args = Array.prototype.slice.call(arguments);
			args.push(level);
			this.log.apply(this, args)
		}
	});
}

wireLoggers();

module.exports = DebugLogger;

module.exports.getLogger = function(name, depth) {

    if(! _.isUndefined(name) && ! _.isString(name)) {
        throw new Error("Name must be string: "+name);
    }

    depth = depth || 0;

	// compute prefix
	var parentParentModule = ModuleHelper.getParentModule(depth + 2);
	var prefix = SimpleLogger.resolvePrefix(parentParentModule);

	// compute name
	var parentModule = ModuleHelper.getParentModule(depth + 1);

    //console.log("parentModule.filename", parentModule.filename, depth);
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
