var _ = require("lodash");
var esprima = require("esprima");
var escodegen = require("escodegen");

//var log = require("./DebugLogger.js").getLogger().setLevel("ERROR").withParentPrefix();

// WARNING: No DebugLogger, because it depends on CodeMutator
var log = function() {};

if(process.env["DEBUG_LEVEL"]) {
	var m = process.env["DEBUG_LEVEL"].match(/autowire:codemutator=(.*?);?/);
	if(m) {
		log = function(msg) {
			console.log(msg);
		};
	}
}

log.trace = log;

// TODO: Avoid eval. Create temporary modules, and require them.
function CodeMutator() {
}

CodeMutator.prototype.clone = function() {
	var clone = new CodeMutator();
	clone.injector = this.injector;
	clone.scope = this.scope;
	return clone;
};

CodeMutator.prototype.setInjector = function(injector) {
	this.injector = injector;
};

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
	originalName = originalName ? originalName.loggerName : "[Anonymous]";

	this.findAndReplace(parsedCallback, pattern, replace);

	var callbackString = escodegen.generate(parsedCallback);
	var ret = this.eval(callbackString);
	return ret;
};

CodeMutator.prototype.eval = function(callbackString) {
	if(this.scope) {
		var params = Object.keys(this.scope);
		var tmpCallbackString = "(function tmp("+params.join(", ")+"){ return "+callbackString+" })";

		var tmpCallback = eval(tmpCallbackString);
		if(! this.injector) {
			throw new Error("Injector must be initialized");
		}
		var callback = this.injector.attach(tmpCallback).executeInject(this.scope);
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
		|| _.isRegExp(val);
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

CodeMutator.prototype.find = function(ast, pattern) {
	var self = this;

	var matches = _.matches(pattern);

	function prettyPrint(value) {
		return JSON.stringify(value, null, 2);
	}

	if(self.isPrimitive(ast)) {
		log.trace("PRIMITIVE "+ast);
	} else if(_.isArray(ast)) {
		var ret;
		_.each(ast, function(elem){
			log.trace("find elem -> "+ prettyPrint(elem));
			var maybe = self.find(elem, pattern);
			if(maybe) {
				ret = maybe;
				return false;
			}
		});
		return ret;
	} else {
		if(matches(ast)) {
			log.trace("-----> FOUND PATTERN");
			// found pattern, make replacement
			return ast;
		} else {
			var keys = ["body", "expression", "declarations"];
			var ret;
			_.each(keys, function(key){
				if(ast[key]) {
					log.trace("find ast[\""+key+"\"] -> "+ prettyPrint(ast[key]));
					var maybe = self.find(ast[key], pattern);
					if(maybe) {
						ret = maybe;
					}
				}
			});
			return ret;
		}
	}
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
};

CodeMutator.prototype.extractExpression = function(code, pattern) {
	var parsedCode = esprima.parse("("+code+")");

	var expr = this.find(parsedCode, pattern);

	var extractedCode = escodegen.generate(expr);
	return extractedCode;
};

function Expression(ast) {
	this.ast = ast;
}

Expression.prototype.toString = function() {
	return escodegen.generate(this.ast);
};

Expression.prototype.toValue = function() {
	return eval(this.toString());
};

CodeMutator.prototype.getRValue = function(code, selector) {
	var parsedCode = esprima.parse("("+code+")");

	var ast = this.find(parsedCode, selector);

	var expr = new Expression(ast.right);

	return expr;
};

CodeMutator.prototype.extractExpressionRValueValue = function(code, pattern) {
	var parsedCode = esprima.parse("("+code+")");

	var expr = this.find(parsedCode, pattern);

	var extractedCode = escodegen.generate(expr.right);
	return eval(extractedCode);
};


module.exports = CodeMutator;