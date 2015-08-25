var assert = require("assert");
var PATH = require("path");

function randomInt(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
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
	var Autowire = require("..");

	describe('classes instantiation', function(){
		beforeEach(function(){
			Autowire.reset();
			delete require.cache[PATH.resolve(__dirname+"/MyClass.js")];
			delete require.cache[PATH.resolve(__dirname+"/MyClassModule1.js")];
			delete require.cache[PATH.resolve(__dirname+"/MyClassModule2.js")];
		});

		it('should instantiate class on each inject', function(){
			var MyClass = require("./MyClass.js");
			Autowire.wireClass("MyClass", MyClass);
			Autowire.alias("uuid", "node-uuid");

			Autowire(function(MyClassModule1, MyClassModule2) {
				assert(!!MyClassModule1.uuid, "uuid1 should be defined");
				assert(!!MyClassModule2.uuid, "uuid2 should be defined");
				assert.notEqual(MyClassModule1.uuid, MyClassModule2.uuid);
			});
		});

		it('should instantiate class only once (singleton mode)', function(){
			var MyClass = require("./MyClass.js");
			Autowire.wireClass("MyClass", MyClass, true);
			Autowire.alias("uuid", "node-uuid");

			Autowire(function(MyClassModule1, MyClassModule2) {
				assert(!!MyClassModule1.uuid, "uuid1 should be defined");
				assert(!!MyClassModule2.uuid, "uuid2 should be defined");
				assert.equal(MyClassModule1.uuid, MyClassModule2.uuid);
			});
		});
	});

	//describe('dependencies identities', function(){
	//	it('should have same moduleFinder as injector', function(){
	//		assert.strictEqual(Autowire.moduleFinder, Autowire.injector.moduleFinder);
	//	});
	//});

	describe("adding import paths", function(){
		it('should add import path relative to current folder', function(){
			var dir = "./testdir";
			Autowire.addImportPath(dir);
			var paths = Autowire.injector.moduleFinder.importPaths;
			assert.equal(paths[paths.length - 1], PATH.resolve(PATH.join(__dirname, dir)));
		});
	});

	describe('autowiring', function(){
		it('should wire fs', function(){
			Autowire(function(fs){
				assert.strictEqual(fs, require("fs"));
			});
		});

		it('should throw error', function(){
			assert.throws(function(){
				Autowire(function(TestModule){});
			})
		});

		it('should not throw error', function(){
			Autowire.injector.moduleFinder.invalidateCache();
			Autowire.addImportPath("./testdir");
			Autowire.addImportPath("./testdir/anotherdir");
			assert.doesNotThrow(function(){
				Autowire(function(TestModule){});
			});
		});

		it('should have inner module of "inner test module"', function(){
			Autowire(function(TestModule){
				assert.equal(TestModule.InnerTestModule, "inner test module");
			});
		});
	});
});