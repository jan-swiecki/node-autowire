var ClassHelper = require("./helpers/ClassHelper.js");

function Instantiator(injector) {
	this.injector = injector;
}

Instantiator.prototype.setInjector = function(injector) {
	this.injector = injector;
	return this;
};

Instantiator.prototype.create = function(clazz) {
	var obj = Object.create(clazz["prototype"]);
	var constructor = this.injector.withFunc(clazz);
	constructor.applyMap(obj);
	return obj;
};

ClassHelper.attachClone(Instantiator);

module.exports = Instantiator;

