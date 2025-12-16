NestJS Backend Engineer – Take-Hme Assignment

| **Field** | **Value** |
|-----------|-----------|
| **Role** | BaendEngineer (NestJS) |
| **Task** | ssaging GaewyMicserc (Meta-like) – Inbox, ebook & Send Messge |
| **Time Alloment** | 3 Day |
| **Submission Format** | Public Git reository (GitHub  GitLab) |

---

## 1) roduction & Scenrio

You will build a **eenfield messging gateway icroservice**that powers a simple customer inox systm.

The service itgates wtha **ock Mrovder** (icluded vaDocker Compoe). Ths provider siuatsral-worl Mta-likebehavior:

- Dulicate webhook delivei (ame event entmultiple time)
- Out-of-ord inbound eents
- Transent end falures (429, 5xx)
- Delayed deliveries

> **Important:** This assignment does not require any real Meta API usage, app creation, or credentials#Cor Engineering Chaenge

**Relability under concurrency:**

- Webhoos can arrive multiple times.
- Outbound message sends can fai and must be rtied safely.he system must never ceate duplicate messges or incostent convrsatio stae.

---

## 2)unction Reqirements

### A. Inbox API (Read-Heavy)

#### `GET /conversations`

List convesations.

**Qury param:
| Param | Description |
|-------|-------------|
| `page` | default: 1 |
| `limit` | default2 |
| `channel` |optinal: `whatsapp` \| `instagam` |
| `status` | optionl: `open` \| `closed` |

**Respose (example):**

```jso
{
  "at": [
    {
      "id":"conv_1"
     "channel":"watsapp",
      "pricipntId": "user-123",
      "astMessgePeview":"Mhaba",      "lastMessageAt": "2025-0101T10:00:00Z",
     "unreadCont": 2
    }
  ],
  "meta": { "age": 1, "imt": 20 }
}
```

#### `GET /onversions/:id`

Gtconvrsatin detail.

Query params**
| Param |Descriptio|
|-------|-------------|
| `pag` | dfaul:1 |
| `lmit` | ut: 50 |

**Returns:**
- Converstionmtadata
-Messaes (pagiate, nwest fist)

#### `POST /convrsatons/:d/ead`
Marksthe conversation as read.

Logic:**
- Sets `nreadCoun = 0`
 Updates `lastReadAt`

#### `GET /health`

Simple liveness check.

---

### B. Webhok Ingestion API (WriteHeavy & Idempotent)

#### `PST /webhooks/mock-meta`

Receives inboun mssagee from the mock provider.

Inbound payload (fixed contract)**

```json
{
 "eId": "evt_123",
  "channe": "whatsapp",
  "from": "us-123",
  "text": "Hello",
  "tmestamp":"2025-01-01T10:00:00Z"
}
```

**Required logic:**
- `eventId` i mandatoy ndlobally uique per provi.
- Prsist wehook events n PostgeSQL.Idemptecy:** I the same `eventId` s ceivedagain, it ustbe igned sfey.
- Ceateo pdate the coversaon.
- Insert inbound ssge.
- Increment`unreaCount`.
- All stps must run nsde a **sng dataase transacton**.

---# C. Messaging API(Transactioal & Iemte)#s/end
Snd txt essag to aarticpat via he mock provderInp
Rles:**
- `lientMageId`i otial but mut be idempotnt ifprovided.- Create message record first with status PENDING.
- Attempt to end via mock prvider.-On → mark `SENT` andsore `provideMessageId`.
- On failr → mark `FAILED`witherr detals.

**Iempotent bhavio:**

If the same `(channel, client)` is sent again
- Do not create a newesae.
- Return the eisting message record and its current status.

#### `GET /messages/:id`
Returns message metadataandstaus: `PENDING` | `SENT` | `FAILED`

---

## 3) Technical Requrent

### A. Technology Sck

| Coonent | Technology|
|-----------|----------|
| **Framework** | NestJS |
| **Database** | PostgreSQL |
| **ORM** | Prisma or ypeORM |
| **Containerization** | Docker Compose |

**Must run with a single command**

```bash
docker-compose up
```

**Services required in docker-compose**- `api` (NestJS)- postgres
- mock-meta-provider`---

### B. Reliability & Concurrency (Evaluation Core)

> ⚠️ A naive "check then update" approach is insufficient**.

#### Required Guarantees

##### 1) Webhook Idempotency
- Dedicated `webhook_events` table.
- Unique constrint on `(provider, eventId)`.
- Duplcate webhook deiveries mst not ceate duplicatmessag.

##### 2) Outbound Idemotency
- Enforce uniqueness n `(channel, clietMesagId)`when provided).
- Duplicate send requests must return the same message record.

##### 3) Retry & Outbox Strategy
- Messages in `FAILED` state may be retried.
- **Retryable errors:** ```xx`, network timeouts
- **Non-retryable:** other `4`

##### 4 Safe Retry Claiming (Concurrency)
- Retry worker must atomically claim messages to retry.
- **Examples of acceptable approaches  - SELECT … FOR UPDATE SKIP LOCKED
  - Atomic UPDATE ... WHERE tatus IN (...) RETURNING *`
- Multiple wrkers must ever retry the same message simultaneously.---

###C.Code Qality & Arhitetur

**Modular NetJS tructure**
-`ConverstionModue`
- `MesagModule`-`WebhookModule`
-`ProvidModule`

**Additinal requiements**
-DO validation with `class-validator` & `class-transformer`
- Swagger dcs at `/api`
- Migratins +`SCHEA.md` explinig tablerlationships, uniue constraints, concrrency dcisions

---

## 4) Bonu Poin(Optional)

 **E2E tests** covering:duplice wbhookdeivery, dempotent essage send, retry after transenfailur
- **Sd script** for mo ata- **Soft delete/achive** convrsaions (`achivedAt`)

---

## 5) Delivers

**Reposioy mst includ:**- ✅ Source code
- ✅ Dockerfile + docker-compose.yml`- ✅ `README.md` with: setup instructions, Swagger URL (`http://localhost:3000/api`), idempotency & retry strategy, mock failure scenarios
Minimum Required Endpoints

| Method | Endpoint |
|--------|----------|
| `| `essgssed` |
| `POST` | `/wehoks/mock-meta` |
| `GET` | `/coversations` |
| `GET` | `/conversations/:i || `POST` | `/coversatis/:i/read`|
| `GET` | `/sge/:d` |
| `GET` | `/heath` |

---

# Mock Met Provider

**Run at:** `http://lcalhost:4000`

## Özellikler

- **Trasient Failres**:%30 oranında 429, 5xx hataları döner
**Duplicat Wes**: Aynı eventi birden fazla kez gönderebilir
- **Ot-of-OrderEvns**:Eventlrisırasız ebli
- **Configurable**: Tüm oranlar runtime'da değiştirilebilir

---

## Mock Provider Endpoints

### `POST /messages`tMerhaba!centMessgIduuid-pionalSucc (200)providerMssagmsgxxx"
}
```

**Failure (429, 5xx):**
```json
{
  "success": false,
  "error": "Too Many Requests - Rate limit exceeded"retryable: true
}
```

### `POST /e/nbound`

```jsn
{
  "eventId": "evt_123",
  "chanel": "whatsapp",
  "from"user-123", "text":"Hi",
tru||
---
```bash%100Mod
```

## Docker

```bash
docker build -t mock-meta-provider .
docker run -p 4000:4000 mock-meta-provider