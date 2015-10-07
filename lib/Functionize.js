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

/**
 * Instantiate class with args and functionize it with func.
 *
 * @param clazz
 * @param args
 * @param func
 * @returns {function(this:*)|*}
 */
function functionize(clazz, args, func) {
  // 1. copy func, so we don not work on the same object
  // when we execute functionize more times with
  // the same function
  // 2. bind to itself, so we can use `this` in object instance context

  var funcCopy = function() {
    var args = Array.prototype.slice.call(arguments);
    return func.apply(funcCopy, args);
  };

  funcCopy.__proto__ = clazz.prototype;

  // execute constructor in object context
  clazz.apply(funcCopy, args);

  return funcCopy;
}

module.exports = functionize;