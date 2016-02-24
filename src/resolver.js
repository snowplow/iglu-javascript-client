'use strict';

let Schema = require('./schema').Schema;

const IGLU_SCHEMA_PREFIX = 'iglu:';
const IGLU_URI_PATH_PREFIX = 'schemas';

class Resolver {
  // cacheName = CURRENT_CACHES.snowplow
  static ServiceWorkerCachingRetriever (cacheName, baseURI, key) {
    let keyWithoutIgluPrefix = key.substring(IGLU_SCHEMA_PREFIX.length);
    let url = [baseURI, IGLU_URI_PATH_PREFIX, keyWithoutIgluPrefix].join('/');

    let request = new Request(url, {
      method: 'GET',
      mode: 'cors'
    });

    return caches.open(cacheName).then(function (cache) {
      // console.log('Fetching schema from: ', url);
      let add = cache.add(request).then(function () {
        let match = cache.match(request); // *Should* always have a match unless somehow the cache is cleared since the last line...
        return match;
      });
      return add;
    });
  }

  constructor (config, retrieverFunction) {
    let resolver = this;
    this.name = config.name;
    this.vendorPrefixes = config.vendorPrefixes;
    this.priority = config.priority;
    this.cacheConfig = config.cacheConfig;

    if (config.connection && config.connection.http) {
      this.type = 'http';
      this.uri = config.connection.http.uri;
      this.path = config.connection.http.path;
      this.retriever = function (key) {
        return retrieverFunction.call(resolver, key);
        // return Resolver.ServiceWorkerCachingRetriever(config.connection.http.uri, key);
      };
    } else {
      // TODO: embedded?
    }
  }

  retrieve (key) {
    return this.retriever(key);
  }

  getSchemaForKey (key) { // => Promise resolving to schema object
    var resolver = this;
    return new Promise(function (resolve, reject) {
      if (key.indexOf(IGLU_SCHEMA_PREFIX) !== 0) {
        reject(Error('Key does not appear to be an iglu repository: ' + key));
      }

      let schemaFetch = resolver.retrieve(key);

      schemaFetch.then(function onSchemaFetchSuccess (response) {
        let schemaJSON = response.json();
        schemaJSON.then(function (obj) {
          resolve(new Schema(obj));
        });

        schemaJSON.catch(function (error) {
          reject(error);
        });
      });

      schemaFetch.catch(function onSchemaFetchError (error) {
        reject(error);
      });
    });
  }

  resolves (schemaMetadata) { // => Boolean
    return this.vendorPrefixes.some((p) => (schemaMetadata.vendor.indexOf(p) === 0));
  }
}

module.exports = Resolver;
