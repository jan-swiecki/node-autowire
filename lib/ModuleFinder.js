var PATH = require("path");
var Promise = require("bluebird");
var _ = require("lodash");

var log = require("./SimpleLogger.js").getLogger();

function ModuleFinder() {
	this.importExtensions = ["", ".js", ".json"];
	this.importPaths = [
		"",
		"./",
		"./lib/"
	];
	this.cache = {};
	this.notFoundCache = {};
}

ModuleFinder.prototype.addImportPath = function(path) {
	this.importPaths.push(path);
};

ModuleFinder.prototype.addToCache = function(paramName, _module) {
	this.cache[paramName] = _module;
};

ModuleFinder.prototype.markAsNotFound = function(paramName) {
	this.notFoundCache[paramName] = true;
};

ModuleFinder.prototype.invalidateCache = function() {
	this.cache = {};
	this.notFoundCache = {};
};

/**
 * Attempt to auto discover module by name.
 *
 * @param paramName by which we seek module
 * @returns imported module or undefined
 */
ModuleFinder.prototype.discoverModuleByName = function(paramName) {
	if(this.notFoundCache[paramName]) {
		return Promise.reject("Module not found");
	}

	if(this.cache[paramName]) {
		return Promise.resolve(this.cache[paramName]);
	}

	var self = this;

	// resolve paths relative to current execution path
	var importPaths = _.map(self.importPaths, function(path) {
		if(path !== "") {
			return PATH.resolve(path)+PATH.sep;
		} else {
			return path;
		}
	});

	var ret = undefined;

	// try from modules
	_.each(self.importExtensions, function(ext) {
		var exit = false;
		_.each(importPaths, function(importPath) {
			var path = importPath+paramName+ext;
			try {
				log.trace("Trying "+path);
				var lib = require(path);

				log("Found lib for "+paramName+": "+path);

				self.addToCache(paramName, lib);

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

module.exports = ModuleFinder;