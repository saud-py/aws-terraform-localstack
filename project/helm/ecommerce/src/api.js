const express = require('express');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const app = express();
app.use(express.json());

const awsEndpoint = process.env.AWS_ENDPOINT || 'http://host.minikube.internal:4566';
const awsRegion = process.env.AWS_REGION || 'us-east-1';

const dbClient = new DynamoDBClient({ endpoint: awsEndpoint, region: awsRegion });
const snsClient = new SNSClient({ endpoint: awsEndpoint, region: awsRegion });

app.post('/orders', async (req, res) => {
  const orderId = 'order_' + Math.random().toString(36).substr(2, 9);
  const amount = req.body.amount || 99.99;
  console.log(`Received order request. Generating order ID: ${orderId}, Amount: ${amount}`);

  try {
    // 1. Save order to DynamoDB (Status: PENDING)
    await dbClient.send(new PutItemCommand({
      TableName: 'dev-ecommerce-orders',
      Item: {
        id: { S: orderId },
        status: { S: 'PENDING' },
        amount: { N: amount.toString() },
        createdAt: { S: new Date().toISOString() }
      }
    }));
    console.log(`DynamoDB Order ${orderId} created as PENDING.`);

    // 2. Publish event to SNS
    const snsMessage = JSON.stringify({ orderId, amount });
    await snsClient.send(new PublishCommand({
      TopicArn: 'arn:aws:sns:us-east-1:000000000000:dev-order-events-topic',
      Message: snsMessage
    }));
    console.log(`SNS order event published for ${orderId}.`);

    res.status(201).json({ orderId, status: 'PENDING', amount });
  } catch (err) {
    console.error('Failed to create order:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/transactions', async (req, res) => {
  const { ScanCommand } = require('@aws-sdk/client-dynamodb');
  try {
    const data = await dbClient.send(new ScanCommand({ TableName: 'dev-ecommerce-transactions' }));
    const txs = data.Items.map(item => ({
      transaction_id: item.transaction_id.S,
      order_id: item.order_id ? item.order_id.S : '',
      status: item.status.S,
      amount: item.amount ? parseFloat(item.amount.N) : 0,
      createdAt: item.createdAt ? item.createdAt.S : ''
    }));
    res.json(txs);
  } catch (err) {
    console.error('Failed to get transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`E-Commerce API Service running on port ${PORT}`);
});
