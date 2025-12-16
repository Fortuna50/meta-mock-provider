const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://api:3000/webhooks/mock-meta';

// Middleware
app.use(cors());
app.use(express.json());

// Configuration for failure simulation
const config = {
  failureRate: parseFloat(process.env.FAILURE_RATE) || 0.3,      // 30% chance of failure
  delayMaxMs: parseInt(process.env.DELAY_MAX_MS) || 2000,        // Max delay in ms
  duplicateRate: parseFloat(process.env.DUPLICATE_RATE) || 0.2,  // 20% chance of duplicate
  outOfOrderRate: parseFloat(process.env.OUT_OF_ORDER_RATE) || 0.15, // 15% chance of out-of-order
};

// Store for tracking messages (in-memory)
const messageStore = new Map();
const pendingWebhooks = [];

// Utility functions
const randomDelay = (maxMs) => new Promise(resolve => 
  setTimeout(resolve, Math.floor(Math.random() * maxMs))
);

const shouldFail = () => Math.random() < config.failureRate;
const shouldDuplicate = () => Math.random() < config.duplicateRate;
const shouldOutOfOrder = () => Math.random() < config.outOfOrderRate;

const getRandomFailureCode = () => {
  const codes = [429, 500, 502, 503, 504];
  return codes[Math.floor(Math.random() * codes.length)];
};

const getErrorMessage = (code) => {
  const messages = {
    429: 'Too Many Requests - Rate limit exceeded',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Temporarily Unavailable',
    504: 'Gateway Timeout',
  };
  return messages[code] || 'Unknown Error';
};

// ============================================
// POST /messages - Send message endpoint
// ============================================
app.post('/messages', async (req, res) => {
  const { channel, to, text, clientMessageId } = req.body;

  // Validate required fields
  if (!channel || !to || !text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: channel, to, text',
    });
  }

  // Validate channel
  if (!['whatsapp', 'instagram'].includes(channel)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid channel. Must be "whatsapp" or "instagram"',
    });
  }

  // Simulate network delay
  await randomDelay(config.delayMaxMs);

  // Simulate transient failures
  if (shouldFail()) {
    const errorCode = getRandomFailureCode();
    console.log(`[MOCK] Simulating failure ${errorCode} for message to ${to}`);
    return res.status(errorCode).json({
      success: false,
      error: getErrorMessage(errorCode),
      retryable: [429, 500, 502, 503, 504].includes(errorCode),
    });
  }

  // Success case
  const providerMessageId = `msg_${uuidv4()}`;
  const timestamp = new Date().toISOString();

  // Store message
  messageStore.set(providerMessageId, {
    providerMessageId,
    clientMessageId,
    channel,
    to,
    text,
    status: 'delivered',
    timestamp,
  });

  console.log(`[MOCK] Message sent successfully: ${providerMessageId}`);

  return res.status(200).json({
    success: true,
    providerMessageId,
    timestamp,
  });
});

// ============================================
// POST /simulate/inbound - Simulate inbound message
// ============================================
app.post('/simulate/inbound', async (req, res) => {
  const { 
    eventId, 
    channel, 
    from, 
    text, 
    duplicate = false, 
    outOfOrder = false,
    webhookUrl = WEBHOOK_URL,
  } = req.body;

  // Validate required fields
  if (!channel || !from || !text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: channel, from, text',
    });
  }

  // Generate eventId if not provided
  const finalEventId = eventId || `evt_${uuidv4()}`;
  const timestamp = new Date().toISOString();

  const webhookPayload = {
    eventId: finalEventId,
    channel,
    from,
    text,
    timestamp,
  };

  const sendWebhook = async (payload, delayMs = 0) => {
    if (delayMs > 0) {
      await randomDelay(delayMs);
    }
    try {
      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
      console.log(`[MOCK] Webhook sent: ${payload.eventId}`);
    } catch (error) {
      console.error(`[MOCK] Webhook failed: ${payload.eventId}`, error.message);
    }
  };

  // Determine behavior based on flags or random
  const shouldSendDuplicate = duplicate || shouldDuplicate();
  const shouldSendOutOfOrder = outOfOrder || shouldOutOfOrder();

  if (shouldSendOutOfOrder) {
    // Out of order: Send a "future" message first, then the current one
    const futureEventId = `evt_${uuidv4()}`;
    const futurePayload = {
      eventId: futureEventId,
      channel,
      from,
      text: `[Future Message] ${text}`,
      timestamp: new Date(Date.now() + 60000).toISOString(),
    };

    console.log(`[MOCK] Simulating out-of-order delivery`);
    
    // Send future message immediately
    sendWebhook(futurePayload, 0);
    // Send current message with delay
    sendWebhook(webhookPayload, 1000);
  } else {
    // Normal delivery
    sendWebhook(webhookPayload, 0);
  }

  // Handle duplicate delivery
  if (shouldSendDuplicate) {
    console.log(`[MOCK] Simulating duplicate webhook delivery`);
    // Send duplicate with slight delay
    sendWebhook(webhookPayload, 500);
    // Sometimes send triple
    if (Math.random() < 0.3) {
      sendWebhook(webhookPayload, 1500);
    }
  }

  return res.status(200).json({
    success: true,
    eventId: finalEventId,
    timestamp,
    simulation: {
      duplicate: shouldSendDuplicate,
      outOfOrder: shouldSendOutOfOrder,
    },
  });
});

// ============================================
// GET /messages/:id - Get message status
// ============================================
app.get('/messages/:id', (req, res) => {
  const { id } = req.params;
  const message = messageStore.get(id);

  if (!message) {
    return res.status(404).json({
      success: false,
      error: 'Message not found',
    });
  }

  return res.status(200).json({
    success: true,
    message,
  });
});

// ============================================
// GET /health - Health check
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'mock-meta-provider',
    timestamp: new Date().toISOString(),
    config: {
      failureRate: config.failureRate,
      duplicateRate: config.duplicateRate,
      outOfOrderRate: config.outOfOrderRate,
      delayMaxMs: config.delayMaxMs,
    },
  });
});

// ============================================
// POST /config - Update simulation config
// ============================================
app.post('/config', (req, res) => {
  const { failureRate, duplicateRate, outOfOrderRate, delayMaxMs } = req.body;

  if (failureRate !== undefined) config.failureRate = failureRate;
  if (duplicateRate !== undefined) config.duplicateRate = duplicateRate;
  if (outOfOrderRate !== undefined) config.outOfOrderRate = outOfOrderRate;
  if (delayMaxMs !== undefined) config.delayMaxMs = delayMaxMs;

  console.log('[MOCK] Config updated:', config);

  return res.status(200).json({
    success: true,
    config,
  });
});

// ============================================
// GET /stats - Get provider statistics
// ============================================
app.get('/stats', (req, res) => {
  res.status(200).json({
    success: true,
    stats: {
      totalMessages: messageStore.size,
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Mock Meta Provider Started                      ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║  Webhook URL: ${WEBHOOK_URL.padEnd(40)}║
╠═══════════════════════════════════════════════════════════╣
║  Simulation Config:                                       ║
║    - Failure Rate: ${(config.failureRate * 100).toFixed(0)}%                                   ║
║    - Duplicate Rate: ${(config.duplicateRate * 100).toFixed(0)}%                                 ║
║    - Out-of-Order Rate: ${(config.outOfOrderRate * 100).toFixed(0)}%                              ║
║    - Max Delay: ${config.delayMaxMs}ms                                   ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
