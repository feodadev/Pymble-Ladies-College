# Library Scripts Documentation

## 1. Feoda_functions_help.js

**Type:** Library Module  
**API Version:** 2.1  
**Module Scope:** Public  
**File Path:** Libraries/Feoda_functions_help.js

### Purpose
Helper library that provides utility functions for integration logging. This is a simplified version focused on creating integration log records.

### Functions

#### createIntegrationLog(logData)
Creates a custom integration log record to track API operations and their results.

**Input Parameters:**
- `logData` (Object):
  - `transactionType` (Number) - Type of transaction (default: 2) (2: general/default category for various operations, 19: "Payment Sync" or "Payment Processing")
  - `method` (String) - HTTP method (e.g., 'POST', 'GET', 'PUT')
  - `responseCode` (Number) - HTTP response code
  - `totalProcessed` (Number) - Total records processed
  - `successful` (Number) - Number of successful operations
  - `failed` (Number) - Number of failed operations
  - `skipped` (Number) - Number of skipped operations
  - `successfulInvoices` (Array) - Array of successful invoice objects
  - `failedInvoices` (Array) - Array of failed invoice objects
  - `skippedInvoices` (Array) - Array of skipped invoice objects
  - `status` (String) - Overall status ('Success', 'Failed', 'Partial')
  - `errorMessage` (String) - Error message if any
  - `requestUrl` (String) - API endpoint URL

**Output:**
- Returns the internal ID of the created log record (Number)
- Returns `null` if creation fails

**Custom Record Fields Used:**
- `custrecord_il_transaction_type`
- `custrecord_il_request_method`
- `custrecord_il_response_code`
- `custrecord_il_execution_summary`
- `custrecord_il_response_body`
- `custrecord_il_status`
- `custrecord_il_error_message`
- `custrecord_il_summary_error_message`
- `custrecord_il_request_url`
- `custrecord_il_integration_type`
- `custrecord_il_timestamp`

**Alli API Mapping:** None (Internal NetSuite function only)

---

## 2. Feoda_RL_Helper.js

**Type:** Library Module (Restlet Helper)  
**API Version:** 2.1  
**Module Scope:** Public  
**File Path:** Libraries/Feoda_RL_Helper.js

### Purpose
Main helper library containing all Alli API integration functions. Handles authentication, data retrieval, and data synchronization between NetSuite and Alli.

### Constants
- `BASE_URL` = 'https://api.myalii.app/api'

---

### Functions

#### 1. authenticate(sbKeys, prodKeys)

**Purpose:** Authenticate with Alli API and retrieve Bearer token

**Alli API:**
- **Name:** Client Authentication
- **Endpoint:** `POST /api/Auth/Client`
- **Input (Body):** API credentials (JSON string)
  ```json
  {
    "clientId": "string",
    "clientSecret": "string"
  }
  ```
- **Output:**
  ```json
  {
    "token": "string"
  }
  ```

**NetSuite Input:**
- `sbKeys` (String) - Sandbox API keys (JSON string)
- `prodKeys` (String) - Production API keys (JSON string)

**NetSuite Output:**
- Returns Bearer token (String)
- Returns `undefined` on error

---

#### 2. getSuppliersFromAlii(token)

**Purpose:** Retrieve all suppliers from Alli

**Alli API:**
- **Name:** Get Suppliers
- **Endpoint:** `GET /api/Supplier`
- **Headers:** `Authorization: Bearer {token}`
- **Input:** None (query parameters)
- **Output:**
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

**NetSuite Input:**
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns array of supplier objects
- Returns empty array `[]` on error

**Field Mapping:** Direct mapping, no conversion needed

---

#### 3. getEntity(token)

**Purpose:** Retrieve entities from Alli

**Alli API:**
- **Name:** Get Entities
- **Endpoint:** `GET /api/Entity`
- **Headers:** `Authorization: Bearer {token}`
- **Input:** None
- **Output:**
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

**NetSuite Input:**
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns array of entity objects
- Returns empty array `[]` on error

---

#### 4. getGLCodes(token)

**Purpose:** Retrieve GL Codes from Alli

**Alli API:**
- **Name:** Get GL Codes
- **Endpoint:** `GET /api/GLCode`
- **Headers:** `Authorization: Bearer {token}`
- **Input:** None
- **Output:**
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

**NetSuite Input:**
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns array of GL code objects
- Returns empty array `[]` on error

---

#### 5. createEntitiesInAlli(bodyData, token)

**Purpose:** Create entities in Alli from NetSuite subsidiaries

**Alli API:**
- **Name:** Create Entity
- **Endpoint:** `POST /api/Entity`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):**
  ```json
  {
    "name": "string",
    "code": "string",
    "currency": "string"
  }
  ```
- **Output:**
  ```json
  {
    "id": "number",
    "name": "string",
    "code": "string",
    "currency": "string"
  }
  ```

**NetSuite Input:**
- `bodyData` (Object) - Keyed object of entities
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite `entityId` → Alli `name`
- NetSuite `code` → Alli `code`
- NetSuite `currency` → Alli `currency`

---

#### 6. createSupplierInAlli(vendorData, entityName, token)

**Purpose:** Create suppliers in Alli from NetSuite vendors

**Alli API:**
- **Name:** Create Supplier
- **Endpoint:** `POST /api/Supplier`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):**
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
- **Output:**
  ```json
  {
    "id": "number",
    "name": "string",
    "code": "string",
    "entityName": "string"
  }
  ```

**NetSuite Input:**
- `vendorData` (Object) - Vendor data from NetSuite
- `entityName` (String) - Entity name (subsidiary)
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite `internalId` → Alli `code`
- NetSuite `companyName` → Alli `name`
- NetSuite `address` → Alli `address` (newlines converted to spaces)
- NetSuite `email` → Alli `email`
- NetSuite `bsb` → Alli `bsb`
- NetSuite `accountNumber` → Alli `accountNumber`
- NetSuite `abn` → Alli `abn`
- NetSuite `paymentTerms` → Alli `paymentTerms`

---

#### 7. updateSupplierInAlli(vendorData, entityId, token)

**Purpose:** Update existing suppliers in Alli

**Alli API:**
- **Name:** Update Supplier
- **Endpoint:** `PUT /api/Supplier/{supplierId}`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):** Same as createSupplierInAlli
- **Output:** Updated supplier object

**NetSuite Input:**
- `vendorData` (Object) - Vendor data from NetSuite
- `entityId` (String) - Entity name (subsidiary)
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `notFound`, `totalProcessed` arrays

**Field Mapping:** Same as createSupplierInAlli

**Special Logic:**
- First retrieves all Alli suppliers using `getSuppliersFromAlii()`
- Creates name-to-ID mapping
- Only updates suppliers that exist in Alli
- Records suppliers not found in `notFound` array

---

#### 8. getInvoiceFromAlii(token)

**Purpose:** Retrieve invoices from Alli with pagination (stage = "FinalReview")

**Alli API:**
- **Name:** Get Invoices
- **Endpoint:** `GET /api/Invoice?skip={skip}&take={take}`
- **Headers:** `Authorization: Bearer {token}`
- **Query Parameters:**
  - `skip` (Number) - Number of records to skip
  - `take` (Number) - Number of records to retrieve (pageSize: 2000)
- **Output:**
  ```json
  [
    {
      "id": "number",
      "invoiceNumber": "string",
      "supplierName": "string",
      "invoiceDescription": "string",
      "poNumber": "string",
      "dueDate": "string (ISO date)",
      "stage": "string",
      "status": "string",
      "postingNumber": "string",
      "lines": [
        {
          "description": "string",
          "glCode": "string",
          "quantity": "number",
          "unitCost": "number",
          "subtotal": "number",
          "total": "number",
          "taxCode": "string",
          "subAllocationCode": "string"
        }
      ]
    }
  ]
  ```

**NetSuite Input:**
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns object:
  ```javascript
  {
    invoices: [...], // Array of invoices with stage = "FinalReview"
    code: 200,
    method: 'GET',
    reqUrl: 'API URL'
  }
  ```

**Special Logic:**
- Implements pagination with skip/take
- Page size: 2000 records
- Filters only invoices with `stage === 'FinalReview'`
- Safety limit: 20 pages max

---

#### 9. getInvoicesReadyForPost(token, entityId)

**Purpose:** Get invoices ready for posting to NetSuite

**Alli API:**
- **Name:** Get Invoices Ready For Post
- **Endpoint:** `GET /api/Invoice/GetInvoicesReadyForPost/{entityId}`
- **Headers:** `Authorization: Bearer {token}`
- **Input:** `entityId` in URL path
- **Output:**
  ```json
  {
    "exportInvoices": [
      {
        // Same structure as getInvoiceFromAlii
      }
    ]
  }
  ```

**NetSuite Input:**
- `token` (String) - Bearer authentication token
- `entityId` (String) - Entity ID to filter invoices

**NetSuite Output:**
- Returns object with `invoices`, `code`, `method`, `reqUrl`

---

#### 10. SetInvoicePaidInAlii(bodyData, token)

**Purpose:** Mark invoices as paid in Alli

**Alli API:**
- **Name:** Set Invoice Paid
- **Endpoint:** `POST /api/Invoice/SetInvoicePaid`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):**
  ```json
  {
    "invoiceId": "number",
    "paid": "boolean",
    "paidDate": "string (yyyy-MM-dd HH:mm:ss)"
  }
  ```
- **Output:**
  ```json
  {
    "isSuccessful": "boolean",
    "message": "string"
  }
  ```

**NetSuite Input:**
- `bodyData` (Object) - Keyed object of invoice payment data
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite external ID → Alli `invoiceId`
- NetSuite payment date → Alli `paidDate` (formatted as yyyy-MM-dd HH:mm:ss)

---

#### 11. SetInvoicePostingStatus(bodyData, token)

**Purpose:** Update invoice posting status in Alli

**Alli API:**
- **Name:** Set Invoice Posting Status
- **Endpoint:** `POST /api/Invoice/SetInvoicePostingStatus`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):**
  ```json
  {
    "invoiceId": "number",
    "status": "number (1=Posted, 2=Failed)",
    "postingNumber": "string",
    "message": "string"
  }
  ```
- **Output:**
  ```json
  {
    "isSuccessful": "boolean",
    "message": "string"
  }
  ```

**NetSuite Input:**
- `bodyData` (Object) - Keyed object of posting status data
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite external ID → Alli `invoiceId`
- NetSuite Bill internal ID → Alli `postingNumber`
- Status 1 = Successfully posted in NetSuite

---

#### 12. createGlCodesInAlli(accountMapping, entityName, allDepartments, token)

**Purpose:** Create GL codes in Alli from NetSuite accounts

**Alli API:**
- **Name:** Create GL Code
- **Endpoint:** `POST /api/GLCode`
- **Input (Body):**
  ```json
  {
    "entityName": "string",
    "accountCode": "string",
    "description": "string",
    "defaultTaxCode": "string",
    "businessUnitsLinked": ["string"]
  }
  ```

**NetSuite Input:**
- `accountMapping` (Object) - NetSuite account data
- `entityName` (String) - Entity name
- `allDepartments` (Object) - Department data
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `skipped`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite account number → Alli `accountCode`
- NetSuite account name → Alli `description`
- NetSuite department names → Alli `businessUnitsLinked` array

---

#### 13. createBusinessUnitsInAlli(entityID, departmentData, token)

**Purpose:** Create business units (departments) in Alli

**Alli API:**
- **Name:** Create Business Unit
- **Endpoint:** `POST /api/BusinessUnit`
- **Input (Body):**
  ```json
  {
    "entityName": "string",
    "name": "string",
    "code": "string"
  }
  ```

**NetSuite Input:**
- `entityID` (String) - Entity ID
- `departmentData` (Object) - Department data grouped by subsidiary
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite department name → Alli `name`
- NetSuite department internal ID → Alli `code`

---

#### 14. createTaxCodeInAlli(entityName, taxCodeData, token)

**Purpose:** Create tax codes in Alli

**Alli API:**
- **Name:** Create Tax Code
- **Endpoint:** `POST /api/TaxCode`
- **Input (Body):**
  ```json
  {
    "entityName": "string",
    "name": "string",
    "description": "string",
    "percentage": "number"
  }
  ```

**NetSuite Input:**
- `entityName` (String) - Entity name
- `taxCodeData` (Object) - Tax code data grouped by subsidiary
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite tax code name → Alli `name`
- NetSuite tax description → Alli `description`
- NetSuite percentage string (e.g., "10.00%") → Alli `percentage` (number)

---

#### 15. createSubAllocationInAlii(entityName, subAllocationData, token)

**Purpose:** Create sub-allocations (jobs/projects) in Alli

**Alli API:**
- **Name:** Create Sub Allocation
- **Endpoint:** `POST /api/SubAllocation`
- **Input (Body):**
  ```json
  {
    "entityName": "string",
    "name": "string",
    "code": "string",
    "linkedGLAccountCodes": ["string"]
  }
  ```

**NetSuite Input:**
- `entityName` (String) - Entity name
- `subAllocationData` (Object) - Job data grouped by subsidiary
- `token` (String) - Bearer authentication token

**NetSuite Output:**
- Returns results object with `successful`, `failed`, `totalProcessed` arrays

**Field Mapping:**
- NetSuite job company name → Alli `name`
- NetSuite job internal ID → Alli `code`
- Hardcoded: `linkedGLAccountCodes` = ['3800-2-102-000']

---

#### 16. createIntegrationLog(logData)

**Purpose:** Create integration log with email notifications

Same as Feoda_functions_help.js but includes:
- Email notification logic for errors
- Error message consolidation
- HTML email formatting

**Additional Features:**
- Sends email on 'Failed' or 'Partial' status
- Email recipients from `logData.emailRecipients` (comma-separated)
- Includes execution summary, error details, and clickable log link

---

#### 17. sendErrorNotification(logData, status, errorMessages, logRecordId)

**Purpose:** Send email notification for integration errors

**NetSuite Input:**
- `logData` (Object) - Log data
- `status` (String) - Status ('Failed', 'Partial')
- `errorMessages` (Array) - Array of error message strings
- `logRecordId` (Number) - ID of integration log record

**Output:** None (sends email)

---

#### 18. buildEmailBody(logData, status, errorMessages, logRecordId)

**Purpose:** Build HTML email body for error notifications

**NetSuite Input:** Same as sendErrorNotification

**NetSuite Output:**
- Returns HTML string

**Features:**
- Execution summary table
- Error details (first 10 errors)
- Failed invoices table (first 5)
- Link to integration log record
- Styled HTML with color coding
