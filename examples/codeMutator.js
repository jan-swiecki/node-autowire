var CodeMutator = require("./../lib/CodeMutator.js");
var codeMutator = new CodeMutator();

var fn = function test() {
	var x = 5;
	return x;
};

var y = codeMutator.newVariableDeclarationValue(fn, "x", 6)();

console.log(y); // 6

//var fn = codeMutator.replacePattern(fn, {
//	"type": "VariableDeclarator",
//	"id": {
//		"type": "Identifier",
//		"name": "x"
//	}
//}, {
//	"type": "VariableDeclarator",
//	"id": {
//		"type": "Identifier",
//		"name": "y"
//	}
//});

//var fn = codeMutator.replacePattern(fn, {
//	"type": "VariableDeclarator",
//	"id": {
//		"type": "Identifier",
//		"name": "x"
//	}
//}, {
//	"type": "VariableDeclarator",
//	"id": {
//		"type": "Identifier",
//		"name": "x"
//	},
//	"init": {
//		"type": "Literal",
//		"value": 6,
//		"raw": "6"
//	}
//});

//console.log(fn);