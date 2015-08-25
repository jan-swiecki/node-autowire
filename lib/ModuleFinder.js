var PATH = require("path");
var Promise = require("bluebird");
var _ = require("lodash");
var fs = require("fs");

var log = require("./DebugLogger.js").getLogger().withParentPrefix().withColor(4);
var ClassHelper = require("./helpers/ClassHelper.js");

function ModuleFinder(instantiator) {
	this.importExtensions = ["", ".js", ".json"];
	this.importPaths = [
		"./",
		"./lib/"
	];
	this.cache = {};
	this.notFoundCache = {};
	this.alias = {};
	this.clazz = {};
	this.instantiator = instantiator;
	this.rootPath = "";
}

ClassHelper.attachClone(ModuleFinder);

//ModuleFinder.prototype.clone = function() {
//	var clone = new ModuleFinder(instantiator.clone());
//	_.extend(clone, this);
//	return clone;
//};

ModuleFinder.prototype.setRootPath = function(rootPath) {
	log.trace("setRootPath", rootPath);
	this.rootPath = rootPath;
	this._rootName = PATH.parse(this.rootPath).base;
	return this;
};

ModuleFinder.prototype.setParentModuleName = function(parentModuleName) {
	this.parentModuleName = parentModuleName;
};

ModuleFinder.prototype.addImportPath = function(path) {
	this.importPaths.push(path);
};

/**
 * Alias name to realname.
 *
 * e.g. addAlias("_", "lodash")
 *
 * @param alias
 * @param realname
 */
ModuleFinder.prototype.addAlias = function(alias, realname) {
	this.alias[alias] = realname;
};

/**
 * Attach object to name, so it is saved in cache
 * and returned when discovery is in place.
 *
 * @param name
 * @param object
 */
ModuleFinder.prototype.wire = function(name, object) {
	this.cache[name] = object;
};

/**
 * Attach class to className, so it can be instantiated via Autowire.
 *
 * @param className
 * @param clazz
 * @param singleton
 */
ModuleFinder.prototype.wireClass = function(className, clazz, singleton) {
	this.clazz[className] = {
		className: className,
		clazz: clazz,
		singleton: singleton || false
	};
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

ModuleFinder.prototype.maybeInstantiate = function(clazz, className) {
	var wiredClass;
	if(clazz && _.isFunction(clazz) && (wiredClass = this.findWiredClass(clazz, className))) {
		var instance = this.instantiator.create(clazz);
		if(! wiredClass.singleton) {
			self.addToCache(className, instance);
		}
		return instance;
	} else {
		return clazz;
	}
};

ModuleFinder.prototype.findWiredClass = function(clazz, className) {
	return _.find(this.clazz, function(c){
		return c.clazz === clazz || c.className === className;
	});
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
			_importPaths.push(realPath);
			break;
		}

		if(lastRealPath === realPath) {
			break;
		}

		_importPaths.push(realPath);

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
	var self = this;

	var alias = this.alias[paramName];
	if(alias) {
		log.debug("[%s] Discover module \"%s\" (alias of \"%s\")", self.parentModuleName, paramName, alias);
		paramName = alias;
	} else {
		log.debug("[%s] Discover module \"%s\"", self.parentModuleName, paramName);
	}

	// try cache
	if(this.notFoundCache[paramName]) {
		log.trace("[%s] Marked as not found \"%s\"", self.parentModuleName, paramName);
		return undefined;
	}

	if(this.cache[paramName]) {
		log.trace("[%s] Found in cache \"%s\"", self.parentModuleName, paramName);
		return this.cache[paramName];
	}

	// check if we need to instantiate class
	var c = this.clazz[paramName];
	if(c) {
		log.trace("[%s] Found as wired class \"%s\", returning instance", self.parentModuleName, paramName);
		var instance = this.instantiator.create(c.clazz);
		if(instance) {
			if(c.singleton) {
				this.cache[paramName] = instance;
			}

			return instance;
		}
	}

	var ret = undefined;

	// try node_modules
	if(tryImport(paramName)) {
		ret = self.maybeInstantiate(ret);
		return ret;
	}

	var extendedImportPaths = this.getExtendedImportPaths(this.importPaths);

	// resolve paths relative to current execution path
	var importPaths = _(extendedImportPaths)
		.map(function(p) {
			if(PATH.isAbsolute(p)) {
				return p;
			} else {
				return PATH.join(self.rootPath, p);
			}
		})
		.map(_.ary(PATH.resolve, 1))
		.filter(fs.existsSync)
		.value();

	log.trace("[%s] importPaths = %s", self.parentModuleName, importPaths);

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

	ret = self.maybeInstantiate(ret);
	return ret;

	function tryImport(name) {
		try {
			log.trace("[%s] Trying \"%s\"", self.parentModuleName, name);

			var lib = require(name);

			log("[%s] Found lib: \"%s\" resolved to \"%s\"", self.parentModuleName, paramName, name);

			ret = lib;

			return true;
		} catch(ex) {
			//if(! ex.message.match(new RegExp("Cannot find module '"+ _.escapeRegExp(path)+"'"))) {
			if(! ex.message.match(new RegExp("Cannot find module "))) {
				exit = true;
				log.error("[%s] Error while discovering for \"%s\"", self.parentModuleName, paramName, ex);
				throw ex;
			}
			return false;
		}
	}
};

module.exports = ModuleFinder;
