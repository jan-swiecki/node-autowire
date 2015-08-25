var Autowire = require("..");
var MyClass = require("./MyClass.js");

Autowire.wireClass("MyClass", MyClass);
Autowire.alias("uuid", "node-uuid");

Autowire(function(MyClassExample1, MyClassExample1_copy) {
	//console.log("MyClassExample1.uuid =", MyClassExample1.getUuid());
	//console.log("MyClassExample1_copy.uuid =", MyClassExample1_copy.getUuid());
});
