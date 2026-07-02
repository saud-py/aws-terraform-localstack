const zlib = require('zlib');
const http = require('http');

// Loki push endpoint inside Minikube (routing through host network)
const lokiEndpoint = process.env.LOKI_ENDPOINT || 'http://host.minikube.internal:3100/loki/api/v1/push';

exports.handler = async (event) => {
  console.log("Loki Shipper triggered with event:", JSON.stringify(event, null, 2));

  // 1. Decode and decompress the CloudWatch log data
  const payload = Buffer.from(event.awslogs.data, 'base64');
  const decompressed = zlib.gunzipSync(payload);
  const logData = JSON.parse(decompressed.toString('utf-8'));

  console.log(`Decompressed log events count: ${logData.logEvents.length} for Log Group: ${logData.logGroup}`);

  // 2. Format logs for Loki Push API
  const lokiStreams = {
    streams: [
      {
        stream: {
          job: "aws-cloudwatch",
          log_group: logData.logGroup,
          log_stream: logData.logStream,
          owner: logData.owner
        },
        values: logData.logEvents.map(event => {
          // Loki expects timestamp in nanoseconds as a string
          const timestampNanos = (event.timestamp * 1000000).toString();
          return [timestampNanos, event.message.trim()];
        })
      }
    ]
  };

  // 3. Post to Loki
  try {
    await postToLoki(lokiEndpoint, lokiStreams);
    console.log("Logs successfully forwarded to Loki.");
  } catch (err) {
    console.error("Failed to forward logs to Loki:", err);
    throw err;
  }

  return { statusCode: 200, body: "Logs processed successfully" };
};

function postToLoki(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const bodyStr = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Loki returned status code ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyStr);
    req.end();
  });
}
