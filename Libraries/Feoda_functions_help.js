/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 */
define(['N/https', 'N/record', 'N/search', 'N/file'], (https, record, search, file) => {
    const saveMapToFile = (supplierMap, title) => {
        try {
            const mapContent = JSON.stringify(supplierMap, null, 2);
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

    function createIntegrationLog(logData) {
        const title = 'createIntegrationLog(): ';
        try {
            var logRecord = record.create({
                type: 'customrecord_integration_log',
                isDynamic: true
            });

            logRecord.setValue({
                fieldId: 'custrecord_il_transaction_type',
                value: logData.transactionType || 2
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
                fieldId: 'custrecord_il_summary_error_message',
                value: logData.errorMessage || ''
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_request_url',
                value: logData.requestUrl || ''
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_integration_type',
                value: logData.requestUrl || ''
            });
            logRecord.setValue({
                fieldId: 'custrecord_il_timestamp',
                value: new Date()
            });

            var recordId = logRecord.save();

            log.audit({
                title: title + 'Integration Log Created',
                details: 'Log ID: ' + recordId + ' | Status: ' + logData.status
            });

            return recordId;

        } catch (e) {
            log.error({
                title: title + 'Error',
                details: e.message
            });
            return null;
        }
    }
    return {
        createIntegrationLog
    };

});
