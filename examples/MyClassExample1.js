var Autowire = require("..");
var MyClass = require("./MyClass.js");

Autowire.wireClass("MyClass", MyClass);
Autowire.alias("uuid", "node-uuid");

Autowire(function(MyClass) {
	console.log("exists(MyClass.js) =", MyClass.getFs().existsSync("MyClass.js"));
	console.log("MyClass.uuid =", MyClass.getUuid());
});
