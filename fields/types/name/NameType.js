var _ = require('underscore');
var FieldType = require('../Type');
var util = require('util');
var utils = require('keystone-utils');
var displayName = require('display-name');

/**
 * Name FieldType Constructor
 * @extends Field
 * @api public
 */
function name (list, path, options) {
	this._fixedSize = 'full';
	options.default = { first: '', last: '' };
	options.nofilter = true; // TODO: remove this when 0.4 is merged
	name.super_.call(this, list, path, options);
}
util.inherits(name, FieldType);


/**
 * Registers the field on the List's Mongoose Schema.
 *
 * Adds String properties for .first and .last name, and a virtual
 * with get() and set() methods for .full
 *
 * @api public
 */

name.prototype.addToSchema = function () {
	var schema = this.list.schema;
	var paths = this.paths = {
		first: this._path.append('.first'),
		last: this._path.append('.last'),
		full: this._path.append('.full'),
	};

	schema.nested[this.path] = true;
	schema.add({
		first: String,
		last: String,
	}, this.path + '.');

	schema.virtual(paths.full).get(function () {
		return displayName(this.get(paths.first), this.get(paths.last));
	});

	schema.virtual(paths.full).set(function (value) {
		if (typeof value !== 'string') {
			this.set(paths.first, undefined);
			this.set(paths.last, undefined);
			return;
		}
		var split = value.split(' ');
		this.set(paths.first, split.shift());
		this.set(paths.last, split.join(' ') || undefined);
	});

	this.bindUnderscoreMethods();
};

/**
 * Gets the string to use for sorting by this field
 */

name.prototype.getSortString = function (options) {
	if (options.invert) {
		return '-' + this.paths.first + ' -' + this.paths.last;
	}
	return this.paths.first + ' ' + this.paths.last;
};

/**
 * Add filters to a query
 *
 * TODO: this filter will conflict with any other $or filter, including filters
 * on other "name" type fields; need to work out a better way to implement.
 */
name.prototype.addFilterToQuery = function (filter, query) {
	query = query || {};
	if (filter.mode === 'exactly' && !filter.value) {
		query[this.paths.first] = query[this.paths.last] = filter.inverted ? { $nin: ['', null] } : { $in: ['', null] };
		return;
	}
	var value = utils.escapeRegExp(filter.value);
	if (filter.mode === 'startsWith') {
		value = '^' + value;
	} else if (filter.mode === 'endsWith') {
		value = value + '$';
	} else if (filter.mode === 'exactly') {
		value = '^' + value + '$';
	}
	value = new RegExp(value, filter.caseSensitive ? '' : 'i');
	if (filter.inverted) {
		query[this.paths.first] = query[this.paths.last] = { $not: value };
	} else {
		var first = {}; first[this.paths.first] = value;
		var last = {}; last[this.paths.last] = value;
		var $or = [first, last];
		if (query.$and) {
			query.$and.push({ $or: $or });
		} else if (query.$or) {
			query.$and = [{ $or: query.$or }, { $or: $or }];
			delete query.$or;
		} else {
			query.$or = $or;
		}
	}
	return query;
};

/**
 * Formats the field value
 */

name.prototype.format = function (item) {
	return item.get(this.paths.full);
};

/**
 * Get the value from a data object; may be simple or a pair of fields
 */
name.prototype.getInputFromData = function (data) {
	var first = this.getValueFromData(data, '_first');
	if (first === undefined) first = this.getValueFromData('.first');
	var last = this.getValueFromData(data, '_last');
	if (last === undefined) last = this.getValueFromData('.last');
	if (typeof first === 'string' || typeof last === 'string') {
		return {
			first: first,
			last: last,
		};
	}
	return this.getValueFromData(data);
};

/**
 * Validates that a value for this field has been provided in a data object
 */
name.prototype.validateInput = function (data, callback) {
	var value = this.getInputFromData(data);
	var result = value === undefined
		|| typeof value === 'string'
		|| (typeof value === 'object' && (
			typeof value.first === 'string'
			|| typeof value.last === 'string')
		);
	utils.defer(callback, result);
};

/**
 * Validates that input has been provided
 */
name.prototype.validateRequiredInput = function (item, data, callback) {
	var value = this.getInputFromData(data);
	var result = (
		typeof value === 'string' && value.length
		|| typeof value === 'object' && (
			typeof value.first === 'string' && value.first.length
			|| typeof value.last === 'string' && value.last.length)
		) ? true : false;
	utils.defer(callback, result);
};

/**
 * Validates that a value for this field has been provided in a data object
 *
 * Deprecated
 */
name.prototype.inputIsValid = function (data, required, item) {
	// Input is valid if none was provided, but the item has data
	if (!(this.path in data || this.paths.first in data || this.paths.last in data || this.paths.full in data) && item && item.get(this.paths.full)) return true;
	// Input is valid if the field is not required
	if (!required) return true;
	// Otherwise check for valid strings in the provided data,
	// which may be nested or use flattened paths.
	if (_.isObject(data[this.path])) {
		return (data[this.path].full || data[this.path].first || data[this.path].last) ? true : false;
	} else {
		return (data[this.paths.full] || data[this.paths.first] || data[this.paths.last]) ? true : false;
	}
};

/**
 * Detects whether the field has been modified
 *
 * @api public
 */
name.prototype.isModified = function (item) {
	return item.isModified(this.paths.first) || item.isModified(this.paths.last);
};

/**
 * Updates the value for this field in the item from a data object
 *
 * @api public
 */
name.prototype.updateItem = function (item, data, callback) {
	var paths = this.paths;
	var value = this.getInputFromData(data);
	if (typeof value === 'string' || value === null) {
		item.set(paths.full, value);
	} else if (typeof value === 'object') {
		if (typeof value.first === 'string' || value.first === null) {
			item.set(paths.first, value.first);
		}
		if (typeof value.last === 'string' || value.last === null) {
			item.set(paths.last, value.last);
		}
	}
	process.nextTick(callback);
};


/* Export Field Type */
module.exports = name;
