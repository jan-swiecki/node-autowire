var assert = require("assert");
var PATH = require("path");

function randomInt(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
}

function getNewAutowire() {
	var id = PATH.resolve("..");
	if(require.cache[id]) {
		delete require.cache[id];
	}
	return require("..");
}

describe('Array', function() {
	describe('#indexOf()', function () {
		it('should return -1 when the value is not present', function () {
			assert.equal(-1, [1,2,3].indexOf(5));
			assert.equal(-1, [1,2,3].indexOf(0));
		});
	});

	describe('#indexOf() 2', function () {
		it('should return -1 when the value is not present', function(done) {
			assert.equal(-1, [1,2,3].indexOf(5));
			assert.equal(-1, [1,2,3].indexOf(0));
			done();
		});
	});
});

describe('Autowire', function(){
	var Autowire;

	beforeEach(function(){
		Autowire = getNewAutowire();
	});

	describe('classes instantiation', function(){
		it('should work instantiate class on each inject', function(){
			var MyClass = require("./MyClass.js");
			Autowire.wireClass("MyClass", MyClass);
			Autowire.alias("uuid", "node-uuid");

			Autowire(function(MyClassModule1, MyClassModule2) {
				assert(!!MyClassModule1.uuid, "uuid1 should be defined");
				assert(!!MyClassModule2.uuid, "uuid2 should be defined");
				assert.notEqual(MyClassModule1.uuid, MyClassModule2.uuid);
			});
		});
	});
});