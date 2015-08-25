var Autowire = require("../../");
module.exports = Autowire(function(InnerTestModule){
	return {
		InnerTestModule: InnerTestModule
	}
});
