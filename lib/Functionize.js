/**
 * Functionizator of classes.
 *
 * I call functionization a process of converting
 * class instance to function, while preserving class
 * properties.
 *
 * E.g.:
 *
 *     var Functionize = require("./Functionize.js");
 *
 *     function Person(firstName, lastName) {
 *         this.firstName = firstName;
 *         this.lastName = lastName;
 *     }
 *
 *     var person1 = Functionize(Person, ["Luke", "Skywalker"], function(separator) {
 *       return this.firstName + separator + this.lastName;
 *     });
 *
 *     var person2 = new Person("a", "b");
 *
 *     person1(" "); // Luke Skywalker
 *     person1("_"); // Luke_Skywalker
 *     person1.firstName; // Luke
 *
 *     person2(" "); // Error
 *
 * @type {exports|module.exports}
 */
var _ = require("lodash");
var uuid = require('node-uuid');
var util = require("util");

/**
 * Attach class instance methods
 * as func properties.
 *
 * This way we achive class instance acting as function, e.g.:
 * f() and f.someMethod() is possible.
 *
 * TODO: Right now prototype methods are wired
 *       directly to object, so we loose true
 *       prototypical inheritance and for example
 *       prototype methods start to be own properties.
 *
 *       Try to mitigate this, e.g. create dynamically
 *       new prototypes.
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
	var instance = Object.create(clazz.prototype);
	clazz.apply(instance, args);
	return instance;
}

/**
 * Return function that is binded to itself.
 *
 * func = func.bind(func) doesn't work, because
 * bind returns new function, so references change.
 *
 * @param func
 * @returns func bind to func
 */
function bindToSelf(func) {
	var f = function() {
		var args = Array.prototype.slice.call(arguments);
		return func.apply(f, args);
	};
	return f;
}

/**
 * Instantiate class with args and functionize it with func.
 *
 * @param extendPrototypes in ascending order (bottom-top) without clazz prototype
 * @param func
 * @returns {function(this:*)|*}
 */
function functionize(clazz, args, extendPrototypes, func) {
	if(_.isUndefined(func)) {
		func = extendPrototypes;
		extendPrototypes = undefined;
	}

	extendPrototypes = extendPrototypes || [];

	var instance = instantiate(clazz, args);

	// 1. copy func, so we don not work on the same object
	// when we execute functionize more times with
	// the same function
	// 2. bind to itself, so we can use `this` nicely

	// <s>I. Doesn't work, because we share func instance with others</s>
	// It does work actaully, see IV below
	//var f = function() {
	//	var args = Array.prototype.slice.call(arguments);
	//	return func.apply(f, args);
	//};

	// II. Doesn't work, because references change
	//func = func.bind(func)

	// TODO: write CodeMutation print-eval of function
	// TODO: with scope auto-detection and auto-wiring.

	// III. simple ugly print-eval, but we do copy successfully
	//func = eval("(function() { return "+func.toString()+"; })");
	//func = eval("("+func.toString()+")");

	// IV. Solved
	// This should be clone, because we create new function
	// It doesn't matter that we bind original `func`, because
	// we use it as stateless black box.
	var func = bindToSelf(func);

	extendPrototypes.push(clazz.prototype);

	// wire prototypes
	_.each(extendPrototypes, function(proto){
		extend(func, instance, proto);
	});

	// wire direct properties
	_.extend(func, instance);

	return func;
}

module.exports = functionize;