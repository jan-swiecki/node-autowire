var _ = require("lodash");
var log = require("../DebugLogger.js").getLogger().withParentPrefix();

module.exports = {
	attachClone: function(clazz) {
		clazz.prototype.clone = function() {
			log.trace("Cloning class %s", clazz.name);

			var clone = Object.create(clazz.prototype);
			_.extend(clone, this);

			//if(clazz.name === "ModuleFinder") {
			//	console.log("importPaths", "\n\t", this.importPaths, "\n\t", clone.importPaths);
			//}

			_.each(clone, function(v, k) {
				if(_.has(v, "prototype") && _.isFunction(v.clone)) {
					log.trace("Cloning %s", k);
					v[k] = v.clone();
				}
			});

			return clone;
		}
	}
};
