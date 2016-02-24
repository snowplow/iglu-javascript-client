'use strict';

// const SCRIPT_VERSION = '?this-is-heavily-cached-so-needs-a-buster-' + 21; // TODO: fix this with proper packaging

// importScripts('/javascripts/service-workers/snowplow/emitter.js' + SCRIPT_VERSION);
// importScripts('/javascripts/service-workers/snowplow/iglu.js' + SCRIPT_VERSION);

let EventEmitter = require('events').EventEmitter;
let IgluClient = require('../iglu/iglu-client');
let URL = require('url');

/*
  TODO:
    - Figure out if we need ArrayUtils.Flatten or if there is a pre-existing alternative
    - Figure out if we can replace URLUtils with something pre-existing. Note 'url-safe'
      base64 substitutes '-' for '/'
    - Get rid of that god-aweful cache busting shit up there...
*/

class ArrayUtils {
  static Flatten (arr) {
    return arr.reduce(function (r, i) {
      if (i.constructor === Array) {
        Array.prototype.push.apply(r, ArrayUtils.Flatten(i));
      } else {
        r.push(i);
      }

      return r;
    }, []);
  }
}

class URLUtils {
  static ParseURI (str) {
    // let o = this.ParseURI.options;
    // let m = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str);
    // let uri = {};
    // let i = 14;

    // while (i--) uri[o.key[i]] = m[i] || '';

    // uri[o.q.name] = {};
    // uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    //   if ($1) uri[o.q.name][$1] = $2;
    // });

    // return uri;
    return URL.parse(str);
  }

  static ParseQueryString (queryString, fieldsToDecode) {
    let obj = {};
    let vars = queryString.split('&');
    for (let item of vars) {
      let pair = item.split('=');
      obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }

    for (let field of fieldsToDecode) {
      if (obj[field] !== undefined) {
        let base64 = obj[field].replace(/-/g, '/');
        obj[field] = JSON.parse(atob(base64));
      }
    }

    return obj;
  };
}

// URLUtils.ParseURI.options = { // Seems like the only way to do static values of a class?
//   strictMode: false,
//   key: ['source','protocol','authority','userInfo','user','password','host','port','relative','path','directory','file','query','anchor'],
//   q:   {
//     name:   'queryKey',
//     parser: /(?:^|&)([^&=]*)=?([^&]*)/g
//   },
//   parser: {
//     strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
//     loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
//   }
// };

var PostMessage = function PostMessage (message, port) {
  if (port !== undefined) {
    port.postMessage(message);
  } else { // broadcast
    self.clients.matchAll().then((all) => all.map((client) => client.postMessage(message)));
  }
};

/** END UTIL **/

const CONSTANTS = {
  IGLU_SCHEMA_PREFIX: 'iglu:',
  IGLU_URI_PATH_PREFIX: 'schemas',
  IGLU_SCHEMA_REGEX: RegExp('^iglu:([a-zA-Z0-9-_.]+)/([a-zA-Z0-9-_]+)/([a-zA-Z0-9-_]+)/((?:[0-9]+-)?[0-9]+-[0-9]+)$'),

  IGLU_RESOLVER_KEY: 'repositories',
  IGLU_INSTANCE_ONLY_SCHEMA: 'iglu:com.snowplowanalytics.self-desc/instance-iglu-only/jsonschema/1-0-0',

  SCHEMATIZED_FIELDS: {
    'ue': ['ue_px', 'ue_pr'], // Unstructured events base64, non-base64
    '*': ['cx', 'co']         // Contexts: base64, nonbase64
  },

  ENCODED_FIELDS: ['cx', 'ue_px'],
  WEB_PLATFORM: 'web',

  SCHEMA_KEY: 'schema',
  DATA_KEY: 'data'
};

const CACHE_VERSION = 1;
const CURRENT_CACHES = {
  snowplow: 'snowplow-schema-cache-v' + CACHE_VERSION
};

class SnowplowWorker extends EventEmitter {

  constructor (context, igluClient) {
    super();
    this.context = context;
    this.iglu = igluClient;

    this.collectorHosts = [];
    this.fieldsToDecode = CONSTANTS.ENCODED_FIELDS;

    this.maxErrorBufferSize = 1000; // TODO: allow this to be unbounded by setting to -1
    this.errorBuffer = [];

    this.maxSucessBufferSize = 1000; // TODO: allow this to be unbounded by setting to -1
    this.succeesBuffer = [];

    this.attachHandlers();

    this.on('snowplow-validation-failure', this._addToErrorBufferOnError);
  }

  notify (data) {
    PostMessage(data);
  }

  fetchHandler (request) {
    let parsedURL = URLUtils.ParseURI(request.url);

    if (this.collectorHosts.includes(parsedURL.host)) {
      this.validateRequest(request);
    }
  }

  validateRequest (request) {
    // Then look at fields that carry schematized data: cx, ue_px, etc
    //    - For each schematized field, first check if they are valid, self-describing
    //      items using 'com.snowplowanalytics.self-desc/instance-iglu-only/jsonschema/1-0-0'
    //    - Then extract the 'data' field and validate against the stated schema (for instance, 'context')
    //    - If there are multiple items within 'data', validate each

    let snowplow = this;
    let parsedURL = URLUtils.ParseURI(request.url);
    let payload = URLUtils.ParseQueryString(parsedURL.query, this.fieldsToDecode);
    if (payload.p && payload.p === CONSTANTS.WEB_PLATFORM) {
      let eventType = payload.e;
      let fieldsToValidate = IgluClient.GetSchematizedFieldNames(eventType);

      let validations = [];

      fieldsToValidate.forEach(function (field) {
        if (payload[field]) {
          validations.push(snowplow.iglu.validateObject(payload[field]));
        }
      });

      Promise.all(validations).then(
        function (values) {
          snowplow.emit('snowplow-validation-success', values);
        },
        function (errors) {
          snowplow.emit('snowplow-validation-failure', errors);
        }
      );
    } else {
      throw Error('Request appears to be made from an unsupported platform');
    }
  }

  _addToErrorBufferOnError (error) {
    this.errorBuffer.push(error);
    if (this.maxErrorBufferSize < this.errorBuffer.length) {
      this.errorBuffer = this.errorBuffer.slice(this.errorBuffer.length - this.maxErrorBufferSize);
    }
  }

  attachHandlers () {
    let ctx = this.context;
    ctx.addEventListener('install', this._bindHandler(this._onWorkerInstall));
    ctx.addEventListener('activate', this._bindHandler(this._onWorkerActivate));
  }

  _onWorkerInstall (event) {
    console.log('Snowplow Worker Installed', event);
    this.context.skipWaiting();
  }

  _onWorkerActivate (event) {
    console.log('Snowplow Worker Activated', event);
    event.waitUntil(cleanupCaches());
    this.on('snowplow-validation-failure', NotifyErrors);
    this.on('snowplow-validation-success', NotifyValidations);

    this.context.addEventListener('fetch', this._bindHandler(this._onFetch));
    this.context.addEventListener('message', this._bindHandler(this._onMessage));
  }

  _onFetch (event) {
    this.fetchHandler(event.request);

    // Return the original response object, which will be used to fulfill the resource request.
    return fetch(event.request.clone()).then((response) => response);
  }

  _onMessage (event) {
    if (event.data.type === 'command') {
      switch (event.data.command) {
        case 'SetResolvers':
          this._setResolversCommand(event);
          break;
        case 'SetCollectorHosts':
          this._setCollectorHostsCommand(event);
          break;
        case 'GetErrors':
          this._getErrorsCommand(event);
          break;
        case 'ClearErrors':
          this._clearErrorsCommand(event);
          break;
        default:
          console.log('Unknown Command: ', event);
      }
    }
  }

  _setResolversCommand (event) {
    // HACK: I need to inject cache config information at this point since
    //       the controlling client doesn't set it. The controlling page
    //       *could* set it potentially but I haven't determined a good cache
    //       api at this stage.
    let resolverConfigs = event.data.options.repositories.map(function (c) {
      c.cacheConfig = {
        cacheName: CURRENT_CACHES.snowplow
      };

      return c
    });

    this.iglu.addAllResolversFromConfigJson(resolverConfigs);
    PostMessage('Resolvers updated', event.ports[0]);
  }

  _setCollectorHostsCommand (event) {
    this.collectorHosts = event.data.options.hosts;
    PostMessage('Collector hosts updated', event.ports[0]);
  }

  _getErrorsCommand (event) {
    PostMessage(this.errorBuffer, event.ports[0]);
  }

  _clearErrorsCommand (event) {
    this._clearErrors();
    PostMessage('Error buffer is clear', event.ports[0]);
  }

  _bindHandler (handler) {
    let binding = this;
    return function (event) {
      handler.call(binding, event);
    }
  }

  _clearErrors () {
    this.errorBuffer = [];
  }
};

var NotifyErrors = function NotifyErrors (errors) {
  for (let error of ArrayUtils.Flatten([errors])) {
    PostMessage({ type: 'snowplow-validation-failure', data: error });
  }
};

var NotifyValidations = function NotifyValidations (items) {
  for (let item of ArrayUtils.Flatten([items])) {
    PostMessage({ type: 'snowplow-validation-success', data: item });
  }
};

// Delete all caches that aren't named in CURRENT_CACHES.
// While there is only one cache in this example, the same logic will handle the case where
// there are multiple versioned caches.
var cleanupCaches = function cleanupCaches () {
  var expectedCacheNames = Object.keys(CURRENT_CACHES).map(function (key) {
    return CURRENT_CACHES[key];
  });

  return caches.keys().then(function (cacheNames) {
    return Promise.all(
      cacheNames.map(function (cacheName) {
        if (expectedCacheNames.indexOf(cacheName) === -1) {
          // If this cache name isn't present in the array of 'expected' cache names, then delete it.
          // console.log('Deleting out of date cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    );
  })
};

var Snowplow = new SnowplowWorker(self, new IgluClient({}));
module.exports = Snowplow;
