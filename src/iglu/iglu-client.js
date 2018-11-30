'use strict';

let Resolver = require('./resolver');
let _Schema = require('./schema');
let Schema = _Schema.Schema;
let SchemaMetadata = _Schema.SchemaMetadata;

const SCHEMATIZED_FIELDS = {
  'ue': ['ue_px', 'ue_pr'], // Unstructured events base64, non-base64
  '*': ['cx', 'co']         // Contexts: base64, nonbase64
};

const IGLU_RESOLVER_KEY = 'repositories';
const IGLU_INSTANCE_ONLY_SCHEMA = 'iglu:com.snowplowanalytics.self-desc/instance-iglu-only/jsonschema/1-0-0';
const IGLU_SCHEMA_KEY = 'schema';
const IGLU_DATA_KEY = 'data';

class IgluClient {
  static GetSchematizedFieldNames (eventType) {
    return SCHEMATIZED_FIELDS['*'].concat(SCHEMATIZED_FIELDS[eventType] === undefined ? [] : SCHEMATIZED_FIELDS[eventType]);
  }

  constructor (config) {
    this.clearResolvers();
    this.addAllResolversFromConfigJson(config);
    this.prioritizeResolvers();
  }

  clearResolvers () {
    this.resolvers = [];
  }

  addResolverFromConfigJson (json) {
    let config = json;
    if (json.constructor === String) {
      config = JSON.parse(json);
    }

    this.resolvers.push(new Resolver(config));
  }

  addAllResolversFromConfigJson (json) {
    if (json === undefined) {
      return;
    }

    let config = json;

    if (json.constructor === String) {
      config = JSON.parse(json);
    }

    let resolverConfigs = [];

    if (config[IGLU_RESOLVER_KEY]) {
      resolverConfigs = config[IGLU_RESOLVER_KEY];
    } else if (config.constructor === Array) {
      resolverConfigs = config;
    }

    let retrieverFunction = function (key) { // `this` will be bound to the resolver instance
      return Resolver.ServiceWorkerCachingRetriever(this.cacheConfig.cacheName, this.uri, key);
    }

    for (let resovlerConfig of resolverConfigs) {
      this.resolvers.push(new Resolver(resovlerConfig, retrieverFunction));
    };

    this.prioritizeResolvers();
  }

  prioritizeResolvers () {
    this.resolvers = this.resolvers.sort((a, b) => ((b.priority || -1) - (a.priority || -1)));
  }

  validateObject (obj) {
    var iglu = this;
    return new Promise(function (resolve, reject) {
      var instanceOnlySchema = iglu.getSchemaForKey(IGLU_INSTANCE_ONLY_SCHEMA);

      instanceOnlySchema.then(
        function (schema) {
          var instanceOnlyResult = schema.validate(obj);
          if (!instanceOnlyResult.isValid) {
            instanceOnlyResult.stack = (new Error()).stack;
            reject(instanceOnlyResult);
          }
        },
        reject
      ).then(function (result) {
        var schemaName = obj[IGLU_SCHEMA_KEY];
        var dataObj = obj[IGLU_DATA_KEY];

        if (schemaName === undefined) {
          reject({object: obj, error: 'NoSchemaError', message: 'Could not find schema in object.', stack: (new Error()).stack});
        }

        let objSchema = iglu.getSchemaForKey(schemaName);

        objSchema.catch(reject);

        objSchema.then(function (schema) {
          let validationResult = schema.validate(dataObj);
          if (!validationResult.isValid) {
            reject(validationResult);
          } else {
            let dataValidations = [];
            if (dataObj.constructor === Array) {
              dataValidations = dataObj.map((item) => iglu.validateObject(item));
            } else {
              if (dataObj[IGLU_SCHEMA_KEY]) {
                dataValidations.push(iglu.validateObject(dataObj));
              }
            }

            return Promise.all(dataValidations).then((results) => resolve(validationResult), reject);
          }
        });
      });
    });
  }

  validateObjectAgainstSchema (obj, schema) {
    let s = new Schema(schema);
    return s.validate(obj);
  }

  getSchemaForKey (key) {
    var myResolvers = this.resolvers;
    return new Promise(function (resolve, reject) {
      // Look for schema in cache and return.
      if (false) {  // TODO
        return // CACHED VERSION
      } else {  // Else, look up the schema
        var schemaMetadata = SchemaMetadata.FromSchemaKey(key);
        // TODO: Could return null - handle error.

        var resolver;

        for (let i = 0; i < myResolvers.length; i++) {
          if (myResolvers[i].resolves(schemaMetadata)) {
            resolver = myResolvers[i];
            break;
          }
        }

        if (resolver) {
          var schema = resolver.getSchemaForKey(key);
          schema.then(resolve, reject);
        } else {
          console.log('Could not find resolver for key: ', key, myResolvers);
          reject(Error('No resolver found for: ' + key));
        }
      }
    })
  }
}

module.exports = IgluClient;
