/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/record', 'N/format', '/SuiteScripts/Feoda/ALII Integration/Libraries/Feoda_RL_Helper.js'],
    function (runtime, record, format, RL_Helper) {

        const BASE_URL = 'YOUR_ALII_BASE_URL';

        /**
         * Format date to yyyy-MM-dd HH:mm:ss
         */
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

        /**
         * Create Integration Log Record
         */
        function createIntegrationLog(logData) {
            const title = 'createIntegrationLog(): ';
            try {
                var logRecord = record.create({
                    type: 'customrecord_integration_log',
                    isDynamic: true
                });

                logRecord.setValue({
                    fieldId: 'custrecord_il_transaction_type',
                    value: logData.transactionType || 19
                });

                logRecord.setValue({
                    fieldId: 'custrecord_il_request_method',
                    value: logData.method || 'POST'
                });

                logRecord.setValue({
                    fieldId: 'custrecord_il_response_code',
                    value: logData.responseCode || 0
                });
                var executionSummary = {
                    totalProcessed: logData.totalProcessed || 0,
                    successful: logData.successful || 0,
                    failed: logData.failed || 0,
                    skipped: logData.skipped || 0
                };

                logRecord.setValue({
                    fieldId: 'custrecord_il_execution_summary',
                    value: JSON.stringify(executionSummary)
                });
                var responseBody = {
                    successfulInvoices: logData.successfulInvoices || [],
                    failedInvoices: logData.failedInvoices || [],
                    skippedInvoices: logData.skippedInvoices || []
                };

                logRecord.setValue({
                    fieldId: 'custrecord_il_response_body',
                    value: JSON.stringify(responseBody, null, 2)
                });
                logRecord.setText({
                    fieldId: 'custrecord_il_status',
                    text: logData.status || 'Failed'
                });
                logRecord.setValue({
                    fieldId: 'custrecord_il_error_message',
                    value: logData.errorMessage || ''
                });
                logRecord.setValue({
                    fieldId: 'custrecord_il_request_url',
                    value: logData.requestUrl || ''
                });
                logRecord.setValue({
                    fieldId: 'custrecord_il_timestamp',
                    value: new Date()
                });
                logRecord.setValue({
                    fieldId: 'custrecord_il_integration_type',
                    value: 1
                });
                var recordId = logRecord.save();

                log.audit({
                    title: title + 'Integration Log Created',
                    details: 'Log Record ID: ' + recordId +
                        ' | Status: ' + logData.status +
                        ' | Failed: ' + logData.failed
                });

                return recordId;

            } catch (e) {
                log.error({
                    title: title + 'Error Creating Log',
                    details: e.message
                });
                return null;
            }
        }

        /**
         * afterSubmit function - Triggers after payment is submitted
         * @param {Object} context
         */
        function afterSubmit(context) {
            const title = 'afterSubmit() ';

            var script = runtime.getCurrentScript();
            const productionKeys = script.getParameter('custscript_production_api_keys_ue');
            const sbKeys = script.getParameter('custscript_production_api_keys_ue');

            try {
                if (context.type === context.UserEventType.DELETE) {
                    return;
                }

                var paymentRecord = context.newRecord;
                var paymentId = paymentRecord.id;

                log.debug({
                    title: title + 'Payment Created',
                    details: 'Payment ID: ' + paymentId
                });

                // Get the number of bills paid by this payment
                var billCount = paymentRecord.getLineCount({
                    sublistId: 'apply'
                });

                log.debug({
                    title: title + 'Bills to Process',
                    details: 'Number of bills: ' + billCount
                });

                var billsToUpdate = [];
                for (var i = 0; i < billCount; i++) {
                    var isApplied = paymentRecord.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: i
                    });

                    if (isApplied) {
                        var billId = paymentRecord.getSublistValue({
                            sublistId: 'apply',
                            fieldId: 'internalid',
                            line: i
                        });

                        log.debug({
                            title: title + 'Processing Bill',
                            details: 'Bill ID: ' + billId
                        });
                        try {
                            var billRecord = record.load({
                                type: record.Type.VENDOR_BILL,
                                id: billId
                            });

                            var createdFromAlii = billRecord.getValue({
                                fieldId: 'custbody_fd_bill_created_from_alii'
                            });

                            var billStatusRef = billRecord.getValue({
                                fieldId: 'statusRef'
                            });

                            var aliiInvoiceId = billRecord.getValue({
                                fieldId: 'externalid'
                            });

                            var billNumber = billRecord.getValue({
                                fieldId: 'tranid'
                            });

                            var aliiSyncDate = billRecord.getValue({
                                fieldId: 'custbody_fd_alii_sync_date'
                            });

                            log.debug({
                                title: title + 'Bill Details',
                                details: 'Bill ID: ' + billId +
                                    ' | Status: ' + billStatusRef +
                                    ' | From Alii: ' + createdFromAlii +
                                    ' | Alii Invoice ID: ' + aliiInvoiceId +
                                    ' | Sync Date: ' + aliiSyncDate
                            });

                            if (createdFromAlii && billStatusRef === 'paidInFull' && aliiInvoiceId) {
                                billsToUpdate.push({
                                    billId: billId,
                                    billNumber: billNumber,
                                    aliiInvoiceId: aliiInvoiceId,
                                    paymentId: paymentId,
                                    paidDate: aliiSyncDate || new Date()
                                });
                            }

                        } catch (loadError) {
                            log.error({
                                title: title + 'Error Loading Bill',
                                details: 'Bill ID: ' + billId + ' | Error: ' + loadError.message
                            });
                        }
                    }
                }

                if (billsToUpdate.length > 0) {
                    log.audit({
                        title: title + 'Bills to Update in Alii',
                        details: 'Count: ' + billsToUpdate.length
                    });

                    var token = RL_Helper.authenticate(sbKeys, productionKeys);

                    if (!token) {
                        var authErrorLog = {
                            transactionType: 19,
                            method: 'POST',
                            responseCode: 401,
                            totalProcessed: billsToUpdate.length,
                            successful: 0,
                            failed: billsToUpdate.length,
                            skipped: 0,
                            successfulInvoices: [],
                            failedInvoices: billsToUpdate.map(function (bill) {
                                return {
                                    invoiceId: bill.aliiInvoiceId,
                                    billNumber: bill.billNumber,
                                    billId: bill.billId,
                                    error: 'Authentication failed - Could not retrieve Alii token'
                                };
                            }),
                            skippedInvoices: [],
                            status: 'Failed',
                            errorMessage: 'Authentication Failed: Could not retrieve Alii token for payment ID: ' + paymentId,
                            requestUrl: 'Authentication Endpoint'
                        };
                        createIntegrationLog(authErrorLog);

                        log.error({
                            title: title + 'Authentication Failed',
                            details: 'Could not retrieve Alii token'
                        });
                        return;
                    }

                    var paidInvoiceData = {};
                    for (var j = 0; j < billsToUpdate.length; j++) {
                        var bill = billsToUpdate[j];
                        paidInvoiceData[bill.aliiInvoiceId] = {
                            invoiceId: parseInt(bill.aliiInvoiceId),
                            paid: true,
                            paidDate: formatDateForAlii(bill.paidDate)
                        };
                    }

                    log.debug({
                        title: 'Calling SetInvoicePaidInAlii',
                        details: 'Data: ' + JSON.stringify(paidInvoiceData)
                    });

                    var paidResults = RL_Helper.SetInvoicePaidInAlii(paidInvoiceData, token);

                    if (paidResults && paidResults.successful && paidResults.successful.length > 0) {
                        log.audit({
                            title: 'Invoices Marked as Paid Successfully',
                            details: 'Updated ' + paidResults.successful.length + ' invoices'
                        });

                        var allSuccessful = true;
                        var failedPaidUpdates = [];

                        for (var m = 0; m < paidResults.successful.length; m++) {
                            var result = paidResults.successful[m];
                            var responseBody = result.response || {};

                            if (result.statusCode !== 200 || responseBody.isSuccessful !== true) {
                                allSuccessful = false;

                                var failedBill = billsToUpdate.find(function (bill) {
                                    return bill.aliiInvoiceId === result.invoiceId.toString();
                                });

                                failedPaidUpdates.push({
                                    invoiceId: result.invoiceId,
                                    billNumber: failedBill ? failedBill.billNumber : 'Unknown',
                                    billId: failedBill ? failedBill.billId : 'Unknown',
                                    statusCode: result.statusCode,
                                    error: 'Payment status update failed - Status Code: ' + result.statusCode +
                                        ', Response: ' + JSON.stringify(responseBody)
                                });

                                log.error({
                                    title: 'Invoice Payment Update Not Fully Successful',
                                    details: 'Invoice ID: ' + result.invoiceId +
                                        ' | Status Code: ' + result.statusCode +
                                        ' | Response: ' + JSON.stringify(responseBody)
                                });
                            }
                        }

                        if (failedPaidUpdates.length > 0) {
                            var paidUpdateErrorLog = {
                                transactionType: 19,
                                method: 'POST',
                                responseCode: paidResults.code || 200,
                                totalProcessed: billsToUpdate.length,
                                successful: billsToUpdate.length - failedPaidUpdates.length,
                                failed: failedPaidUpdates.length,
                                skipped: 0,
                                successfulInvoices: [],
                                failedInvoices: failedPaidUpdates,
                                skippedInvoices: [],
                                status: 'Partial',
                                errorMessage: 'Failed to mark ' + failedPaidUpdates.length +
                                    ' invoice(s) as paid in Alii for Payment ID: ' + paymentId,
                                requestUrl: paidResults.reqUrl || 'SetInvoicePaid Endpoint'
                            };
                            createIntegrationLog(paidUpdateErrorLog);
                        }

                        if (allSuccessful) {
                            log.audit({
                                title: 'All Invoices Marked as Paid - Proceeding to Update Posting Status',
                                details: 'Processing ' + billsToUpdate.length + ' bills'
                            });

                            var postingStatusData = {};
                            for (var j = 0; j < billsToUpdate.length; j++) {
                                var bill = billsToUpdate[j];
                                postingStatusData[bill.aliiInvoiceId] = {
                                    invoiceId: parseInt(bill.aliiInvoiceId),
                                    status: 1,
                                    postingNumber: bill.billId.toString(),
                                    message: 'Paid In Full in NetSuite - Bill ID: ' + bill.billId +
                                        ', Bill Number: ' + bill.billNumber +
                                        ', Payment ID: ' + paymentId
                                };
                            }

                            var postingStatusResults = RL_Helper.SetInvoicePostingStatus(postingStatusData, token);

                            if (postingStatusResults && postingStatusResults.successful.length > 0) {
                                log.audit({
                                    title: 'Alii Posting Status Updated Successfully',
                                    details: 'Updated ' + postingStatusResults.successful.length + ' invoices'
                                });

                                var syncUpdateErrors = [];
                                for (var k = 0; k < billsToUpdate.length; k++) {
                                    try {
                                        record.submitFields({
                                            type: record.Type.VENDOR_BILL,
                                            id: billsToUpdate[k].billId,
                                            values: {
                                                custbody_fd_alii_sync_status: 1,
                                                custbody_fd_alii_sync_date: new Date()
                                            },
                                            options: {
                                                enableSourcing: false,
                                                ignoreMandatoryFields: true
                                            }
                                        });
                                    } catch (updateError) {
                                        syncUpdateErrors.push({
                                            invoiceId: billsToUpdate[k].aliiInvoiceId,
                                            billNumber: billsToUpdate[k].billNumber,
                                            billId: billsToUpdate[k].billId,
                                            error: 'Failed to update sync status in NetSuite: ' + updateError.message
                                        });

                                        log.error({
                                            title: 'Error Updating Bill Sync Status',
                                            details: 'Bill ID: ' + billsToUpdate[k].billId +
                                                ' | Error: ' + updateError.message
                                        });
                                    }
                                }
                                var successLog = {
                                    transactionType: 19,
                                    method: 'POST',
                                    responseCode: postingStatusResults.code || 200,
                                    totalProcessed: billsToUpdate.length,
                                    successful: billsToUpdate.length - syncUpdateErrors.length,
                                    failed: syncUpdateErrors.length,
                                    skipped: 0,
                                    successfulInvoices: billsToUpdate.map(function (bill) {
                                        return {
                                            invoiceId: bill.aliiInvoiceId,
                                            billNumber: bill.billNumber,
                                            billId: bill.billId,
                                            paymentId: paymentId,
                                            message: 'Successfully synced payment status to Alii'
                                        };
                                    }),
                                    failedInvoices: syncUpdateErrors,
                                    skippedInvoices: [],
                                    status: syncUpdateErrors.length > 0 ? 'Partial' : 'Success',
                                    errorMessage: syncUpdateErrors.length > 0 ?
                                        'Some bills failed to update sync status in NetSuite' : '',
                                    requestUrl: postingStatusResults.reqUrl || 'SetInvoicePostingStatus Endpoint'
                                };
                                createIntegrationLog(successLog);

                            } else {
                                var postingFailLog = {
                                    transactionType: 19,
                                    method: 'POST',
                                    responseCode: postingStatusResults ? postingStatusResults.code : 0,
                                    totalProcessed: billsToUpdate.length,
                                    successful: 0,
                                    failed: billsToUpdate.length,
                                    skipped: 0,
                                    successfulInvoices: [],
                                    failedInvoices: billsToUpdate.map(function (bill) {
                                        return {
                                            invoiceId: bill.aliiInvoiceId,
                                            billNumber: bill.billNumber,
                                            billId: bill.billId,
                                            error: 'Posting status update failed in Alii'
                                        };
                                    }),
                                    skippedInvoices: [],
                                    status: 'Failed',
                                    errorMessage: 'Alii Posting Status Update Failed for Payment ID: ' + paymentId +
                                        ' | Results: ' + JSON.stringify(postingStatusResults),
                                    requestUrl: postingStatusResults ? postingStatusResults.reqUrl : 'SetInvoicePostingStatus Endpoint'
                                };
                                createIntegrationLog(postingFailLog);

                                log.error({
                                    title: 'Alii Posting Status Update Failed',
                                    details: 'Results: ' + JSON.stringify(postingStatusResults)
                                });
                            }
                        } else {
                            log.error({
                                title: 'Skipping Posting Status Update',
                                details: 'Not all invoices were successfully marked as paid'
                            });
                        }
                    } else {
                        var paidFailLog = {
                            transactionType: 19,
                            method: 'POST',
                            responseCode: paidResults ? paidResults.code : 0,
                            totalProcessed: billsToUpdate.length,
                            successful: 0,
                            failed: billsToUpdate.length,
                            skipped: 0,
                            successfulInvoices: [],
                            failedInvoices: billsToUpdate.map(function (bill) {
                                return {
                                    invoiceId: bill.aliiInvoiceId,
                                    billNumber: bill.billNumber,
                                    billId: bill.billId,
                                    error: 'SetInvoicePaidInAlii API call failed'
                                };
                            }),
                            skippedInvoices: [],
                            status: 'Failed',
                            errorMessage: 'SetInvoicePaidInAlii Failed for Payment ID: ' + paymentId +
                                ' | Results: ' + JSON.stringify(paidResults),
                            requestUrl: paidResults ? paidResults.reqUrl : 'SetInvoicePaid Endpoint'
                        };
                        createIntegrationLog(paidFailLog);

                        log.error({
                            title: 'SetInvoicePaidInAlii Failed',
                            details: 'Results: ' + JSON.stringify(paidResults)
                        });
                    }
                } else {
                    log.debug({
                        title: title + 'No Bills to Update',
                        details: 'No Alii bills were paid in full with this payment'
                    });
                }

            } catch (e) {
                var unexpectedErrorLog = {
                    transactionType: 19,
                    method: 'POST',
                    responseCode: 0,
                    totalProcessed: 0,
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
                    errorMessage: 'Unexpected Error in afterSubmit for Payment: ' + e.message +
                        ' | Stack: ' + e.stack,
                    requestUrl: 'User Event Script Execution'
                };
                createIntegrationLog(unexpectedErrorLog);

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