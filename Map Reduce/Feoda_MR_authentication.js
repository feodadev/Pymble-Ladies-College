/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/runtime', 'N/record', 'N/search', 'N/log', '/SuiteScripts/Feoda/ALII Integration/Libraries/Feoda_RL_Helper.js'],
    (runtime, record, search, log, RL_Helper) => {

        var script = runtime.getCurrentScript();
        const getInputData = () => {
            const title = 'getInputData(): ';
            try {
                let apiMetaData = {
                    code: null,
                    method: null,
                    reqUrl: null
                };
                const sbKeys = script.getParameter('custscript_sandbox_api_keys');
                const productionKeys = script.getParameter('custscript_production_api_keys');
                const prodEntityId = script.getParameter('custscript_prod_entity_id');
                const token = RL_Helper.authenticate(sbKeys, productionKeys);
                if (!token) {
                    log.error(title + 'Authentication failed - Could not retrieve Alii token');
                    return;
                }
                const getInvReadyForPostObj = RL_Helper.getInvoicesReadyForPost(token, prodEntityId);
                log.debug(title + '::getInvReadyForPostObj', JSON.stringify(getInvReadyForPostObj));
                // Store API metadata
                if (getInvReadyForPostObj && getInvReadyForPostObj.invoices) {
                    apiMetaData.code = getInvReadyForPostObj.code;
                    apiMetaData.method = getInvReadyForPostObj.method;
                    apiMetaData.reqUrl = getInvReadyForPostObj.reqUrl;

                    log.debug(title + ':: apiMetaData stored', JSON.stringify(apiMetaData));
                    const invoicesWithMetadata = getInvReadyForPostObj.invoices.map(invoice => ({
                        ...invoice,
                        _apiMetadata: apiMetaData
                    }));
                    log.debug(title + ':: invoicesWithMetadata', JSON.stringify(invoicesWithMetadata));

                    return invoicesWithMetadata;
                }
                return [];

            } catch (e) {
                log.error('getInputData Error', e.message);
                return [];
            }
        };

        const map = (context) => {
            const title = 'map(): ';
            try {
                const billObj = JSON.parse(context.value);
                const apiMetadata = billObj._apiMetadata;
                delete billObj._apiMetadata;

                log.debug({
                    title: title + 'Processing Invoice',
                    details: 'Invoice ID: ' + billObj.id + ' | Invoice Number: ' + billObj.invoiceNumber
                });
                // if (billObj.id == 2299069) {
                // CHECK FOR DUPLICATE INVOICE
                const duplicateCheck = checkDuplicateInvoice(billObj.id);
                if (duplicateCheck.isDuplicate) {
                    log.audit({
                        title: title + 'Duplicate Invoice Skipped',
                        details: 'Invoice Number: ' + billObj.invoiceNumber +
                            ' | Alii ID: ' + billObj.id +
                            ' | Existing ' + duplicateCheck.recordType + ' ID: ' + duplicateCheck.existingId
                    });
                    context.write({
                        key: 'skipped',
                        value: {
                            invoiceId: billObj.id,
                            invoiceNumber: billObj.invoiceNumber,
                            reason: 'Duplicate invoice already exists in NetSuite',
                            existingRecordType: duplicateCheck.recordType,
                            existingRecordId: duplicateCheck.existingId,
                            recordType: duplicateCheck.recordType === 'Vendor Bill' ? 'Vendor Bill' : 'Vendor Credit',
                            _apiMetadata: apiMetadata
                        }
                    });
                    return;
                }
                var hasNegativeLines = false;
                if (billObj.lines && Array.isArray(billObj.lines)) {
                    hasNegativeLines = billObj.lines.some(function (line) {
                        return parseFloat(line.total) < 0;
                    });
                }

                var result;
                if (hasNegativeLines) {
                    log.debug({
                        title: title + 'Creating Vendor Credit',
                        details: 'Invoice has negative line items - creating Vendor Credit'
                    });
                    result = createVendorCreditInNS([billObj]);
                } else {
                    log.debug({
                        title: title + 'Creating Vendor Bill',
                        details: 'Invoice has positive line items - creating Vendor Bill'
                    });
                    result = createVendorBillInNS([billObj]);
                }
                apiMetadata.recordType = result.recordTypes.join(', ');

                if (result.successful && result.successful.length > 0) {
                    context.write({
                        key: 'successful',
                        value: {
                            ...result.successful[0],
                            _apiMetadata: apiMetadata
                        }
                    });
                } else if (result.failed && result.failed.length > 0) {
                    context.write({
                        key: 'failed',
                        value: {
                            ...result.failed[0],
                            _apiMetadata: apiMetadata
                        }
                    });
                } else if (result.skipped && result.skipped.length > 0) {
                    context.write({
                        key: 'skipped',
                        value: {
                            ...result.skipped[0],
                            _apiMetadata: apiMetadata
                        }
                    });
                }
                // }
            } catch (e) {
                log.error(title + 'Error', e.message);
                context.write({
                    key: 'failed',
                    value: {
                        invoiceId: context.key,
                        invoiceNumber: 'Unknown',
                        error: e.message
                    }
                });
            }
        };

        const reduce = (context) => {
            const title = 'reduce(): ';
            try {
                log.debug({
                    title: title + 'Processing',
                    details: 'Key: ' + context.key + ' | Values Count: ' + context.values.length
                });
                context.values.forEach(function (value) {
                    context.write({
                        key: context.key,
                        value: value
                    });
                });

            } catch (e) {
                log.error(title + 'Error', e.message);
            }
        };

        const summarize = (summary) => {
            const title = 'summarize(): ';
            try {
                var apiMetadata = null;
                var results = {
                    successful: [],
                    failed: [],
                    skipped: [],
                    totalProcessed: 0,
                    recordTypes: new Set()
                };

                summary.output.iterator().each(function (key, value) {
                    const result = JSON.parse(value);
                    if (!apiMetadata && result._apiMetadata) {
                        apiMetadata = result._apiMetadata;
                    }
                    const cleanResult = { ...result };
                    delete cleanResult._apiMetadata;
                    if (key === 'successful') {
                        results.successful.push(result);
                    } else if (key === 'failed') {
                        results.failed.push(result);
                    } else if (key === 'skipped') {
                        results.skipped.push(result);
                    }
                    results.totalProcessed++;
                    if (result.recordType) {
                        results.recordTypes.add(result.recordType);
                    }
                    return true;
                });

                log.audit({
                    title: title + 'Vendor Bill Creation Summary',
                    details: 'Total Processed: ' + results.totalProcessed +
                        ' | Successful Bills: ' + results.successful.length +
                        ' | Failed Bills: ' + results.failed.length +
                        ' | Skipped: ' + results.skipped.length +
                        ' | results: ' + JSON.stringify(results)
                });
                // Create integration log
                var status = 'Success';
                if (results.failed.length > 0 && results.successful.length > 0) {
                    status = 'Partial';
                } else if (results.failed.length > 0 && results.successful.length === 0) {
                    status = 'Failed';
                }
                var errorMessages = [];
                if (results.failed.length > 0) {
                    results.failed.forEach(function (failedInvoice) {
                        errorMessages.push(
                            'Invoice #' + failedInvoice.invoiceNumber +
                            ' (ID: ' + failedInvoice.invoiceId + '): ' +
                            failedInvoice.error
                        );
                    });
                }

                var emailRecipients = script.getParameter('custscript_email_recipients');
                var logData = {
                    emailRecipients: emailRecipients,
                    recordType: Array.from(results.recordTypes).join(', '),
                    method: apiMetadata.method,
                    responseCode: apiMetadata.code,
                    totalProcessed: results.totalProcessed,
                    successful: results.successful.length,
                    failed: results.failed.length,
                    skipped: results.skipped.length,
                    successfulInvoices: results.successful || [],
                    failedInvoices: results.failed || [],
                    skippedInvoices: results.skipped || [],
                    status: status,
                    errorMessage: errorMessages || '',
                    requestUrl: apiMetadata.reqUrl
                };
                log.audit({
                    title: title + 'logData',
                    details: logData
                });
                RL_Helper.createIntegrationLog(logData);

                if (summary.inputSummary.error) {
                    log.error(title + 'Input Stage Error', summary.inputSummary.error);
                }
                summary.mapSummary.errors.iterator().each(function (key, error) {
                    log.error(title + 'Map Stage Error', 'Key: ' + key + ' | Error: ' + error);
                    return true;
                });
                summary.reduceSummary.errors.iterator().each(function (key, error) {
                    log.error(title + 'Reduce Stage Error', 'Key: ' + key + ' | Error: ' + error);
                    return true;
                });

            } catch (e) {
                log.error(title + 'Error', e.message);
            }
        };

        const createVendorBillInNS = (invdataObj) => {
            const title = 'createVendorBillInNS(): ';
            try {
                log.debug({
                    title: title,
                    details: 'invdataObj: ' + JSON.stringify(invdataObj)
                });
                let validationErrors = [];
                var results = {
                    successful: [],
                    failed: [],
                    skipped: [],
                    totalProcessed: 0,
                    recordTypes: []
                };
                const departmentMapping = getDepartmentMapping();
                const classMapping = getClassMapping();
                const locationMapping = getLocationMapping();
                const jobMapping = getJobMapping();
                const taxCodeMaping = getTaxCodeMapping();
                const glCodeMappingObj = getGlAccountFromNS();
                for (var i = 0; i < invdataObj.length; i++) {
                    var billObj = invdataObj[i];

                    log.debug({
                        title: title + 'Processing Invoice',
                        details: 'Invoice ID: ' + billObj.id + ' | Status: ' + billObj.status +
                            ' | Stage: ' + billObj.stage + ' | Posting Number: ' + billObj.postingNumber
                    });

                    try {
                        results.totalProcessed++;
                        const billRecord = record.create({
                            type: record.Type.VENDOR_BILL,
                            isDynamic: true
                        });
                        results.recordTypes.push('Vendor Bill');
                        billRecord.setValue({
                            fieldId: 'tranid',
                            value: billObj.invoiceNumber
                        });

                        billRecord.setText({
                            fieldId: 'entity',
                            text: billObj.supplierName
                        });

                        billRecord.setValue({
                            fieldId: 'trandate',
                            value: new Date()
                        });

                        billRecord.setValue({
                            fieldId: 'duedate',
                            value: new Date(billObj.dueDate)
                        });

                        billRecord.setValue({
                            fieldId: 'otherrefnum',
                            value: billObj.poNumber
                        });

                        billRecord.setValue({
                            fieldId: 'memo',
                            value: billObj.invoiceDescription || ''
                        });


                        billObj.lines.forEach(function (line, index) {
                            const sublist = 'expense';
                            billRecord.selectNewLine({
                                sublistId: sublist
                            });

                            const glCodeObj = splitGlAccountCode(line.glCode);
                            // 
                            // glCodeObj.accountCode = 'PATHS ROADS & FENCES'
                            // glCodeObj.locationId = 'W'
                            // glCodeObj.classId = 'C3'
                            // glCodeObj.departmentCode = 'Facilities'

                            log.audit({
                                title: title + 'GL Line Processing',
                                details: 'Line ' + (index + 1) +
                                    ' | GL Code: ' + line.glCode +
                                    ' | Account: ' + glCodeObj.accountCode +
                                    ' | Class: ' + glCodeObj.classId +
                                    ' | Location: ' + glCodeObj.locationId +
                                    ' | Department: ' + glCodeObj.departmentCode +
                                    ' | tax Code Alii: ' + line.taxCode
                            });
                            log.audit({
                                title: title + 'glCodeObj.accountCode.trim()',
                                details: glCodeObj.accountCode.trim()
                            });


                            if (glCodeObj.accountCode === '1410') {
                                log.audit({
                                    title: title + 'I am here:: 1',
                                });
                                billRecord.setCurrentSublistValue({
                                    sublistId: sublist,
                                    fieldId: 'account',
                                    value: 229
                                });
                            }
                            else {
                                billRecord.setCurrentSublistValue({
                                    sublistId: sublist,
                                    fieldId: 'account',
                                    value: glCodeMappingObj.get((glCodeObj.accountCode).toUpperCase())
                                });
                            }

                            billRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'memo',
                                value: line.description
                            });

                            billRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'quantity',
                                value: parseFloat(line.quantity) || 1
                            });

                            billRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'rate',
                                value: parseFloat(line.unitCost)
                            })

                            // Location validation
                            if (glCodeObj.locationId) {
                                const locationKey = (glCodeObj.locationId).toUpperCase();
                                const locationInternalId = locationMapping[locationKey]?.internalId;

                                if (!locationInternalId) {
                                    validationErrors.push(`Location internal id not found for: ${glCodeObj.locationId}`);
                                    log.error('Location Error', `Location internal id not found for: ${glCodeObj.locationId}`);

                                } else {
                                    billRecord.setCurrentSublistValue({
                                        sublistId: sublist,
                                        fieldId: 'location',
                                        value: locationInternalId
                                    });
                                }
                            }
                            // Department validation
                            if (glCodeObj.departmentCode) {
                                const deptKey = (glCodeObj.departmentCode).toUpperCase();
                                const deptInternalId = departmentMapping[deptKey]?.internalId;

                                if (!deptInternalId) {
                                    validationErrors.push(`Department internal id not found for: ${glCodeObj.departmentCode}`);
                                    log.error('Department Error', `Department internal id not found for: ${glCodeObj.departmentCode}`);
                                } else {
                                    billRecord.setCurrentSublistValue({
                                        sublistId: sublist,
                                        fieldId: 'department',
                                        value: deptInternalId
                                    });
                                }
                            }
                            // Class validation
                            if (glCodeObj.classId) {
                                const classKey = (glCodeObj.classId).toUpperCase();
                                log.debug('classKey', classKey);
                                const classInternalId = classMapping[classKey]?.internalId;
                                log.debug('classInternalId', classInternalId);

                                if (!classInternalId) {
                                    validationErrors.push(`Class internal id not found for: ${glCodeObj.classId}`);
                                    log.error('Class Error', `Class internal id not found for: ${glCodeObj.classId}`);
                                } else {
                                    billRecord.setCurrentSublistValue({
                                        sublistId: sublist,
                                        fieldId: 'class',
                                        value: classInternalId
                                    });
                                }
                            }
                            if (validationErrors.length > 0) {

                                log.audit({
                                    title: 'Record Created with Warnings',
                                    details: 'Invoice: ' + billObj.invoiceNumber +
                                        ' | Warnings: ' + validationErrors.join('; ')
                                });
                                billRecord.setValue({
                                    fieldId: 'custbody_alii_error_message',
                                    value: 'Validation Warnings: ' + validationErrors.join('; ')
                                });
                            }
                            if (line.subAllocationCode) {
                                billRecord.setCurrentSublistValue({
                                    sublistId: sublist,
                                    fieldId: 'customer',
                                    value: jobMapping[line.subAllocationCode]
                                });
                            }
                            if (line.taxCode) {
                                billRecord.setCurrentSublistValue({
                                    sublistId: sublist,
                                    fieldId: 'taxcode',
                                    value: taxCodeMaping[line.taxCode].internalId
                                });
                            }

                            billRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'amount',
                                value: parseFloat(line.subtotal) || 0
                            });

                            billRecord.commitLine({
                                sublistId: sublist
                            });
                        });

                        billRecord.setValue({
                            fieldId: 'custbody_fd_bill_created_from_alii',
                            value: true
                        });

                        billRecord.setValue({
                            fieldId: 'externalid',
                            value: billObj.id
                        });

                        const billId = billRecord.save();

                        log.audit({
                            title: 'Vendor Bill Created Successfully',
                            details: 'Alii Invoice ID: ' + billObj.id +
                                ' | Invoice Number: ' + billObj.invoiceNumber +
                                ' | NetSuite Bill ID: ' + billId
                        });

                        results.successful.push({
                            invoiceId: billObj.id,
                            invoiceNumber: billObj.invoiceNumber,
                            netSuiteBillId: billId,
                            recordType: Array.from(results.recordTypes).join(', ')
                        });

                    } catch (billError) {
                        results.failed.push({
                            invoiceId: billObj.id,
                            invoiceNumber: billObj.invoiceNumber,
                            error: billError.message,
                            recordType: Array.from(results.recordTypes).join(', ')
                        });

                        log.error({
                            title: 'Error Creating Vendor Bill',
                            details: 'Alii Invoice ID: ' + billObj.id +
                                ' | Invoice Number: ' + billObj.invoiceNumber +
                                ' | Error: ' + billError.message
                        });
                    }
                }
                log.audit({
                    title: 'Vendor Bill Creation Summary',
                    details: 'Total Processed: ' + results.totalProcessed +
                        ' | Successful Bills: ' + results.successful.length +
                        ' | Failed Bills: ' + results.failed.length +
                        ' | Skipped: ' + results.skipped.length +
                        ' | RecordType: ' + results.recordTypes.join(', ')
                });

                return results;

            } catch (e) {
                log.error({
                    title: 'Error in ' + title,
                    details: e.message
                });
                throw e;
            }
        };

        const createVendorCreditInNS = (creditdataObj) => {
            const title = 'createVendorCreditInNS(): ';
            try {
                log.debug({
                    title: title,
                    details: 'creditdataObj: ' + JSON.stringify(creditdataObj)
                });
                let validationErrors = [];
                var results = {
                    successful: [],
                    failed: [],
                    skipped: [],
                    totalProcessed: 0,
                    recordTypes: []
                };
                const departmentMapping = getDepartmentMapping();
                const classMapping = getClassMapping();
                const locationMapping = getLocationMapping();
                const jobMapping = getJobMapping();
                const taxCodeMaping = getTaxCodeMapping();
                const glCodeMappingObj = getGlAccountFromNS();

                for (var i = 0; i < creditdataObj.length; i++) {
                    var creditObj = creditdataObj[i];

                    log.debug({
                        title: title + 'Processing Credit',
                        details: 'Credit ID: ' + creditObj.id + ' | Status: ' + creditObj.status +
                            ' | Stage: ' + creditObj.stage + ' | Posting Number: ' + creditObj.postingNumber
                    });

                    try {
                        results.totalProcessed++;

                        const creditRecord = record.create({
                            type: record.Type.VENDOR_CREDIT,
                            isDynamic: true
                        });

                        results.recordTypes.push('Vendor Credit');

                        creditRecord.setValue({
                            fieldId: 'tranid',
                            value: creditObj.invoiceNumber
                        });

                        creditRecord.setText({
                            fieldId: 'entity',
                            text: creditObj.supplierName
                        });

                        creditRecord.setValue({
                            fieldId: 'trandate',
                            value: new Date()
                        });

                        creditRecord.setValue({
                            fieldId: 'duedate',
                            value: new Date(creditObj.dueDate)
                        });

                        creditRecord.setValue({
                            fieldId: 'otherrefnum',
                            value: creditObj.poNumber
                        });

                        creditRecord.setValue({
                            fieldId: 'memo',
                            value: creditObj.invoiceDescription || ''
                        });

                        creditObj.lines.forEach(function (line, index) {
                            const sublist = 'expense';
                            let hasError = false;
                            let errorMessage = '';
                            creditRecord.selectNewLine({
                                sublistId: sublist
                            });

                            const glCodeObj = splitGlAccountCode(line.glCode);

                            log.debug({
                                title: title + 'GL Line Processing',
                                details: 'Line ' + (index + 1) +
                                    ' | GL Code: ' + line.glCode +
                                    ' | Account: ' + glCodeObj.accountCode +
                                    ' | Class: ' + glCodeObj.classId +
                                    ' | Location: ' + glCodeObj.locationId +
                                    ' | Department: ' + glCodeObj.departmentCode +
                                    ' | Original Amount: ' + line.subtotal
                            });

                            creditRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'account',
                                value: glCodeMappingObj.get((glCodeObj.accountCode).toUpperCase())
                            });

                            creditRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'memo',
                                value: line.description
                            });

                            creditRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'quantity',
                                value: parseFloat(line.quantity) || 1
                            });

                            // Convert negative rate to positive for Vendor Credit
                            var lineRate = parseFloat(line.unitCost) || 0;
                            creditRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'rate',
                                value: Math.abs(lineRate)
                            });

                            // Location validation
                            if (glCodeObj.locationId) {
                                const locationKey = (glCodeObj.locationId).toUpperCase();
                                const locationInternalId = locationMapping[locationKey]?.internalId;

                                if (!locationInternalId) {
                                    validationErrors.push(`Location internal id not found for: ${glCodeObj.locationId}`);
                                    log.error('Location Error', `Location internal id not found for: ${glCodeObj.locationId}`);
                                } else {
                                    creditRecord.setCurrentSublistValue({
                                        sublistId: sublist,
                                        fieldId: 'location',
                                        value: locationInternalId
                                    });
                                }
                            }

                            // Department validation
                            if (glCodeObj.departmentCode) {
                                const deptKey = (glCodeObj.departmentCode).toUpperCase();
                                const deptInternalId = departmentMapping[deptKey]?.internalId;
                                if (!deptInternalId) {
                                    validationErrors.push(`Department internal id not found for: ${glCodeObj.departmentCode}`);
                                    log.error('Department Error', `Department internal id not found for: ${glCodeObj.departmentCode}`);
                                } else {
                                    creditRecord.setCurrentSublistValue({
                                        sublistId: sublist,
                                        fieldId: 'department',
                                        value: deptInternalId
                                    });
                                }
                            }

                            // Class validation
                            if (glCodeObj.classId) {
                                const classKey = (glCodeObj.classId).toUpperCase();
                                const classInternalId = classMapping[classKey]?.internalId;
                                if (!classInternalId) {
                                    validationErrors.push(`Class internal id not found for: ${glCodeObj.classId}`);
                                    log.error('Class Error', `Class internal id not found for: ${glCodeObj.classId}`);
                                } else {
                                    creditRecord.setCurrentSublistValue({
                                        sublistId: sublist,
                                        fieldId: 'class',
                                        value: classInternalId
                                    });
                                }
                            }
                            // Check if there were any errors AFTER all validations
                            if (validationErrors.length > 0) {
                                throw new Error(validationErrors.join('; '));
                            }
                            if (line.subAllocationCode) {
                                creditRecord.setCurrentSublistValue({
                                    sublistId: sublist,
                                    fieldId: 'customer',
                                    value: jobMapping[line.subAllocationCode]
                                });
                            }

                            if (line.taxCode) {
                                creditRecord.setCurrentSublistValue({
                                    sublistId: sublist,
                                    fieldId: 'taxcode',
                                    value: taxCodeMaping[line.taxCode].internalId
                                });
                            }

                            // CRITICAL: Convert negative amount to positive for Vendor Credit
                            var lineTotal = parseFloat(line.subtotal) || 0;
                            creditRecord.setCurrentSublistValue({
                                sublistId: sublist,
                                fieldId: 'amount',
                                value: Math.abs(lineTotal)
                            });

                            log.debug({
                                title: title + 'Line Amount Conversion',
                                details: 'Original: ' + lineTotal + ' | Converted: ' + Math.abs(lineTotal)
                            });

                            creditRecord.commitLine({
                                sublistId: sublist
                            });
                        });

                        creditRecord.setValue({
                            fieldId: 'custbody_fd_bill_created_from_alii',
                            value: true
                        });

                        creditRecord.setValue({
                            fieldId: 'externalid',
                            value: creditObj.id
                        });

                        const creditId = creditRecord.save();

                        log.audit({
                            title: 'Vendor Credit Created Successfully',
                            details: 'Alii Credit ID: ' + creditObj.id +
                                ' | Credit Number: ' + creditObj.invoiceNumber +
                                ' | NetSuite Credit ID: ' + creditId
                        });

                        results.successful.push({
                            invoiceId: creditObj.id,
                            invoiceNumber: creditObj.invoiceNumber,
                            netSuiteCreditId: creditId,
                            recordType: Array.from(results.recordTypes).join(', ')
                        });

                    } catch (creditError) {
                        results.failed.push({
                            invoiceId: creditObj.id,
                            invoiceNumber: creditObj.invoiceNumber,
                            error: creditError.message,
                            recordType: Array.from(results.recordTypes).join(', ')
                        });

                        log.error({
                            title: 'Error Creating Vendor Credit',
                            details: 'Alii Credit ID: ' + creditObj.id +
                                ' | Credit Number: ' + creditObj.invoiceNumber +
                                ' | Error: ' + creditError.message
                        });
                    }
                }

                log.audit({
                    title: 'Vendor Credit Creation Summary',
                    details: 'Total Processed: ' + results.totalProcessed +
                        ' | Successful Credits: ' + results.successful.length +
                        ' | Failed Credits: ' + results.failed.length +
                        ' | Skipped: ' + results.skipped.length +
                        ' | RecordType: ' + Array.from(results.recordTypes).join(', ')
                });

                return results;

            } catch (e) {
                log.error({
                    title: 'Error in ' + title,
                    details: e.message
                });
                throw e;
            }
        };

        const getDepartmentMapping = () => {
            const title = 'getDepartmentMapping():: ';

            try {
                var departmentMap = {};

                var departmentSearch = search.create({
                    type: search.Type.DEPARTMENT,
                    filters: [],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'name' }),
                        search.createColumn({ name: 'externalid' })
                    ]
                });
                departmentSearch.run().each(function (result) {
                    var externalId = result.getValue({ name: 'externalid' });
                    var deptName = result.getValue({ name: 'name' });
                    log.debug({
                        title: title,
                        details: 'deptName: ' + deptName
                    });
                    const deptResult = deptName.split(':').pop().trim().replace(/^\d+\s*/, '').replace(/\s+/g, ' ').trim().toUpperCase();

                    if (deptResult) {
                        departmentMap[deptResult] = {
                            internalId: result.id,
                            name: result.getValue({ name: 'name' })
                        };
                    }
                    return true;
                });
                log.debug({
                    title: title,
                    details: 'departmentMap: ' + JSON.stringify(departmentMap)
                });
                return departmentMap;

            } catch (e) {
                log.error('getDepartmentMapping', 'Error: ' + e.message);
                return {};
            }
        }

        const getClassMapping = () => {
            const title = 'getClassMapping():: ';

            try {
                var classMap = {};

                var classSearch = search.create({
                    type: search.Type.CLASSIFICATION,
                    filters: [],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'name' }),
                        search.createColumn({ name: 'externalid' })
                    ]
                });

                classSearch.run().each(function (result) {
                    var externalId = result.getValue({ name: 'externalid' });
                    var className = result.getValue({ name: 'name' });
                    if (externalId) {
                        classMap[externalId] = {
                            internalId: result.id,
                            name: result.getValue({ name: 'name' })
                        };
                    }
                    return true;
                });

                log.debug({
                    title: title,
                    details: 'classMap: ' + JSON.stringify(classMap)
                });
                return classMap;

            } catch (e) {
                log.error('getClassMapping', 'Error: ' + e.message);
                return {};
            }
        }

        const getLocationMapping = () => {
            const title = 'getLocationMapping():: ';

            try {
                var locationMap = {};

                var locationSearch = search.create({
                    type: search.Type.LOCATION,
                    filters: [],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'name' }),
                        search.createColumn({ name: 'externalid' })
                    ]
                });

                locationSearch.run().each(function (result) {
                    var externalId = result.getValue({ name: 'externalid' });
                    var locName = (result.getValue({ name: 'name' })).toUpperCase();
                    if (externalId) {
                        locationMap[externalId] = {
                            internalId: result.id,
                            name: result.getValue({ name: 'name' })
                        };
                    }
                    return true;
                });

                log.debug({
                    title: title,
                    details: 'locationMap: ' + JSON.stringify(locationMap)
                });
                return locationMap;

            } catch (e) {
                log.error('getLocationMapping', 'Error: ' + e.message);
                return {};
            }
        }

        const getJobMapping = () => {
            const title = 'getJobMapping():: ';

            try {
                var jobMap = {};

                var jobSearch = search.create({
                    type: search.Type.JOB,
                    filters: [],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'entityid' }),
                        search.createColumn({ name: 'externalid' })
                    ]
                });

                jobSearch.run().each(function (result) {
                    var name = result.getValue({ name: 'entityid' });
                    var externalId = result.getValue({ name: 'externalid' });
                    if (externalId) {
                        jobMap[externalId] = result.id;
                    }
                    return true;
                });

                log.debug({
                    title: title,
                    details: 'jobMap: ' + JSON.stringify(jobMap)
                });
                return jobMap;

            } catch (e) {
                log.error('getJobMapping', 'Error: ' + e.message);
                return {};
            }
        }

        const getTaxCodeMapping = () => {
            const title = 'getTaxCodeMapping(): ';
            try {
                const taxCodeSearch = search.create({
                    type: 'salestaxitem',
                    filters: [
                        ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'itemid' }),
                        search.createColumn({ name: 'description' })
                    ]
                });

                const taxCodeMapping = {};

                taxCodeSearch.run().each(function (result) {
                    const internalId = result.getValue({ name: 'internalid' });
                    const itemId = result.getValue({ name: 'itemid' });
                    const description = result.getValue({ name: 'description' }) || '';
                    taxCodeMapping[itemId] = {
                        internalId: internalId,
                        itemId: itemId,
                        description: description
                    };

                    log.debug(title + 'Tax Code Found', {
                        itemId: itemId,
                        internalId: internalId,
                        description: description
                    });

                    return true;
                });

                log.audit(title + 'Final Mapping created', JSON.stringify(taxCodeMapping));
                return taxCodeMapping;

            } catch (e) {
                log.error(title + 'Error', {
                    message: e.message,
                    stack: e.stack
                });
                return {};
            }
        };

        const getGlAccountFromNS = () => {
            const title = 'getGlAccountFromNS(): ';
            try {
                const accountMapping = new Map();
                const accountSearchFilters = [
                    ['isinactive', 'is', 'F'],
                ];
                const accountSearch = search.create({
                    type: 'account',
                    filters: accountSearchFilters,
                    columns: [
                        search.createColumn({ name: 'number', sort: search.Sort.ASC }),
                        search.createColumn({ name: 'name' }),
                        search.createColumn({ name: 'displayname' })
                    ],
                });
                const accountSearchPagedData = accountSearch.runPaged({ pageSize: 1000 });

                for (let i = 0; i < accountSearchPagedData.pageRanges.length; i++) {
                    const accountSearchPage = accountSearchPagedData.fetch({ index: i });
                    accountSearchPage.data.forEach(function (result) {
                        const internalId = result.id;
                        let accountName = result.getValue({ name: 'name' });
                        const splitAccName = (accountName.split(':').pop().trim()).toUpperCase();
                        const accountNumber = result.getValue({ name: 'number' });
                        accountMapping.set(accountNumber, internalId);
                    });
                }

                log.debug({
                    title: title,
                    details: 'accountMapping: ' + JSON.stringify(Object.fromEntries(accountMapping))
                });

                return accountMapping;

            } catch (e) {
                log.error({
                    title: 'Error in ' + title,
                    details: e.message
                });
            }
        };
        const splitGlAccountCode = (glAccountCode) => {
            const title = 'splitGlAccountCode(): ';

            try {
                if (!glAccountCode || typeof glAccountCode !== 'string') {
                    log.error({
                        title: title + 'Invalid Input',
                        details: 'glAccountCode must be a string: ' + glAccountCode
                    });
                    return {
                        accountCode: '',
                        locationId: '',
                        classId: '',
                        departmentCode: ''
                    };
                }

                // Split only on the first 3 dashes, keep the rest as the last segment
                var segments = glAccountCode.split('-');

                if (segments.length < 4) {
                    log.error({
                        title: title + 'Invalid Format',
                        details: 'Expected at least 4 segments but got ' + segments.length + ' in: ' + glAccountCode
                    });
                    return {
                        accountCode: segments[0] || '',
                        locationId: segments[1] || '',
                        classId: segments[2] || '',
                        departmentCode: segments[3] || ''
                    };
                }

                // Take first 3 segments normally, join the rest for department
                var result = {
                    accountCode: segments[0].trim(),
                    locationId: segments[1].trim(),
                    classId: segments[2].trim(),
                    departmentCode: segments.slice(3).join('-').trim()  // Join remaining segments with '-'
                };

                log.debug({
                    title: title + 'Split Result',
                    details: 'Input: ' + glAccountCode + ' | Output: ' + JSON.stringify(result)
                });

                return result;

            } catch (e) {
                log.error({
                    title: 'Error in ' + title,
                    details: e.message
                });
                return {
                    accountCode: '',
                    locationId: '',
                    classId: '',
                    departmentCode: ''
                };
            }
        };

        const checkDuplicateInvoice = (externalId) => {
            const title = 'checkDuplicateInvoice(): ';
            try {
                const billSearch = search.create({
                    type: search.Type.VENDOR_BILL,
                    filters: [
                        ['externalid', 'is', externalId],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'tranid' })
                    ]
                });
                const billResults = billSearch.run().getRange({ start: 0, end: 1 });
                const creditSearch = search.create({
                    type: search.Type.VENDOR_CREDIT,
                    filters: [
                        ['externalid', 'is', externalId],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'tranid' })
                    ]
                });

                const creditResults = creditSearch.run().getRange({ start: 0, end: 1 });

                if (billResults.length > 0) {
                    log.debug({
                        title: title + 'Duplicate Found',
                        details: 'Vendor Bill already exists with external Id: ' + externalId +
                            ' | NetSuite ID: ' + billResults[0].id
                    });
                    return {
                        isDuplicate: true,
                        recordType: 'Vendor Bill',
                        existingId: billResults[0].id
                    };
                }

                if (creditResults.length > 0) {
                    log.debug({
                        title: title + 'Duplicate Found',
                        details: 'Vendor Credit already exists with external Id: ' + externalId +
                            ' | NetSuite ID: ' + creditResults[0].id
                    });
                    return {
                        isDuplicate: true,
                        recordType: 'Vendor Credit',
                        existingId: creditResults[0].id
                    };
                }

                return { isDuplicate: false };

            } catch (e) {
                log.error({
                    title: title + 'Error',
                    details: 'Error checking duplicate for invoice: ' + externalId + ' | ' + e.message
                });
                return { isDuplicate: false };
            }
        };
        return {
            getInputData,
            map,
            reduce,
            summarize
        };
    });