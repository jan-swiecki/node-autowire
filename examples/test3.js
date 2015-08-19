var Autowire = require("..");

function MyClass(fs) {
	console.log("Exists ->", fs.existsSync("test3.js"));
	this.fs = fs;
}

//var m = new MyClass();
//var m = Object.create(MyClass.prototype);
//console.log(m instanceof MyClass);

var m = Autowire.instantiate(MyClass);

console.log(!!m.fs);