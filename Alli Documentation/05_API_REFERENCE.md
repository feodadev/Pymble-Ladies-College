# Complete API Reference

## Alli API Overview

**Base URL:** https://api.myalii.app/api

**Authentication:** Bearer Token (obtained via Client Authentication endpoint)

**Content-Type:** application/json

---

## Authentication

### Client Authentication
**Purpose:** Obtain Bearer token for API access

**Endpoint:** `POST /api/Auth/Client`

**Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "clientId": "string",
  "clientSecret": "string"
}
```

**Response:**
```json
{
  "token": "string",
  "expiresIn": "number (optional)"
}
```

**Used By:**
- All scripts (via `RL_Helper.authenticate()`)

---

## Supplier Management

### 1. Get Suppliers
**Purpose:** Retrieve all suppliers

**Endpoint:** `GET /api/Supplier`

**Headers:**
- `Authorization: Bearer {token}`
- `Accept: application/json`

**Query Parameters:** None

**Response:**
```json
[
  {
    "id": "number",
    "name": "string",
    "code": "string",
    "entityName": "string",
    "address": "string",
    "email": "string",
    "bsb": "string",
    "accountNumber": "string",
    "abn": "string",
    "paymentTerms": "string"
  }
]
```

**NetSuite Mapping:**
- `code` ← NetSuite Vendor Internal ID
- `name` ← NetSuite Company Name
- `entityName` ← "Pymble Ladies College"

**Used By:**
- `updateSupplierInAlli()` (for name-to-ID mapping)

---

### 2. Create Supplier
**Purpose:** Create a new supplier in Alli

**Endpoint:** `POST /api/Supplier`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`
- `Accept: application/json`

**Request Body:**
```json
{
  "entityName": "string",
  "code": "string",
  "name": "string",
  "address": "string",
  "email": "string",
  "bsb": "string",
  "accountNumber": "string",
  "abn": "string",
  "paymentTerms": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "code": "string",
  "entityName": "string",
  "message": "string (optional)"
}
```

**NetSuite Source:**
- Vendor record fields
- Custom bank details record
- Address subrecord

**Used By:**
- `Feoda_UE_create_supplier_alii.js`
- `Feoda_MR_create_data_tables_alii.js`

---

### 3. Update Supplier
**Purpose:** Update an existing supplier

**Endpoint:** `PUT /api/Supplier/{supplierId}`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`
- `Accept: application/json`

**Path Parameters:**
- `supplierId` (number) - Alli supplier internal ID

**Request Body:** Same as Create Supplier

**Response:** Updated supplier object

**Used By:**
- `Feoda_UE_update_supplier_alii.js` (bank details changes)
- `Feoda_UE_update_vendor_supplier_alii.js` (vendor changes)
- `Feoda_MR_create_data_tables_alii.js`

---

## Invoice Management

### 4. Get Invoices (with pagination)
**Purpose:** Retrieve invoices with pagination support

**Endpoint:** `GET /api/Invoice?skip={skip}&take={take}`

**Headers:**
- `Authorization: Bearer {token}`
- `Accept: application/json`

**Query Parameters:**
- `skip` (number) - Number of records to skip (default: 0)
- `take` (number) - Number of records to retrieve (max: 2000)

**Response:**
```json
[
  {
    "id": "number",
    "invoiceNumber": "string",
    "supplierName": "string",
    "supplierCode": "string",
    "invoiceDescription": "string",
    "poNumber": "string",
    "dueDate": "string (ISO 8601)",
    "invoiceDate": "string (ISO 8601)",
    "stage": "string",
    "status": "string",
    "postingNumber": "string",
    "totalAmount": "number",
    "lines": [
      {
        "lineNumber": "number",
        "description": "string",
        "glCode": "string",
        "glDescription": "string",
        "quantity": "number",
        "unitCost": "number",
        "subtotal": "number",
        "taxAmount": "number",
        "total": "number",
        "taxCode": "string",
        "businessUnit": "string",
        "subAllocationCode": "string"
      }
    ]
  }
]
```

**Stage Values:**
- "Draft"
- "InReview"
- "FinalReview" ← Target for import
- "Posted"
- "Rejected"

**Status Values:**
- "Unpaid"
- "Paid"
- "PartiallyPaid"
- "Overdue"

**Used By:**
- `Feoda_SS_get_all_invoice_data_alii.js` (filters by stage = "FinalReview")

---

### 5. Get Invoices Ready For Post
**Purpose:** Get invoices ready to be posted to ERP (NetSuite)

**Endpoint:** `GET /api/Invoice/GetInvoicesReadyForPost/{entityId}`

**Headers:**
- `Authorization: Bearer {token}`
- `Accept: application/json`

**Path Parameters:**
- `entityId` (string) - Entity ID to filter invoices

**Response:**
```json
{
  "exportInvoices": [
    {
      // Same structure as Get Invoices
    }
  ],
  "totalCount": "number",
  "entityName": "string"
}
```

**Used By:**
- `Feoda_MR_authentication.js` (primary invoice fetch method)

**Notes:**
- Returns only invoices in "FinalReview" stage
- Pre-filtered for specific entity
- Recommended over generic Get Invoices

---

### 6. Set Invoice Paid
**Purpose:** Mark an invoice as paid

**Endpoint:** `POST /api/Invoice/SetInvoicePaid`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`
- `Accept: application/json`

**Request Body:**
```json
{
  "invoiceId": "number",
  "paid": "boolean",
  "paidDate": "string (yyyy-MM-dd HH:mm:ss)"
}
```

**Response:**
```json
{
  "isSuccessful": "boolean",
  "message": "string",
  "invoiceId": "number"
}
```

**Date Format:** `"2024-01-15 14:30:00"`

**Used By:**
- `Feoda_UE_change_posting_status_alii.js` (when vendor payment created)

**NetSuite Trigger:**
- Vendor Payment record with paid Alli bills

---

### 7. Set Invoice Posting Status
**Purpose:** Update invoice with posting status and ERP reference

**Endpoint:** `POST /api/Invoice/SetInvoicePostingStatus`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`
- `Accept: application/json`

**Request Body:**
```json
{
  "invoiceId": "number",
  "status": "number",
  "postingNumber": "string",
  "message": "string"
}
```

**Status Values:**
- `1` - Successfully Posted
- `2` - Failed to Post

**Response:**
```json
{
  "isSuccessful": "boolean",
  "message": "string",
  "invoiceId": "number"
}
```

**Used By:**
- `Feoda_MR_authentication.js` (after creating vendor bill/credit)
- `Feoda_UE_change_posting_status_alii.js` (after marking as paid)

**NetSuite Mapping:**
- `invoiceId` ← Vendor Bill external ID
- `postingNumber` ← Vendor Bill internal ID
- `message` ← Constructed message with bill details

---

## Entity Management

### 8. Get Entities
**Purpose:** Retrieve all entities

**Endpoint:** `GET /api/Entity`

**Headers:**
- `Authorization: Bearer {token}`
- `Accept: application/json`

**Response:**
```json
[
  {
    "id": "number",
    "name": "string",
    "code": "string",
    "currency": "string"
  }
]
```

**Used By:**
- `Feoda_MR_create_data_tables_alii.js` (verification)

---

### 9. Create Entity
**Purpose:** Create a new entity (subsidiary/company)

**Endpoint:** `POST /api/Entity`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "name": "string",
  "code": "string",
  "currency": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "code": "string",
  "currency": "string"
}
```

**NetSuite Mapping:**
- `name` ← Subsidiary name
- `code` ← Subsidiary code or "null"
- `currency` ← Currency code

**Used By:**
- `Feoda_MR_create_data_tables_alii.js`

---

## GL Code Management

### 10. Get GL Codes
**Purpose:** Retrieve all GL codes

**Endpoint:** `GET /api/GLCode`

**Headers:**
- `Authorization: Bearer {token}`
- `Accept: application/json`

**Response:**
```json
[
  {
    "id": "number",
    "entityName": "string",
    "accountCode": "string",
    "description": "string",
    "defaultTaxCode": "string",
    "businessUnitsLinked": ["string"]
  }
]
```

**Used By:**
- `Feoda_MR_create_data_tables_alii.js` (verification)

---

### 11. Create GL Code
**Purpose:** Create a new GL code/account

**Endpoint:** `POST /api/GLCode`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "entityName": "string",
  "accountCode": "string",
  "description": "string",
  "defaultTaxCode": "string",
  "businessUnitsLinked": ["string"]
}
```

**Response:**
```json
{
  "id": "number",
  "accountCode": "string",
  "description": "string"
}
```

**NetSuite Mapping:**
- `entityName` ← "Pymble Ladies College"
- `accountCode` ← Account number
- `description` ← Account name
- `businessUnitsLinked` ← Array of department names

**Used By:**
- `Feoda_MR_create_data_tables_alii.js`

**GL Code Format in Invoices:**
- Format: `{accountCode}-{locationId}-{classId}-{departmentCode}`
- Example: `"1410-W-C3-Facilities"`

---

## Business Unit Management

### 12. Create Business Unit
**Purpose:** Create a new business unit (department/division)

**Endpoint:** `POST /api/BusinessUnit`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "entityName": "string",
  "name": "string",
  "code": "string"
}
```

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "code": "string"
}
```

**NetSuite Mapping:**
- `entityName` ← "Pymble Ladies College"
- `name` ← Department name
- `code` ← Department internal ID

**Used By:**
- `Feoda_MR_create_data_tables_alii.js`

---

## Tax Code Management

### 13. Create Tax Code
**Purpose:** Create a new tax code

**Endpoint:** `POST /api/TaxCode`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "entityName": "string",
  "name": "string",
  "description": "string",
  "percentage": "number"
}
```

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "percentage": "number"
}
```

**NetSuite Mapping:**
- `entityName` ← "Pymble Ladies College"
- `name` ← Tax code name/item ID
- `description` ← Tax code description
- `percentage` ← Numeric percentage (e.g., 10.00 for 10%)

**Used By:**
- `Feoda_MR_create_data_tables_alii.js`

**Note:** NetSuite stores as "10.00%", converted to number 10.00

---

## Sub-Allocation Management

### 14. Create Sub-Allocation
**Purpose:** Create a new sub-allocation (project/job)

**Endpoint:** `POST /api/SubAllocation`

**Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "entityName": "string",
  "name": "string",
  "code": "string",
  "linkedGLAccountCodes": ["string"]
}
```

**Response:**
```json
{
  "id": "number",
  "name": "string",
  "code": "string"
}
```

**NetSuite Mapping:**
- `entityName` ← "Pymble Ladies College"
- `name` ← Job company name
- `code` ← Job internal ID
- `linkedGLAccountCodes` ← Hardcoded ['3800-2-102-000']

**Used By:**
- `Feoda_MR_create_data_tables_alii.js`

---

## API Response Patterns

### Success Response (2xx)
```json
{
  "id": "number",
  "isSuccessful": true,
  "message": "Success",
  // ... entity-specific fields
}
```

### Error Response (4xx, 5xx)
```json
{
  "isSuccessful": false,
  "message": "Error description",
  "errors": [
    {
      "field": "string",
      "message": "string"
    }
  ]
}
```

### Common HTTP Status Codes
- `200 OK` - Success (GET, PUT)
- `201 Created` - Success (POST)
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource
- `500 Internal Server Error` - Server error
