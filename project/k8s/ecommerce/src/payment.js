const express = require('express');
const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const app = express();
app.use(express.json());

const awsEndpoint = process.env.AWS_ENDPOINT || 'http://host.minikube.internal:4566';
const awsRegion = process.env.AWS_REGION || 'us-east-1';
const secretName = process.env.SECRETS_NAME || 'dev-ecommerce-secrets';

const dbClient = new DynamoDBClient({ endpoint: awsEndpoint, region: awsRegion });
const secretsClient = new SecretsManagerClient({ endpoint: awsEndpoint, region: awsRegion });

let config = {
  PAYMENTS_TABLE: 'dev-ecommerce-payments'
};

async function loadConfig() {
  try {
    console.log(`Fetching configuration from Secrets Manager: ${secretName}...`);
    const data = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      config = { ...config, ...secrets };
      console.log('Payment Service configuration loaded:', config);
    }
  } catch (err) {
    console.error('Failed to load config from Secrets Manager:', err.message);
  }
}

// POST /charge
app.post('/charge', async (req, res) => {
  const { orderId, amount, product_id, quantity } = req.body;
  if (!orderId || !amount) {
    return res.status(400).json({ error: 'orderId and amount are required' });
  }

  const paymentId = 'pay_' + Math.random().toString(36).substr(2, 9);
  console.log(`Processing payment ${paymentId} for Order ${orderId} ($${amount})`);

  try {
    // Write payment record to DynamoDB
    await dbClient.send(new PutItemCommand({
      TableName: config.PAYMENTS_TABLE,
      Item: {
        payment_id: { S: paymentId },
        order_id: { S: orderId },
        product_id: { S: product_id || 'unknown' },
        quantity: { N: (quantity || 1).toString() },
        amount: { N: amount.toString() },
        status: { S: 'SUCCESS' },
        createdAt: { S: new Date().toISOString() }
      }
    }));

    res.status(201).json({ paymentId, orderId, status: 'SUCCESS', amount });
  } catch (err) {
    console.error('Failed to record payment:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /ledger
app.get('/ledger', async (req, res) => {
  try {
    const data = await dbClient.send(new ScanCommand({ TableName: config.PAYMENTS_TABLE }));
    const payments = data.Items.map(item => ({
      payment_id: item.payment_id.S,
      order_id: item.order_id.S,
      product_id: item.product_id ? item.product_id.S : 'unknown',
      quantity: item.quantity ? parseInt(item.quantity.N) : 1,
      amount: parseFloat(item.amount.N),
      status: item.status.S,
      createdAt: item.createdAt.S
    }));
    res.json(payments);
  } catch (err) {
    console.error('Failed to retrieve payment ledger:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
loadConfig().then(() => {
  app.listen(PORT, () => {
    console.log(`Payment Service running on port ${PORT}`);
  });
});
