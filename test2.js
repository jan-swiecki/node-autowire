var Injector = require("./lib/Injector.js");
var ModuleFinder = require("./lib/ModuleFinder.js");
var CodeMutator = require("./lib/CodeMutator.js");

var codeMutator = new CodeMutator();
var moduleFinder = new ModuleFinder();

// TODO: autowire to new instances
var injector = new Injector(moduleFinder, codeMutator);

var fn = function test(Rest, x, fs) {
	console.log("Rest =", Rest);
	//console.log(fs.existsSync("test.js"));
};

//fn = injector.wrap(fn).autoWireModules();
//fn = injector.wrap(fn);
fn = injector.attachSafe(fn).autoWireModules();

fn.applyInject({
	"Rest": 123
});

