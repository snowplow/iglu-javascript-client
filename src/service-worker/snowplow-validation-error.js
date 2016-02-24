'use strict';

class SnowplowValidationError extends Error {
  constructor (data) {
    super(data.message);
    this.name = 'SnowplowValidationError';
    this.stack = (new Error()).stack;
    this.data = data;
  }

  toString () {
    return this.data.message;
  }
}

module.exports = SnowplowValidationError;
