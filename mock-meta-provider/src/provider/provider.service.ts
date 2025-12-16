import { Injectable, NotFoundException, BadRequestException, HttpException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface ProviderConfig {
  failureRate: number;
  delayMaxMs: number;
  duplicateRate: number;
  outOfOrderRate: number;
}

export interface MessageRecord {
  providerMessageId: string;
  clientMessageId?: string;
  channel: string;
  to: string;
  text: string;
  status: string;
  timestamp: string;
}

@Injectable()
export class ProviderService {
  private readonly messageStore = new Map<string, MessageRecord>();
  
  private config: ProviderConfig = {
    failureRate: parseFloat(process.env.FAILURE_RATE) || 0.3,
    delayMaxMs: parseInt(process.env.DELAY_MAX_MS) || 2000,
    duplicateRate: parseFloat(process.env.DUPLICATE_RATE) || 0.2,
    outOfOrderRate: parseFloat(process.env.OUT_OF_ORDER_RATE) || 0.15,
  };

  private readonly webhookUrl = process.env.WEBHOOK_URL || 'http://api:3000/webhooks/mock-meta';

  private async randomDelay(maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * maxMs);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private shouldFail(): boolean {
    return Math.random() < this.config.failureRate;
  }

  private shouldDuplicate(): boolean {
    return Math.random() < this.config.duplicateRate;
  }

  private shouldOutOfOrder(): boolean {
    return Math.random() < this.config.outOfOrderRate;
  }

  private getRandomFailureCode(): number {
    const codes = [429, 500, 502, 503, 504];
    return codes[Math.floor(Math.random() * codes.length)];
  }

  private getErrorMessage(code: number): string {
    const messages: Record<number, string> = {
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Temporarily Unavailable',
      504: 'Gateway Timeout',
    };
    return messages[code] || 'Unknown Error';
  }

  async sendMessage(body: any) {
    const { channel, to, text, clientMessageId } = body;

    if (!channel || !to || !text) {
      throw new BadRequestException({
        success: false,
        error: 'Missing required fields: channel, to, text',
      });
    }

    if (!['whatsapp', 'instagram'].includes(channel)) {
      throw new BadRequestException({
        success: false,
        error: 'Invalid channel. Must be "whatsapp" or "instagram"',
      });
    }

    // Simulate network delay
    await this.randomDelay(this.config.delayMaxMs);

    // Simulate transient failures
    if (this.shouldFail()) {
      const errorCode = this.getRandomFailureCode();
      console.log(`Simulating failure ${errorCode} for message to ${to}`);
      
      throw new HttpException({
        success: false,
        error: this.getErrorMessage(errorCode),
        retryable: [429, 500, 502, 503, 504].includes(errorCode),
      }, errorCode);
    }

    // Success case
    const providerMessageId = `msg_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    const record: MessageRecord = {
      providerMessageId,
      clientMessageId,
      channel,
      to,
      text,
      status: 'delivered',
      timestamp,
    };

    this.messageStore.set(providerMessageId, record);

    console.log(`Message sent successfully: ${providerMessageId}`);

    return {
      success: true,
      providerMessageId,
      timestamp,
    };
  }

  async simulateInbound(body: any) {
    const { 
      eventId, 
      channel, 
      from, 
      text, 
      duplicate = false, 
      outOfOrder = false,
      webhookUrl = this.webhookUrl,
    } = body;

    if (!channel || !from || !text) {
      throw new BadRequestException({
        success: false,
        error: 'Missing required fields: channel, from, text',
      });
    }

    const finalEventId = eventId || `evt_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    const webhookPayload = {
      eventId: finalEventId,
      channel,
      from,
      text,
      timestamp,
    };

    const sendWebhook = async (payload: any, delayMs = 0) => {
      if (delayMs > 0) {
        await this.randomDelay(delayMs);
      }
      try {
        await axios.post(webhookUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        });
        console.log(`Webhook sent: ${payload.eventId}`);
      } catch (error: any) {
        // Suppress ENOTFOUND errors (no API running) - this is expected in standalone mode
        if (error.code === 'ENOTFOUND') {
          console.log(`Webhook skipped (no API): ${payload.eventId}`);
        } else {
          console.error(`Webhook failed: ${payload.eventId} - ${error.message}`);
        }
      }
    };

    const shouldSendDuplicate = duplicate || this.shouldDuplicate();
    const shouldSendOutOfOrder = outOfOrder || this.shouldOutOfOrder();

    if (shouldSendOutOfOrder) {
      const futureEventId = `evt_${uuidv4()}`;
      const futurePayload = {
        eventId: futureEventId,
        channel,
        from,
        text: `[Future Message] ${text}`,
        timestamp: new Date(Date.now() + 60000).toISOString(),
      };

      console.log(`Simulating out-of-order delivery`);
      
      // Send future message immediately
      sendWebhook(futurePayload, 0);
      // Send current message with delay
      sendWebhook(webhookPayload, 1000);
    } else {
      // Normal delivery
      sendWebhook(webhookPayload, 0);
    }

    if (shouldSendDuplicate) {
      console.log(`Simulating duplicate webhook delivery`);
      // Send duplicate with slight delay
      sendWebhook(webhookPayload, 500);
      // Sometimes send triple
      if (Math.random() < 0.3) {
        sendWebhook(webhookPayload, 1500);
      }
    }

    return {
      success: true,
      eventId: finalEventId,
      timestamp,
      simulation: {
        duplicate: shouldSendDuplicate,
        outOfOrder: shouldSendOutOfOrder,
      },
    };
  }

  getMessage(id: string) {
    const message = this.messageStore.get(id);
    if (!message) {
      throw new NotFoundException({
        success: false,
        error: 'Message not found',
      });
    }
    return {
      success: true,
      message,
    };
  }

  getConfig() {
    return {
      success: true,
      config: this.config,
    };
  }

  updateConfig(newConfig: Partial<ProviderConfig>) {
    if (newConfig.failureRate !== undefined) this.config.failureRate = newConfig.failureRate;
    if (newConfig.duplicateRate !== undefined) this.config.duplicateRate = newConfig.duplicateRate;
    if (newConfig.outOfOrderRate !== undefined)      this.config.outOfOrderRate = newConfig.outOfOrderRate;
    if (newConfig.delayMaxMs !== undefined) this.config.delayMaxMs = newConfig.delayMaxMs;

    console.log(`Config updated: ${JSON.stringify(this.config)}`);
    return {
      success: true,
      config: this.config,
    };
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'mock-meta-provider',
      timestamp: new Date().toISOString(),
      config: this.config,
    };
  }

  getStats() {
    return {
      success: true,
      stats: {
        totalMessages: this.messageStore.size,
      },
    };
  }
}
