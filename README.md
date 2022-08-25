
# Javascript Iglu Client

[![early-release]][tracker-classification]
[![Build Status][gh-actions-image]][gh-actions]
[![License][license-image]][license]
[![Release][release-image]][releases]

[Snowplow][snowplow] is a scalable open-source platform for rich, high quality, low-latency data collection. It is designed to collect high quality, complete behavioral data for enterprise business.

**To find out more, please check out the [Snowplow website][website] and our [documentation][docs].**

## Javascript Iglu Client Overview

[Iglu][iglu-github] is a machine-readable, open-source schema registry for JSON and Thrift schema from the team at Snowplow Analytics.

The JavaScript [Iglu client][iglu-client] aids validation of schematized JavaScript objects backed by an Iglu-compatible schema service.

## Quick start

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

From within a browser you can do something like this:

```html
  <script src="/javascripts/service-workers/snowplow/snowplow-worker-client.js"></script>
  <script src="/javascripts/service-workers/snowplow/init-snowplow-worker.js"></script>
```

See the `init-snowplow-worker.js` file in `examples/service-worker`.

### Note

As currently formulated, this client is meant to be used in a ServiceWorker context. Refactoring is needed to separate parts of this system that rely on browser-based API's from those that don't.  Notably these are the mechanisms for actually fetching schemas from a remote host and caching those schemas locally.

At the moment the Iglu JavaScript Client is under beta status. There are several points to address before we consider it production-ready, such as:

- Refactor the fetch/cache mechanism to make it a bit more flexible.
- Refactor resolver construction to allow easier addition of new resolver types.
- Add example usage for ServiceWorker as well as Node contexts.
- Add tests

## Architecture

- The library is written using ES2015. No attempt has been made to make this compatible with previous versions of JS.
- The client is set up to be asyncronous in operation using `Promises`.
- There are three main components:
  - `IgluClient`: The main entry point to the library. Instances of this class traverse a schematized object hierarchy and validate constituent parts of an object using `Schema`.
  - `Schema`: Schema is a class representing a JSON Schema. It can validate a single object but does not traverse an hierarchy.
  - `Resolver`: A class meant to dereference a schema key/name to an actual schema. Currently only HTTPS-accessible Iglu servers are supported. Resolver also relies on a `retrieverFunction` that actually handles getting the schema and potentially caching the result.

## Contributing

Feedback and contributions are welcome - if you have identified a bug, please log an issue on this repo. For all other feedback, discussion or questions please open a thread on our [discourse forum][discourse].

## Copyright and license

The Snowplow Iglu JavaScript Client is copyright 2016-2022 Snowplow Analytics Ltd.

Licensed under the **[Apache License, Version 2.0][license]** (the "License");
you may not use this software except in compliance with the License.

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

[tracker-classification]: https://docs.snowplowanalytics.com/docs/collecting-data/collecting-from-own-applications/tracker-maintenance-classification/
[early-release]: https://img.shields.io/static/v1?style=flat&label=Snowplow&message=Early%20Release&color=014477&labelColor=9ba0aa&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAeFBMVEVMaXGXANeYANeXANZbAJmXANeUANSQAM+XANeMAMpaAJhZAJeZANiXANaXANaOAM2WANVnAKWXANZ9ALtmAKVaAJmXANZaAJlXAJZdAJxaAJlZAJdbAJlbAJmQAM+UANKZANhhAJ+EAL+BAL9oAKZnAKVjAKF1ALNBd8J1AAAAKHRSTlMAa1hWXyteBTQJIEwRgUh2JjJon21wcBgNfmc+JlOBQjwezWF2l5dXzkW3/wAAAHpJREFUeNokhQOCA1EAxTL85hi7dXv/E5YPCYBq5DeN4pcqV1XbtW/xTVMIMAZE0cBHEaZhBmIQwCFofeprPUHqjmD/+7peztd62dWQRkvrQayXkn01f/gWp2CrxfjY7rcZ5V7DEMDQgmEozFpZqLUYDsNwOqbnMLwPAJEwCopZxKttAAAAAElFTkSuQmCC

[gh-actions]: https://github.com/snowplow/iglu-javascript-client/actions
[gh-actions-image]: https://github.com/snowplow/iglu-javascript-client/actions/workflows/build.yml/badge.svg

[license]: https://www.apache.org/licenses/LICENSE-2.0
[license-image]: https://img.shields.io/badge/license-Apache--2-blue.svg?style=flat

[releases]: https://github.com/snowplow/iglu-javascript-client/releases
[release-image]: https://img.shields.io/github/v/release/snowplow/iglu-javascript-client?sort=semver

[website]: https://snowplowanalytics.com
[docs]: https://docs.snowplowanalytics.com
[snowplow]: https://github.com/snowplow/snowplow
[discourse]: https://discourse.snowplowanalytics.com

[iglu-github]: https://github.com/snowplow/iglu
[iglu-client]: https://docs.snowplowanalytics.com/docs/pipeline-components-and-applications/iglu/iglu-clients/
