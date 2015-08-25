var _ = require("lodash");
var log = require("../DebugLogger.js").getLogger().withParentPrefix();

console.log(log.loggerName);

module.exports = {
	attachClone: function(clazz) {
		clazz.prototype.clone = function() {
			log.trace("Cloning class %s", clazz.name);

			var clone = Object.create(clazz.prototype);
			_.extend(clone, this);

			_.each(clone, function(v, k) {
				if(v.prototype && _.isFunction(v.clone)) {
					log.trace("Cloning %s", k);
					v[k] = v.clone();
				}
			});

			return clone;
		}
	}
};
