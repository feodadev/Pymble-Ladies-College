/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/record', 'N/search', '/SuiteScripts/Feoda/ALII Integration/Libraries/Feoda_RL_Helper.js'],
    function (runtime, record, search, RL_Helper) {
        const BASE_URL = 'https://api.myalii.app/api';
        const MAIN_ENTITY = {
            NAME: 'Pymble Ladies College'
        };

        function afterSubmit(context) {
            const title = 'afterSubmit (Vendor): ';

            var script = runtime.getCurrentScript();
            var emailRecipients = script.getParameter('custscript_email_recipients_ue_ven_sup');
            
            try {
                log.debug({
                    title: title + 'Debug Event Type',
                    details: 'Type value: [' + context.type + ']' +
                        ' | CREATE: [' + context.UserEventType.CREATE + ']' +
                        ' | EDIT: [' + context.UserEventType.EDIT + ']' +
                        ' | Match CREATE: ' + (context.type === context.UserEventType.CREATE) +
                        ' | Match EDIT: ' + (context.type === context.UserEventType.EDIT)
                });

                if (context.type !== context.UserEventType.EDIT) {
                    log.debug({
                        title: title + 'Skipping',
                        details: 'Event type is: ' + context.type
                    });
                    return;
                }

                const productionKeys = script.getParameter('custscript_prod_api_keys_ven_sup_ue');
                const sbKeys = script.getParameter('custscript_sb_api_keys_vendor_ue');

                var vendorRecord = context.newRecord;
                var vendorId = vendorRecord.id;

                log.debug({
                    title: title + 'Vendor Record Triggered',
                    details: 'Vendor ID: ' + vendorId + ' | Event: ' + context.type
                });

                // Load vendor record to get all details
                var vendor = record.load({
                    type: record.Type.VENDOR,
                    id: vendorId,
                    isDynamic: true
                });

                var entityId = vendor.getValue('entityid');
                var companyName = vendor.getValue('companyname') || vendor.getValue('entityid');
                var email = vendor.getValue('email') || '';
                var phone = vendor.getValue('phone') || '';
                var terms = vendor.getText('terms') || '';
                var abn = vendor.getValue('vatregnumber') || '';

                // Get address
                var address = getVendorAddress(vendor);

                // Get bank details
                var bankDetails = getVendorBankDetails(vendorId);

                log.debug({
                    title: title + 'Vendor Details',
                    details: 'ID: ' + vendorId +
                        ' | Entity ID: ' + entityId +
                        ' | Company: ' + companyName +
                        ' | BSB: ' + (bankDetails.bsb || 'N/A') +
                        ' | Account: ' + (bankDetails.accountNumber || 'N/A')
                });

                // Authenticate with Alii
                var token = RL_Helper.authenticate(sbKeys, productionKeys);
                if (!token) {
                    var authFailedLog = {
                        emailRecipients: emailRecipients,
                        recordType: 'Vendor',
                        method: 'PUT',
                        responseCode: 401,
                        totalProcessed: 1,
                        successful: 0,
                        failed: 1,
                        skipped: 0,
                        successfulInvoices: [],
                        failedInvoices: [{
                            vendorId: vendorId,
                            entityId: entityId,
                            companyName: companyName,
                            error: 'Authentication failed - Could not retrieve Alii token'
                        }],
                        skippedInvoices: [],
                        status: 'Failed',
                        errorMessage: 'Authentication Failed: Could not retrieve Alii token for vendor ID: ' + vendorId,
                        requestUrl: BASE_URL + '/Auth/Client'
                    };

                    RL_Helper.createIntegrationLog(authFailedLog);
                    log.error({
                        title: title + 'Authentication Failed',
                        details: 'Could not retrieve Alii token'
                    });
                    return;
                }

                // Prepare vendor data for update
                var vendorData = {};
                vendorData[vendorId] = {
                    internalId: vendorId.toString(),
                    entityId: entityId,
                    companyName: companyName,
                    email: email,
                    phone: phone,
                    address: address,
                    paymentTerms: terms,
                    abn: abn,
                    accountNumber: bankDetails.accountNumber,
                    bsb: bankDetails.bsb
                };

                log.debug({
                    title: title + 'Vendor Data Prepared for Update',
                    details: JSON.stringify(vendorData)
                });

                // Update supplier in Alii
                var updateResult = RL_Helper.updateSupplierInAlli(vendorData, MAIN_ENTITY.NAME, token);

                log.debug({
                    title: title + 'Supplier Update Result',
                    details: JSON.stringify(updateResult)
                });

                // Create integration log
                var logData = {
                    emailRecipients: emailRecipients,
                    recordType: 'Vendor',
                    method: 'PUT',
                    responseCode: updateResult.successful.length > 0 ?
                        updateResult.successful[0].statusCode :
                        (updateResult.failed.length > 0 ? updateResult.failed[0].statusCode : 0),
                    totalProcessed: updateResult.totalProcessed,
                    successful: updateResult.successful.length,
                    failed: updateResult.failed.length,
                    skipped: 0,
                    successfulInvoices: updateResult.successful,
                    failedInvoices: updateResult.failed.concat(updateResult.notFound),
                    skippedInvoices: [],
                    status: updateResult.failed.length > 0 || updateResult.notFound.length > 0 ?
                        'Failed' : 'Success',
                    errorMessage: updateResult.failed.length > 0 ?
                        updateResult.failed.map(function (f) {
                            return 'Vendor ' + f.supplierName + ': ' + f.error;
                        }).join('; ') :
                        (updateResult.notFound.length > 0 ?
                            updateResult.notFound.map(function (nf) {
                                return 'Vendor ' + nf.supplierName + ': ' + nf.reason;
                            }).join('; ') : ''),
                    requestUrl: BASE_URL + `/Supplier/${vendorId}`
                };

                RL_Helper.createIntegrationLog(logData);

                // Update vendor with sync status if successful
                if (updateResult.successful.length > 0) {
                    try {
                        record.submitFields({
                            type: record.Type.VENDOR,
                            id: vendorId,
                            values: {
                                custentity_alii_sync_date: new Date(),
                                custentity_alii_sync_status: true
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });

                        log.audit({
                            title: title + 'Vendor Synced Successfully',
                            details: 'Vendor ID: ' + vendorId +
                                ' | Company: ' + companyName +
                                ' | Synced to Alii'
                        });
                    } catch (updateError) {
                        log.error({
                            title: title + 'Error Updating Vendor Sync Status',
                            details: 'Vendor ID: ' + vendorId + ' | Error: ' + updateError.message
                        });
                    }
                }

            } catch (e) {
                var unexpectedErrorLog = {
                    emailRecipients: emailRecipients,
                    recordType: 'Vendor',
                    method: 'PUT',
                    responseCode: 0,
                    totalProcessed: 1,
                    successful: 0,
                    failed: 1,
                    skipped: 0,
                    successfulInvoices: [],
                    failedInvoices: [{
                        vendorId: vendorId,
                        error: 'Unexpected error in User Event Script: ' + e.message,
                        stack: e.stack
                    }],
                    skippedInvoices: [],
                    status: 'Failed',
                    errorMessage: 'Unexpected Error in afterSubmit for Vendor: ' + e.message +
                        ' | Stack: ' + e.stack,
                    requestUrl: BASE_URL + `/Supplier/${vendorId || 'unknown'}`
                };
                RL_Helper.createIntegrationLog(unexpectedErrorLog);
                log.error({
                    title: 'Error in ' + title,
                    details: 'Error: ' + e.message + ' | Stack: ' + e.stack
                });
            }
        }

        /**
         * Get vendor bank details from custom record
         */
        function getVendorBankDetails(vendorId) {
            var bankDetails = {
                accountNumber: '',
                bsb: '',
                bankRecordId: null
            };

            try {
                var bankSearch = search.create({
                    type: 'customrecord_2663_entity_bank_details',
                    filters: [
                        ['custrecord_2663_parent_vendor', 'anyof', vendorId]
                    ],
                    columns: [
                        'custrecord_2663_entity_acct_no',
                        'custrecord_2663_entity_bank_no',
                        'custrecord_2663_entity_branch_no',
                        'internalid'
                    ]
                });

                var searchResult = bankSearch.run().getRange({ start: 0, end: 1 });

                if (searchResult && searchResult.length > 0) {
                    var result = searchResult[0];
                    var accountNumber = result.getValue('custrecord_2663_entity_acct_no') || '';
                    var bankNum = result.getValue('custrecord_2663_entity_bank_no') || '';
                    var branchNum = result.getValue('custrecord_2663_entity_branch_no') || '';
                    
                    bankDetails.accountNumber = accountNumber;
                    bankDetails.bsb = bankNum + branchNum;
                    bankDetails.bankRecordId = result.getValue('internalid');
                }
            } catch (searchError) {
                log.debug('getVendorBankDetails', 'Error searching for bank details: ' + searchError.message);
            }

            return bankDetails;
        }

        /**
         * Get vendor address
         */
        function getVendorAddress(vendor) {
            var address = '';
            try {
                var addressCount = vendor.getLineCount({
                    sublistId: 'addressbook'
                });

                if (addressCount > 0) {
                    var addressSubrecord = vendor.getSublistSubrecord({
                        sublistId: 'addressbook',
                        fieldId: 'addressbookaddress',
                        line: 0
                    });

                    if (addressSubrecord) {
                        var addressParts = [];
                        var addressee = addressSubrecord.getValue('addressee') || '';
                        var attention = addressSubrecord.getValue('attention') || '';
                        var addr1 = addressSubrecord.getValue('addr1') || '';
                        var addr2 = addressSubrecord.getValue('addr2') || '';
                        var city = addressSubrecord.getValue('city') || '';
                        var state = addressSubrecord.getValue('state') || '';
                        var zip = addressSubrecord.getValue('zip') || '';
                        var country = addressSubrecord.getText('country') || '';

                        if (addressee) addressParts.push(addressee);
                        if (attention) addressParts.push(attention);
                        if (addr1) addressParts.push(addr1);
                        if (addr2) addressParts.push(addr2);

                        var cityStateZip = [city, state, zip]
                            .filter(function (part) { return part; })
                            .join(' ');
                        if (cityStateZip) addressParts.push(cityStateZip);
                        if (country) addressParts.push(country);

                        address = addressParts.join('\n');
                    }
                }
            } catch (addressError) {
                log.debug('getVendorAddress', 'Could not access address: ' + addressError.message);
            }

            return address;
        }

        return {
            afterSubmit: afterSubmit
        };
    });