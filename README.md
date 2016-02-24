# Javascript Iglu Client

The javascript Iglu client aids validation of schematized javascript objects backed by an Iglu-compatible schema service.

# Usage

```js
let client = new IgluClient({
  repositories: [
    {
      "name": "Iglu Central",
      "vendorPrefixes": [
        "com.snowplowanalytics"
      ],
      "connection": {
        "http": {
          "uri": "https://s3.amazonaws.com/iglucentral.com"
        }
      },
      "priority": 1
    }
  ]
});

client.validateObject(obj).then(
    (success) => console.log("Succes:", success)
).catch(
    (failure) => console.log("Fail:", failure)
);
```

NOTE: As currently formulated, this client is meant to be used in a ServiceWorker context. Refactoring is needed to separate parts of this system that rely on browser-based apis from those that don't.  Notably these are the mechanisms for actually fetching schemas from a remote host and caching those schemas locally.

From within a browser you can do something like this:

```html
  <script src="/javascripts/service-workers/snowplow/snowplow-worker-client.js"></script>
  <script src="/javascripts/service-workers/snowplow/init-snowplow-worker.js"></script>
```

See the `init-snowplow-worker.js` file in `examples/service-worker`.


## Architecture

- The library is written using ES2015. No attempt has been made to make this compatible with previous versions of JS.
- The client is set up to be asyncronous in operation using `Promises`.
- There are three main components:
    + `IgluClient`: The main entry point to the library. Instances of this class traverse a schematized object hierercy and validate constituent parts of an object using `Schema`.
    + `Schema`: Schema is a class representing a JSON Schema. It can validate a single object but does not traverse a hierarchy.
    + `Resolver`: A class meant to dereference a schema key/name to an actual schema. Currently only HTTPS-accessible Iglu servers are supported. Resolver also relies on a `retrieverFunction` that actually handles the getting the schema and potentially caching the result.

## TODO

- Refactor the fetch/cache mechanism to make it a bit more flexible.
- Refactor resolver construction to allow easier addition of new resolver types.
- Add example usage for ServiceWorker as well as Node contexts.
- TESTS!!!!