var assert = require("assert");
var PATH = require("path");

process.env["DEBUG"] = "*";
process.env["DEBUG_LEVEL"] = "modulefinder=trace;autowire=trace";

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low) + low);
}

describe('Autowire', function(){
  var Autowire = require("..");

  describe('classes instantiation [wireClass]', function(){
    beforeEach(function(){
      delete require.cache[PATH.resolve(__dirname+"/MyClass.js")];
      delete require.cache[PATH.resolve(__dirname+"/MyClassModule1.js")];
      delete require.cache[PATH.resolve(__dirname+"/MyClassModule2.js")];
    });

    it('should instantiate class on each inject', function(){
      var MyClass = require("./MyClass.js");

      Autowire(function(MyClassModule1, MyClassModule2) {
        assert(!!MyClassModule1.uuid, "uuid1 should be defined");
        assert(!!MyClassModule2.uuid, "uuid2 should be defined");
        assert.notEqual(MyClassModule1.uuid, MyClassModule2.uuid);
      });
    });

    it('should instantiate class only once (singleton mode)', function(){
      var MyClassSingleton = require("./MyClassSingleton.js");

      Autowire(function(MyClassModuleSingleton1, MyClassModuleSingleton2) {
        assert(MyClassModuleSingleton1 instanceof MyClassSingleton, "MyClassModuleSingleton1 should be instance of MyClass");
        assert(MyClassModuleSingleton2 instanceof MyClassSingleton, "MyClassModuleSingleton2 should be instance of MyClass");
        assert(!!MyClassModuleSingleton1.uuid, "uuid1 should be defined");
        assert(!!MyClassModuleSingleton2.uuid, "uuid2 should be defined");
        assert.equal(MyClassModuleSingleton1.uuid, MyClassModuleSingleton2.uuid);
      });
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
        Autowire(function(TestModuleX){});
      })
    });

    it('should not throw error', function(){
      assert.doesNotThrow(function(){
        Autowire(function(TestModule){});
      });
    });

    it('should have inner module of "inner test module"', function(){
      Autowire(function(TestModule){
        assert.equal(TestModule.InnerTestModule, "inner test module");
      });
    });

    it('should wire test-module', function(){
      Autowire(function(testModule){
        assert.equal(testModule, 'yes');
      });
    });

    it('should wire test-module/lib/testMe', function(){
      Autowire(function(testModule$lib$testMe){
        assert.equal(testModule$lib$testMe, 'test_success');
      });
    });

    it('should alias test-module/lib/testMe', function(){
      Autowire.alias('xyz', 'testModule/lib/testMe');
      Autowire(function(xyz){
        assert.equal(xyz, 'test_success');
      });
    });

    it('should include test-module/lib/testMe #1', function(){
      Autowire.include('testModule/lib/testMe');
      Autowire(function(testMe){
        assert.equal(testMe, 'test_success');
      });
    });

    it('should include test-module/lib/testMe.js', function(){
      Autowire.include('testModule/lib/testMe.js');
      Autowire(function(testMe){
        assert.equal(testMe, 'test_success');
      });
    });

    it('should return module by name', function(){
      var TestModule = Autowire.getModuleByName('TestModule');
      assert.equal(TestModule.InnerTestModule, "inner test module");
    });

    it('should include module', function(){
      var currentPath = PATH.resolve(__dirname);
      Autowire.include(currentPath+"/../test2");
      Autowire.include("testModuleName/lib/SubModule");
      Autowire(function(testModuleName, SubModule){
        assert.equal(testModuleName, "testValue");
        assert.equal(SubModule, "testSubModule");
      })
    });
    
    it('injector should deepInject parameter into subsequent class instances', function(){
      Autowire.include("testModuleName/lib/TestScopeClass");
      let injector = Autowire.getInjector();

      injector.exec(function(Scope, TestScopeClass) {
        // console.log("TestScopeClass", TestScopeClass)
        assert.equal(TestScopeClass.Scope, 'test');
        assert.equal(TestScopeClass.Scope, Scope);
      }, {
        "Scope": 'test'
      }, true);
    });

    it('injector should instantiate given class', function(){
      class Test {
        constructor(MyClassModuleSingleton1, MyClassModuleSingleton2, InnerTestModule) {
          this.MyClassModuleSingleton1 = MyClassModuleSingleton1;
          this.MyClassModuleSingleton2 = MyClassModuleSingleton2;
          this.InnerTestModule = InnerTestModule;
        }
      }

      Test.autowire = {
        instantiate: true
      };

      let injector = Autowire.getInjector();
      let obj = injector.getInstance(Test);

      let MyClassSingleton = require("./MyClassSingleton.js");
      assert(obj.MyClassModuleSingleton1 instanceof MyClassSingleton, "MyClassModuleSingleton1 should be instance of MyClass");
      assert(obj.MyClassModuleSingleton2 instanceof MyClassSingleton, "MyClassModuleSingleton2 should be instance of MyClass");
      assert(!!obj.MyClassModuleSingleton1.uuid, "uuid1 should be defined");
      assert(!!obj.MyClassModuleSingleton2.uuid, "uuid2 should be defined");
      assert.equal(obj.MyClassModuleSingleton1.uuid, obj.MyClassModuleSingleton2.uuid);
      assert.equal(obj.MyClassModuleSingleton1.uuid, obj.MyClassModuleSingleton2.uuid);
      assert.equal(obj.InnerTestModule, "inner test module");
    });

    it('should include sub module from wired module', function(){
      var currentPath = PATH.resolve(__dirname);
      Autowire.wire('testModuleName3', require(currentPath+"/test3"));
      Autowire.include("testModuleName3/lib/SubModule");
      Autowire(function(testModuleName3, SubModule){
        assert.equal(testModuleName3, "testValue3");
        assert.equal(SubModule, "testSubModule3");
      });
    });
  });
});