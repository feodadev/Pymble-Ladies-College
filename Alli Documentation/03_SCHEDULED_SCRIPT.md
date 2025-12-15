# Scheduled Script Documentation

## Feoda_SS_get_all_invoice_data_alii.js

**Type:** Scheduled Script  
**API Version:** 2.1  
**File Path:** Schedule/Feoda_SS_get_all_invoice_data_alii.js

### Purpose
This scheduled script runs periodically to:
1. Fetch all invoices with stage "FinalReview" from Alli
2. Save invoice data to a JSON file in the File Cabinet
3. Trigger the Map/Reduce script to process the invoices
4. Acts as the entry point for the invoice import workflow

### Script Parameters
- `custscript_ss_sandbox_api_keys` - Sandbox API credentials
- `custscript_ss_prodcution_api_keys` - Production API credentials

### Deployment Settings
- **Frequency:** Configurable (recommended: ?)
- **Target:** All invoices with stage "FinalReview"

---

### Alli API Used

#### Get Invoices
- **API Name:** Get Invoice From Alii
- **Endpoint:** `GET /api/Invoice?skip={skip}&take={take}`
- **Headers:** `Authorization: Bearer {token}`
- **Query Parameters:**
  - `skip` - Number of records to skip (pagination)
  - `take` - Page size (2000 records per page)
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
      "lines": [...]
    }
  ]
  ```
- **Filtering:** Only invoices with `stage === "FinalReview"` are processed
- **Pagination:** Handled automatically by `RL_Helper.getInvoiceFromAlii()`

---

### Functions

#### execute(context)
**Purpose:** Main entry point for scheduled execution

**Process:**
1. **Authenticate:**
   - Retrieve API credentials from script parameters
   - Call `RL_Helper.authenticate(sbKeys, productionKeys)`
   - Exit if authentication fails

2. **Fetch Invoices:**
   - Call `RL_Helper.getInvoiceFromAlii(token)`
   - Receives object with:
     - `invoices` - Array of filtered invoices (stage = "FinalReview")
     - `code` - HTTP response code
     - `method` - HTTP method used
     - `reqUrl` - Request URL
   - Exit if no invoices returned

3. **Save to File:**
   - Call `saveInvoicesToFile(invoices)`
   - Creates JSON file in File Cabinet
   - Returns file ID

4. **Trigger Map/Reduce:**
   - Call `triggerMapReduceScript(fileId)`
   - Submits Map/Reduce task with file ID parameter
   - Returns task ID

**Error Handling:**
- All errors caught and logged with full stack trace
- Script execution continues to log errors but doesn't retry

---

#### saveInvoicesToFile(invoices)
**Purpose:** Save invoice array to JSON file in File Cabinet

**Process:**
1. Generate timestamp for unique filename
2. Create filename: `alii_invoices_{timestamp}.json`
3. Create file object with JSON content
4. Save to folder 1368
5. Return file internal ID

**Input:**
- `invoices` (Array) - Array of invoice objects from Alli

**Output:**
- Returns file internal ID (Number)
- Throws error if save fails

**File Details:**
- **Type:** JSON
- **Folder ID:** 1368 (File Cabinet folder)
- **Naming:** `alii_invoices_1702650000000.json`
- **Content:** JSON stringified invoice array

---

#### triggerMapReduceScript(fileId)
**Purpose:** Submit Map/Reduce script task to process invoices

**Process:**
1. Create Map/Reduce task
2. Set script and deployment IDs
3. Pass file ID as parameter
4. Submit task
5. Return task ID

**Input:**
- `fileId` (Number) - Internal ID of JSON file containing invoices

**Output:**
- Returns Map/Reduce task ID (String)
- Throws error if submission fails

**Map/Reduce Script Details:**
- **Script ID:** `customscript__fd_mr_create_vb_alii`
- **Deployment ID:** `customdeploy_fd_mr_create_vb_alii`
- **Parameter:** `custscript_invoice_file_id` = fileId

**Note:** This parameter is defined but not currently used by the Map/Reduce script (which uses `getInvoicesReadyForPost` instead). This may be legacy code or for future enhancement.

---

### Workflow Sequence

```
1. Scheduled Script Executes (Daily/Hourly)
         ↓
2. Authenticate with Alli
         ↓
3. Fetch Invoices (stage = "FinalReview")
         ↓
4. Save to JSON File (folder 1368)
         ↓
5. Trigger Map/Reduce Script
         ↓
6. Map/Reduce Creates Vendor Bills/Credits
         ↓
7. Update Posting Status in Alli
         ↓
8. Create Integration Log
```

---

### Alli Field Mapping

**Direct Pass-Through:** This script doesn't transform any fields. It passes the complete Alli invoice structure to the Map/Reduce script for processing.

**Invoice Structure from Alli:**
```json
{
  "id": "number",
  "invoiceNumber": "string",
  "supplierName": "string",
  "invoiceDescription": "string",
  "poNumber": "string",
  "dueDate": "string (ISO date)",
  "stage": "FinalReview",
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
```

---

### Error Handling

1. **Authentication Failure:**
   - Logs error
   - Script exits without processing
   - No integration log created

2. **No Invoices:**
   - Logs warning
   - Script exits gracefully
   - Considered normal operation

3. **File Save Failure:**
   - Error thrown and caught
   - Full error details logged
   - Script execution terminates

4. **Map/Reduce Submission Failure:**
   - Error thrown and caught
   - Task submission details logged
   - Script execution terminates

---

### Integration with Other Scripts

**Upstream:** None (entry point)

**Downstream:**
- Triggers: `Feoda_MR_authentication.js` Map/Reduce script
- File Cabinet dependency: Folder 1368 must exist

**Alternative Entry Point:**
The Map/Reduce script can also be triggered independently using the `getInvoicesReadyForPost` API, which may be the preferred method (based on Map/Reduce code analysis).
