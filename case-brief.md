# NestJS Backend Engineer – Take-Home Assignment

| **Field** | **Value** |
|-----------|-----------|
| **Role** | Backend Engineer (NestJS) |
| **Task** | Messaging Gateway Microservice (Meta-like) – Inbox, Webhook & Send Message |
| **Time Allotment** | 3 Days |
| **Submission Format** | Public Git repository (GitHub / GitLab) |

---

## 1) Introduction & Scenario

You will build a **greenfield messaging gateway microservice** that powers a simple customer inbox system.

The service integrates with a **Mock Meta Provider** (included via Docker Compose). This provider simulates real-world Meta-like behavior:

- Duplicate webhook deliveries (same event sent multiple times)
- Out-of-order inbound events
- Transient send failures (429, 5xx)
- Delayed deliveries

> **Important:** This assignment does not require any real Meta API usage, app creation, or credentials.

### Core Engineering Challenge

**Reliability under concurrency:**

- Webhooks can arrive multiple times.
- Outbound message sends can fail and must be retried safely.
- The system must never create duplicate messages or inconsistent conversation state.

---

## 2) Functional Requirements

### A. Inbox API (Read-Heavy)

#### `GET /conversations`

List conversations.

**Query params:**
| Param | Description |
|-------|-------------|
| `page` | default: 1 |
| `limit` | default: 20 |
| `channel` | optional: `whatsapp` \| `instagram` |
| `status` | optional: `open` \| `closed` |

**Response (example):**

```json
{
  "data": [
    {
      "id": "conv_1",
      "channel": "whatsapp",
      "participantId": "user-123",
      "lastMessagePreview": "Merhaba",
      "lastMessageAt": "2025-01-01T10:00:00Z",
      "unreadCount": 2
    }
  ],
  "meta": { "page": 1, "limit": 20 }
}
```

#### `GET /conversations/:id`

Get conversation details.

**Query params:**
| Param | Description |
|-------|-------------|
| `page` | default: 1 |
| `limit` | default: 50 |

**Returns:**
- Conversation metadata
- Messages (paginated, newest first)

#### `POST /conversations/:id/read`

Marks the conversation as read.

**Logic:**
- Sets `unreadCount = 0`
- Updates `lastReadAt`

#### `GET /health`

Simple liveness check.

---

### B. Webhook Ingestion API (Write-Heavy & Idempotent)

#### `POST /webhooks/mock-meta`

Receives inbound message events from the mock provider.

**Inbound payload (fixed contract):**

```json
{
  "eventId": "evt_123",
  "channel": "whatsapp",
  "from": "user-123",
  "text": "Hello",
  "timestamp": "2025-01-01T10:00:00Z"
}
```

**Required logic:**
- `eventId` is mandatory and globally unique per provider.
- Persist webhook events in PostgreSQL.
- **Idempotency:** If the same `eventId` is received again, it must be ignored safely.
- Create or update the conversation.
- Insert inbound message.
- Increment `unreadCount`.
- All steps must run inside a **single database transaction**.

---

### C. Messaging API (Transactional & Idempotent)

#### `POST /messages/send`

Send a text message to a participant via the mock provider.

**Input:**

```json
{
  "channel": "whatsapp",
  "to": "user-123",
  "text": "Merhaba!",
  "clientMessageId": "uuid-optional"
}
```

**Rules:**
- `clientMessageId` is optional but must be idempotent if provided.
- Create message record first with status `PENDING`.
- Attempt to send via mock provider.
- On success → mark `SENT` and store `providerMessageId`.
- On failure → mark `FAILED` with error details.

**Idempotent behavior:**

If the same `(channel, clientMessageId)` is sent again:
- Do not create a new message.
- Return the existing message record and its current status.

#### `GET /messages/:id`

Returns message metadata and status: `PENDING` | `SENT` | `FAILED`

---

## 3) Technical Requirements

### A. Technology Stack

| Component | Technology |
|-----------|------------|
| **Framework** | NestJS |
| **Database** | PostgreSQL |
| **ORM** | Prisma or TypeORM |
| **Containerization** | Docker Compose |

**Must run with a single command:**

```bash
docker-compose up
```

**Services required in docker-compose:**
- `api` (NestJS)
- `postgres`
- `mock-meta-provider`

---

### B. Reliability & Concurrency (Evaluation Core)

> ⚠️ A naive "check then update" approach is **insufficient**.

#### Required Guarantees

##### 1) Webhook Idempotency
- Dedicated `webhook_events` table.
- Unique constraint on `(provider, eventId)`.
- Duplicate webhook deliveries must not create duplicate messages.

##### 2) Outbound Idempotency
- Enforce uniqueness on `(channel, clientMessageId)` (when provided).
- Duplicate send requests must return the same message record.

##### 3) Retry & Outbox Strategy
- Messages in `FAILED` state may be retried.
- **Retryable errors:**
  - `429`
  - `5xx`
  - network timeouts
- **Non-retryable:**
  - other `4xx`

##### 4) Safe Retry Claiming (Concurrency)
- Retry worker must atomically claim messages to retry.
- **Examples of acceptable approaches:**
  - `SELECT … FOR UPDATE SKIP LOCKED`
  - Atomic `UPDATE ... WHERE status IN (...) RETURNING *`
- Multiple workers must never retry the same message simultaneously.

---

### C. Code Quality & Architecture

**Modular NestJS structure:**
- `ConversationModule`
- `MessageModule`
- `WebhookModule`
- `ProviderModule`

**Additional requirements:**
- DTO validation with `class-validator` & `class-transformer`
- Swagger docs at `/api`
- Migrations + `SCHEMA.md` explaining:
  - Table relationships
  - Unique constraints
  - Concurrency decisions

---

## 4) Bonus Points (Optional)

- **E2E tests** covering:
  - Duplicate webhook delivery
  - Idempotent message send
  - Retry after transient failure
- **Seed script** for demo data
- **Soft delete / archive** conversations (`archivedAt`)

---

## 5) Deliverables

**Repository must include:**

- ✅ Source code
- ✅ `Dockerfile` + `docker-compose.yml`
- ✅ `README.md` with:
  - Setup instructions
  - Swagger URL (`http://localhost:3000/api`)
  - Brief explanation of idempotency & retry strategy
  - How to trigger mock failure scenarios

---

## Mock Meta Provider Contract

**Runs at:** `http://localhost:4000`

### Send message

```
POST /messages
```
- `200` → success
- `429 / 5xx` → transient failure

### Simulate inbound message

```
POST /simulate/inbound
```

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

---

## Minimum Required Endpoints

| Method | Endpoint |
|--------|----------|
| `POST` | `/messages/send` |
| `POST` | `/webhooks/mock-meta` |
| `GET` | `/conversations` |
| `GET` | `/conversations/:id` |
| `POST` | `/conversations/:id/read` |
| `GET` | `/messages/:id` |
| `GET` | `/health` |
