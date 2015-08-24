var _ = require("lodash");

/**
 * Attach class instance methods
 * as func properties.
 *
 * This way we achive class instance acting as function, e.g.:
 * f() and f.someMethod() is possible.
 *
 * @param func
 * @param instance
 * @param prototypes in ascending order (bottom-top) without clazz prototype
 */
function extend(func, instance, prototypes) {
	_.each(prototypes, function(f, fName){
		if(_.isFunction(instance[fName])) {
			func[fName] = function() {
				var args = Array.prototype.slice.call(arguments);
				return instance[fName].apply(func, args);
			}
		} else {
			func[fName] = instance[fName];
		}
	});
}

/**
 * Instantiate clazz with args for constructor
 *
 * @param clazz
 * @param args constructor arguments
 * @returns {clazz}
 */
function instantiate(clazz, args) {
	var logger = Object.create(clazz.prototype);
	clazz.apply(logger, args);
	return logger;
}

/**
 * Instantiate class with args and functionize it with func.
 *
 * @param extendPrototypes in ascending order (bottom-top) without clazz prototype
 * @param func
 * @returns {function(this:*)|*}
 */
function functionize(clazz, args, extendPrototypes, func) {
	extendPrototypes = extendPrototypes || [];

	var logger = instantiate(clazz, args);

	func = func.bind(logger);

	extendPrototypes.push(clazz.prototype);

	// wire prototypes
	_.each(extendPrototypes, function(proto){
		extend(func, logger, proto);
	});

	// wire direct properties
	_.extend(func, logger);

	return func;
}

module.exports = {
	functionize: functionize
};