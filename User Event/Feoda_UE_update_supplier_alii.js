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
            const title = 'afterSubmit (Bank Details): ';

            var script = runtime.getCurrentScript();
            var emailRecipients = script.getParameter('custscript_email_recipients_ue_update');
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
                const productionKeys = script.getParameter('custscript_prod_api_keys_bank_ue');
                const sbKeys = script.getParameter('custscript_sb_api_keys_bank_ue');

                var bankRecord = context.newRecord;
                var bankRecordId = bankRecord.id;

                log.debug({
                    title: title + 'Bank Details Record Triggered',
                    details: 'Bank Record ID: ' + bankRecordId + ' | Event: ' + context.type
                });

                // Load the bank details record
                var bankDetailsRecord = record.load({
                    type: 'customrecord_2663_entity_bank_details',
                    id: bankRecordId,
                    isDynamic: true
                });

                // Get vendor ID from parent field
                var vendorId = bankDetailsRecord.getValue({
                    fieldId: 'custrecord_2663_parent_vendor'
                });

                if (!vendorId) {
                    log.debug({
                        title: title + 'No Vendor Linked',
                        details: 'Bank record does not have a vendor linked. Skipping.'
                    });
                    return;
                }

                log.debug({
                    title: title + 'Vendor ID Found',
                    details: 'Vendor ID: ' + vendorId
                });
                var accountNumber = bankDetailsRecord.getValue({
                    fieldId: 'custrecord_2663_entity_acct_no'
                }) || '';

                var bankNum = bankDetailsRecord.getValue({
                    fieldId: 'custrecord_2663_entity_bank_no'
                }) || '';

                var branchNum = bankDetailsRecord.getValue({
                    fieldId: 'custrecord_2663_entity_branch_no'
                }) || '';

                const bsbVal = bankNum + '' + branchNum
                log.debug({
                    title: title + 'bsbVal',
                    details: bsbVal
                });
                // Load vendor record to get other details
                var vendor = record.load({
                    type: record.Type.VENDOR,
                    id: vendorId
                });

                var entityId = vendor.getValue('entityid');
                var companyName = vendor.getValue('companyname') || vendor.getValue('entityid');
                var email = vendor.getValue('email') || '';
                var phone = vendor.getValue('phone') || '';
                var terms = vendor.getText('terms') || '';
                var abn = vendor.getValue('vatregnumber') || '';

                // Get address
                var address = getVendorAddress(vendor);

                log.debug({
                    title: title + 'Vendor Details',
                    details: 'ID: ' + vendorId +
                        ' | Entity ID: ' + entityId +
                        ' | Company: ' + companyName +
                        ' | BSB: ' + bsbVal +
                        ' | Account: ' + accountNumber
                });

                // Authenticate with Alii
                var token = RL_Helper.authenticate(sbKeys, productionKeys);
                if (!token) {
                    var logData = {
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
                    }

                    RL_Helper.createIntegrationLog(logData);
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
                    accountNumber: accountNumber,
                    bsb: bsbVal
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
                    requestUrl: 'Authentication Endpoint'
                }
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

                // Update bank record with sync status if successful
                if (updateResult.successful.length > 0) {
                    try {
                        record.submitFields({
                            type: 'customrecord_2663_entity_bank_details',
                            id: bankRecordId,
                            values: {
                                custrecord_bank_alii_sync_date: new Date(),
                                custrecord_bank_alii_sync_status: true
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });

                        log.audit({
                            title: title + 'Bank Details Synced Successfully',
                            details: 'Bank Record ID: ' + bankRecordId +
                                ' | Vendor ID: ' + vendorId +
                                ' | BSB: ' + bsbVal +
                                ' | Synced to Alii'
                        });
                    } catch (updateError) {
                        log.error({
                            title: title + 'Error Updating Bank Sync Status',
                            details: 'Bank Record ID: ' + bankRecordId + ' | Error: ' + updateError.message
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
                        error: 'Unexpected error in User Event Script: ' + e.message,
                        stack: e.stack
                    }],
                    skippedInvoices: [],
                    status: 'Failed',
                    errorMessage: 'Unexpected Error in afterSubmit for Vendor: ' + e.message +
                        ' | Stack: ' + e.stack,
                    requestUrl: BASE_URL + `/Supplier/${vendorId}`
                };
                RL_Helper.createIntegrationLog(unexpectedErrorLog);
                log.error({
                    title: 'Error in ' + title,
                    details: 'Error: ' + e.message + ' | Stack: ' + e.stack
                });
            }
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