const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");

// In LocalStack Lambdas, AWS_ENDPOINT_URL is automatically set to the LocalStack endpoint
const endpoint = process.env.AWS_ENDPOINT_URL || `http://${process.env.LOCALSTACK_HOSTNAME || 'localhost'}:4566`;

const s3 = new S3Client({
  endpoint: endpoint,
  region: process.env.AWS_REGION || "us-east-1",
  forcePathStyle: true
});

const dynamo = new DynamoDBClient({
  endpoint: endpoint,
  region: process.env.AWS_REGION || "us-east-1"
});

exports.handler = async (event) => {
  console.log("Processing S3 Event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(`Fetching object ${key} from bucket ${bucket}`);

    try {
      // 1. Get the invoice from S3
      const getObjectParams = { Bucket: bucket, Key: key };
      const s3Response = await s3.send(new GetObjectCommand(getObjectParams));
      const streamToString = (stream) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        });

      const bodyContents = await streamToString(s3Response.Body);
      console.log("Invoice Content:", bodyContents);

      const invoiceData = JSON.parse(bodyContents);
      const orderId = invoiceData.orderId;

      if (!orderId) {
        console.error("No orderId found in invoice!");
        continue;
      }

      // 2. Update order status in DynamoDB to COMPLETED
      const tableName = "dev-ecommerce-orders";
      console.log(`Updating DynamoDB Order ${orderId} status to COMPLETED`);
      
      const updateParams = {
        TableName: tableName,
        Key: {
          id: { S: orderId }
        },
        UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt"
        },
        ExpressionAttributeValues: {
          ":status": { S: "COMPLETED" },
          ":updatedAt": { S: new Date().toISOString() }
        }
      };

      await dynamo.send(new UpdateItemCommand(updateParams));
      console.log(`Successfully completed post-processing for Order ${orderId}`);

      // 3. Update transaction status in DynamoDB to SUCCESS
      const txTableName = "dev-ecommerce-transactions";
      const txId = "tx_" + orderId;
      console.log(`Updating DynamoDB Transaction ${txId} status to SUCCESS`);
      
      const updateTxParams = {
        TableName: txTableName,
        Key: {
          transaction_id: { S: txId }
        },
        UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt"
        },
        ExpressionAttributeValues: {
          ":status": { S: "SUCCESS" },
          ":updatedAt": { S: new Date().toISOString() }
        }
      };

      await dynamo.send(new UpdateItemCommand(updateTxParams));
      console.log(`Successfully completed post-processing for Transaction ${txId}`);

    } catch (err) {
      console.error("Error processing S3 invoice:", err);
    }
  }

  return { statusCode: 200, body: "Success" };
};
