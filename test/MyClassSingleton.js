function MyClassSingleton(fs, nodeUuid) {
  this.fs = fs;
  this.uuid = nodeUuid.v4();
}

MyClassSingleton.autowire = {
  singleton: true,
  instantiate: true
};

MyClassSingleton.prototype.getFs = function() {
  return this.fs;
};

MyClassSingleton.prototype.getUuid = function() {
  return this.uuid;
};

module.exports = MyClassSingleton;