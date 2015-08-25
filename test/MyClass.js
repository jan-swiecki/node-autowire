function MyClass(fs, uuid) {
	this.fs = fs;
	this.uuid = uuid.v4();
}

MyClass.prototype.getFs = function() {
	return this.fs;
};

MyClass.prototype.getUuid = function() {
	return this.uuid;
};

module.exports = MyClass;