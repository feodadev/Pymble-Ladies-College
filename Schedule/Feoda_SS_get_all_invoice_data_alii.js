/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/https', 'N/log', 'N/task', 'N/file', 'N/runtime', '/SuiteScripts/Feoda/ALII Integration/Libraries/Feoda_RL_Helper.js'],
    (https, log, task, file, runtime, RL_Helper) => {

        const execute = (context) => {
            const title = 'execute: ';

            try {
                log.audit(title + 'Started', 'Fetching invoices from Alii API');
                var script = runtime.getCurrentScript();
                const sbKeys = script.getParameter('custscript_ss_sandbox_api_keys');
                const productionKeys = script.getParameter('custscript_ss_prodcution_api_keys');
                // Step 1: Get the token
                const token = RL_Helper.authenticate(sbKeys, productionKeys);
                log.debug(title + '::token', token);
                if (!token) {
                    log.error(title + 'Error', 'Failed to obtain token');
                    return;
                }
                log.debug(title + 'Token obtained', 'Length: ' + token.length);

                // Step 2: Fetch invoices from API
                const invoiceData = RL_Helper.getInvoiceFromAlii(token);
                log.debug(title + '::invoiceData', JSON.stringify(invoiceData));

                if (!invoiceData || !invoiceData.invoices || invoiceData.invoices.length === 0) {
                    log.audit(title + 'Warning', 'No invoices returned from API');
                    return;
                }

                log.audit(title + 'Success', 'Fetched ' + invoiceData.invoices.length + ' invoices');

                // Step 3: Save data to a file for Map/Reduce to process
                const fileId = saveInvoicesToFile(invoiceData.invoices);
                log.audit(title + 'File Created', 'File ID: ' + fileId);

                // Step 4: Trigger Map/Reduce script
                triggerMapReduceScript(fileId);

            } catch (e) {
                log.error(title + 'Error', {
                    name: e.name,
                    message: e.message,
                    stack: e.stack
                });
            }
        };
        /**
         * Save invoices to a JSON file in File Cabinet
         */
        const saveInvoicesToFile = (invoices) => {
            const title = 'saveInvoicesToFile: ';

            try {
                const timestamp = new Date().getTime();
                const fileName = 'alii_invoices_' + timestamp + '.json';

                const fileObj = file.create({
                    name: fileName,
                    fileType: file.Type.JSON,
                    contents: JSON.stringify(invoices),
                    folder: 1368
                });

                const fileId = fileObj.save();
                log.audit(title + 'File saved', 'ID: ' + fileId + ', Name: ' + fileName);

                return fileId;

            } catch (e) {
                log.error(title + 'Error', e.message);
                throw e;
            }
        };
        const triggerMapReduceScript = (fileId) => {
            const title = 'triggerMapReduceScript: ';

            try {
                const mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript__fd_mr_create_vb_alii',
                    deploymentId: 'customdeploy_fd_mr_create_vb_alii',
                    params: {
                        custscript_invoice_file_id: fileId
                    }
                });

                const mrTaskId = mrTask.submit();
                log.audit(title + 'Map/Reduce triggered', 'Task ID: ' + mrTaskId);

                return mrTaskId;

            } catch (e) {
                log.error(title + 'Error', {
                    message: e.message,
                    name: e.name
                });
                throw e;
            }
        };

        return {
            execute: execute
        };
    });