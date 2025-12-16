# Mock Meta Provider

WhatsApp/Instagram benzeri Meta API'sini simüle eden Express.js servisi.

## Özellikler

- **Transient Failures**: %30 oranında 429, 5xx hataları döner
- **Duplicate Webhooks**: Aynı event'i birden fazla kez gönderebilir
- **Out-of-Order Events**: Event'leri sırasız gönderebilir
- **Configurable**: Tüm oranlar runtime'da değiştirilebilir

## Endpoints

### `POST /messages`
Mesaj gönderme endpoint'i.

**Request:**
```json
{
  "channel": "whatsapp",
  "to": "user-123",
  "text": "Merhaba!",
  "clientMessageId": "uuid-optional"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "providerMessageId": "msg_xxx",
  "timestamp": "2025-01-01T10:00:00Z"
}
```

**Failure Response (429, 5xx):**
```json
{
  "success": false,
  "error": "Too Many Requests - Rate limit exceeded",
  "retryable": true
}
```

---

### `POST /simulate/inbound`
Inbound mesaj simülasyonu - webhook'u NestJS API'ye gönderir.

**Request:**
```json
{
  "eventId": "evt_123",
  "channel": "whatsapp",
  "from": "user-123",
  "text": "Hi",
  "duplicate": true,
  "outOfOrder": true
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "evt_123",
  "timestamp": "2025-01-01T10:00:00Z",
  "simulation": {
    "duplicate": true,
    "outOfOrder": false
  }
}
```

---

### `POST /config`
Runtime'da simülasyon ayarlarını değiştir.

**Request:**
```json
{
  "failureRate": 0.5,
  "duplicateRate": 0.3,
  "outOfOrderRate": 0.2,
  "delayMaxMs": 3000
}
```

---

### `GET /health`
Health check endpoint'i.

---

### `GET /messages/:id`
Gönderilen mesajın durumunu sorgula.

---

### `GET /stats`
Provider istatistikleri.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | Server port |
| `WEBHOOK_URL` | `http://api:3000/webhooks/mock-meta` | Webhook gönderim adresi |
| `FAILURE_RATE` | 0.3 | Failure oranı (0-1) |
| `DUPLICATE_RATE` | 0.2 | Duplicate webhook oranı |
| `OUT_OF_ORDER_RATE` | 0.15 | Out-of-order oranı |
| `DELAY_MAX_MS` | 2000 | Max simülasyon gecikmesi |

## Docker

```bash
docker build -t mock-meta-provider .
docker run -p 4000:4000 mock-meta-provider
```

## Test Senaryoları

### 1. Normal Mesaj Gönderimi
```bash
curl -X POST http://localhost:4000/messages \
  -H "Content-Type: application/json" \
  -d '{"channel":"whatsapp","to":"user-123","text":"Test"}'
```

### 2. Duplicate Webhook Testi
```bash
curl -X POST http://localhost:4000/simulate/inbound \
  -H "Content-Type: application/json" \
  -d '{"channel":"whatsapp","from":"user-123","text":"Hi","duplicate":true}'
```

### 3. Out-of-Order Testi
```bash
curl -X POST http://localhost:4000/simulate/inbound \
  -H "Content-Type: application/json" \
  -d '{"channel":"whatsapp","from":"user-123","text":"Hi","outOfOrder":true}'
```

### 4. Failure Rate Artırma (%100 Fail)
```bash
curl -X POST http://localhost:4000/config \
  -H "Content-Type: application/json" \
  -d '{"failureRate":1.0}'
```
