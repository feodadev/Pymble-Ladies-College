/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define(['N/email', 'N/https', 'N/record', 'N/search', 'N/file', 'N/runtime'], (email, https, record, search, file, runtime) => {

    const BASE_URL = 'https://api.myalii.app/api';

    const authenticate = (sbKeys, prodKeys) => {
        const title = 'authenticate(): ';
        const url = `${BASE_URL}/Auth/Client`;
        const body = prodKeys;
        try {
            let response = https.post({
                url,
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            const parsed = JSON.parse(response.body);
            const token = parsed.token;
            if (!token) {
                throw new Error("Failed to retrieve token from API");
            }
            log.debug(title + 'API Token Retrieved', token);
            return token;
        } catch (e) {
            if (e.name === 'SSS_REQUEST_TIME_EXCEEDED') {
                log.error('Timeout Error', 'Third party took too long to respond');
            } else {
                log.error(title + ':: Error', e.message);

            }
        }
    };
    const getSuppliersFromAlii = (token) => {
        const title = 'getSuppliersFromAlii(): ';
        try {
            log.audit(title + 'Started');

            const url = `${BASE_URL}/Supplier`;

            log.debug(title + 'Request URL', url);

            const response = https.get({
                url: url,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });

            log.debug(title + 'Response code', response.code);
            log.debug(title + 'Response body length', response.body ? response.body.length : 0);

            if (response.code === 401) {
                throw new Error('401 Unauthorized — check Authorization header and token value');
            }

            if (response.code !== 200) {
                log.error(title + 'Unexpected response code', {
                    code: response.code,
                    body: response.body
                });
                return [];
            }

            const parsed = JSON.parse(response.body || '[]');

            let suppliers = [];
            if (Array.isArray(parsed)) {
                suppliers = parsed;
            } else if (parsed.listResult && Array.isArray(parsed.listResult)) {
                suppliers = parsed.listResult;
            } else {
                log.error(title + 'Unexpected response structure', typeof parsed);
                return [];
            }

            log.audit(title + 'Completed', {
                totalSuppliers: suppliers.length,
                responseType: Array.isArray(parsed) ? 'array' : 'object with listResult'
            });

            return suppliers;

        } catch (e) {
            log.error(title + 'Error', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            // If it's a timeout or size issue, log specifically
            if (e.name === 'SSS_REQUEST_TIME_EXCEEDED') {
                log.error(title + 'Request timed out - response might be too large');
            }

            return [];
        }
    };
    const getEntity = (token) => {
        const title = 'getEntity(): ';
        try {
            const url = `${BASE_URL}/Entity`;
            const response = https.get({
                url,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });
            if (response.code === 401) {
                throw new Error('401 Unauthorized — check Authorization header and token value');
            }
            const parsed = JSON.parse(response.body || '[]');
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return parsed.listResult || [];
        } catch (e) {
            log.error(title + ':: Error', e.message);
            return [];
        }
    };
    const getBudget = (token) => {
        const title = 'getBudget(): ';
        try {
            const url = `${BASE_URL}/Entity`;
            const response = https.get({
                url,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });
            if (response.code === 401) {
                throw new Error('401 Unauthorized — check Authorization header and token value');
            }
            const parsed = JSON.parse(response.body || '[]');
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return parsed.listResult || [];
        } catch (e) {
            log.error(title + ':: Error', e.message);
            return [];
        }
    };
    const getGLCodes = (token) => {
        const title = 'getGLCodes(): ';
        try {
            const url = `${BASE_URL}/GLCode`;
            const response = https.get({
                url,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });
            if (response.code === 401) {
                throw new Error('401 Unauthorized — check Authorization header and token value');
            }
            const parsed = JSON.parse(response.body || '[]');
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return parsed.listResult || [];
        } catch (e) {
            log.error(title + ':: Error', e.message);
            return [];
        }
    };
    const createEntitiesInAlli = (bodyData, token) => {
        const title = 'createEntitiesInAlli(): ';
        try {
            const apiUrl = `${BASE_URL}/Entity`;
            log.debug(title + ':: bodyData: ', JSON.stringify(bodyData));
            var results = {
                successful: [],
                failed: [],
                totalProcessed: 0
            };
            for (var entityId in bodyData) {
                if (bodyData.hasOwnProperty(entityId)) {
                    var vendor = bodyData[entityId];
                    var body = {
                        name: vendor.entityId,
                        code: vendor.code === "null" ? null : vendor.code,
                        currency: vendor.currency || null
                    };
                    try {
                        var response = https.post({
                            url: apiUrl,
                            body: JSON.stringify(body),
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            }
                        });
                        results.totalProcessed++;
                        if (response.code >= 200 && response.code < 300) {
                            results.successful.push({
                                entityId: entityId,
                                statusCode: response.code,
                                response: JSON.parse(response.body)
                            });
                            log.audit({
                                title: 'Entity Created Successfully',
                                details: 'Entity ID: ' + entityId + ' | Status: ' + response.code
                            });
                        } else {
                            results.failed.push({
                                entityId: entityId,
                                statusCode: response.code,
                                error: response.body
                            });
                            log.error({
                                title: 'Entity Creation Failed',
                                details: 'Entity ID: ' + entityId + ' | Status: ' + response.code + ' | Error: ' + response.body
                            });
                        }
                    } catch (postError) {
                        results.failed.push({
                            entityId: entityId,
                            error: postError.message
                        });

                        log.error({
                            title: 'POST Request Error',
                            details: 'Entity ID: ' + entityId + ' | Error: ' + postError.message
                        });
                    }
                }
            }
            log.audit({
                title: 'Entity Creation Summary',
                details: 'Total: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length
            });


            if (response.code === 401) {
                throw new Error('401 Unauthorized — check Authorization header and token value');
            }
            const parsed = JSON.parse(response.body || '[]');
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return parsed.listResult || [];
        } catch (e) {
            log.error({
                title: 'Error in ' + title,
                details: e.message
            });
        }
    };
    const createSupplierInAlli = (vendorData, entityName, token) => {
        const title = 'createSupplierInAlli(): ';
        const apiUrl = `${BASE_URL}/Supplier`;

        log.debug({
            title: title + 'entityName',
            details: 'entityName: ' + entityName
        });

        log.debug({
            title: title + 'vendorData',
            details: 'vendorData: ' + JSON.stringify(vendorData)
        });

        var results = {
            successful: [],
            failed: [],
            totalProcessed: 0
        };

        try {
            // Loop through each vendor in NetSuite data
            for (var vendorId in vendorData) {
                if (vendorData.hasOwnProperty(vendorId)) {
                    var vendor = vendorData[vendorId];

                    // Prepare vendor body for POST request
                    var vendorBody = {
                        entityName: entityName,
                        code: vendor.internalId || vendorId || "",
                        name: vendor.companyName || vendor.entityId || vendor.name || "",
                        address: vendor.address ? vendor.address.replace(/\\n/g, ' ').replace(/\n/g, ' ') : "",
                        email: vendor.email || "",
                        bsb: vendor.bsb || "",
                        accountNumber: vendor.accountNumber || "",
                        abn: vendor.abn,
                        paymentTerms: vendor.paymentTerms || "",
                        // defaultTaxCode: vendor.defaultTaxCode || ""
                    };

                    log.debug({
                        title: title + 'vendorBody',
                        details: JSON.stringify(vendorBody)
                    });

                    try {
                        // Make POST request to create vendor in Alli
                        var response = https.post({
                            url: apiUrl,
                            body: JSON.stringify(vendorBody),
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            }
                        });

                        results.totalProcessed++;

                        if (response.code >= 200 && response.code < 300) {
                            results.successful.push({
                                vendorId: vendorId,
                                entityName: entityName,
                                vendorCode: vendorBody.code,
                                vendorName: vendorBody.name,
                                statusCode: response.code,
                                response: response.body ? JSON.parse(response.body) : null
                            });

                            log.audit({
                                title: 'Supplier Created Successfully',
                                details: 'Vendor ID: ' + vendorId +
                                    ' | Name: ' + vendorBody.name +
                                    ' | Entity: ' + entityName +
                                    ' | Status: ' + response.code
                            });
                        } else {
                            results.failed.push({
                                vendorId: vendorId,
                                entityName: entityName,
                                vendorCode: vendorBody.code,
                                vendorName: vendorBody.name,
                                statusCode: response.code,
                                error: response.body,
                                requestBody: vendorBody
                            });

                            log.error({
                                title: 'Supplier Creation Failed',
                                details: 'Vendor ID: ' + vendorId +
                                    ' | Name: ' + vendorBody.name +
                                    ' | Status: ' + response.code +
                                    ' | Error: ' + response.body
                            });
                        }

                    } catch (postError) {
                        results.failed.push({
                            vendorId: vendorId,
                            entityName: entityName,
                            vendorCode: vendorBody.code,
                            vendorName: vendorBody.name,
                            error: postError.message,
                            requestBody: vendorBody
                        });

                        log.error({
                            title: 'POST Request Error',
                            details: 'Vendor ID: ' + vendorId +
                                ' | Name: ' + vendorBody.name +
                                ' | Error: ' + postError.message
                        });
                    }
                }
            }

            // Log summary
            log.audit({
                title: 'Supplier Creation Summary',
                details: 'Total Processed: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length
            });

        } catch (e) {
            log.error({
                title: 'Error in createSupplierInAlli',
                details: e.message + ' | Stack: ' + e.stack
            });
            return {
                successful: [],
                failed: [],
                totalProcessed: 0,
                error: e.message
            };
        }

        return results;
    };
    const updateSupplierInAlli = (vendorData, entityId, token) => {
        const title = 'updateSupplierInAlli(): ';
        const apiUrl = `${BASE_URL}/Supplier/`;

        try {
            const alliSuppliers = getSuppliersFromAlii(token);

            log.debug({
                title: title + 'Entity ID',
                details: 'entityId: ' + entityId
            });

            log.debug({
                title: title + 'Alli Suppliers',
                details: 'suppliers: ' + JSON.stringify(alliSuppliers)
            });
            log.debug({
                title: title + 'Alli Suppliers Length',
                details: 'suppliers Length: ' + alliSuppliers.length
            });

            var results = {
                successful: [],
                failed: [],
                totalProcessed: 0,
                notFound: []
            };

            // Create supplier name to ID mapping
            var supplierNameToIdMap = {};
            alliSuppliers.forEach(function (supplier) {
                supplierNameToIdMap[supplier.name] = supplier.id;
            });
            // saveMapToFile(supplierNameToIdMap, title);
            log.debug({
                title: title + 'Supplier Mapping Created',
                details: 'Total suppliers: ' + Object.keys(supplierNameToIdMap).length
            });
            log.debug({
                title: title + 'Supplier Mapping Created details',
                details: 'suppliers: ' + JSON.stringify(supplierNameToIdMap)
            });
            // Process each vendor
            log.debug({
                title: 'vendorData keys::',
                details: Object.keys(vendorData).join(', ')
            });

            for (var vendorKey in vendorData) {
                if (vendorData.hasOwnProperty(vendorKey)) {
                    log.debug({
                        title: 'Current vendorKey::',
                        details: vendorKey
                    });

                    var vendor = vendorData[vendorKey];

                    log.debug({
                        title: 'vendor (for key: ' + vendorKey + ')::',
                        details: JSON.stringify(vendor)
                    });

                    log.debug({
                        title: 'vendor.companyName::',
                        details: vendor.companyName
                    });

                    log.debug({
                        title: 'vendor.entityId::',
                        details: vendor.entityId
                    });

                    var supplierName = vendor.companyName || vendor.entityId;

                    log.debug({
                        title: 'supplierName::',
                        details: supplierName
                    });

                    // Check if supplier exists in Alli
                    if (!supplierNameToIdMap.hasOwnProperty(supplierName)) {
                        results.notFound.push({
                            supplierName: supplierName,
                            netsuiteId: vendor.internalId,
                            reason: 'Supplier not found in Alli - cannot update'
                        });

                        log.debug({
                            title: 'Supplier Not Found',
                            details: 'Supplier: ' + supplierName + ' does not exist in Alli'
                        });
                        continue;
                    }

                    var alliSupplierId = supplierNameToIdMap[supplierName];

                    log.debug({
                        title: title + 'Processing Supplier',
                        details: 'Supplier: ' + supplierName +
                            ' | Alli ID: ' + alliSupplierId +
                            ' | BSB: ' + vendor.bsb +
                            ' | Account: ' + vendor.accountNumber
                    });

                    // Prepare vendor body for update
                    var vendorBody = {
                        entityName: entityId,
                        code: vendor.internalId || "",
                        name: vendor.companyName || vendor.entityId || "",
                        address: vendor.address ? vendor.address.replace(/\\n/g, ' ').replace(/\n/g, ' ').trim() : "",
                        email: vendor.email || "",
                        bsb: vendor.bsb || "",
                        accountNumber: vendor.accountNumber || "",
                        abn: vendor.abn || "",
                        paymentTerms: vendor.paymentTerms || "",
                        defaultTaxCode: vendor.defaultTaxCode || ""
                    };

                    log.debug({
                        title: title + 'Update Payload',
                        details: JSON.stringify(vendorBody)
                    });

                    try {
                        results.totalProcessed++;

                        var response = https.put({
                            url: apiUrl + alliSupplierId,
                            body: JSON.stringify(vendorBody),
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            }
                        });

                        if (response.code >= 200 && response.code < 300) {
                            results.successful.push({
                                supplierName: supplierName,
                                alliSupplierId: alliSupplierId,
                                netsuiteId: vendor.internalId,
                                bsb: vendor.bsb,
                                accountNumber: vendor.accountNumber,
                                statusCode: response.code,
                                response: response.body ? JSON.parse(response.body) : null
                            });

                            log.audit({
                                title: 'Supplier Updated Successfully',
                                details: 'Supplier: ' + supplierName +
                                    ' | Alli ID: ' + alliSupplierId +
                                    ' | BSB: ' + vendor.bsb +
                                    ' | Status: ' + response.code
                            });
                        } else {
                            results.failed.push({
                                supplierName: supplierName,
                                alliSupplierId: alliSupplierId,
                                netsuiteId: vendor.internalId,
                                statusCode: response.code,
                                error: response.body,
                                requestBody: vendorBody
                            });

                            log.error({
                                title: 'Supplier Update Failed',
                                details: 'Supplier: ' + supplierName +
                                    ' | Alli ID: ' + alliSupplierId +
                                    ' | Status: ' + response.code +
                                    ' | Error: ' + response.body
                            });
                        }

                    } catch (putError) {
                        results.failed.push({
                            supplierName: supplierName,
                            alliSupplierId: alliSupplierId,
                            netsuiteId: vendor.internalId,
                            error: putError.message,
                            requestBody: vendorBody
                        });

                        log.error({
                            title: 'PUT Request Error',
                            details: 'Supplier: ' + supplierName +
                                ' | Alli ID: ' + alliSupplierId +
                                ' | Error: ' + putError.message
                        });
                    }
                }
            }

            // Log summary
            log.audit({
                title: 'Supplier Update Summary',
                details: 'Entity ID: ' + entityId +
                    ' | Total Processed: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length +
                    ' | Not Found: ' + results.notFound.length
            });

            return results;

        } catch (e) {
            log.error({
                title: 'Error in ' + title,
                details: e.message + ' | Stack: ' + e.stack
            });

            return {
                successful: [],
                failed: [],
                totalProcessed: 0,
                notFound: [],
                error: e.message
            };
        }
    };
    const saveMapToFile = (supplierMap, title) => {
        try {
            const mapContent = JSON.stringify(supplierMap, null, 2);

            // Create file
            const fileObj = file.create({
                name: 'supplier_mapping_' + new Date().getTime() + '.json',
                fileType: file.Type.JSON,
                contents: mapContent,
                folder: 1671
            });
            const fileId = fileObj.save();

            log.audit({
                title: title + 'Mapping saved to file',
                details: 'File ID: ' + fileId + ' | Total entries: ' + Object.keys(supplierMap).length
            });

            return fileId;

        } catch (e) {
            log.error(title + 'Error saving file', e.message);
            return null;
        }
    };
    const getInvoiceFromAlii = (token) => {
        const title = 'getInvoiceFromAlii(): ';

        try {
            log.audit(title + 'Started with pagination');

            const allInvoices = [];
            const pageSize = 2000; // Take 5000 records at a time
            let skip = 0;
            let hasMoreData = true;
            let pageNumber = 1;

            while (hasMoreData) {
                const url = `${BASE_URL}/Invoice?skip=${skip}&take=${pageSize}`;

                log.debug(title + 'Fetching page ' + pageNumber, {
                    skip: skip,
                    take: pageSize,
                    url: url
                });

                let response;
                try {
                    response = https.get({
                        url: url,
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': 'Bearer ' + token
                        }
                    });

                    log.debug(title + 'Page ' + pageNumber + ' response code', response.code);

                } catch (httpError) {
                    log.error(title + 'HTTP Request Failed on page ' + pageNumber, {
                        error: httpError.message,
                        name: httpError.name,
                        skip: skip,
                        take: pageSize
                    });

                    // If timeout, break the loop but return what we have so far
                    if (httpError.name === 'SSS_REQUEST_TIME_EXCEEDED') {
                        log.error(title + 'Timeout on page ' + pageNumber,
                            'Returning ' + allInvoices.length + ' invoices fetched so far');
                        break;
                    }

                    throw httpError;
                }

                // Check response code
                if (response.code === 401) {
                    throw new Error('401 Unauthorized — check Authorization header and token value');
                } else if (response.code !== 200) {
                    log.error(title + 'Unexpected response code', response.code);
                    break;
                }

                // Parse response
                const parsed = JSON.parse(response.body || '[]');

                if (Array.isArray(parsed)) {
                    // Filter for only "FinalReview" stage invoices
                    const filteredRecords = parsed.filter(invoice => invoice.stage === 'FinalReview');
                    const recordsInPage = filteredRecords.length;

                    log.audit(title + 'Page ' + pageNumber + ' fetched and filtered', {
                        totalRecordsInPage: parsed.length,
                        filteredRecords: recordsInPage,
                        totalSoFar: allInvoices.length + recordsInPage,
                        skip: skip
                    });

                    // Add filtered records to our collection
                    allInvoices.push(...filteredRecords);

                    // Check if we got less than pageSize (means last page)
                    if (parsed.length < pageSize) {
                        hasMoreData = false;
                        log.audit(title + 'Last page reached', 'Total FinalReview invoices: ' + allInvoices.length);
                    } else {
                        // Move to next page
                        skip += pageSize;
                        pageNumber++;
                    }

                } else {
                    log.error(title + 'Response is not an array', typeof parsed);
                    break;
                }

                // Safety check: prevent infinite loop (adjust max pages as needed)
                if (pageNumber > 20) {
                    log.error(title + 'Safety limit reached', 'Stopped at page ' + pageNumber);
                    break;
                }
            }

            log.audit(title + 'Completed', {
                totalInvoices: allInvoices.length,
                totalPages: pageNumber
            });

            return {
                invoices: allInvoices,
                code: 200,
                method: 'GET',
                reqUrl: BASE_URL + '/Invoice'
            };

        } catch (e) {
            log.error(title + 'Error', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            return {
                invoices: [],
                error: e.message
            };
        }
    };
    const getInvoicesReadyForPost = (token, enityId) => {
        const title = 'getInvoicesReadyForPost(): ';
        try {
            const url = `${BASE_URL}/Invoice/GetInvoicesReadyForPost/${enityId}`;
            log.debug(title + ':: url', url);

            const response = https.get({
                url,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });
            log.debug(title + ':: response', response);
            if (response.code === 401) {
                throw new Error('401 Unauthorized — check Authorization header and token value');
            } else if (response.code === 200) {
                const parsed = JSON.parse(response.body || '{}');
                log.debug(title + ':: parsed', parsed);
                if (parsed.exportInvoices && Array.isArray(parsed.exportInvoices)) {
                    log.debug(title + ':: exportInvoices count', parsed.exportInvoices.length);
                    return {
                        invoices: parsed.exportInvoices,
                        code: response.code,
                        method: 'GET',
                        reqUrl: url
                    };
                }
            }
            log.audit(title + ':: Warning', 'No exportInvoices found in response');
            return [];


        } catch (e) {
            if (e.name === 'SSS_REQUEST_TIME_EXCEEDED') {
                log.error('Timeout Error', 'Third party took too long to respond');
                // Implement retry logic or queue for later
            } else {
                log.error(title + ':: Error', e.message);
                return [];

            }
        }
    };
    const SetInvoicePaidInAlii = (bodyData, token) => {  // Added bodyData parameter
        const title = 'SetInvoicePaidInAlii(): ';
        try {
            const apiUrl = `${BASE_URL}/Invoice/SetInvoicePaid`;
            log.debug(title + ':: bodyData: ', JSON.stringify(bodyData));

            var results = {
                successful: [],
                failed: [],
                totalProcessed: 0
            };

            for (var invoiceId in bodyData) {
                if (bodyData.hasOwnProperty(invoiceId)) {
                    var invoice = bodyData[invoiceId];

                    var body = {
                        invoiceId: invoice.invoiceId || parseInt(invoiceId),
                        paid: invoice.paid !== undefined ? invoice.paid : true,
                        paidDate: invoice.paidDate || ""
                    };

                    try {
                        var response = https.post({  // Make sure https module is imported
                            url: apiUrl,
                            body: JSON.stringify(body),
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            }
                        });

                        results.totalProcessed++;

                        if (response.code >= 200 && response.code < 300) {
                            var responseBody = JSON.parse(response.body || '{}');

                            results.successful.push({
                                invoiceId: body.invoiceId,
                                statusCode: response.code,
                                response: responseBody
                            });

                            log.audit({
                                title: 'Invoice Marked as Paid Successfully',
                                details: 'Invoice ID: ' + body.invoiceId +
                                    ' | Status: ' + response.code +
                                    ' | Is Successful: ' + responseBody.isSuccessful
                            });
                        } else {
                            results.failed.push({
                                invoiceId: body.invoiceId,
                                statusCode: response.code,
                                error: response.body
                            });

                            log.error({
                                title: 'Invoice Payment Update Failed',
                                details: 'Invoice ID: ' + body.invoiceId +
                                    ' | Status: ' + response.code +
                                    ' | Error: ' + response.body
                            });
                        }
                    } catch (postError) {
                        results.failed.push({
                            invoiceId: body.invoiceId,
                            error: postError.message
                        });

                        log.error({
                            title: 'POST Request Error',
                            details: 'Invoice ID: ' + body.invoiceId +
                                ' | Error: ' + postError.message
                        });
                    }
                }
            }

            log.audit({
                title: 'Invoice Payment Update Summary',
                details: 'Total: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length
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
    const SetInvoicePostingStatus = (bodyData, token) => {
        const title = 'SetInvoicePostingStatus(): ';
        try {
            const apiUrl = `${BASE_URL}/Invoice/SetInvoicePostingStatus`;
            log.debug(title + ':: bodyData: ', JSON.stringify(bodyData));

            var results = {
                successful: [],
                failed: [],
                totalProcessed: 0
            };

            for (var invoiceId in bodyData) {
                if (bodyData.hasOwnProperty(invoiceId)) {
                    var invoice = bodyData[invoiceId];

                    var body = {
                        invoiceId: invoice.invoiceId || invoiceId,
                        status: invoice.status || 1,
                        postingNumber: invoice.postingNumber || "",
                        message: invoice.message || ""
                    };
                    log.debug(title + ':: bodyData:after ', JSON.stringify(body));

                    try {
                        var response = https.post({
                            url: apiUrl,
                            body: JSON.stringify(body),
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            }
                        });
                        log.debug(title + ':: response', JSON.stringify(response));

                        results.totalProcessed++;

                        if (response.code >= 200 && response.code < 300) {
                            results.successful.push({
                                invoiceId: body.invoiceId,
                                statusCode: response.code,
                                postingNumber: body.postingNumber,
                                response: JSON.parse(response.body || '{}')
                            });

                            log.audit({
                                title: 'Invoice Posting Status Updated Successfully',
                                details: 'Invoice ID: ' + body.invoiceId +
                                    ' | Posting Number: ' + body.postingNumber +
                                    ' | Status: ' + response.code
                            });
                        } else {
                            results.failed.push({
                                invoiceId: body.invoiceId,
                                statusCode: response.code,
                                error: response.body
                            });

                            log.error({
                                title: 'Invoice Posting Status Update Failed',
                                details: 'Invoice ID: ' + body.invoiceId +
                                    ' | Status: ' + response.code +
                                    ' | Error: ' + response.body
                            });
                        }
                    } catch (postError) {
                        results.failed.push({
                            invoiceId: body.invoiceId,
                            error: postError.message
                        });

                        log.error({
                            title: 'POST Request Error',
                            details: 'Invoice ID: ' + body.invoiceId +
                                ' | Error: ' + postError.message
                        });
                    }
                }
            }

            log.audit({
                title: 'Invoice Posting Status Update Summary',
                details: 'Total: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length
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
    const createGlCodesInAlli = (accountMapping, entityName, allDepartments, token) => {
        const title = 'createGlCodesInAlli(): ';
        const apiUrl = `${BASE_URL}/GLCode`;

        log.debug({
            title: title + 'accountMapping',
            details: 'accountMapping: ' + JSON.stringify(accountMapping)
        });

        log.debug({
            title: title + 'entityName',
            details: 'entityName: ' + entityName
        });

        log.debug({
            title: title + 'allDepartments',
            details: 'departments: ' + JSON.stringify(allDepartments)
        });

        var results = {
            successful: [],
            failed: [],
            totalProcessed: 0,
            skipped: []
        };

        try {
            // Extract all department names from the departments object
            var allDepartmentNames = [];

            // Loop through all subsidiaries in the departments object
            for (var subsidiaryKey in allDepartments) {
                if (allDepartments.hasOwnProperty(subsidiaryKey)) {
                    var departmentArray = allDepartments[subsidiaryKey];

                    // Check if it's an array of departments
                    if (Array.isArray(departmentArray)) {
                        departmentArray.forEach(function (dept) {
                            if (dept.name) {
                                allDepartmentNames.push(dept.name);
                            }
                        });
                    }
                }
            }

            log.debug({
                title: title + 'Department Names Extracted',
                details: 'Total departments: ' + allDepartmentNames.length + ' | Names: ' + JSON.stringify(allDepartmentNames)
            });

            // Loop through each account in the accountMapping
            for (var accountCode in accountMapping) {
                if (accountMapping.hasOwnProperty(accountCode)) {
                    var account = accountMapping[accountCode];

                    // Use all department names for businessUnitsLinked
                    var businessUnitsLinked = allDepartmentNames.slice(); // Create a copy of the array

                    // Prepare GL code body for POST request
                    var glCodeBody = {
                        entityName: entityName,
                        accountCode: accountCode,
                        description: account.accountName || "",
                        defaultTaxCode: "null",
                        businessUnitsLinked: businessUnitsLinked
                    };

                    log.debug({
                        title: title + 'glCodeBody',
                        details: JSON.stringify(glCodeBody)
                    });

                    try {
                        // Make POST request to create GL code in Alli
                        var response = https.post({
                            url: apiUrl,
                            body: JSON.stringify(glCodeBody),
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            }
                        });

                        results.totalProcessed++;

                        if (response.code >= 200 && response.code < 300) {
                            results.successful.push({
                                accountCode: accountCode,
                                entityName: entityName,
                                description: account.accountName || "",
                                businessUnitsLinked: businessUnitsLinked,
                                statusCode: response.code,
                                response: response.body ? JSON.parse(response.body) : null
                            });

                            log.audit({
                                title: 'GL Code Created Successfully',
                                details: 'GL Code: ' + accountCode +
                                    ' | Entity: ' + entityName +
                                    ' | Description: ' + (account.accountName || "") +
                                    ' | Linked to ' + businessUnitsLinked.length + ' departments' +
                                    ' | Status: ' + response.code
                            });
                        } else {
                            results.failed.push({
                                accountCode: accountCode,
                                entityName: entityName,
                                description: account.accountName || "",
                                statusCode: response.code,
                                error: response.body,
                                requestBody: glCodeBody
                            });

                            log.error({
                                title: 'GL Code Creation Failed',
                                details: 'GL Code: ' + accountCode +
                                    ' | Entity: ' + entityName +
                                    ' | Status: ' + response.code +
                                    ' | Error: ' + response.body
                            });
                        }

                    } catch (postError) {
                        results.failed.push({
                            accountCode: accountCode,
                            entityName: entityName,
                            description: account.accountName || "",
                            error: postError.message,
                            requestBody: glCodeBody
                        });

                        log.error({
                            title: 'POST Request Error',
                            details: 'GL Code: ' + accountCode +
                                ' | Entity: ' + entityName +
                                ' | Error: ' + postError.message
                        });
                    }
                }
            }

            // Log summary
            log.audit({
                title: 'GL Code Creation Summary',
                details: 'Total Processed: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length +
                    ' | Skipped: ' + results.skipped.length
            });

        } catch (e) {
            log.error({
                title: 'Error in createGlCodesInAlli',
                details: e.message + ' | Stack: ' + e.stack
            });
        }

        return results;
    };
    const createBusinessUnitsInAlli = (enityID, departmentData, token) => {
        const title = 'createBusinessUnitsInAlli(): ';
        try {
            const apiUrl = `${BASE_URL}/BusinessUnit`;
            log.debug(title + ':: departmentData: ', JSON.stringify(departmentData));

            var results = {
                successful: [],
                failed: [],
                totalProcessed: 0
            };

            // Iterate through subsidiaries
            for (var key in departmentData) {
                var departments = departmentData[key];
                for (var i = 0; i < departments.length; i++) {
                    var dept = departments[i];

                    var body = {
                        entityName: enityID,
                        name: dept.name,
                        code: dept.id || ""
                    };

                    try {
                        var response = https.post({
                            url: apiUrl,
                            body: JSON.stringify(body),
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            }
                        });

                        results.totalProcessed++;

                        if (response.code >= 200 && response.code < 300) {
                            results.successful.push({
                                subsidiaryId: enityID,
                                departmentId: dept.id,
                                departmentName: dept.name,
                                statusCode: response.code,
                                response: JSON.parse(response.body)
                            });

                            log.audit({
                                title: 'Business Unit Created Successfully',
                                details: 'Subsidiary: ' + enityID +
                                    ' | Department: ' + dept.name +
                                    ' | Status: ' + response.code
                            });
                        } else {
                            results.failed.push({
                                subsidiaryId: enityID,
                                departmentId: dept.id,
                                departmentName: dept.name,
                                statusCode: response.code,
                                error: response.body
                            });

                            log.error({
                                title: 'Business Unit Creation Failed',
                                details: 'Subsidiary: ' + enityID +
                                    ' | Department: ' + dept.name +
                                    ' | Status: ' + response.code +
                                    ' | Error: ' + response.body
                            });
                        }
                    } catch (postError) {
                        results.failed.push({
                            subsidiaryId: enityID,
                            departmentId: dept.id,
                            departmentName: dept.name,
                            error: postError.message
                        });

                        log.error({
                            title: 'POST Request Error',
                            details: 'Subsidiary: ' + enityID +
                                ' | Department: ' + dept.name +
                                ' | Error: ' + postError.message
                        });
                    }
                }

            }

            log.audit({
                title: 'Business Unit Creation Summary',
                details: 'Total: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length
            });

            return results;

        } catch (e) {
            log.error({
                title: 'Error in ' + title,
                details: e.message
            });
            return {
                successful: [],
                failed: [],
                totalProcessed: 0,
                error: e.message
            };
        }
    };
    const createTaxCodeInAlli = (entityName, taxCodeData, token) => {
        const title = 'createTaxCodeInAlli(): ';
        try {
            const apiUrl = `${BASE_URL}/TaxCode`;

            log.debug({
                title: title + 'entityName',
                details: 'entityName: ' + entityName
            });

            log.debug({
                title: title + 'taxCodeData',
                details: 'taxCodeData: ' + JSON.stringify(taxCodeData)
            });

            var results = {
                successful: [],
                failed: [],
                totalProcessed: 0
            };

            // Loop through all subsidiaries in the tax code data
            for (var subsidiaryKey in taxCodeData) {
                if (taxCodeData.hasOwnProperty(subsidiaryKey)) {
                    var taxCodes = taxCodeData[subsidiaryKey];

                    // Check if it's an array of tax codes
                    if (Array.isArray(taxCodes)) {
                        for (var i = 0; i < taxCodes.length; i++) {
                            var taxCode = taxCodes[i];

                            // Parse percentage string to number
                            var percentageStr = taxCode.percentage || "0.00%";
                            var percentageNum = parseFloat(percentageStr.replace('%', ''));

                            // Prepare tax code body for POST request
                            var body = {
                                entityName: entityName,
                                name: taxCode.name || "",
                                description: taxCode.description || "",
                                percentage: percentageNum
                            };

                            log.debug({
                                title: title + 'taxCodeBody',
                                details: JSON.stringify(body)
                            });

                            try {
                                var response = https.post({
                                    url: apiUrl,
                                    body: JSON.stringify(body),
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json',
                                        'Authorization': 'Bearer ' + token
                                    }
                                });

                                results.totalProcessed++;

                                if (response.code >= 200 && response.code < 300) {
                                    results.successful.push({
                                        entityName: entityName,
                                        subsidiaryId: subsidiaryKey,
                                        taxCodeName: taxCode.name,
                                        percentage: percentageNum,
                                        statusCode: response.code,
                                        response: JSON.parse(response.body)
                                    });

                                    log.audit({
                                        title: 'Tax Code Created Successfully',
                                        details: 'Entity: ' + entityName +
                                            ' | Tax Code: ' + taxCode.name +
                                            ' | Percentage: ' + percentageNum + '%' +
                                            ' | Status: ' + response.code
                                    });
                                } else {
                                    results.failed.push({
                                        entityName: entityName,
                                        subsidiaryId: subsidiaryKey,
                                        taxCodeName: taxCode.name,
                                        percentage: percentageNum,
                                        statusCode: response.code,
                                        error: response.body,
                                        requestBody: body
                                    });

                                    log.error({
                                        title: 'Tax Code Creation Failed',
                                        details: 'Entity: ' + entityName +
                                            ' | Tax Code: ' + taxCode.name +
                                            ' | Status: ' + response.code +
                                            ' | Error: ' + response.body
                                    });
                                }
                            } catch (postError) {
                                results.failed.push({
                                    entityName: entityName,
                                    subsidiaryId: subsidiaryKey,
                                    taxCodeName: taxCode.name,
                                    percentage: percentageNum,
                                    error: postError.message,
                                    requestBody: body
                                });

                                log.error({
                                    title: 'POST Request Error',
                                    details: 'Entity: ' + entityName +
                                        ' | Tax Code: ' + taxCode.name +
                                        ' | Error: ' + postError.message
                                });
                            }
                        }
                    }
                }
            }

            log.audit({
                title: 'Tax Code Creation Summary',
                details: 'Total: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length
            });

            return results;

        } catch (e) {
            log.error({
                title: 'Error in ' + title,
                details: e.message
            });
            return {
                successful: [],
                failed: [],
                totalProcessed: 0,
                error: e.message
            };
        }
    };
    const createSubAllocationInAlii = (entityName, subAllocationData, token) => {
        const title = 'createSubAllocationInAlii(): ';
        try {
            const apiUrl = `${BASE_URL}/SubAllocation`;

            log.debug({
                title: title + 'entityName',
                details: 'entityName: ' + entityName
            });

            log.debug({
                title: title + 'subAllocationData',
                details: 'subAllocationData: ' + JSON.stringify(subAllocationData)
            });
            // log.debug({
            //     title: title + 'linkedGLAccountCodes',
            //     details: 'linkedGLAccountCodes: ' + JSON.stringify(linkedGLAccountCodes)
            // });

            var results = {
                successful: [],
                failed: [],
                totalProcessed: 0
            };

            // Loop through all subsidiaries in the sub-allocation data
            for (var subsidiaryKey in subAllocationData) {
                if (subAllocationData.hasOwnProperty(subsidiaryKey)) {
                    var subAllocations = subAllocationData[subsidiaryKey];

                    // Check if it's an array of sub-allocations
                    if (Array.isArray(subAllocations)) {
                        for (var i = 0; i < subAllocations.length; i++) {
                            var subAllocation = subAllocations[i];

                            // Prepare sub-allocation body for POST request
                            var body = {
                                entityName: entityName,
                                name: subAllocation.name || "",
                                code: subAllocation.code || "",
                                linkedGLAccountCodes: ['3800-2-102-000'] || []
                            };

                            log.debug({
                                title: title + 'subAllocationBody',
                                details: JSON.stringify(body)
                            });

                            try {
                                var response = https.post({
                                    url: apiUrl,
                                    body: JSON.stringify(body),
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json',
                                        'Authorization': 'Bearer ' + token
                                    }
                                });

                                results.totalProcessed++;

                                if (response.code >= 200 && response.code < 300) {
                                    results.successful.push({
                                        entityName: entityName,
                                        subsidiaryId: subsidiaryKey,
                                        subAllocationName: subAllocation.name,
                                        subAllocationCode: subAllocation.code,
                                        statusCode: response.code,
                                        response: JSON.parse(response.body)
                                    });

                                    log.audit({
                                        title: 'Sub-Allocation Created Successfully',
                                        details: 'Entity: ' + entityName +
                                            ' | Name: ' + subAllocation.name +
                                            ' | Code: ' + subAllocation.code +
                                            ' | Status: ' + response.code
                                    });
                                } else {
                                    results.failed.push({
                                        entityName: entityName,
                                        subsidiaryId: subsidiaryKey,
                                        subAllocationName: subAllocation.name,
                                        subAllocationCode: subAllocation.code,
                                        statusCode: response.code,
                                        error: response.body,
                                        requestBody: body
                                    });

                                    log.error({
                                        title: 'Sub-Allocation Creation Failed',
                                        details: 'Entity: ' + entityName +
                                            ' | Name: ' + subAllocation.name +
                                            ' | Code: ' + subAllocation.code +
                                            ' | Status: ' + response.code +
                                            ' | Error: ' + response.body
                                    });
                                }
                            } catch (postError) {
                                results.failed.push({
                                    entityName: entityName,
                                    subsidiaryId: subsidiaryKey,
                                    subAllocationName: subAllocation.name,
                                    subAllocationCode: subAllocation.code,
                                    error: postError.message,
                                    requestBody: body
                                });

                                log.error({
                                    title: 'POST Request Error',
                                    details: 'Entity: ' + entityName +
                                        ' | Name: ' + subAllocation.name +
                                        ' | Code: ' + subAllocation.code +
                                        ' | Error: ' + postError.message
                                });
                            }
                        }
                    }
                }
            }

            log.audit({
                title: 'Sub-Allocation Creation Summary',
                details: 'Total: ' + results.totalProcessed +
                    ' | Successful: ' + results.successful.length +
                    ' | Failed: ' + results.failed.length
            });

            return results;

        } catch (e) {
            log.error({
                title: 'Error in ' + title,
                details: e.message
            });
            return {
                successful: [],
                failed: [],
                totalProcessed: 0,
                error: e.message
            };
        }
    };
    function createIntegrationLog(logData) {
        const title = 'createIntegrationLog(): ';
        try {
            log.debug({
                title: title + 'logData',
                details: JSON.stringify(logData)
            });
            var status = 'Success';
            if (logData.failed.length > 0 && logData.successful.length > 0) {
                status = 'Partial';
            } else if (logData.failed.length > 0 && logData.successful.length === 0) {
                status = 'Failed';
            }
            var errorMessages = [];
            log.debug({
                title: title + 'logData',
                details: JSON.stringify(logData)
            });
            if (logData.failedInvoices && logData.failedInvoices.length > 0) {
                logData.failedInvoices.forEach(function (failedInvoice) {
                    errorMessages.push(
                        'Invoice #' + failedInvoice.invoiceNumber +
                        ' (ID: ' + failedInvoice.invoiceId + '): ' +
                        failedInvoice.error
                    );
                });
            }

            if (logData.skippedInvoices && logData.skippedInvoices.length > 0) {
                logData.skippedInvoices.forEach(function (skippedInvoice) {
                    errorMessages.push(
                        'Invoice #' + skippedInvoice.invoiceNumber +
                        ' (ID: ' + skippedInvoice.invoiceId + '): ' +
                        skippedInvoice.reason +
                        ' (Existing Record: ' + skippedInvoice.existingRecordId + ')'
                    );
                });
            }
            var logRecord = record.create({
                type: 'customrecord_integration_log',
                isDynamic: true
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_request_method',
                value: logData.method || ''
            });

            logRecord.setValue({
                fieldId: 'custrecord_il_response_code',
                value: logData.responseCode || 0
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_record_name',
                value: logData.recordType || ''
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
                text: logData.status || ''
            });

            logRecord.setValue({
                fieldId: 'custrecord_il_error_message',
                value: errorMessages.length > 0 ? errorMessages.join('\n\n') : ''
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_summary_error_message',
                value: errorMessages.length > 0 ? errorMessages.join('\n\n') : ''
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_request_url',
                value: logData.requestUrl || ''
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_integration_type',
                value: 1 || ''
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_timestamp',
                value: new Date()
            });

            var recordId = logRecord.save();

            log.audit({
                title: title + 'Integration Log Created',
                details: 'Custom Record ID: ' + recordId +
                    ' | Status: ' + logData.status +
                    ' | Total: ' + logData.totalProcessed +
                    ' | Success: ' + logData.successful +
                    ' | Failed: ' + logData.failed +
                    ' | skipped: ' + logData.skipped
            });

            if (status === 'Failed' || status === 'Partial' || errorMessages.length > 0) {
                sendErrorNotification(logData, logData.status, errorMessages, recordId);
            }
            return recordId;

        } catch (e) {
            log.error({
                title: title + 'Error',
                details: e.message
            });
            return null;
        }
    }
    function sendErrorNotification(logData, status, errorMessages, logRecordId) {
        const title = 'sendErrorNotification(): ';

        try {
            var currentUser = runtime.getCurrentUser();
            if (!logData.emailRecipients) {
                log.debug({
                    title: title + 'No Recipients',
                    details: 'Email parameter not configured. Skipping notification.'
                });
                return;
            }

            // Parse email addresses (comma-separated)
            var recipientList = logData.emailRecipients.split(',').map(function (email) {
                return email.trim();
            }).filter(function (email) {
                return email.length > 0;
            });

            if (recipientList.length === 0) {
                log.debug({
                    title: title + 'No Valid Recipients',
                    details: 'No valid email addresses found.'
                });
                return;
            }

            // Build email subject
            var subject = '[NetSuite Integration] ' + status + ' - ' +
                (logData.recordType || 'Integration') + ' Sync Error';

            // Build email body
            var emailBody = buildEmailBody(logData, status, errorMessages, logRecordId);

            // Send email
            email.send({
                author: 211, // NetSuite System
                recipients: recipientList ,
                subject: subject,
                body: emailBody
            });

            log.audit({
                title: title + 'Email Sent',
                details: 'Notification sent to: ' + recipientList.join(', ') +
                    ' | Status: ' + status +
                    ' | Failed: ' + logData.failed +
                    ' | Log Record ID: ' + logRecordId
            });

        } catch (e) {
            log.error({
                title: title + 'Email Error',
                details: 'Failed to send notification email: ' + e.message
            });
        }
    }
    function buildEmailBody(logData, status, errorMessages, logRecordId) {
        var accountId = runtime.accountId;
        var logRecordUrl = 'https://' + accountId + '.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=1135&id=' + logRecordId;

        var html = '';
        html += '<div style="font-family: Arial, sans-serif; max-width: 800px;">';
        html += '<h2 style="color: ' + (status === 'Failed' ? '#d9534f' : '#f0ad4e') + ';">';
        html += '⚠️ Integration Sync ' + status;
        html += '</h2>';
        html += '<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">';
        html += '<h3 style="margin-top: 0;">Execution Summary</h3>';
        html += '<table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><td style="padding: 5px;"><strong>Record Type:</strong></td><td>' + (logData.recordType || 'N/A') + '</td></tr>';
        html += '<tr><td style="padding: 5px;"><strong>Status:</strong></td><td><span style="color: ' + (status === 'Failed' ? '#d9534f' : '#f0ad4e') + '; font-weight: bold;">' + status + '</span></td></tr>';
        html += '<tr><td style="padding: 5px;"><strong>Total Processed:</strong></td><td>' + (logData.totalProcessed || 0) + '</td></tr>';
        html += '<tr><td style="padding: 5px;"><strong>Successful:</strong></td><td style="color: #5cb85c;">' + (logData.successful || 0) + '</td></tr>';
        html += '<tr><td style="padding: 5px;"><strong>Failed:</strong></td><td style="color: #d9534f;">' + (logData.failed || 0) + '</td></tr>';
        html += '<tr><td style="padding: 5px;"><strong>Skipped:</strong></td><td style="color: #f0ad4e;">' + (logData.skipped || 0) + '</td></tr>';
        html += '<tr><td style="padding: 5px;"><strong>Timestamp:</strong></td><td>' + new Date().toLocaleString() + '</td></tr>';
        html += '</table>';
        html += '</div>';

        // Error Details
        if (errorMessages.length > 0) {
            html += '<div style="margin-bottom: 20px;">';
            html += '<h3>Error Details</h3>';
            html += '<div style="background-color: #fff3cd; border-left: 4px solid #f0ad4e; padding: 15px;">';

            // Show first 10 errors
            var displayErrors = errorMessages.slice(0, 10);
            html += '<ul style="margin: 0; padding-left: 20px;">';
            displayErrors.forEach(function (error) {
                html += '<li style="margin-bottom: 10px;">' + error + '</li>';
            });
            html += '</ul>';

            if (errorMessages.length > 10) {
                html += '<p style="margin-top: 10px; font-style: italic;">... and ' + (errorMessages.length - 10) + ' more errors. See integration log for full details.</p>';
            }
            html += '</div>';
            html += '</div>';
        }
        if (logData.failedInvoices && logData.failedInvoices.length > 0) {
            html += '<div style="margin-bottom: 20px;">';
            html += '<h3>Failed Invoices (' + logData.failedInvoices.length + ')</h3>';
            html += '<table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">';
            html += '<thead><tr style="background-color: #f5f5f5;">';
            html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Invoice #</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">ID</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Error</th>';
            html += '</tr></thead><tbody>';

            var displayFailed = logData.failedInvoices.slice(0, 5);
            displayFailed.forEach(function (invoice) {
                html += '<tr>';
                html += '<td style="padding: 10px; border: 1px solid #ddd;">' + (invoice.invoiceNumber || 'N/A') + '</td>';
                html += '<td style="padding: 10px; border: 1px solid #ddd;">' + (invoice.invoiceId || 'N/A') + '</td>';
                html += '<td style="padding: 10px; border: 1px solid #ddd;">' + (invoice.error || 'Unknown error') + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table>';

            if (logData.failedInvoices.length > 5) {
                html += '<p style="margin-top: 10px; font-style: italic;">Showing 5 of ' + logData.failedInvoices.length + ' failed invoices.</p>';
            }
            html += '</div>';
        }
        html += '<div style="background-color: #d9edf7; border-left: 4px solid #5bc0de; padding: 15px; margin-bottom: 20px;">';
        html += '<h3 style="margin-top: 0;">📋 Action Required</h3>';
        html += '<p>Please review the integration log for detailed information and take appropriate action to resolve the errors.</p>';
        html += '<p><a href="' + logRecordUrl + '" style="display: inline-block; padding: 10px 20px; background-color: #5bc0de; color: white; text-decoration: none; border-radius: 3px;">View Integration Log</a></p>';
        html += '</div>';
        html += '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">';
        html += '<p>This is an automated notification from NetSuite Integration System.</p>';
        html += '<p>Log Record ID: ' + logRecordId + '</p>';
        html += '<p>Request URL: ' + (logData.requestUrl || 'N/A') + '</p>';
        html += '</div>';

        html += '</div>';

        return html;
    }
    return {
        authenticate,
        getSuppliersFromAlii,
        createEntitiesInAlli,
        createSupplierInAlli,
        updateSupplierInAlli,
        getEntity,
        getBudget,
        getGLCodes,
        getInvoiceFromAlii,
        SetInvoicePaidInAlii,
        SetInvoicePostingStatus,
        createGlCodesInAlli,
        createBusinessUnitsInAlli,
        createTaxCodeInAlli,
        createSubAllocationInAlii,
        getInvoicesReadyForPost,
        createIntegrationLog

    };

});
