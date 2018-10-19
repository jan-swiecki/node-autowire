class TestScopeClass {
  constructor(Scope) {
    this.Scope = Scope;
  }
}

TestScopeClass.autowire = {
  instantiate: true
};

module.exports = TestScopeClass;