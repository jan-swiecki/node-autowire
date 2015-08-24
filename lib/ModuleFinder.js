var PATH = require("path");
var Promise = require("bluebird");
var _ = require("lodash");
var fs = require("fs");

var log = require("./DebugLogger.js").getLogger().withParentPrefix();

function ModuleFinder() {
	this.importExtensions = ["", ".js", ".json"];
	this.importPaths = [
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
 * Extend impot paths based on current context. Import up the directory tree until package.json is found.
 *
 * @param importPaths
 */
ModuleFinder.prototype.getExtendedImportPaths = function(importPaths) {
	var _importPaths = _.clone(importPaths);

	var i = 10; // MAX_DEPTH

	var path = "./";
	var lastRealPath = -1;
	while(i--) {
		path += "../";
		var realPath = PATH.resolve(path)+PATH.sep;
		if(fs.existsSync(realPath+"package.json")) {
			break;
		}

		if(lastRealPath === realPath) {
			break;
		}

		_importPaths.push(path);

		lastRealPath = realPath;
	}

	return _importPaths;
};

/**
 * Attempt to auto discover module by name.
 *
 * @param paramName by which we seek module
 * @returns imported module or undefined
 */
ModuleFinder.prototype.discoverModuleByName = function(paramName) {
	log.debug("Discover for %s", paramName);

	// try cache
	if(this.notFoundCache[paramName]) {
		//return Promise.reject("Module not found");
		return undefined;
	}

	if(this.cache[paramName]) {
		//return Promise.resolve(this.cache[paramName]);
		return this.cache[paramName];
	}

	var ret = undefined;
	var self = this;

	// try node_modules
	if(tryImport(paramName)) {
		return ret;
	}

	var extendedImportPaths = this.getExtendedImportPaths(this.importPaths);

	// resolve paths relative to current execution path
	var importPaths = _(extendedImportPaths)
		.map(_.ary(PATH.resolve, 1))
		.filter(fs.existsSync)
		.value();

	// try from modules
	_.each(self.importExtensions, function(ext) {
		var exit = false;
		_.each(importPaths, function(importPath) {
			var path = PATH.join(importPath, paramName+ext);
			if(tryImport(path)) {
				return false; // break
			}
		});
		if(typeof ret !== 'undefined' || exit === true) {
			return false;
		}
	});

	if(typeof ret === 'undefined') {
		this.notFoundCache[paramName] = true;
	}

	return ret;

	function tryImport(name) {
		try {
			log.trace("Trying \"%s\"", name);

			var lib = require(name);

			log("Found lib for "+paramName+": "+name);

			self.addToCache(paramName, lib);

			ret = lib;

			return true;
		} catch(ex) {
			//if(! ex.message.match(new RegExp("Cannot find module '"+ _.escapeRegExp(path)+"'"))) {
			if(! ex.message.match(new RegExp("Cannot find module "))) {
				exit = true;
				log.error("Error while discovering for \"%s\"", paramName, ex);
				throw ex;
			}
			return false;
		}
	}
};

module.exports = ModuleFinder;
