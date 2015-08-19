var _ = require("lodash");
var esprima = require("esprima");
var escodegen = require("escodegen");

var log = require("./SimpleLogger.js").noDate().setLevel(10).getLogger();

function CodeMutator() {

}

CodeMutator.prototype.clone = function() {
	var clone = new CodeMutator();
	clone.injector = this.injector;
	clone.scope = this.scope;
	return clone;
}

CodeMutator.prototype.setInjector = function(injector) {
	this.injector = injector;
}

CodeMutator.prototype.withScope = function(scope) {
	var ret = this.clone();
	ret.scope = scope;
	return ret;
};

CodeMutator.prototype.replaceString = function(callback, search, replace) {
	throw new Error("Not implemented exception");
};

CodeMutator.prototype.replacePattern = function(callback, pattern, replace) {
	var parsedCallback = esprima.parse("("+callback+")");
	var originalName = parsedCallback.body[0].expression.id;
	originalName = originalName ? originalName.name : "[Anonymous]";

	this.findAndReplace(parsedCallback, pattern, replace);

	var callbackString = escodegen.generate(parsedCallback);

	return this.eval(callbackString);
};

CodeMutator.prototype.eval = function(callbackString) {
	if(this.scope) {
		var params = Object.keys(this.scope);
		var tmpCallbackString = "(function tmp("+params.join(", ")+"){ return "+callbackString+" })";

		var tmpCallback = eval(tmpCallbackString);
		if(! this.injector) {
			throw new Error("Injector must be initialized");
		}
		var callback = this.injector.attach(tmpCallback).applyInject(this.scope);
		return callback;
	} else {
		return eval(callbackString);
	}
};

CodeMutator.prototype.isPrimitive = function(val) {
	return _.isNull(val)
		|| _.isUndefined(val)
		|| _.isNumber(val)
		|| _.isString(val)
		|| _.isRegExp(val)
};

CodeMutator.prototype.findAndReplace = function(ast, pattern, replace) {
	var self = this;

	function prettyPrint(value) {
		return JSON.stringify(value, null, 2);
	}

	if(self.isPrimitive(ast)) {
		log.trace("PRIMITIVE "+ast);
	} else if(_.isArray(ast)) {
		_.each(ast, function(elem){
			log.trace("findAndReplace elem -> "+ prettyPrint(elem));
			self.findAndReplace(elem, pattern, replace);
		});
	} else {
		if(
			_.has(ast, 'type')
			&& _.has(ast, 'id')
			&& ast.type === pattern.type
			&& _.isEqual(ast.id, pattern.id)
		) {
			log.trace("-----> FOUND PATTERN");
			// found pattern, make replacement
			_.merge(ast, replace);
		} else {
			var keys = ["body", "expression", "declarations"];
			_.each(keys, function(key){
				if(ast[key]) {
					log.trace("findAndReplace ast[\""+key+"\"] -> "+ prettyPrint(ast[key]));
					self.findAndReplace(ast[key], pattern, replace);
				}
			});
		}
	}
	//else {
	//	throw new Error("Unrecognized tree: "+JSON.stringify(ast));
	//}
};

CodeMutator.prototype.newVariableDeclarationValue = function(callback, varName, newVarValue) {
	return this.replacePattern(callback, {
		"type": "VariableDeclarator",
		"id": {
			"type": "Identifier",
			"name": varName
		}
	}, {
		"init": {
			"type": "Literal",
			"value": newVarValue,
			"raw": ""+newVarValue
		}
	});
}

module.exports = CodeMutator;