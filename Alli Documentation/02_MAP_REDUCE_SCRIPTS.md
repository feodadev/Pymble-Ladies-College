# Map/Reduce Scripts Documentation

## 1. Feoda_MR_authentication.js

**Type:** Map/Reduce Script  
**API Version:** 2.1  
**File Path:** Map Reduce/Feoda_MR_authentication.js

### Purpose
This is the main invoice processing script that:
1. Fetches invoices ready for posting from Alli
2. Creates Vendor Bills or Vendor Credits in NetSuite
3. Handles duplicate checking
4. Updates posting status back to Alli
5. Creates detailed integration logs

### Script Parameters
- `custscript_sandbox_api_keys` - Sandbox API credentials
- `custscript_production_api_keys` - Production API credentials
- `custscript_prod_entity_id` - Production entity ID for filtering invoices
- `custscript_email_recipients` - Email addresses for error notifications (comma-separated)

---

### Alli APIs Used

#### 1. Get Invoices Ready For Post
- **API Name:** GetInvoicesReadyForPost
- **Endpoint:** `GET /api/Invoice/GetInvoicesReadyForPost/{entityId}`
- **Input:** Entity ID (from script parameter)
- **Output:** Array of invoice objects ready for posting
- **Used In:** `getInputData()` stage

#### 2. Set Invoice Posting Status
- **API Name:** SetInvoicePostingStatus
- **Endpoint:** `POST /api/Invoice/SetInvoicePostingStatus`
- **Input:**
  ```json
  {
    "invoiceId": "number",
    "status": "number (1=success, 2=failed)",
    "postingNumber": "string (NetSuite Bill ID)",
    "message": "string"
  }
  ```
- **Output:** Success/failure response
- **Used In:** After successful vendor bill/credit creation
- **Triggered:** Implicitly through the workflow (commented in code but logic present)

---

### Stage Details

#### getInputData()
**Purpose:** Retrieve invoices from Alli that are ready for posting

**Process:**
1. Authenticate with Alli API
2. Call `getInvoicesReadyForPost(token, prodEntityId)`
3. Attach API metadata to each invoice for tracking
4. Return array of invoices with metadata

**Output:** Array of invoice objects with `_apiMetadata` property

**Alli API Response Mapping:**
- Direct pass-through of Alli invoice structure
- Added field: `_apiMetadata` containing:
  - `code` - HTTP response code
  - `method` - HTTP method ('GET')
  - `reqUrl` - Request URL
  - `recordType` - Will be set in map stage

---

#### map(context)
**Purpose:** Process each invoice and create Vendor Bill or Vendor Credit

**Process:**
1. Parse invoice data from context
2. **Check for duplicates** using `checkDuplicateInvoice()`
   - Searches both Vendor Bills and Vendor Credits by external ID
   - Skips if duplicate found
3. **Determine record type** based on line items:
   - If any line has negative `total` → Create **Vendor Credit**
   - Otherwise → Create **Vendor Bill**
4. Call appropriate creation function
5. Write results to context with success/failed/skipped status

**NetSuite Record Creation:**

##### Vendor Bill Fields
- `tranid` ← Alli `invoiceNumber`
- `entity` ← Alli `supplierName` (text search)
- `trandate` ← Current date
- `duedate` ← Alli `dueDate`
- `otherrefnum` ← Alli `poNumber`
- `memo` ← Alli `invoiceDescription`
- `externalid` ← Alli `id` (for duplicate checking)
- `custbody_fd_bill_created_from_alii` ← true (custom field flag)

##### Line Items (Expense Sublist)
- `account` ← Parsed from Alli `glCode` (see GL Code Parsing below)
- `memo` ← Alli line `description`
- `quantity` ← Alli line `quantity`
- `rate` ← Alli line `unitCost`
- `amount` ← Alli line `subtotal`
- `location` ← Parsed from `glCode`
- `department` ← Parsed from `glCode`
- `class` ← Parsed from `glCode`
- `customer` ← Alli `subAllocationCode` (mapped to NetSuite job)
- `taxcode` ← Alli `taxCode` (mapped to NetSuite tax item)

##### Vendor Credit Fields
Same as Vendor Bill, but:
- Record type: `VENDOR_CREDIT`
- Negative amounts converted to positive (Alli sends negative, NetSuite expects positive)
- `rate` and `amount` use `Math.abs()` to convert

**GL Code Parsing:**
Alli `glCode` format: `{accountCode}-{locationId}-{classId}-{departmentCode}`

Example: `"1410-W-C3-Facilities"` splits to:
- `accountCode`: "1410"
- `locationId`: "W"
- `classId`: "C3"
- `departmentCode`: "Facilities"

**Mapping Functions Used:**
- `getDepartmentMapping()` - Maps department names to internal IDs
- `getClassMapping()` - Maps class external IDs to internal IDs
- `getLocationMapping()` - Maps location external IDs to internal IDs
- `getJobMapping()` - Maps job external IDs to internal IDs
- `getTaxCodeMapping()` - Maps tax item IDs
- `getGlAccountFromNS()` - Maps account codes to internal IDs

**Special Handling:**
- Account code "1410" hardcoded to internal ID 229
- Validation errors tracked but don't prevent record creation
- Stored in `custbody_alii_error_message` field

**Output to Context:**
```javascript
{
  key: 'successful' | 'failed' | 'skipped',
  value: {
    invoiceId: "number",
    invoiceNumber: "string",
    netSuiteBillId: "number", // or netSuiteCreditId
    recordType: "Vendor Bill" | "Vendor Credit",
    error: "string" (if failed),
    reason: "string" (if skipped),
    _apiMetadata: {...}
  }
}
```

---

#### reduce(context)
**Purpose:** Pass through map results (simple aggregation)

**Process:**
1. Iterate through context values
2. Write each value as-is to output
3. No transformation or aggregation performed

---

#### summarize(summary)
**Purpose:** Generate final summary and create integration log

**Process:**
1. Collect all results from output iterator
2. Categorize by key (successful/failed/skipped)
3. Determine overall status:
   - 'Success' - All successful
   - 'Partial' - Mix of success and failures
   - 'Failed' - All failed
4. Build error messages array
5. Create integration log with `RL_Helper.createIntegrationLog()`
6. Log map/reduce stage errors if any

**Integration Log Data:**
```javascript
{
  emailRecipients: "string",
  recordType: "Vendor Bill, Vendor Credit",
  method: "GET",
  responseCode: "number",
  totalProcessed: "number",
  successful: "number",
  failed: "number",
  skipped: "number",
  successfulInvoices: [...],
  failedInvoices: [...],
  skippedInvoices: [...],
  status: "Success" | "Partial" | "Failed",
  errorMessage: "string",
  requestUrl: "string"
}
```

---

### Helper Functions

#### checkDuplicateInvoice(externalId)
**Purpose:** Check if invoice already exists in NetSuite

**Process:**
1. Search Vendor Bills by external ID
2. Search Vendor Credits by external ID
3. Return duplicate information if found

**Output:**
```javascript
{
  isDuplicate: boolean,
  recordType: "Vendor Bill" | "Vendor Credit",
  existingId: "number"
}
```

#### createVendorBillInNS(invdataObj)
**Purpose:** Create vendor bills in NetSuite from Alli invoices

**Output:**
```javascript
{
  successful: [...],
  failed: [...],
  skipped: [...],
  totalProcessed: "number",
  recordTypes: ["Vendor Bill"]
}
```

#### createVendorCreditInNS(creditdataObj)
**Purpose:** Create vendor credits in NetSuite (for negative invoices)

**Output:** Same structure as createVendorBillInNS

#### getDepartmentMapping()
**Purpose:** Create mapping of department names to internal IDs

**Special Processing:**
- Extracts last segment after `:` in name
- Removes leading numbers
- Converts to uppercase for matching
- Example: "01 : 100 Facilities" → "FACILITIES"

#### getClassMapping()
**Purpose:** Map classification external IDs to internal IDs

#### getLocationMapping()
**Purpose:** Map location external IDs to internal IDs

#### getJobMapping()
**Purpose:** Map job external IDs to internal IDs

#### getTaxCodeMapping()
**Purpose:** Map tax item IDs and descriptions

#### getGlAccountFromNS()
**Purpose:** Create mapping of account codes to internal IDs
- Returns ES6 Map object
- Maps account number to internal ID

#### splitGlAccountCode(glAccountCode)
**Purpose:** Parse Alli GL code into components

**Input:** String like `"1410-W-C3-Facilities"`

**Output:**
```javascript
{
  accountCode: "1410",
  locationId: "W",
  classId: "C3",
  departmentCode: "Facilities"
}
```

**Special Handling:**
- Handles department codes with hyphens by joining remaining segments
- Example: `"1410-W-C3-Facilities-Extra"` → departmentCode: "Facilities-Extra"

---

### Field Mapping Summary

| Alli Field | NetSuite Field | Type | Transformation |
|------------|----------------|------|----------------|
| `id` | `externalid` | String | Direct |
| `invoiceNumber` | `tranid` | String | Direct |
| `supplierName` | `entity` | Text | Lookup by name |
| `dueDate` | `duedate` | Date | Parse to Date |
| `poNumber` | `otherrefnum` | String | Direct |
| `invoiceDescription` | `memo` | String | Direct |
| `lines[].description` | Line `memo` | String | Direct |
| `lines[].glCode` | Multiple fields | String | Split and map (see above) |
| `lines[].quantity` | Line `quantity` | Number | Parse float |
| `lines[].unitCost` | Line `rate` | Number | Parse float, abs() for credits |
| `lines[].subtotal` | Line `amount` | Number | Parse float, abs() for credits |
| `lines[].taxCode` | Line `taxcode` | Lookup | Map to internal ID |
| `lines[].subAllocationCode` | Line `customer` | Lookup | Map to job internal ID |

---

### Error Handling

1. **Authentication Failures:** Logged and script terminates
2. **Duplicate Invoices:** Skipped and logged in integration log
3. **Missing Mappings:** Tracked in validation errors, added to bill memo
4. **Bill Creation Failures:** Caught, logged, added to failed array
5. **API Errors:** Logged with full error details

---

## 2. Feoda_MR_create_data_tables_alii.js

**Type:** Map/Reduce Script  
**API Version:** 2.1  
**File Path:** Map Reduce/Feoda_MR_create_data_tables_alii.js

### Purpose
This is a utility script for creating/updating master data tables in Alli from NetSuite. Used for initial setup and bulk updates of:
- Entities (Subsidiaries)
- Suppliers (Vendors)
- GL Codes (Accounts)
- Business Units (Departments)
- Tax Codes
- Sub-Allocations (Jobs)

### Constants
```javascript
var MAIN_ENTITY = {
  NAME: "Pymble Ladies College",
  ID: "2"
}
```

### Script Parameters
- `custscript_alii_pro_keys_data_tabl` - Production API keys for data table operations

---

### Alli APIs Used

#### 1. Update Supplier
- **API Name:** Update Supplier
- **Endpoint:** `PUT /api/Supplier/{supplierId}`
- **Input:** Supplier data (see Library documentation)
- **Output:** Updated supplier object
- **Used In:** `getInputData()` for bulk vendor updates

#### 2. Create Supplier
- **API Name:** Create Supplier
- **Endpoint:** `POST /api/Supplier`
- **Input:** Supplier data
- **Used In:** Commented out in code (available for use)

#### 3. Create Business Units
- **API Name:** Create Business Unit
- **Endpoint:** `POST /api/BusinessUnit`
- **Input:** Business unit data
- **Used In:** Commented out (available for use)

#### 4. Create Tax Codes
- **API Name:** Create Tax Code
- **Endpoint:** `POST /api/TaxCode`
- **Input:** Tax code data
- **Used In:** Commented out (available for use)

#### 5. Create Sub-Allocations
- **API Name:** Create Sub Allocation
- **Endpoint:** `POST /api/SubAllocation`
- **Input:** Sub-allocation data
- **Used In:** Commented out (available for use)

#### 6. Create GL Codes
- **API Name:** Create GL Code
- **Endpoint:** `POST /api/GLCode`
- **Input:** GL code data
- **Used In:** Commented out (available for use)

#### 7. Get Entity, Get Suppliers, Get GL Codes
- Used for verification (commented out in code)

---

### Stage Details

#### getInputData()
**Purpose:** Orchestrate master data synchronization

**Current Configuration:**
- **Active:** Update Suppliers (vendors) in Alli
- **Commented Out:**
  - Create Suppliers
  - Create Business Units
  - Create Tax Codes
  - Create Sub-Allocations
  - Create GL Codes
  - Retrieval operations for verification

**Process (Active):**
1. Authenticate with Alli
2. Get vendors from NetSuite via `getVendorsFromNS()`
3. Call `RL_Helper.updateSupplierInAlli()`
4. Return results (currently returns nothing to prevent map stage)

**Note:** This script is designed to be run once or occasionally for bulk data setup/updates. The specific operations are commented/uncommented as needed.

---

#### map(context)
**Purpose:** Currently empty (no processing)

**Note:** Map stage not used in current configuration. Script primarily runs in getInputData stage for bulk operations.

---

### Helper Functions

#### getVendorsFromNS()
**Purpose:** Retrieve vendor data from NetSuite

**Process:**
1. Search for active vendors with specific internal IDs (filtered)
2. Extract vendor details including bank information
3. Build vendor mapping object

**NetSuite Fields Retrieved:**
- `entityid` - Entity ID
- `internalid` - Internal ID
- `companyname` - Company name
- `email` - Email address
- `phone` - Phone number
- `address` - Address
- `terms` - Payment terms
- `vatregnumber` - ABN
- `custrecord_2663_entity_acct_name` (join) - Bank account name
- `custrecord_2663_entity_acct_no` (join) - Account number
- `custrecord_2663_entity_branch_no` (join) - Branch number
- `custrecord_2663_entity_bank_no` (join) - Bank number

**BSB Calculation:**
- `bsb` = `bank_no` + `branch_no` (concatenated)

**Output:**
```javascript
{
  vendorData: {
    "{entityId}": {
      internalId: "string",
      entityId: "string",
      companyName: "string",
      email: "string",
      phone: "string",
      address: "string",
      paymentTerms: "string",
      bsb: "string",
      abn: "string",
      accountNumber: "string"
    }
  },
  entityData: {
    "{entityId}": {
      entityId: "string",
      code: "null",
      currency: ""
    }
  }
}
```

**Current Filter:**
- Only vendors with internal IDs: 17423-17435 (13 vendors)
- Can be modified to process all vendors

---

#### getGlAccountFromNS()
**Purpose:** Retrieve GL accounts from NetSuite

**Process:**
1. Search for active accounts
2. Extract account details
3. Build account code to name mapping

**Output:**
```javascript
{
  "{accountNumber}": {
    accountName: "string"
  }
}
```

---

#### getDepartmentsFromNS()
**Purpose:** Retrieve departments from NetSuite grouped by subsidiary

**Process:**
1. Search for active departments
2. Group by subsidiary
3. Build department mapping

**Output:**
```javascript
{
  "{subsidiaryId}": [
    {
      id: "string",
      name: "string"
    }
  ]
}
```

---

#### getTaxCodesFromNS()
**Purpose:** Retrieve tax codes from NetSuite

**Process:**
1. Search sales tax items for subsidiary "2"
2. Extract tax code details
3. Group by subsidiary

**Fields:**
- `name` - Tax code name
- `description` - Description
- `rate` - Tax percentage
- `subsidiarynohierarchy` - Subsidiary

**Output:**
```javascript
{
  "{subsidiaryId}": [
    {
      entityName: "Pymble Ladies College",
      name: "string",
      description: "string",
      percentage: "string"
    }
  ]
}
```

---

#### getJobsFromNS()
**Purpose:** Retrieve jobs (customers of type job) from NetSuite

**Process:**
1. Search for active jobs
2. Extract job details
3. Group by subsidiary

**Output:**
```javascript
{
  "{subsidiaryId}": [
    {
      name: "string (companyname)",
      code: "string (internalid)"
    }
  ]
}
```

---

### Field Mapping Summary

#### Vendor to Supplier
| NetSuite Field | Alli Field | Notes |
|----------------|------------|-------|
| `internalid` | `code` | Unique identifier |
| `companyname` | `name` | Supplier name |
| `email` | `email` | Email address |
| `phone` | `phone` | Not currently mapped to Alli |
| `address` | `address` | Full address |
| `terms` | `paymentTerms` | Text value |
| `vatregnumber` | `abn` | Australian Business Number |
| Bank no + Branch no | `bsb` | Concatenated |
| Account number | `accountNumber` | Bank account |

#### Account to GL Code
| NetSuite Field | Alli Field | Notes |
|----------------|------------|-------|
| `number` | `accountCode` | Account number |
| `name` | `description` | Account name |
| Department names | `businessUnitsLinked` | Array of all departments |

#### Department to Business Unit
| NetSuite Field | Alli Field | Notes |
|----------------|------------|-------|
| `internalid` | `code` | Internal ID |
| `name` | `name` | Department name |
| Subsidiary | `entityName` | Parent entity |

#### Tax Code to Tax Code
| NetSuite Field | Alli Field | Notes |
|----------------|------------|-------|
| `name` | `name` | Tax code name |
| `description` | `description` | Description |
| `rate` | `percentage` | Converted from string to number |
| Entity constant | `entityName` | "Pymble Ladies College" |

#### Job to Sub-Allocation
| NetSuite Field | Alli Field | Notes |
|----------------|------------|-------|
| `companyname` | `name` | Job name |
| `internalid` | `code` | Internal ID |
| Entity constant | `entityName` | "Pymble Ladies College" |
| Hardcoded | `linkedGLAccountCodes` | ['3800-2-102-000'] |

---

### Usage Notes

**This script is designed for:**
1. Initial setup of Alli master data
2. Bulk updates of existing data
3. One-time data migrations

**To use different functions:**
1. Uncomment desired operation in `getInputData()`
2. Comment out currently active operations
3. Save and run script deployment

**Current Active Operation:**
- Update Suppliers (lines 23-25)

**Available Operations (Commented):**
- Create Suppliers (line 34)
- Create Business Units (lines 35-38)
- Create Tax Codes (lines 45-48)
- Create Sub-Allocations (lines 41-44)
- Create GL Codes (lines 50-53)
- Get/Verify Operations (lines 56-63)
