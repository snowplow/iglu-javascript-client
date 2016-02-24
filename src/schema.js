'use strict';

const IGLU_SCHEMA_PREFIX = 'iglu:'; // TODO: Refactor: this constant is duplicated
const IGLU_SCHEMA_REGEX = RegExp('^iglu:([a-zA-Z0-9-_.]+)/([a-zA-Z0-9-_]+)/([a-zA-Z0-9-_]+)/((?:[0-9]+-)?[0-9]+-[0-9]+)$');

let isMyJsonValid = require('is-my-json-valid');

class Schema {
  constructor (json) {
    if (json.constructor === String) {
      this.schema = JSON.parse(json);
    } else {
      this.schema = json;
    }
  }

  validate (obj) {
    let validate = isMyJsonValid(this.schema);
    let isValid = validate(obj);
    let result = { isValid: isValid, errors: validate.errors, object: obj, schema: this.schema };
    if (!result.isValid) {
      result.error = 'SchemaMismatch';
      result.message = result.errors.reduce(function (memo, item) {
        memo.push(item.field + ' ' + item.message);
        return memo;
      }, []).join('; ');
    } else {
      result.message = 'Successful validation';
    }
    return result;
  }
}

class SchemaKeyFormatError {
  constructor (key) {
    this.key = key;
    this.message = 'does not match the required format';
  }

  toString () {
    return this.key + ' ' + this.message;
  }
}

class SchemaMetadata {
  static FromSchemaKey (key) {
    let m = key.match(IGLU_SCHEMA_REGEX); // TODO: Refactor to class variable

    if (m) {
      let vendor = m[1];
      let name = m[2];
      let format = m[3];
      let version = m[4];

      return new SchemaMetadata(vendor, name, format, version);
    } else {
      throw new SchemaKeyFormatError(key);
    }
  }

  constructor (vendor, name, format, version) {
    this.vendor = vendor;
    this.name = name;
    this.format = format;
    this.version = version;
  }

  get key () { // Refactor to default parameter
    return IGLU_SCHEMA_PREFIX + [this.vendor, this.name, this.format, this.version].join('/');
  }

  toString () {
    return this.key;
  }
}

module.exports.Schema = Schema;
module.exports.SchemaMetadata = SchemaMetadata;
module.exports.SchemaKeyFormatError = SchemaKeyFormatError;
