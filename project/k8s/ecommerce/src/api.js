const express = require('express');
const os = require('os');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand, GetItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const app = express();
app.use(express.json());

const awsEndpoint = process.env.AWS_ENDPOINT || 'http://host.minikube.internal:4566';
const awsRegion = process.env.AWS_REGION || 'us-east-1';
const secretName = process.env.SECRETS_NAME || 'dev-ecommerce-secrets';

// Clients
const dbClient = new DynamoDBClient({ endpoint: awsEndpoint, region: awsRegion });
const snsClient = new SNSClient({ endpoint: awsEndpoint, region: awsRegion });
const secretsClient = new SecretsManagerClient({ endpoint: awsEndpoint, region: awsRegion });

// Global configurations (loaded from Secrets Manager)
let config = {
  ORDERS_TABLE: 'dev-ecommerce-orders',
  TRANSACTIONS_TABLE: 'dev-ecommerce-transactions',
  INVENTORY_TABLE: 'dev-ecommerce-inventory',
  ORDER_EVENTS_TOPIC: 'arn:aws:sns:us-east-1:000000000000:dev-order-events-topic',
  SYSTEM_ALERTS_TOPIC: 'arn:aws:sns:us-east-1:000000000000:dev-system-alerts-topic'
};

// Load configuration from Secrets Manager
async function loadConfig() {
  try {
    console.log(`Fetching configuration from Secrets Manager: ${secretName}...`);
    const data = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      config = { ...config, ...secrets };
      console.log('Configuration successfully loaded from Secrets Manager:', config);
    }
  } catch (err) {
    console.error('Failed to load config from Secrets Manager, using defaults:', err.message);
  }
}

// 1. Get Product Catalog & Stock Levels
app.get('/products', async (req, res) => {
  try {
    const data = await dbClient.send(new ScanCommand({ TableName: config.INVENTORY_TABLE }));
    const products = data.Items.map(item => ({
      product_id: item.product_id.S,
      name: item.name.S,
      price: parseFloat(item.price.N),
      stock: parseInt(item.stock.N)
    }));
    res.json(products);
  } catch (err) {
    console.error('Failed to list products:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Place an Order (Stock validation & decrement)
app.post('/orders', async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) {
    return res.status(400).json({ error: 'product_id is required' });
  }

  try {
    // A. Retrieve product details
    const productData = await dbClient.send(new GetItemCommand({
      TableName: config.INVENTORY_TABLE,
      Key: { product_id: { S: product_id } }
    }));

    if (!productData.Item) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const productName = productData.Item.name.S;
    const productPrice = parseFloat(productData.Item.price.N);
    const amount = productPrice * quantity;

    // B. Decrement stock atomically (checking if stock >= quantity)
    try {
      await dbClient.send(new UpdateItemCommand({
        TableName: config.INVENTORY_TABLE,
        Key: { product_id: { S: product_id } },
        UpdateExpression: 'SET stock = stock - :qty',
        ConditionExpression: 'stock >= :qty',
        ExpressionAttributeValues: {
          ':qty': { N: quantity.toString() }
        }
      }));
      console.log(`Stock decremented for ${productName}. Processing order...`);
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        return res.status(400).json({ error: `Out of Stock. Only ${productData.Item.stock.N} units available.` });
      }
      throw err;
    }

    // C. Save order to DynamoDB (PENDING)
    const orderId = 'order_' + Math.random().toString(36).substr(2, 9);
    await dbClient.send(new PutItemCommand({
      TableName: config.ORDERS_TABLE,
      Item: {
        id: { S: orderId },
        status: { S: 'PENDING' },
        amount: { N: amount.toString() },
        product_id: { S: product_id },
        quantity: { N: quantity.toString() },
        createdAt: { S: new Date().toISOString() }
      }
    }));
    console.log(`Order ${orderId} placed for ${quantity}x ${productName} ($${amount}).`);

    // D. Publish event to SNS
    const snsMessage = JSON.stringify({ orderId, amount });
    await snsClient.send(new PublishCommand({
      TopicArn: config.ORDER_EVENTS_TOPIC,
      Message: snsMessage
    }));
    console.log(`SNS order event published for ${orderId}.`);

    res.status(201).json({ orderId, status: 'PENDING', amount, product: productName, quantity });
  } catch (err) {
    console.error('Failed to create order:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/transactions', async (req, res) => {
  try {
    const data = await dbClient.send(new ScanCommand({ TableName: config.TRANSACTIONS_TABLE }));
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

// Endpoint to simulate high resources / CPU spike and manually trigger SNS Alert
let mockSpikeActive = false;
app.post('/simulate-spike', async (req, res) => {
  mockSpikeActive = true;
  console.warn('⚠️ WARNING: Resource spike simulation triggered!');
  
  try {
    const msg = `CRITICAL ALERT: E-Commerce Platform detected resource usage spike on host ${os.hostname()}. CPU Load Average: 4.82, Memory Usage: 94% (Alert threshold exceeded).`;
    await snsClient.send(new PublishCommand({
      TopicArn: config.SYSTEM_ALERTS_TOPIC,
      Message: msg,
      Subject: 'CRITICAL ALERT: Kubernetes Resource Spike Detected'
    }));
    console.log('SNS resource spike alert dispatched successfully.');
    res.json({ message: 'Resource spike simulated. Email notification sent via SNS.', active: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Background monitoring loop (checks memory usage)
setInterval(async () => {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const thresholdMB = 80; // Configure a mock low threshold to showcase detection

  console.log(`[Resource Monitor] Heap Used: ${heapUsedMB}MB / Threshold: ${thresholdMB}MB`);

  // If memory usage exceeds threshold, automatically trigger alert
  if (heapUsedMB > thresholdMB) {
    console.warn(`[Resource Monitor] ⚠️ Resource threshold breached! Dispatching alert...`);
    try {
      await snsClient.send(new PublishCommand({
        TopicArn: config.SYSTEM_ALERTS_TOPIC,
        Message: `AUTOMATED SYSTEM ALERT: Container Memory Heap Usage exceeded threshold on pod ${os.hostname()}. Current Heap: ${heapUsedMB}MB (Threshold: ${thresholdMB}MB). Please inspect the workload.`,
        Subject: 'AUTOMATED ALERT: Kubernetes Container Memory Spiked'
      }));
      console.log('Automated SNS resource alert dispatched.');
    } catch (err) {
      console.error('Failed to dispatch automated resource alert:', err.message);
    }
  }
}, 30000);

const PORT = 3000;
loadConfig().then(() => {
  app.listen(PORT, () => {
    console.log(`E-Commerce API Service running on port ${PORT}`);
  });
});
