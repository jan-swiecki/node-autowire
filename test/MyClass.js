function MyClass(fs, nodeUuid) {
  this.fs = fs;
  this.uuid = nodeUuid.v4();
}

MyClass.autowire = {
  singleton: false,
  instantiate: true
};

MyClass.prototype.getFs = function() {
  return this.fs;
};

MyClass.prototype.getUuid = function() {
  return this.uuid;
};

module.exports = MyClass;