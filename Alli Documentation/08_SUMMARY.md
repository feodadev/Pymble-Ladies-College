# Summary & Quick Reference

## Project Summary

**Client:** Pymble Ladies College  
**Integration:** NetSuite ↔ Alli Invoice Management System  
**Total Scripts:** 8 files (2 libraries, 2 Map/Reduce, 1 Scheduled, 4 User Events)  
**API Base:** https://api.myalii.app/api  
**Entity:** "Pymble Ladies College" (Subsidiary ID: 2)

---

## Script Inventory

| Script Name | Type | Trigger | Purpose |
|-------------|------|---------|---------|
| `Feoda_functions_help.js` | Library | N/A | Integration logging utilities |
| `Feoda_RL_Helper.js` | Library | N/A | All Alli API functions |
| `Feoda_MR_authentication.js` | Map/Reduce | Scheduled/Manual | Import invoices, create bills/credits |
| `Feoda_MR_create_data_tables_alii.js` | Map/Reduce | Manual | Bulk master data sync (setup) |
| `Feoda_SS_get_all_invoice_data_alii.js` | Scheduled | Periodic | Fetch invoices and trigger Map/Reduce |
| `Feoda_UE_change_posting_status_alii.js` | User Event | Payment afterSubmit | Update paid status in Alli |
| `Feoda_UE_create_supplier_alii.js` | User Event | Vendor CREATE | Create supplier in Alli |
| `Feoda_UE_update_supplier_alii.js` | User Event | Bank Details EDIT | Update supplier bank info |
| `Feoda_UE_update_vendor_supplier_alii.js` | User Event | Vendor EDIT | Update supplier details |

---

## Data Flow Overview

```
NetSuite → Alli (Master Data):
├── Vendors → Suppliers
├── Accounts → GL Codes
├── Departments → Business Units
├── Tax Codes → Tax Codes
└── Jobs → Sub-Allocations

Alli → NetSuite (Invoices):
├── Invoices (FinalReview) → Vendor Bills
├── Invoices (negative lines) → Vendor Credits
└── Duplicate Check (by external ID)

NetSuite → Alli (Payment Status):
├── Vendor Payment → SetInvoicePaid
└── Bill ID → SetInvoicePostingStatus
```

---

## Alli API Summary

| API Endpoint | Method | Purpose | Input | Output |
|--------------|--------|---------|-------|--------|
| `/api/Auth/Client` | POST | Get token | Credentials | Token |
| `/api/Supplier` | GET | List suppliers | None | Supplier array |
| `/api/Supplier` | POST | Create supplier | Supplier data | Created supplier |
| `/api/Supplier/{id}` | PUT | Update supplier | Supplier data | Updated supplier |
| `/api/Invoice` | GET | List invoices | skip, take | Invoice array |
| `/api/Invoice/GetInvoicesReadyForPost/{entityId}` | GET | Get ready invoices | Entity ID | Invoice array |
| `/api/Invoice/SetInvoicePaid` | POST | Mark as paid | Invoice ID, date | Success response |
| `/api/Invoice/SetInvoicePostingStatus` | POST | Update status | Invoice ID, bill ID | Success response |
| `/api/Entity` | GET | List entities | None | Entity array |
| `/api/Entity` | POST | Create entity | Entity data | Created entity |
| `/api/GLCode` | GET | List GL codes | None | GL code array |
| `/api/GLCode` | POST | Create GL code | GL code data | Created GL code |
| `/api/BusinessUnit` | POST | Create business unit | Department data | Created unit |
| `/api/TaxCode` | POST | Create tax code | Tax code data | Created tax code |
| `/api/SubAllocation` | POST | Create sub-allocation | Job data | Created allocation |

---

## Key Field Mappings (Quick Reference)

### Vendor ↔ Supplier
```
NS internalid     → Alli code
NS companyname    → Alli name (lookup key)
NS email          → Alli email
NS address        → Alli address (formatted)
NS vatregnumber   → Alli abn
Bank no + branch  → Alli bsb
NS account number → Alli accountNumber
NS terms (text)   → Alli paymentTerms
```

### Invoice → Vendor Bill
```
Alli id               → NS externalid
Alli invoiceNumber    → NS tranid
Alli supplierName     → NS entity (lookup)
Alli dueDate          → NS duedate
Alli poNumber         → NS otherrefnum
Alli invoiceDescription → NS memo
Alli lines[]          → NS expense sublist
```

### GL Code Parsing
```
Format: "accountCode-locationId-classId-departmentCode"
Example: "1410-W-C3-Facilities"

accountCode   → Account internal ID
locationId    → Location internal ID  
classId       → Class internal ID
departmentCode → Department internal ID
```

---

## Custom NetSuite Fields

### On Vendor
- `custentity_alii_sync_date` - Last sync timestamp
- `custentity_alii_sync_status` - Sync success flag

### On Vendor Bill
- `custbody_fd_bill_created_from_alii` - Identifies Alli bills
- `custbody_fd_alii_sync_status` - Payment sync status
- `custbody_fd_alii_sync_date` - Payment sync timestamp
- `custbody_alii_error_message` - Validation errors

### On Bank Details Record
- `custrecord_2663_parent_vendor` - Link to vendor
- `custrecord_2663_entity_acct_no` - Account number
- `custrecord_2663_entity_bank_no` - Bank number (BSB part 1)
- `custrecord_2663_entity_branch_no` - Branch number (BSB part 2)
- `custrecord_bank_alii_sync_date` - Last sync timestamp
- `custrecord_bank_alii_sync_status` - Sync success flag

### Integration Log Record
- `custrecord_il_transaction_type` - Type of operation
- `custrecord_il_request_method` - HTTP method
- `custrecord_il_response_code` - HTTP status
- `custrecord_il_execution_summary` - JSON summary
- `custrecord_il_response_body` - Full response
- `custrecord_il_status` - Success/Failed/Partial
- `custrecord_il_error_message` - Error details
- `custrecord_il_request_url` - API endpoint
- `custrecord_il_timestamp` - Execution time
- `custrecord_il_integration_type` - Integration category

---

## Script Parameters Reference

### Map/Reduce Authentication Script
- `custscript_sandbox_api_keys` - Sandbox credentials
- `custscript_production_api_keys` - Production credentials
- `custscript_prod_entity_id` - Entity ID for invoice filtering
- `custscript_email_recipients` - Error notification emails

### Map/Reduce Data Tables Script
- `custscript_alii_pro_keys_data_tabl` - Production credentials

### Scheduled Script
- `custscript_ss_sandbox_api_keys` - Sandbox credentials
- `custscript_ss_prodcution_api_keys` - Production credentials

### Payment User Event
- `custscript_production_api_keys_ue` - Production credentials

### Create Supplier User Event
- `custscript_prod_api_keys_vendor_ue` - Production credentials
- `custscript_sb_api_keys_vendor_ue` - Sandbox credentials
- `custscript_email_recipients_ue` - Error notification emails

### Update Bank Details User Event
- `custscript_prod_api_keys_bank_ue` - Production credentials
- `custscript_sb_api_keys_bank_ue` - Sandbox credentials
- `custscript_email_recipients_ue_update` - Error notification emails

### Update Vendor User Event
- `custscript_prod_api_keys_ven_sup_ue` - Production credentials
- `custscript_sb_api_keys_vendor_ue` - Sandbox credentials
- `custscript_email_recipients_ue_ven_sup` - Error notification emails

---

## Execution Workflows

### 1. Invoice Import (Scheduled)
```
1. Scheduled Script executes (daily/hourly)
2. Authenticate with Alli
3. Fetch invoices (stage = "FinalReview")
4. Save to File Cabinet (folder 1368)
5. Trigger Map/Reduce script
6. Map/Reduce:
   - Check duplicates
   - Determine Bill vs Credit (negative lines)
   - Parse GL codes
   - Create Vendor Bill or Credit
   - Update posting status in Alli
7. Create integration log
8. Email on errors
```

### 2. Vendor Creation (Real-time)
```
1. User creates Vendor in NetSuite
2. User Event afterSubmit triggers
3. Extract vendor data (basic + bank + address)
4. Authenticate with Alli
5. Call Create Supplier API
6. Update sync status fields on vendor
7. Create integration log
8. Email on errors
```

### 3. Vendor Update (Real-time)
```
1. User edits Vendor in NetSuite
2. User Event afterSubmit triggers
3. Extract updated vendor data
4. Search for bank details
5. Authenticate with Alli
6. Get all suppliers from Alli
7. Find supplier by name match
8. Call Update Supplier API
9. Update sync status fields
10. Create integration log
11. Email on errors
```

### 4. Bank Details Update (Real-time)
```
1. User edits Bank Details record
2. User Event afterSubmit triggers
3. Load parent vendor
4. Extract all vendor data + new bank details
5. Authenticate with Alli
6. Update supplier in Alli (by name lookup)
7. Update sync status on bank record
8. Create integration log
9. Email on errors
```

### 5. Payment Processing (Real-time)
```
1. User creates Vendor Payment
2. User Event afterSubmit triggers
3. Identify paid bills from Alli
4. For each bill:
   - Check custbody_fd_bill_created_from_alii = true
   - Check statusRef = 'paidInFull'
   - Check externalid exists
5. Authenticate with Alli
6. Call SetInvoicePaid for all qualified bills
7. If all successful:
   - Call SetInvoicePostingStatus with bill IDs
8. Update sync fields on bills
9. Create integration log
10. Email on errors
```

### 6. Master Data Sync (Manual)
```
1. Manually run Map/Reduce Data Tables script
2. Uncomment desired operation in getInputData()
3. Options:
   - Update Suppliers (bulk)
   - Create Business Units
   - Create Tax Codes
   - Create Sub-Allocations
   - Create GL Codes
4. Authenticate with Alli
5. Extract NetSuite data
6. Call appropriate Alli APIs
7. Results logged in execution log
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Authentication Failed | Invalid credentials | Check script parameters, verify API keys |
| Supplier Not Found | Name mismatch | Ensure company name matches exactly in Alli |
| Duplicate Invoice | Already imported | Check external ID, may be legitimate duplicate |
| Missing GL Code Mapping | Invalid GL code format | Verify GL code follows format: account-loc-class-dept |
| Department Not Found | Name mismatch | Check department mapping, verify uppercase matching |
| Bill Creation Failed | Missing supplier | Create/import supplier first |
| Payment Not Syncing | Bill not from Alli | Check custbody_fd_bill_created_from_alii flag |
| Timeout Error | Large dataset | Implement pagination, reduce page size |

---

## Monitoring & Maintenance

### Key Logs to Monitor
1. **Integration Log Records** (customrecord_integration_log)
   - Filter by Status = "Failed" or "Partial"
   - Review error messages
   - Check timestamp for frequency

2. **Script Execution Logs**
   - Audit logs for successful operations
   - Error logs for failures
   - Debug logs for detailed troubleshooting

3. **Email Notifications**
   - Sent on Failed or Partial status
   - Contains summary and first errors
   - Link to integration log record

### Regular Maintenance Tasks
- **Daily:** Review integration logs for failures
- **Weekly:** Verify sync status fields on vendors
- **Monthly:** Audit duplicate invoice handling
- **Quarterly:** Review and update API credentials
- **As Needed:** Update mapping functions for new data

### Performance Monitoring
- Script execution time (Map/Reduce governance)
- API response times
- Number of invoices processed
- Success/failure rates
- Email notification frequency

---

## Testing Checklist

### Invoice Import
- [ ] Single invoice imports successfully
- [ ] Multiple invoices in one batch
- [ ] Negative line items create Vendor Credit
- [ ] Duplicate detection works
- [ ] GL code parsing correct
- [ ] All dimensions mapped (location, dept, class)
- [ ] Tax codes applied correctly
- [ ] Job assignments work
- [ ] Integration log created
- [ ] Posting status updated in Alli

### Vendor Sync
- [ ] New vendor creates supplier
- [ ] Vendor edit updates supplier
- [ ] Bank details edit updates supplier
- [ ] Address formatting correct
- [ ] BSB concatenation correct
- [ ] Sync status fields updated
- [ ] Integration log created
- [ ] Email notification on error

### Payment Sync
- [ ] Single bill payment syncs
- [ ] Multiple bills payment syncs
- [ ] Only Alli bills processed
- [ ] Paid status updated in Alli
- [ ] Posting status updated
- [ ] Bill sync fields updated
- [ ] Integration log created
- [ ] Email notification works

### Master Data Sync
- [ ] Suppliers created/updated in bulk
- [ ] GL codes created with business units
- [ ] Departments created
- [ ] Tax codes created
- [ ] Sub-allocations created

---

## File & Folder Structure

```
Pymble-Ladies-College/
├── Libraries/
│   ├── Feoda_functions_help.js
│   └── Feoda_RL_Helper.js
├── Map Reduce/
│   ├── Feoda_MR_authentication.js
│   └── Feoda_MR_create_data_tables_alii.js
├── Schedule/
│   └── Feoda_SS_get_all_invoice_data_alii.js
├── User Event/
│   ├── Feoda_UE_change_posting_status_alii.js
│   ├── Feoda_UE_create_supplier_alii.js
│   ├── Feoda_UE_update_supplier_alii.js
│   └── Feoda_UE_update_vendor_supplier_alii.js
└── Alli Documentation/
    ├── 00_PROJECT_OVERVIEW.md
    ├── 01_LIBRARY_SCRIPTS.md
    ├── 02_MAP_REDUCE_SCRIPTS.md
    ├── 03_SCHEDULED_SCRIPT.md
    ├── 04_USER_EVENT_SCRIPTS.md
    ├── 05_API_REFERENCE.md
    ├── 06_FIELD_MAPPING.md
    └── 07_SUMMARY.md (this file)
```

---

## Quick Command Reference

### Deploy New Script
1. Upload to File Cabinet → SuiteScripts folder
2. Create Script record (Scripts menu)
3. Create Deployment
4. Set parameters
5. Assign to users/roles
6. Save and test

### Update Existing Script
1. Edit file in File Cabinet
2. Save changes
3. No redeploy needed (dynamic)
4. Clear cache if issues

### View Integration Logs
```
Customization → Lists, Records, & Fields → Record Types → 
Integration Log → List
```

### Search Alli Bills
```
Transactions → Vendors → Vendor Bills
Add Filter: custbody_fd_bill_created_from_alii = true
```

### Check Sync Status
```
Lists → Relationships → Vendors
Add Column: custentity_alii_sync_status
Add Column: custentity_alii_sync_date
```

---

## Contact & Support

**For Technical Issues:**
- Check integration logs first
- Review script execution logs
- Verify API credentials
- Test API endpoints manually
- Contact Alli support for API issues

**For Business Process Questions:**
- Review workflow documentation
- Check field mapping reference
- Verify data in both systems
- Consult with Pymble stakeholders

---

## Version History

**Current Version:** 1.0 (December 2025)

**Components:**
- 8 SuiteScript 2.1 files
- 15 Alli API endpoints used
- 12 custom fields on various records
- 1 custom integration log record type

**Future Enhancements:**
- Implement retry logic for transient failures
- Add incremental sync based on last update date
- Optimize supplier lookup (avoid loading all suppliers)
- Add validation before API calls
- Implement queue for large batches
- Add dashboard for sync status monitoring
- Create scheduled report for daily summary

---

## Documentation Last Updated

December 15, 2025

---

*This documentation package provides complete technical specifications for the Pymble Ladies College - Alli integration project. For questions or clarifications, refer to the detailed documentation files or contact the development team.*
