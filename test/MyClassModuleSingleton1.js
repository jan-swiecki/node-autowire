var Autowire = require("..");

module.exports = Autowire(function(MyClassSingleton) {
  return MyClassSingleton;
});
