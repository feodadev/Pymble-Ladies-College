/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/record', 'N/https', 'N/search', '/SuiteScripts/Feoda/ALII Integration/Libraries/Feoda_RL_Helper.js'],
    function (runtime, record, https, search, RL_Helper) {

        const BASE_URL = 'https://api.myalii.app/api';
        const MAIN_ENTITY = {
            NAME: 'Pymble Ladies College'
        };

        /**
         * afterSubmit function - Triggers after vendor is created/edited
         * @param {Object} context
         */
        function afterSubmit(context) {
            const title = 'afterSubmit - Vendor Creation: ';

            var script = runtime.getCurrentScript();
            var emailRecipients = script.getParameter('custscript_email_recipients_ue');
            try {
                if (context.type !== context.UserEventType.CREATE) {
                    log.debug({
                        title: title + 'Skipping',
                        details: 'Event type is not CREATE: ' + context.type
                    });
                    return;
                }

                const productionKeys = script.getParameter('custscript_prod_api_keys_vendor_ue');
                const sbKeys = script.getParameter('custscript_sb_api_keys_vendor_ue');

                var vendorRecord = context.newRecord;
                var vendorId = vendorRecord.id;

                log.debug({
                    title: title + 'New Vendor Created',
                    details: 'Vendor ID: ' + vendorId
                });

                // Load the vendor record to get all fields
                var vendor = record.load({
                    type: record.Type.VENDOR,
                    id: vendorId
                });

                // Get vendor data
                var entityId = vendor.getValue('entityid');
                var companyName = vendor.getValue('companyname') || vendor.getValue('entityid');
                var email = vendor.getValue('email');
                var phone = vendor.getValue('phone');
                var terms = vendor.getText('terms');
                var abn = vendor.getValue('vatregnumber');

                // Get bank account details from vendor subsidiary record
                var accountNumber = '';
                var bsb = '';

                try {
                    var lineCount = vendor.getLineCount({
                        sublistId: 'submachine'
                    });

                    if (lineCount > 0) {
                        accountNumber = vendor.getSublistValue({
                            sublistId: 'submachine',
                            fieldId: 'custrecord_2663_entity_acct_no',
                            line: 0
                        }) || '';

                        bsb = vendor.getSublistValue({
                            sublistId: 'submachine',
                            fieldId: 'custrecord_2663_entity_bank_no',
                            line: 0
                        }) || '';
                    }
                } catch (sublistError) {
                    log.debug({
                        title: title + 'Sublist Access',
                        details: 'Could not access bank details: ' + sublistError.message
                    });
                }

                // Get address from addressbook sublist
                var address = '';
                try {
                    var addressCount = vendor.getLineCount({
                        sublistId: 'addressbook'
                    });

                    if (addressCount > 0) {
                        // Get the first address (usually the default)
                        var addressSubrecord = vendor.getSublistSubrecord({
                            sublistId: 'addressbook',
                            fieldId: 'addressbookaddress',
                            line: 0
                        });

                        if (addressSubrecord) {
                            var addressee = addressSubrecord.getValue('addressee') || '';
                            var attention = addressSubrecord.getValue('attention') || '';
                            var addr1 = addressSubrecord.getValue('addr1') || '';
                            var addr2 = addressSubrecord.getValue('addr2') || '';
                            var city = addressSubrecord.getValue('city') || '';
                            var state = addressSubrecord.getValue('state') || '';
                            var zip = addressSubrecord.getValue('zip') || '';
                            var country = addressSubrecord.getText('country') || '';
                            var addressParts = [];

                            if (addressee) addressParts.push(addressee);
                            if (attention) addressParts.push(attention);
                            if (addr1) addressParts.push(addr1);
                            if (addr2) addressParts.push(addr2);

                            var cityStateZip = [city, state, zip]
                                .filter(function (part) { return part; })
                                .join(' ');
                            if (cityStateZip) addressParts.push(cityStateZip);

                            if (country) addressParts.push(country);

                            // Join with line breaks
                            address = addressParts.join('\n');
                        }
                    }
                } catch (addressError) {
                    log.debug({
                        title: title + 'Address Access',
                        details: 'Could not access address: ' + addressError.message
                    });
                }

                log.debug({
                    title: title + 'Vendor Details',
                    details: 'ID: ' + vendorId +
                        ' | Entity ID: ' + entityId +
                        ' | Company: ' + companyName +
                        ' | Email: ' + email +
                        ' | ABN: ' + abn
                });

                // Authenticate with Alii
                var token = RL_Helper.authenticate(sbKeys, productionKeys);

                if (!token) {
                    var logData = {
                        emailRecipients: emailRecipients,
                        recordType: 'Vendor',
                        method: 'POST',
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
                    RL_Helper.createIntegrationLog(logData);

                    log.error({
                        title: title + 'Authentication Failed',
                        details: 'Could not retrieve Alii token'
                    });
                    return;
                }

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
                    bsb: bsb
                };

                log.debug({
                    title: title + 'Vendor Data Prepared',
                    details: JSON.stringify(vendorData)
                });

                // Create supplier in Alii
                var supplierResult = RL_Helper.createSupplierInAlli(vendorData, MAIN_ENTITY.NAME, token);

                log.debug({
                    title: title + 'Supplier Creation Result',
                    details: JSON.stringify(supplierResult)
                });

                // Create integration log
                var logData = {
                    emailRecipients: emailRecipients,
                    recordType: 'Vendor',
                    method: 'POST',
                    responseCode: supplierResult.successful.length > 0 ?
                        supplierResult.successful[0].statusCode :
                        (supplierResult.failed.length > 0 ? supplierResult.failed[0].statusCode : 0),
                    totalProcessed: supplierResult.totalProcessed,
                    successful: supplierResult.successful.length,
                    failed: supplierResult.failed.length,
                    skipped: 0,
                    successfulInvoices: supplierResult.successful,
                    failedInvoices: supplierResult.failed,
                    skippedInvoices: [],
                    status: supplierResult.failed.length > 0 ? 'Failed' : 'Success',
                    errorMessage: supplierResult.failed.length > 0 ?
                        supplierResult.failed.map(function (f) {
                            return 'Vendor ' + f.vendorName + ': ' + f.error;
                        }).join('; ') : '',
                    requestUrl: BASE_URL + '/Supplier'
                };
                RL_Helper.createIntegrationLog(logData);

                // Update vendor record with sync status if successful
                if (supplierResult.successful.length > 0) {
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
                            details: 'Vendor ID: ' + vendorId + ' | Synced to Alii'
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
                    method: 'POST',
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
                    requestUrl: BASE_URL + '/Supplier'
                };
                RL_Helper.createIntegrationLog(unexpectedErrorLog);

                log.error({
                    title: 'Error in ' + title,
                    details: 'Error: ' + e.message + ' | Stack: ' + e.stack
                });
            }
        }
        return {
            afterSubmit: afterSubmit
        };
    });