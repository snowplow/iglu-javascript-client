let SnowplowClient = null;

$(function(){
  SnowplowWorkerClient.Register({ workerPath: "/snowplow-service.js" }).then(function(c) {
    SnowplowClient = c;
    window.addEventListener('snowplow-validation-success', function(event) {
      console.log("Snowplow Success: ", event.detail);
    });

    SnowplowClient.setResolvers({
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
        // Add resolvers here.
      ]
    });

    SnowplowClient.setCollectorHosts({
      hosts: [
        "collector.example.com" // Snowplow collector hostname
      ]
    });

    // NB:  The snowplow worker error buffer will persist between page loads.
    //      It's possible you will want to call `SnoplowClient.clearErrors()`
    //      on activation.
  });
});
