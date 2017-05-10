'use strict';

let SnowplowValidationError = require('./snowplow-validation-error');

class SnowplowWorkerClient {
  static Register (options) {
    let registrationPromise = new Promise(function (resolve, reject) {
      if (!('serviceWorker' in navigator)) {
        reject('Service worker not supported');
      }
      options.workerPath = options.workerPath || '/snowplow-worker.js';
      options.scope = options.scope || '/';

      let registration = navigator.serviceWorker.register(options.workerPath, { scope: options.scope });

      registration.then(function (reg) {
        if (reg.active) {
          resolve(new SnowplowWorkerClient(reg, navigator.serviceWorker, {}));
        } else {
          navigator.serviceWorker.oncontrollerchange = () => {
            resolve(new SnowplowWorkerClient(reg, navigator.serviceWorker, {}));
          }
        }
      });

      registration.catch(function (err) {
        console.log('Could not register Snowplow worker: ', err);
        reject('err');
      });
    });

    return registrationPromise;
  }

  constructor (registration, context, options) {
    this.context = context;
    this.registration = registration;

    if (options.hasOwnProperty('raiseOnValidationErrors')) {
      this.raiseOnValidationErrors = options.raiseOnValidationErrors;
    } else {
      this.raiseOnValidationErrors = true;
    }

    this.attachMessageHandlers();
  }

  attachMessageHandlers () {
    let workerClient = this;
    this.context.onmessage = function (event) {
      if (event.data.type === 'snowplow-validation-failure') {
        workerClient.handleValidationFailure(event);
      } else if (event.data.type === 'snowplow-validation-success') {
        workerClient.handleValidationSuccess(event);
      }
    };
  }

  handleValidationSuccess (event) {
    window.dispatchEvent(this._customEvent(event.data.type, event.data.data));
  }

  handleValidationFailure (event) {
    window.dispatchEvent(this._customEvent(event.data.type, event.data.data));

    if (this.raiseOnValidationErrors) {
      this._throwValidationError(event.data.data);
    }
  }

  _throwValidationError (err) {
    throw new SnowplowValidationError(err);
  }

  setResolvers (config) {
    return this._command('SetResolvers', config);
  }

  setCollectorHosts (config) {
    /*
    config = {
      hosts: ['collector-qa.animoto.com', 'collector.animoto.com']
    }
    */
    return this._command('SetCollectorHosts', config);
  }

  getErrors () {
    return this._command('GetErrors');
  }

  clearErrors () {
    return this._command('ClearErrors');
  }

  _customEvent (type, detail) {
    return new CustomEvent(type, {detail: detail});
  }

  _command (command, options) {
    return this._postMessage({type: 'command', command: command, options: options});
  }

  _postMessage (message) {
    // This wraps the message posting/response in a promise, which will resolve if the response doesn't
    // contain an error, and reject with the error if it does. If you'd prefer, it's possible to call
    // controller.postMessage() and set up the onmessage handler independently of a promise, but this is
    // a convenient wrapper.
    return new Promise(function (resolve, reject) {
      var messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = function (event) {
        if (event.data.error) {
          reject(event.data.error);
        } else {
          resolve(event.data);
        }
      };

      // This sends the message data as well as transferring messageChannel.port2 to the service worker.
      // The service worker can then use the transferred port to reply via postMessage(), which
      // will in turn trigger the onmessage handler on messageChannel.port1.
      // See https://html.spec.whatwg.org/multipage/workers.html#dom-worker-postmessage
      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
    });
  }
}

module.exports = SnowplowWorkerClient;
