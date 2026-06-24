const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

const awsEndpoint = process.env.AWS_ENDPOINT || 'http://host.minikube.internal:4566';
const awsRegion = process.env.AWS_REGION || 'us-east-1';

const sqsClient = new SQSClient({ endpoint: awsEndpoint, region: awsRegion });
const s3Client = new S3Client({ endpoint: awsEndpoint, region: awsRegion, forcePathStyle: true });
const dbClient = new DynamoDBClient({ endpoint: awsEndpoint, region: awsRegion });

const queueUrl = 'http://host.minikube.internal:4566/000000000000/dev-process-order-queue';
const s3Bucket = 'dev-ecommerce-invoices';

async function pollQueue() {
  console.log('Polling SQS Queue for order processing...');

  try {
    const response = await sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10
    }));

    if (response.Messages && response.Messages.length > 0) {
      const message = response.Messages[0];
      console.log('Received SQS Order message:', message.Body);

      // Parse SNS wrapper body
      const snsPayload = JSON.parse(message.Body);
      const orderEvent = JSON.parse(snsPayload.Message);
      const orderId = orderEvent.orderId;
      const amount = orderEvent.amount;

      console.log(`Processing Order ${orderId}...`);

      // Simulate processing time
      await new Promise(r => setTimeout(r, 2000));

      // Create Transaction record in DynamoDB (Status: PENDING)
      const txId = 'tx_' + orderId;
      await dbClient.send(new PutItemCommand({
        TableName: 'dev-ecommerce-transactions',
        Item: {
          transaction_id: { S: txId },
          order_id: { S: orderId },
          status: { S: 'PENDING' },
          amount: { N: amount.toString() },
          createdAt: { S: new Date().toISOString() }
        }
      }));
      console.log(`Transaction ${txId} created in DynamoDB as PENDING.`);

      // 1. Create Invoice payload
      const invoicePayload = {
        orderId,
        amount,
        processedAt: new Date().toISOString(),
        status: 'PROCESSED'
      };

      // 2. Upload Invoice JSON to S3
      const s3Key = `invoices/order-${orderId}.json`;
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: JSON.stringify(invoicePayload),
        ContentType: 'application/json'
      }));
      console.log(`S3 Invoice successfully uploaded to ${s3Bucket}/${s3Key}. This will trigger the Lambda post-processor!`);

      // 3. Delete message from Queue
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle
      }));
      console.log(`SQS Message for Order ${orderId} deleted.`);
    }
  } catch (err) {
    console.error('Error in Worker polling cycle:', err);
  }

  // Continue polling
  setTimeout(pollQueue, 1000);
}

// Start polling loop
pollQueue();
