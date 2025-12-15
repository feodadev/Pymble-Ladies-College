# User Event Scripts Documentation

## 1. Feoda_UE_change_posting_status_alii.js

**Type:** User Event Script  
**API Version:** 2.1  
**Context:** afterSubmit  
**Event Types:** All except DELETE  
**Applied To:** Vendor Payment (vendorpayment) record  
**File Path:** User Event/Feoda_UE_change_posting_status_alii.js

### Purpose
This script runs automatically when a Vendor Payment is created or edited in NetSuite. It:
1. Identifies bills that were paid and originated from Alli
2. Marks those invoices as "Paid" in Alli
3. Updates the posting status in Alli with the NetSuite bill ID
4. Updates sync status fields on the bill record
5. Creates integration logs for all operations
6. Sends email notifications on failures

### Script Parameters
- `custscript_production_api_keys_ue` - Production API credentials
- `custscript_production_api_keys_ue` - Sandbox API credentials (currently same parameter name)

---

### Alli APIs Used

#### 1. Set Invoice Paid
- **API Name:** SetInvoicePaidInAlii
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
- **When Called:** After identifying paid bills from Alli

---

#### 2. Set Invoice Posting Status
- **API Name:** SetInvoicePostingStatus
- **Endpoint:** `POST /api/Invoice/SetInvoicePostingStatus`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):**
  ```json
  {
    "invoiceId": "number",
    "status": "number (1 = Posted Successfully)",
    "postingNumber": "string (NetSuite Bill ID)",
    "message": "string (Details about the bill)"
  }
  ```
- **Output:**
  ```json
  {
    "isSuccessful": "boolean",
    "message": "string"
  }
  ```
- **When Called:** After successfully marking invoice as paid

---

### Function: afterSubmit(context)

**Trigger:** Executes after a Vendor Payment record is submitted

**Process Flow:**

1. **Skip DELETE events**
   - Returns immediately if payment is being deleted

2. **Load Payment Record**
   - Get payment internal ID
   - Count bills in 'apply' sublist

3. **Identify Paid Bills from Alli**
   - Loop through each bill in payment
   - Check if `apply` checkbox is true
   - Load each bill record
   - Check criteria:
     - `custbody_fd_bill_created_from_alii` = true
     - `statusRef` = 'paidInFull'
     - `externalid` exists (Alli invoice ID)
   - Collect matching bills with metadata

4. **Authenticate with Alli**
   - Call `RL_Helper.authenticate()`
   - Create integration log if authentication fails

5. **Mark Invoices as Paid**
   - Build payload for each bill:
     ```javascript
     {
       invoiceId: parseInt(aliiInvoiceId),
       paid: true,
       paidDate: formatDateForAlii(syncDate)
     }
     ```
   - Call `RL_Helper.SetInvoicePaidInAlii(paidInvoiceData, token)`
   - Check response for `isSuccessful === true`

6. **Update Posting Status (if all successful)**
   - Build payload for each bill:
     ```javascript
     {
       invoiceId: parseInt(aliiInvoiceId),
       status: 1, // Posted successfully
       postingNumber: billId.toString(),
       message: "Paid In Full in NetSuite - Bill ID: {billId}, Bill Number: {billNumber}, Payment ID: {paymentId}"
     }
     ```
   - Call `RL_Helper.SetInvoicePostingStatus()`

7. **Update NetSuite Bill Records**
   - Use `record.submitFields()` to update:
     - `custbody_fd_alii_sync_status` = 1 (Success)
     - `custbody_fd_alii_sync_date` = new Date()

8. **Create Integration Logs**
   - Log created for each operation:
     - Authentication failures
     - Paid status update results
     - Posting status update results
     - Sync field update errors
     - Unexpected errors

---

### Helper Functions

#### formatDateForAlii(dateValue)
**Purpose:** Convert JavaScript date to Alli date format

**Input:** JavaScript Date object or date string

**Output:** String in format `"yyyy-MM-dd HH:mm:ss"`

**Example:**
```javascript
formatDateForAlii(new Date('2024-01-15T10:30:00'))
// Returns: "2024-01-15 10:30:00"
```

---

#### createIntegrationLog(logData)
**Purpose:** Create integration log record for payment sync operations

**Input:** logData object (same structure as library)

**Output:** Integration log record ID or null

**Custom Fields Used:**
- `custrecord_il_transaction_type` = 19 (Payment sync)
- `custrecord_il_request_method`
- `custrecord_il_response_code`
- `custrecord_il_execution_summary`
- `custrecord_il_response_body`
- `custrecord_il_status`
- `custrecord_il_error_message`
- `custrecord_il_request_url`
- `custrecord_il_timestamp`
- `custrecord_il_integration_type` = 1

**Note:** This is a local implementation (not using library version) with transaction type 19 specific to payments.

---

### Field Mapping

#### NetSuite → Alli (Set Invoice Paid)

| NetSuite Field | Alli Field | Transformation |
|----------------|------------|----------------|
| `externalid` | `invoiceId` | Parse to integer |
| Hardcoded `true` | `paid` | Boolean |
| `custbody_fd_alii_sync_date` or current date | `paidDate` | Format as "yyyy-MM-dd HH:mm:ss" |

---

#### NetSuite → Alli (Set Posting Status)

| NetSuite Field | Alli Field | Transformation |
|----------------|------------|----------------|
| `externalid` | `invoiceId` | Parse to integer |
| Hardcoded `1` | `status` | 1 = Successfully Posted |
| Bill `internalid` | `postingNumber` | Convert to string |
| Constructed message | `message` | Includes Bill ID, Bill Number, Payment ID |

---

### Custom NetSuite Fields Used

**On Vendor Bill:**
- `custbody_fd_bill_created_from_alii` (Checkbox) - Identifies bills from Alli
- `custbody_fd_alii_sync_status` (List/Record) - Sync status (1 = Success)
- `custbody_fd_alii_sync_date` (Date) - Last sync timestamp
- `externalid` (Standard Field) - Stores Alli invoice ID

**On Vendor Payment:**
- `apply` sublist checkbox - Identifies which bills are being paid

---

### Error Handling & Logging

**Integration Logs Created For:**

1. **Authentication Failure:**
   - Transaction Type: 19
   - Status: "Failed"
   - Failed count = number of bills to update
   - Each bill listed in failedInvoices array

2. **Partial Paid Update Failure:**
   - Transaction Type: 19
   - Status: "Partial"
   - Mixed successful/failed counts
   - Failed bills with error details

3. **Posting Status Update Failure:**
   - Transaction Type: 19
   - Status: "Failed"
   - All bills listed as failed

4. **Success:**
   - Transaction Type: 19
   - Status: "Success" or "Partial" (if sync field updates failed)
   - Details of all processed bills

5. **Unexpected Errors:**
   - Transaction Type: 19
   - Status: "Failed"
   - Full error message and stack trace

---

### Execution Logic

**Key Decision Points:**

1. **Bill Qualification:**
   - Must be applied in payment (`apply` = true)
   - Must be from Alli (`custbody_fd_bill_created_from_alii` = true)
   - Must be paid in full (`statusRef` = 'paidInFull')
   - Must have Alli invoice ID (`externalid` exists)

2. **Sequential API Calls:**
   - SetInvoicePaid must succeed before SetInvoicePostingStatus is called
   - If any invoice fails SetInvoicePaid, posting status is not updated for ANY invoice
   - This ensures data consistency in Alli

3. **Response Validation:**
   - Not just checking HTTP status code
   - Also verifying `isSuccessful === true` in response body
   - Any invoice with `isSuccessful !== true` is treated as failed

---

## 2. Feoda_UE_create_supplier_alii.js

**Type:** User Event Script  
**API Version:** 2.1  
**Context:** afterSubmit  
**Event Types:** CREATE only  
**Applied To:** Vendor record  
**File Path:** User Event/Feoda_UE_create_supplier_alii.js

### Purpose
This script runs automatically when a new Vendor is created in NetSuite. It:
1. Extracts vendor details including bank information
2. Creates a corresponding supplier in Alli
3. Updates sync status on the vendor record
4. Creates integration log
5. Sends email notification on failure

### Script Parameters
- `custscript_prod_api_keys_vendor_ue` - Production API credentials
- `custscript_sb_api_keys_vendor_ue` - Sandbox API credentials
- `custscript_email_recipients_ue` - Email addresses for error notifications

### Constants
```javascript
const MAIN_ENTITY = {
  NAME: 'Pymble Ladies College'
};
```

---

### Alli API Used

#### Create Supplier
- **API Name:** Create Supplier
- **Endpoint:** `POST /api/Supplier`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):**
  ```json
  {
    "entityName": "Pymble Ladies College",
    "code": "string (NetSuite internal ID)",
    "name": "string (Company name)",
    "address": "string (Full address)",
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

---

### Function: afterSubmit(context)

**Trigger:** Executes after a new Vendor record is created

**Process Flow:**

1. **Event Type Check**
   - Only processes CREATE events
   - Skips all other event types (EDIT, DELETE, etc.)

2. **Load Vendor Record**
   - Get vendor internal ID from context
   - Load full vendor record for complete data access

3. **Extract Vendor Data:**

   **Basic Fields:**
   - `entityid` - Entity ID
   - `companyname` - Company name
   - `email` - Email address
   - `phone` - Phone number
   - `terms` - Payment terms (text value)
   - `vatregnumber` - ABN

   **Bank Details (from submachine sublist):**
   - `custrecord_2663_entity_acct_no` - Account number
   - `custrecord_2663_entity_bank_no` - Bank number
   - Concatenate for BSB

   **Address (from addressbook sublist):**
   - Extracts first address from addressbook sublist
   - Combines: addressee, attention, addr1, addr2, city, state, zip, country
   - Joins with newline separators

4. **Authenticate with Alli**
   - Call `RL_Helper.authenticate()`
   - Create integration log if fails

5. **Prepare Vendor Data**
   - Build vendorData object keyed by vendor ID
   - Include all extracted fields

6. **Create Supplier in Alli**
   - Call `RL_Helper.createSupplierInAlli(vendorData, MAIN_ENTITY.NAME, token)`
   - Receives results with successful/failed arrays

7. **Update Vendor Sync Status (if successful)**
   - Use `record.submitFields()` to update:
     - `custentity_alii_sync_date` = new Date()
     - `custentity_alii_sync_status` = true

8. **Create Integration Log**
   - Log result (success or failure)
   - Include all vendor details

---

### Field Mapping

#### NetSuite → Alli

| NetSuite Field | Alli Field | Location | Transformation |
|----------------|------------|----------|----------------|
| Constant | `entityName` | - | "Pymble Ladies College" |
| `internalid` | `code` | Vendor | Convert to string |
| `companyname` or `entityid` | `name` | Vendor | Fallback to entityid |
| Address subrecord | `address` | addressbook sublist | Multi-line formatted string |
| `email` | `email` | Vendor | Direct |
| `phone` | `phone` | Vendor | Not sent to Alli (mapped but unused) |
| `custrecord_2663_entity_bank_no` | `bsb` | submachine sublist | Direct (bank number) |
| `custrecord_2663_entity_acct_no` | `accountNumber` | submachine sublist | Direct |
| `vatregnumber` | `abn` | Vendor | Direct |
| `terms` (text) | `paymentTerms` | Vendor | Text representation |

---

### Address Formatting

**Address Components (in order):**
1. Addressee
2. Attention
3. Address Line 1
4. Address Line 2
5. City + State + Zip (space-separated)
6. Country

**Example:**
```
John Doe
ATTN: Accounts Payable
123 Main Street
Suite 100
Sydney NSW 2000
Australia
```

---

### Custom NetSuite Fields Used

**On Vendor:**
- `custentity_alii_sync_date` (Date/Time) - Last sync timestamp
- `custentity_alii_sync_status` (Checkbox) - Indicates successful sync

**On Custom Bank Details Record:**
- `custrecord_2663_parent_vendor` - Link to parent vendor
- `custrecord_2663_entity_acct_no` - Account number
- `custrecord_2663_entity_bank_no` - Bank number
- `custrecord_2663_entity_branch_no` - Branch number

---

### Error Handling

**Integration Logs Created For:**

1. **Authentication Failure:**
   - Status: "Failed"
   - Records vendor details that couldn't be synced
   - Email notification sent

2. **Supplier Creation Failure:**
   - Status: "Failed"
   - Includes error message from Alli API
   - Email notification sent

3. **Sync Status Update Failure:**
   - Logged separately but doesn't affect supplier creation
   - Supplier exists in Alli but NetSuite field not updated

4. **Unexpected Errors:**
   - Full error and stack trace captured
   - Email notification sent

---

## 3. Feoda_UE_update_supplier_alii.js

**Type:** User Event Script  
**API Version:** 2.1  
**Context:** afterSubmit  
**Event Types:** EDIT only  
**Applied To:** Custom Record - Entity Bank Details (customrecord_2663_entity_bank_details)  
**File Path:** User Event/Feoda_UE_update_supplier_alii.js

### Purpose
This script runs automatically when bank details for a vendor are edited. It:
1. Detects changes to vendor bank account information
2. Updates the corresponding supplier in Alli with new bank details
3. Updates sync status on the bank details record
4. Creates integration log
5. Sends email notification on failure

### Script Parameters
- `custscript_prod_api_keys_bank_ue` - Production API credentials
- `custscript_sb_api_keys_bank_ue` - Sandbox API credentials
- `custscript_email_recipients_ue_update` - Email addresses for notifications

### Constants
```javascript
const MAIN_ENTITY = {
  NAME: 'Pymble Ladies College'
};
```

---

### Alli API Used

#### Update Supplier
- **API Name:** Update Supplier
- **Endpoint:** `PUT /api/Supplier/{supplierId}`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):** Same as Create Supplier
- **Output:** Updated supplier object

---

### Function: afterSubmit(context)

**Trigger:** Executes after bank details record is edited

**Process Flow:**

1. **Event Type Check**
   - Only processes EDIT events
   - Skips CREATE and DELETE events

2. **Load Bank Details Record**
   - Get bank record internal ID
   - Load full record

3. **Get Parent Vendor**
   - Read `custrecord_2663_parent_vendor` field
   - Exit if no vendor linked

4. **Extract Bank Details:**
   - `custrecord_2663_entity_acct_no` - Account number
   - `custrecord_2663_entity_bank_no` - Bank number
   - `custrecord_2663_entity_branch_no` - Branch number
   - Calculate BSB: bankNum + branchNum

5. **Load Vendor Record**
   - Get complete vendor information
   - Extract all fields (same as create supplier script)

6. **Get Vendor Address**
   - Call `getVendorAddress(vendor)` helper
   - Format same as create supplier script

7. **Authenticate with Alli**
   - Call `RL_Helper.authenticate()`
   - Create integration log if fails

8. **Prepare Vendor Data**
   - Build complete vendor object with updated bank details

9. **Update Supplier in Alli**
   - Call `RL_Helper.updateSupplierInAlli(vendorData, MAIN_ENTITY.NAME, token)`
   - Function will:
     - Find supplier in Alli by name
     - Update with new information
     - Return results with successful/failed/notFound arrays

10. **Update Bank Record Sync Status (if successful)**
    - Use `record.submitFields()` to update:
      - `custrecord_bank_alii_sync_date` = new Date()
      - `custrecord_bank_alii_sync_status` = true

11. **Create Integration Log**
    - Include results from update operation

---

### Helper Function: getVendorAddress(vendor)

**Purpose:** Extract and format vendor address

**Process:**
1. Get addressbook sublist line count
2. Access first address subrecord
3. Extract all address components
4. Filter empty components
5. Join with newlines

**Output:** Formatted address string

---

### Field Mapping

#### NetSuite → Alli (Update)

| NetSuite Field | Alli Field | Source Record | Notes |
|----------------|------------|---------------|-------|
| Constant | `entityName` | - | "Pymble Ladies College" |
| Vendor `internalid` | `code` | Vendor | Convert to string |
| Vendor `companyname` | `name` | Vendor | Used to find supplier in Alli |
| Vendor `email` | `email` | Vendor | Direct |
| Vendor address | `address` | Vendor | Formatted string |
| Vendor `terms` | `paymentTerms` | Vendor | Text |
| Vendor `vatregnumber` | `abn` | Vendor | Direct |
| Bank no + Branch no | `bsb` | Bank Details | Concatenated |
| `custrecord_2663_entity_acct_no` | `accountNumber` | Bank Details | Direct |

---

### Custom NetSuite Fields Used

**On Bank Details Record:**
- `custrecord_2663_parent_vendor` (List/Record) - Link to vendor
- `custrecord_2663_entity_acct_no` (Text) - Account number
- `custrecord_2663_entity_bank_no` (Text) - Bank number (first part of BSB)
- `custrecord_2663_entity_branch_no` (Text) - Branch number (second part of BSB)
- `custrecord_bank_alii_sync_date` (Date/Time) - Last sync timestamp
- `custrecord_bank_alii_sync_status` (Checkbox) - Sync success flag

---

### Special Logic

**Supplier Lookup:**
- Uses vendor company name to find supplier in Alli
- `updateSupplierInAlli` function:
  1. Gets all suppliers from Alli
  2. Creates name-to-ID mapping
  3. Looks up supplier by name
  4. Updates if found, adds to notFound if not exists

**BSB Calculation:**
```javascript
bsb = bankNum + branchNum
// Example: "123" + "456" = "123456"
```

---

### Error Handling

**Integration Logs Created For:**

1. **No Vendor Linked:**
   - Script exits gracefully, no log created
   - Debug log only

2. **Authentication Failure:**
   - Status: "Failed"
   - Method: "PUT"
   - Response Code: 401

3. **Supplier Not Found:**
   - Status: "Failed"
   - Supplier added to `notFound` array
   - Indicates supplier doesn't exist in Alli

4. **Update Failure:**
   - Status: "Failed"
   - Includes API error response

5. **Success:**
   - Status: "Success"
   - Method: "PUT"
   - Includes updated supplier details

6. **Unexpected Errors:**
   - Full error and stack trace

---

## 4. Feoda_UE_update_vendor_supplier_alii.js

**Type:** User Event Script  
**API Version:** 2.1  
**Context:** afterSubmit  
**Event Types:** EDIT only  
**Applied To:** Vendor record  
**File Path:** User Event/Feoda_UE_update_vendor_supplier_alii.js

### Purpose
This script runs automatically when a Vendor record is edited in NetSuite. It:
1. Detects changes to vendor information (name, email, address, terms, etc.)
2. Updates the corresponding supplier in Alli
3. Updates sync status on the vendor record
4. Creates integration log
5. Sends email notification on failure

### Script Parameters
- `custscript_prod_api_keys_ven_sup_ue` - Production API credentials
- `custscript_sb_api_keys_vendor_ue` - Sandbox API credentials
- `custscript_email_recipients_ue_ven_sup` - Email addresses for notifications

### Constants
```javascript
const MAIN_ENTITY = {
  NAME: 'Pymble Ladies College'
};
```

---

### Alli API Used

#### Update Supplier
- **API Name:** Update Supplier
- **Endpoint:** `PUT /api/Supplier/{supplierId}`
- **Headers:**
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`
- **Input (Body):** Same structure as Create Supplier
- **Output:** Updated supplier object

---

### Function: afterSubmit(context)

**Trigger:** Executes after a Vendor record is edited

**Process Flow:**

1. **Event Type Check**
   - Only processes EDIT events
   - Skips CREATE and DELETE

2. **Load Vendor Record**
   - Get vendor internal ID
   - Load full vendor record

3. **Extract Vendor Data:**
   - Entity ID, company name, email, phone
   - Payment terms, ABN
   - Address via `getVendorAddress(vendor)`
   - Bank details via `getVendorBankDetails(vendorId)`

4. **Authenticate with Alli**
   - Call `RL_Helper.authenticate()`
   - Create integration log if fails

5. **Prepare Vendor Data**
   - Build complete vendor object with all fields

6. **Update Supplier in Alli**
   - Call `RL_Helper.updateSupplierInAlli(vendorData, MAIN_ENTITY.NAME, token)`
   - Supplier looked up by company name

7. **Update Vendor Sync Status (if successful)**
   - Use `record.submitFields()`:
     - `custentity_alii_sync_date` = new Date()
     - `custentity_alii_sync_status` = true

8. **Create Integration Log**
   - Include results and any errors

---

### Helper Functions

#### getVendorBankDetails(vendorId)
**Purpose:** Retrieve bank details from custom bank details record

**Process:**
1. Search custom record type `customrecord_2663_entity_bank_details`
2. Filter by `custrecord_2663_parent_vendor` = vendorId
3. Get first result (assumes one bank record per vendor)
4. Extract account number, bank number, branch number
5. Calculate BSB = bankNum + branchNum

**Output:**
```javascript
{
  accountNumber: "string",
  bsb: "string",
  bankRecordId: "number"
}
```

**Returns empty values if no bank record found**

---

#### getVendorAddress(vendor)
**Purpose:** Extract and format vendor address

Same implementation as other update scripts.

---

### Field Mapping

#### NetSuite → Alli (Update)

| NetSuite Field | Alli Field | Notes |
|----------------|------------|-------|
| Constant | `entityName` | "Pymble Ladies College" |
| `internalid` | `code` | String |
| `companyname` or `entityid` | `name` | Used for lookup |
| `email` | `email` | Direct |
| `phone` | `phone` | Not used by Alli API |
| Address subrecord | `address` | Formatted string |
| `terms` (text) | `paymentTerms` | Text value |
| `vatregnumber` | `abn` | Direct |
| Bank record | `bsb` | From separate record |
| Bank record | `accountNumber` | From separate record |

---

### Custom NetSuite Fields Used

**On Vendor:**
- `custentity_alii_sync_date` (Date/Time) - Last sync timestamp
- `custentity_alii_sync_status` (Checkbox) - Sync success flag

**On Bank Details Record (searched):**
- `custrecord_2663_parent_vendor` - Link to vendor
- `custrecord_2663_entity_acct_no` - Account number
- `custrecord_2663_entity_bank_no` - Bank number
- `custrecord_2663_entity_branch_no` - Branch number

---

### Update Trigger Scenarios

**This script triggers when any of these fields are edited:**
- Company name
- Entity ID
- Email
- Phone
- Address
- Payment terms
- ABN/VAT Registration Number

**Note:** Bank details changes trigger the separate bank details user event script, not this one.

---

### Error Handling

**Integration Logs Created For:**

1. **Authentication Failure:**
   - Status: "Failed"
   - Response Code: 401
   - All relevant vendor details logged

2. **Supplier Not Found in Alli:**
   - Status: "Failed"
   - Error: "Supplier not found in Alli - cannot update"
   - Indicates vendor was never synced to Alli (create needed first)

3. **Update Failure:**
   - Status: "Failed"
   - Includes API error response from Alli

4. **Success:**
   - Status: "Success"
   - Method: "PUT"
   - All updated fields logged

5. **Sync Field Update Failure:**
   - Logged separately
   - Supplier updated in Alli but NetSuite field not updated

6. **Unexpected Errors:**
   - Full error message and stack trace

---

### Integration with Other Scripts

**Related Scripts:**
- `Feoda_UE_create_supplier_alii.js` - Creates supplier on vendor CREATE
- `Feoda_UE_update_supplier_alii.js` - Updates supplier when bank details change

**Coordination:**
- Create script runs first (on vendor creation)
- This script handles subsequent vendor edits
- Bank details script handles bank field changes
- All three can update sync status fields
