# Field Mapping & Data Transformation

## Complete Field Mapping Reference

### 1. Vendor → Supplier (Create & Update)

| NetSuite Field | NetSuite Type | Alli Field | Alli Type | Transformation | Notes |
|----------------|---------------|------------|-----------|----------------|-------|
| `internalid` | Number | `code` | String | `toString()` | Unique identifier |
| `companyname` | String | `name` | String | Direct | Primary lookup field |
| `entityid` | String | `name` | String | Fallback | If companyname empty |
| `email` | String | `email` | String | Direct | |
| `phone` | String | `phone` | String | Not mapped | Field exists but not sent |
| Address subrecord | Complex | `address` | String | Multi-line format | See Address Formatting |
| `terms` (text value) | String | `paymentTerms` | String | getText() | Text, not value |
| `vatregnumber` | String | `abn` | String | Direct | Australian Business Number |
| Bank: `custrecord_2663_entity_bank_no` + `custrecord_2663_entity_branch_no` | String | `bsb` | String | Concatenate | Example: "123" + "456" = "123456" |
| Bank: `custrecord_2663_entity_acct_no` | String | `accountNumber` | String | Direct | |
| Constant | - | `entityName` | String | Hardcoded | "Pymble Ladies College" |

**Scripts Using This Mapping:**
- `Feoda_UE_create_supplier_alii.js` (CREATE)
- `Feoda_UE_update_supplier_alii.js` (bank details EDIT)
- `Feoda_UE_update_vendor_supplier_alii.js` (vendor EDIT)
- `Feoda_MR_create_data_tables_alii.js` (bulk operations)

---

### 2. Alli Invoice → NetSuite Vendor Bill

| Alli Field | Alli Type | NetSuite Field | NetSuite Type | Transformation | Notes |
|------------|-----------|----------------|---------------|----------------|-------|
| `id` | Number | `externalid` | String | Direct | For duplicate checking |
| `invoiceNumber` | String | `tranid` | String | Direct | Transaction number |
| `supplierName` | String | `entity` | Lookup | setText() | Lookup by name |
| `dueDate` | String (ISO) | `duedate` | Date | `new Date(value)` | Parse ISO date |
| - | - | `trandate` | Date | `new Date()` | Current date |
| `poNumber` | String | `otherrefnum` | String | Direct | PO reference |
| `invoiceDescription` | String | `memo` | String | Direct | Header memo |
| `lines[]` | Array | Expense sublist | Sublist | Line-by-line | See Line Items below |
| - | - | `custbody_fd_bill_created_from_alii` | Boolean | `true` | Custom flag |

**Record Type Determination:**
- If ANY line has `total < 0` → Create **Vendor Credit**
- Otherwise → Create **Vendor Bill**

---

### 3. Alli Invoice Lines → NetSuite Expense Lines

| Alli Field | Alli Type | NetSuite Field | NetSuite Type | Transformation | Notes |
|------------|-----------|----------------|---------------|----------------|-------|
| `glCode` (parsed) | String | `account` | Lookup | Parse & map | See GL Code Parsing |
| `description` | String | `memo` | String | Direct | Line description |
| `quantity` | Number | `quantity` | Number | `parseFloat()` | Default: 1 |
| `unitCost` | Number | `rate` | Number | `parseFloat()` or `Math.abs()` | Abs for credits |
| `subtotal` | Number | `amount` | Number | `parseFloat()` or `Math.abs()` | Abs for credits |
| `taxCode` | String | `taxcode` | Lookup | Map to internal ID | Via tax code mapping |
| `subAllocationCode` | String | `customer` | Lookup | Map to job ID | Via job mapping |
| `glCode` segment | String | `location` | Lookup | Extract & map | 2nd segment |
| `glCode` segment | String | `department` | Lookup | Extract & map | 4th+ segment |
| `glCode` segment | String | `class` | Lookup | Extract & map | 3rd segment |

---

### 4. GL Code Parsing

**Alli Format:** `{accountCode}-{locationId}-{classId}-{departmentCode}`

**Example:** `"1410-W-C3-Facilities-Management"`

**Parsed Result:**
```javascript
{
  accountCode: "1410",      // Maps to Account
  locationId: "W",          // Maps to Location
  classId: "C3",            // Maps to Class
  departmentCode: "Facilities-Management"  // Maps to Department (can include hyphens)
}
```

**Mapping Process:**
1. Split by `-` (hyphen)
2. First segment → Account code
3. Second segment → Location external ID
4. Third segment → Class external ID
5. Remaining segments joined with `-` → Department name

**NetSuite Lookups:**
- **Account:** Map account code to internal ID via search
- **Location:** Map external ID to internal ID
- **Department:** Map name (uppercase, trimmed) to internal ID
- **Class:** Map external ID to internal ID

**Special Handling:**
- Account "1410" → Hardcoded to internal ID 229
- Missing segments → Leave field empty
- Invalid mappings → Log validation error, add to bill memo

---

### 5. Department Name Processing

**NetSuite Format:** `"01 : 100 Facilities Management"`

**Processing Steps:**
1. Split by `:` and take last segment
2. Trim whitespace
3. Remove leading numbers
4. Trim extra spaces
5. Convert to uppercase

**Example:**
```javascript
"01 : 100 Facilities Management"
→ "100 Facilities Management"  // After colon split
→ "Facilities Management"       // Remove leading numbers
→ "FACILITIES MANAGEMENT"       // Uppercase
```

**Matching:**
- Department mapping uses uppercase keys
- GL code department also converted to uppercase
- Case-insensitive matching

---

### 6. Address Formatting

**NetSuite Address Subrecord Fields:**
- `addressee` - Recipient name
- `attention` - Attention line
- `addr1` - Address line 1
- `addr2` - Address line 2
- `city` - City
- `state` - State/Province
- `zip` - Postal code
- `country` - Country (text value)

**Formatting Process:**
1. Collect non-empty fields
2. Combine city, state, zip with spaces
3. Join all lines with `\n` (newline)

**Example Output:**
```
John Doe
ATTN: Accounts Payable
123 Main Street
Suite 100
Sydney NSW 2000
Australia
```

**Alli Storage:**
- Stored as multi-line string
- Newlines converted to spaces when needed: `.replace(/\\n/g, ' ').replace(/\n/g, ' ')`

---

### 7. Date Formatting

**NetSuite → Alli:**

**Format:** `"yyyy-MM-dd HH:mm:ss"`

**Example:** `"2024-01-15 14:30:00"`

**Function:** `formatDateForAlii(dateValue)`

**Code:**
```javascript
function formatDateForAlii(dateValue) {
  if (!dateValue) return null;
  
  var date = new Date(dateValue);
  var year = date.getFullYear();
  var month = ('0' + (date.getMonth() + 1)).slice(-2);
  var day = ('0' + date.getDate()).slice(-2);
  var hours = ('0' + date.getHours()).slice(-2);
  var minutes = ('0' + date.getMinutes()).slice(-2);
  var seconds = ('0' + date.getSeconds()).slice(-2);
  
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
}
```

**Used For:**
- `paidDate` in SetInvoicePaid API

**Alli → NetSuite:**
- Alli sends ISO 8601 format: `"2024-01-15T14:30:00Z"`
- NetSuite parses with `new Date(value)`

---

### 8. Account → GL Code

| NetSuite Field | NetSuite Type | Alli Field | Alli Type | Transformation | Notes |
|----------------|---------------|------------|-----------|----------------|-------|
| `number` | String | `accountCode` | String | Direct | Account number |
| `name` | String | `description` | String | Direct | Account name |
| Department names (all) | Array | `businessUnitsLinked` | Array | Collect all dept names | Links GL to departments |
| Constant "null" | - | `defaultTaxCode` | String | Hardcoded | Not used |
| Constant | - | `entityName` | String | Hardcoded | "Pymble Ladies College" |

---

### 9. Department → Business Unit

| NetSuite Field | NetSuite Type | Alli Field | Alli Type | Transformation | Notes |
|----------------|---------------|------------|-----------|----------------|-------|
| `name` | String | `name` | String | Direct | Department name |
| `internalid` | Number | `code` | String | `toString()` | Internal ID |
| Constant | - | `entityName` | String | Hardcoded | "Pymble Ladies College" |

---

### 10. Tax Code → Tax Code

| NetSuite Field | NetSuite Type | Alli Field | Alli Type | Transformation | Notes |
|----------------|---------------|------------|-----------|----------------|-------|
| `itemid` | String | `name` | String | Direct | Tax code name |
| `description` | String | `description` | String | Direct | Description |
| `rate` | String | `percentage` | Number | Parse & remove % | "10.00%" → 10.00 |
| Constant | - | `entityName` | String | Hardcoded | "Pymble Ladies College" |

**Percentage Conversion:**
```javascript
var percentageStr = "10.00%";
var percentageNum = parseFloat(percentageStr.replace('%', ''));
// Result: 10.00
```

---

### 11. Job → Sub-Allocation

| NetSuite Field | NetSuite Type | Alli Field | Alli Type | Transformation | Notes |
|----------------|---------------|------------|-----------|----------------|-------|
| `companyname` | String | `name` | String | Direct | Job name |
| `internalid` | Number | `code` | String | `toString()` | Internal ID |
| Constant | - | `entityName` | String | Hardcoded | "Pymble Ladies College" |
| Hardcoded | - | `linkedGLAccountCodes` | Array | ['3800-2-102-000'] | Fixed GL link |

---

### 12. Payment → Invoice Paid Status

| NetSuite Field | NetSuite Type | Alli Field | Alli Type | Transformation | Notes |
|----------------|---------------|------------|-----------|----------------|-------|
| Bill `externalid` | String | `invoiceId` | Number | `parseInt()` | Alli invoice ID |
| Constant `true` | - | `paid` | Boolean | Hardcoded | Always true |
| Bill `custbody_fd_alii_sync_date` or current | Date | `paidDate` | String | formatDateForAlii() | "yyyy-MM-dd HH:mm:ss" |

---

### 13. Bill → Posting Status

| NetSuite Field | NetSuite Type | Alli Field | Alli Type | Transformation | Notes |
|----------------|---------------|------------|-----------|----------------|-------|
| Bill `externalid` | String | `invoiceId` | Number | `parseInt()` | Alli invoice ID |
| Constant `1` | - | `status` | Number | Hardcoded | 1 = Posted |
| Bill `internalid` | Number | `postingNumber` | String | `toString()` | NetSuite bill ID |
| Constructed | - | `message` | String | Template string | Bill details |

**Message Template:**
```javascript
"Paid In Full in NetSuite - Bill ID: {billId}, Bill Number: {billNumber}, Payment ID: {paymentId}"
```

---

## Data Validation Rules

### Required Fields

**Supplier Creation:**
- `entityName` (required, constant)
- `code` (required, vendor internal ID)
- `name` (required, company name or entity ID)
- `address`, `email`, `bsb`, `accountNumber`, `abn`, `paymentTerms` (optional)

**Invoice Import:**
- `invoiceNumber` (required)
- `supplierName` (required, must exist in NetSuite)
- `dueDate` (required)
- `lines` (required, at least one line)
- Each line: `glCode`, `quantity`, `unitCost`, `subtotal` (required)

**GL Code Creation:**
- `entityName` (required)
- `accountCode` (required)
- `description` (required)
- `businessUnitsLinked` (optional, can be empty array)

---

## Data Type Conversions

### String to Number
```javascript
parseFloat(value)  // For amounts, quantities
parseInt(value)    // For IDs
```

### Number to String
```javascript
value.toString()
```

### Boolean Handling
```javascript
// NetSuite checkbox to Alli boolean
value === 'T' ? true : false

// Or direct boolean
value === true
```

### Array Handling
```javascript
// Single value to array
[value]

// Multiple values
values.map(function(v) { return v; })
```

---

## Null/Empty Value Handling

**Null Values:**
```javascript
value || ""           // Empty string if null/undefined
value || null         // null if falsy
value || 0            // 0 if falsy
value === "null" ? null : value  // String "null" to actual null
```

**Empty Arrays:**
```javascript
Array.isArray(value) ? value : []  // Ensure array
value.length > 0 ? value : []      // Empty if no items
```

**Optional Fields:**
- If optional field is empty, send empty string or omit from payload
- Alli API handles null/empty values gracefully

---

## Lookup Mappings

### Creating Lookup Maps

**Pattern:**
```javascript
var mapping = {};
searchResults.forEach(function(result) {
  var key = result.getValue('key_field');
  var value = result.getValue('value_field');
  mapping[key] = value;
});
```

**Example - Department Mapping:**
```javascript
var departmentMap = {};
departmentSearch.run().each(function(result) {
  var name = result.getValue('name');
  var processed = name.split(':').pop().trim()
                      .replace(/^\d+\s*/, '')
                      .toUpperCase();
  departmentMap[processed] = {
    internalId: result.id,
    name: result.getValue('name')
  };
  return true;
});
```

**Usage:**
```javascript
var deptInternalId = departmentMap['FACILITIES']?.internalId;
if (!deptInternalId) {
  // Handle missing mapping
}
```

---

## Special Cases

### Account 1410
**Special Rule:** Account code "1410" is hardcoded to internal ID 229

**Reason:** Specific business requirement for this account

**Code:**
```javascript
if (glCodeObj.accountCode === '1410') {
  billRecord.setCurrentSublistValue({
    sublistId: 'expense',
    fieldId: 'account',
    value: 229
  });
} else {
  // Normal mapping
}
```

### Negative Amounts (Vendor Credits)
**Detection:** Any line with `total < 0`

**Transformation:**
- `unitCost`: `Math.abs(parseFloat(value))`
- `amount`: `Math.abs(parseFloat(value))`

**Reason:** NetSuite Vendor Credit expects positive values

### BSB Concatenation
**Format:** Bank Number + Branch Number (no separator)

**Example:**
- Bank Number: "123"
- Branch Number: "456"
- BSB: "123456"

**Code:**
```javascript
const bsb = bankNum + branchNum;
```

---

## Validation Error Tracking

**Pattern:**
```javascript
let validationErrors = [];

if (!requiredField) {
  validationErrors.push('Missing required field: ...');
}

if (validationErrors.length > 0) {
  billRecord.setValue({
    fieldId: 'custbody_alii_error_message',
    value: 'Validation Warnings: ' + validationErrors.join('; ')
  });
}
```

**Custom Field:** `custbody_alii_error_message`

**Purpose:** Track validation issues without preventing record creation

---

## Performance Optimization

### Mapping Caching
**Create mappings once per script execution:**
```javascript
// At script level, not in loops
const departmentMapping = getDepartmentMapping();
const classMapping = getClassMapping();
// ... use in loops
```

### Bulk Operations
**Use ES6 Map for large lookups:**
```javascript
const accountMapping = new Map();
// O(1) lookup time
accountMapping.get(accountCode);
```

### Search Pagination
**For large result sets:**
```javascript
const pagedData = search.runPaged({ pageSize: 1000 });
pagedData.pageRanges.forEach(function(pageRange) {
  const page = pagedData.fetch({ index: pageRange.index });
  // Process page
});
```
