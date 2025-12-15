# Recommendations & Best Practices

**Note:** This section contains operational recommendations and best practices. These are suggestions based on integration patterns and industry standards.

---

## Scheduled Script - Operational Considerations

### Performance Considerations

1. **Pagination:** Handled by library function
   - Page size: 2000 invoices
   - Maximum pages: 20 (safety limit)
   - Total capacity: ~40,000 invoices per run

2. **File Size:** JSON file size depends on invoice count and line item detail

3. **Frequency:** Recommended to run:
   - **Daily** for low volume (< 100 invoices/day)
   - **Hourly** for high volume or time-sensitive processing
   - **Multiple times daily** during peak periods

### Monitoring & Maintenance

**Key Logs to Monitor:**
1. "Token obtained" - Confirms authentication
2. "Fetched X invoices" - Shows volume processed
3. "File Created" - Confirms file save with ID
4. "Map/Reduce triggered" - Shows task ID

**Common Issues:**
1. **No token:** Check API credentials in script parameters
2. **No invoices:** Check if Alli has invoices in "FinalReview" stage
3. **File not created:** Check folder 1368 permissions
4. **Map/Reduce not running:** Check deployment status and concurrency limits

### Future Enhancements

**Potential improvements:**
1. Add retry logic for transient failures
2. Track processed invoices to avoid reprocessing
3. Add script parameter for stage filter (currently hardcoded to "FinalReview")
4. Implement incremental processing based on last sync date
5. Add integration log creation in this script for visibility
6. Use the saved file in Map/Reduce instead of making another API call

---

## User Event Scripts - Operational Considerations

### 1. Payment Sync Script (Feoda_UE_change_posting_status_alii.js)

#### Performance Considerations

1. **Bill Loading:** Each bill in payment is loaded individually
2. **API Calls:** Two API calls per paid bill (SetInvoicePaid + SetInvoicePostingStatus)
3. **Field Updates:** Individual submitFields calls for each bill
4. **Recommendation:** Suitable for payments with < 50 bills. For larger batches, consider queuing for scheduled processing.

#### Monitoring

**Key Logs:**
- "Payment Created" - Shows payment ID being processed
- "Bills to Process" - Count of bills in payment
- "Bills to Update in Alii" - Count of qualified Alli bills
- "Invoices Marked as Paid Successfully" - Confirms paid status update
- "Alii Posting Status Updated Successfully" - Confirms posting status update

**Integration Log Queries:**
- Transaction Type = 19
- Look for "Failed" or "Partial" status
- Check error messages for specific bill failures

#### Common Issues

1. **Authentication Failures:**
   - Check API credentials in script parameters
   - Verify network connectivity to Alli

2. **Bill Not Updating:**
   - Verify `custbody_fd_bill_created_from_alii` = true
   - Check that `externalid` matches Alli invoice ID
   - Ensure bill status is "Paid In Full"

3. **Partial Failures:**
   - Some Alli invoices may already be marked as paid
   - Check Alli invoice status
   - Review integration log for specific invoice errors

4. **Sync Fields Not Updating:**
   - Check field permissions
   - Verify custom fields exist on bill record
   - Review integration log for field update errors

---

### 2. Create Supplier Script (Feoda_UE_create_supplier_alii.js)

#### Operational Considerations

1. **Required Fields:**
   - Ensure vendor has company name or entity ID
   - Bank details are optional but recommended

2. **Address Quality:**
   - Complete address improves supplier communication
   - Script handles missing address components gracefully

3. **ABN:**
   - Important for Australian vendors
   - Used for tax compliance in Alli

4. **Testing:**
   - Test with vendors that have complete data
   - Test with minimal data to verify error handling

---

### 3. Update Bank Details Script (Feoda_UE_update_supplier_alii.js)

#### Operational Scenarios

1. **BSB Update:**
   - User edits bank number or branch number
   - Script triggers, concatenates new BSB
   - Updates supplier in Alli

2. **Account Number Change:**
   - User edits account number field
   - Script updates supplier with new account number

3. **New Vendor (No Alli Supplier):**
   - Bank details edited before supplier created in Alli
   - Update fails with "not found"
   - User should create supplier first (using create script)

#### Operational Notes

1. **Recommended Sequence:**
   - Create vendor first (triggers create supplier script)
   - Then edit bank details (triggers this update script)

2. **BSB Format:**
   - Bank number and branch number should be correct
   - No validation on format (relies on user input)

3. **Supplier Name Matching:**
   - Company name must match exactly in Alli
   - Case-sensitive matching
   - Any mismatch results in "not found"

---

### 4. Update Vendor Script (Feoda_UE_update_vendor_supplier_alii.js)

#### Common Issues

1. **Supplier Not Found:**
   - Vendor never created in Alli
   - Company name changed (lookup fails)
   - **Solution:** Run create supplier script or manually create in Alli

2. **Name Mismatch:**
   - NetSuite company name doesn't match Alli supplier name
   - Case-sensitive comparison
   - **Solution:** Ensure names match exactly

3. **Missing Bank Details:**
   - Vendor has no bank details record
   - Updates proceed with empty BSB/account number
   - **Solution:** Create bank details record if needed

#### Performance Considerations

1. **Search for Bank Details:**
   - Additional search per vendor edit
   - Consider caching if performance issues arise

2. **Alli Supplier Lookup:**
   - `updateSupplierInAlli` retrieves ALL suppliers to build mapping
   - Can be slow with large supplier counts (> 1000)
   - Consider optimization if needed

3. **Address Subrecord Access:**
   - Accesses subrecords which can be slow
   - Acceptable for single vendor edits

#### Operational Notes

1. **Script Execution Flow:**
   - Create vendor → Create supplier script runs
   - Edit vendor details → This update script runs
   - Edit bank details → Bank details script runs

2. **Data Quality Considerations:**
   - Consistent company names improve matching
   - Complete address information improves Alli data quality

3. **Monitoring Approach:**
   - Check integration logs regularly
   - Look for "Supplier not found" errors
   - Indicates vendors not properly synced

---

## API Usage - Performance & Security

### Rate Limiting & Performance

**Pagination Best Practices:**
- Use pagination for large datasets (>1000 records)
- Recommended page size: 1000-2000 records
- Monitor for timeout errors (SSS_REQUEST_TIME_EXCEEDED)

**Retry Logic:**
- Implement for transient errors (5xx, timeouts)
- Exponential backoff recommended
- Maximum 3 retries

**Timeout Considerations:**
- NetSuite default: 60 seconds per HTTP request
- Large responses may timeout
- Use pagination to avoid timeouts

---

## Security Considerations

### Token Management
- Tokens obtained per script execution
- Tokens not cached across executions
- Credentials stored in script parameters (encrypted)

### Data Privacy
- Vendor bank details transmitted
- HTTPS only (enforced by API)
- Audit logs track all API calls

### Access Control
- API credentials tied to specific entity
- Credentials configured with minimal required permissions
- Separate credentials for sandbox and production

---

## Error Handling - Common Patterns

### Authentication Errors
```javascript
if (response.code === 401) {
  throw new Error('401 Unauthorized — check Authorization header and token value');
}
```

### Timeout Errors
```javascript
catch (e) {
  if (e.name === 'SSS_REQUEST_TIME_EXCEEDED') {
    log.error('Timeout Error', 'Third party took too long to respond');
    // Implement retry or queue for later
  }
}
```

### Validation Errors
- Check `isSuccessful` property in response body
- Parse `errors` array for field-specific messages
- Log detailed error information

---

## Data Transformation - Testing Approach

### Suggested Test Cases

1. **Complete Data:** All fields populated
2. **Minimal Data:** Only required fields
3. **Empty Optionals:** Optional fields null/empty
4. **Special Characters:** In names, addresses
5. **Long Text:** Maximum length fields
6. **Edge Cases:** Zero amounts, negative amounts
7. **Invalid References:** Missing lookups
8. **Duplicate Keys:** Multiple matching records

### Validation

- Check Alli UI for correct data display
- Verify NetSuite records match source data
- Test roundtrip (NetSuite → Alli → NetSuite)

---

## Performance - Optimization Approaches

### Mapping Caching
Create mappings once per script execution:
```javascript
// At script level, not in loops
const departmentMapping = getDepartmentMapping();
const classMapping = getClassMapping();
// ... use in loops
```

### Bulk Operations
Use ES6 Map for large lookups:
```javascript
const accountMapping = new Map();
// O(1) lookup time
accountMapping.get(accountCode);
```

### Search Pagination
For large result sets:
```javascript
const pagedData = search.runPaged({ pageSize: 1000 });
pagedData.pageRanges.forEach(function(pageRange) {
  const page = pagedData.fetch({ index: pageRange.index });
  // Process page
});
```

---

## Monitoring & Maintenance - Operational Guidelines

### Suggested Maintenance Schedule
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

### Key Integration Log Queries
1. Filter by Status = "Failed" or "Partial"
2. Review error messages
3. Check timestamp for frequency
4. Transaction Type = 19 for payment sync
5. Transaction Type = 2 for general operations

---

## Testing - Suggested Scenarios

### Integration Testing

#### Authentication
- Valid credentials
- Invalid credentials
- Expired token (if applicable)

#### Supplier Creation
- Complete data
- Minimal required fields
- Duplicate supplier

#### Invoice Import
- Single invoice
- Multiple invoices
- Negative amounts (credits)
- Missing GL codes
- Missing suppliers

#### Payment Sync
- Single bill payment
- Multiple bills payment
- Partial payment
- Already paid invoice

#### Error Handling
- Network timeout
- Invalid data
- Missing required fields
- API unavailable

### Test Environments
- **Sandbox:** For development/testing
- **Production:** With limited test data

### Complete Testing Checklist

#### Invoice Import
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

#### Vendor Sync
- [ ] New vendor creates supplier
- [ ] Vendor edit updates supplier
- [ ] Bank details edit updates supplier
- [ ] Address formatting correct
- [ ] BSB concatenation correct
- [ ] Sync status fields updated
- [ ] Integration log created
- [ ] Email notification on error

#### Payment Sync
- [ ] Single bill payment syncs
- [ ] Multiple bills payment syncs
- [ ] Only Alli bills processed
- [ ] Paid status updated in Alli
- [ ] Posting status updated
- [ ] Bill sync fields updated
- [ ] Integration log created
- [ ] Email notification works

#### Master Data Sync
- [ ] Suppliers created/updated in bulk
- [ ] GL codes created with business units
- [ ] Departments created
- [ ] Tax codes created
- [ ] Sub-allocations created

---

## Future Enhancement Opportunities

### Invoice Processing
1. Add retry logic for transient failures
2. Track processed invoices to avoid reprocessing
3. Add script parameter for stage filter (currently hardcoded to "FinalReview")
4. Implement incremental processing based on last sync date
5. Add integration log creation in scheduled script for visibility
6. Use the saved file in Map/Reduce instead of making another API call

### Supplier Management
1. Implement retry logic for transient failures
2. Optimize supplier lookup (avoid loading all suppliers)
3. Add validation before API calls
4. Implement queue for large batches
5. Add dashboard for sync status monitoring
6. Create scheduled report for daily summary

### General System Improvements
1. Implement batch processing for high-volume scenarios
2. Add caching layer for frequently accessed data
3. Create monitoring dashboard
4. Implement automated testing suite
5. Add data validation before API calls
6. Improve error messages with actionable guidance
7. Add webhook support for real-time sync
8. Implement conflict resolution strategies

---

## API Versioning - Considerations

**Current Status:** API not explicitly versioned in URLs

**Monitoring Approach:**
- Monitor Alli release notes for breaking changes
- Watch for new required fields
- Track deprecated endpoints
- Note changed response structures
- Monitor authentication changes
- Implement API version checking if/when introduced

**Preparation Steps:**
- Document current API behavior
- Create version-specific handling if needed
- Plan for migration windows
- Test new versions in sandbox first

---

## Troubleshooting Reference

### Common Issues & Solutions

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

**Last Updated:** December 15, 2025
