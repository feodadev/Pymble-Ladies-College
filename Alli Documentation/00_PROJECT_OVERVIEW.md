# Pymble Ladies College - Alli Integration Project Documentation

## Project Overview

**Client:** Pymble Ladies College  
**Project Name:** Alli Integration  
**Platform:** Oracle NetSuite  
**External System:** Alli (Invoice & Supplier Management System)  
**API Base URL:** https://api.myalii.app/api  

## Purpose

This integration project connects NetSuite with Alli's invoice and supplier management system to:
1. Synchronize vendor/supplier data between NetSuite and Alli
2. Import approved invoices from Alli into NetSuite as Vendor Bills or Vendor Credits
3. Update payment status back to Alli when bills are paid in NetSuite
4. Sync master data (GL Codes, Business Units, Tax Codes, Sub-Allocations)

## Architecture

The integration consists of:
- **2 Library Scripts** - Reusable helper functions
- **2 Map/Reduce Scripts** - Batch processing for invoices and data creation
- **1 Scheduled Script** - Periodic invoice fetching
- **4 User Event Scripts** - Real-time vendor and payment synchronization

## Data Flow

1. **Master Data Sync (NetSuite → Alli):**
   - Vendors/Suppliers
   - GL Codes
   - Business Units (Departments)
   - Tax Codes
   - Sub-Allocations (Jobs)
   - Entities

2. **Invoice Processing (Alli → NetSuite):**
   - Scheduled script fetches invoices with stage "FinalReview"
   - Map/Reduce creates Vendor Bills or Vendor Credits
   - Posting status updated back to Alli

3. **Payment Sync (NetSuite → Alli):**
   - When a bill is paid, Alli is notified
   - Invoice marked as "Paid" in Alli
   - Posting status updated with NetSuite bill ID

## Authentication

All API calls use Bearer Token authentication:
- API endpoint: `POST /api/Auth/Client`
- Credentials stored in script parameters (separate for sandbox and production)
- Token is retrieved at the start of each script execution

## Integration Logging

All scripts create integration logs in custom record `customrecord_integration_log` tracking:
- Execution summaries (total/successful/failed/skipped)
- Request/Response details
- Error messages
- Email notifications for failures
