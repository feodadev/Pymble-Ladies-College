/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
var MAIN_ENTITY = {
    NAME: "Pymble Ladies College",
    ID: "2"
}
define(['N/file', 'N/runtime', 'N/record', 'N/search', 'N/log', '/SuiteScripts/Feoda/ALII Integration/Libraries/Feoda_RL_Helper.js'],
    (file, runtime, record, search, log, RL_Helper) => {

        const getInputData = () => {
            const title = 'getInputData(): ';
            try {

                var script = runtime.getCurrentScript();
                const productionKeys = script.getParameter('custscript_alii_pro_keys_data_tabl');
                const sbKeys = '';

                const token = RL_Helper.authenticate(sbKeys, productionKeys);
                log.debug(title + '::token', token);
                const vendorObject = getVendorsFromNS(token);
                log.debug(title + ':: vendorObject: ', vendorObject);
                const aliiEntityObj = RL_Helper.updateSupplierInAlli(vendorObject.vendorData, MAIN_ENTITY.NAME, token)
                log.debug(title + ':: aliiEntityObj: ', aliiEntityObj);
                // const aliiEntityObj = RL_Helper.getEntity(token);
                // log.debug(title + ':: aliiEntityObj: ', aliiEntityObj);
                // const supplierObj = RL_Helper.createSupplierInAlli(vendorObject.vendorData, MAIN_ENTITY.NAME, token);
                // log.debug(title + ':: supplierObj: ', supplierObj);
                // const getDepartmentsObj = getDepartmentsFromNS();
                // log.debug(title + ':: getDepartmentsObj: ', getDepartmentsObj);
                // const departmentsObj = RL_Helper.createBusinessUnitsInAlli(MAIN_ENTITY.NAME, getDepartmentsObj, token);
                // log.debug(title + ':: departmentsObj: ', departmentsObj);
                // const getTaxCodeObj = getTaxCodesFromNS();
                // log.debug(title + ':: getTaxCodeObj: ', getTaxCodeObj);
                // const getJobsObj = getJobsFromNS();
                // log.debug(title + ':: getJobsObj: ', getJobsObj);
                // const subAllocationObj = RL_Helper.createSubAllocationInAlii(MAIN_ENTITY.NAME, getJobsObj, token)
                // log.debug(title + ':: subAllocationObj: ', subAllocationObj);
                // const taxCodesObj = RL_Helper.createTaxCodeInAlli(MAIN_ENTITY.NAME, getTaxCodeObj, token);
                // log.debug(title + ':: taxCodesObj: ', taxCodesObj);

                // const getGlCodesObj = getGlAccountFromNS();
                // log.debug(title + ':: getGlCodesObj: ', getGlCodesObj);
                // const glCodesObj = RL_Helper.createGlCodesInAlli(getGlCodesObj, MAIN_ENTITY.NAME, getDepartmentsObj, token);
                // log.debug(title + ':: glCodesObj: ', glCodesObj);

                return;
                const getSupplier = RL_Helper.getSuppliersFromAlii(token);
                log.debug(title + ':: getSupplier: ', getSupplier);
                const getEntity = RL_Helper.getEntity(token);
                log.debug(title + ':: getEntity: ', getEntity);
                const getGLCodes = RL_Helper.getGLCodes(token);
                log.debug(title + ':: getGLCodes: ', getGLCodes);
                return true;
            } catch (e) {
                log.error('getInputData Error', e.message);
                return [];
            }
        };

        const getVendorsFromNS = () => {
            const title = 'getVendorsFromNS(): ';
            try {
                let vendorMapping = {};
                let entityMapping = {};
                const vendorSearch = search.create({
                    type: search.Type.VENDOR,
                    filters: [
                        ['isinactive', 'is', 'F'],
                        'AND',
                        // ['internalid', 'anyof', '17421','17422'],
                        ['internalid', 'anyof', '17423', '17424', '17425', '17426', '17427', '17428', '17429', '17430', '17431', '17432', '17433', '17434', '17435'],
                    ],
                    columns: [
                        search.createColumn({ name: 'entityid' }),
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'companyname' }),
                        search.createColumn({ name: 'email' }),
                        search.createColumn({ name: 'phone' }),
                        search.createColumn({ name: 'address' }),
                        search.createColumn({ name: 'terms' }),
                        search.createColumn({ name: 'custrecord_2663_entity_acct_name', join: 'custrecord_2663_parent_vendor' }),
                        search.createColumn({ name: 'custrecord_2663_entity_acct_no', join: 'custrecord_2663_parent_vendor' }),
                        search.createColumn({ name: 'custrecord_2663_entity_branch_no', join: 'custrecord_2663_parent_vendor' }),
                        search.createColumn({ name: 'custrecord_2663_entity_bank_no', join: 'custrecord_2663_parent_vendor' }),
                        search.createColumn({ name: 'vatregnumber' })
                    ]
                });

                const pagedData = vendorSearch.runPaged({ pageSize: 1000 });

                pagedData.pageRanges.forEach(function (pageRange) {
                    const page = pagedData.fetch({ index: pageRange.index });

                    page.data.forEach(function (result) {
                        const entityId = result.getValue('entityid');
                        const bsbVal = result.getValue({ name: 'custrecord_2663_entity_bank_no', join: 'custrecord_2663_parent_vendor' }) + '' + result.getValue({ name: 'custrecord_2663_entity_branch_no', join: 'custrecord_2663_parent_vendor' })
                        log.debug({
                            title: title + 'bsbVal',
                            details: bsbVal
                        });
                        vendorMapping[entityId] = {
                            internalId: result.getValue('internalid'),
                            entityId: entityId,
                            companyName: result.getValue('companyname'),
                            email: result.getValue('email'),
                            phone: result.getValue('phone'),
                            address: result.getValue('address'),
                            paymentTerms: result.getValue('terms'),
                            bsb: bsbVal,
                            abn: result.getValue('vatregnumber'),
                            accountNumber: result.getValue({ name: 'custrecord_2663_entity_acct_no', join: 'custrecord_2663_parent_vendor' })
                        };
                        entityMapping[entityId] = {
                            entityId: entityId,
                            code: "null",
                            currency: ""
                        };
                    });
                });

                log.debug({
                    title: title + 'Vendor Mapping Created (Paged)',
                    details: 'Total vendors: ' + Object.keys(vendorMapping).length
                });
                log.debug({
                    title: title + 'Vendor Mapping Obj: ',
                    details: 'Total vendors: ' + JSON.stringify(vendorMapping)
                });
                return {
                    vendorData: vendorMapping,
                    entityData: entityMapping
                };
            } catch (e) {
                log.error({
                    title: 'Error in ' + title,
                    details: e.message
                });
            }

        };
        const getGlAccountFromNS = () => {
            const title = 'getGlAccountFromNS(): ';
            try {

                const accountMapping = {};
                const accountSearchFilters = [
                    ['isinactive', 'is', 'F']
                ];
                const accountSearch = search.create({
                    type: 'account',
                    filters: accountSearchFilters,
                    columns: [
                        search.createColumn({ name: 'name', sort: search.Sort.ASC }),
                        search.createColumn({ name: 'displayname' }),
                        search.createColumn({ name: 'number' })
                    ],
                });
                const accountSearchPagedData = accountSearch.runPaged({ pageSize: 1000 });

                for (let i = 0; i < accountSearchPagedData.pageRanges.length; i++) {
                    const accountSearchPage = accountSearchPagedData.fetch({ index: i });
                    accountSearchPage.data.forEach(function (result) {
                        const accountName = result.getValue({ name: 'name' });
                        const internalId = result.id;
                        const accountNumber = result.getValue({ name: 'number' });
                        const accountDisplay = result.getValue({ name: 'displayname' });
                        accountMapping[accountNumber] = { accountName };
                    });
                }
                log.debug({
                    title: title,
                    details: 'accountMapping: ' + JSON.stringify(accountMapping)
                });
                return accountMapping;


            } catch (e) {
                log.error({
                    title: 'Error in ' + title,
                    details: e.message
                });
            }

        };
        const getDepartmentsFromNS = () => {
            const title = 'getDepartmentsFromNS(): ';
            try {
                const departmentMapping = {};
                const departmentSearchFilters = [
                    ['isinactive', 'is', 'F']
                ];

                const departmentSearch = search.create({
                    type: 'department',
                    filters: departmentSearchFilters,
                    columns: [
                        search.createColumn({ name: 'name', sort: search.Sort.ASC }),
                        search.createColumn({ name: 'subsidiary' }),
                        search.createColumn({ name: 'internalid' })
                    ],
                });

                const departmentSearchPagedData = departmentSearch.runPaged({ pageSize: 1000 });

                for (let i = 0; i < departmentSearchPagedData.pageRanges.length; i++) {
                    const departmentSearchPage = departmentSearchPagedData.fetch({ index: i });
                    departmentSearchPage.data.forEach(function (result) {
                        const departmentName = result.getValue({ name: 'name' });
                        const internalId = result.id;
                        const subsidiaryId = result.getValue({ name: 'subsidiary' });
                        if (!departmentMapping[subsidiaryId]) {
                            departmentMapping[subsidiaryId] = [];
                        }
                        departmentMapping[subsidiaryId].push({
                            id: internalId,
                            name: departmentName
                        });
                    });
                }

                log.debug({
                    title: title + ':: Department Mapping',
                    details: 'departmentMapping: ' + JSON.stringify(departmentMapping)
                });

                return departmentMapping;

            } catch (e) {
                log.error({
                    title: 'Error fetching departments',
                    details: e.toString()
                });
                return {};
            }

        };
        const getTaxCodesFromNS = () => {
            const title = 'getTaxCodesFromNS(): ';
            try {
                const taxCodeMapping = {};
                const taxCodeSearchFilters = [
                    ['subsidiary', 'anyof', '2'],
                    'AND',
                    ['isinactive', 'is', 'F'],
                ];

                const taxCodeSearch = search.create({
                    type: 'salestaxitem',
                    filters: taxCodeSearchFilters,
                    columns: [
                        search.createColumn({ name: 'name', sort: search.Sort.ASC }),
                        search.createColumn({ name: 'description' }),
                        search.createColumn({ name: 'rate' }),
                        search.createColumn({ name: 'subsidiarynohierarchy' }),
                        search.createColumn({ name: 'internalid' })
                    ],
                });

                const taxCodeSearchPagedData = taxCodeSearch.runPaged({ pageSize: 1000 });

                for (let i = 0; i < taxCodeSearchPagedData.pageRanges.length; i++) {
                    const taxCodeSearchPage = taxCodeSearchPagedData.fetch({ index: i });
                    taxCodeSearchPage.data.forEach(function (result) {
                        const taxCodeName = result.getValue({ name: 'name' });
                        const description = result.getValue({ name: 'description' });
                        const rate = result.getValue({ name: 'rate' });
                        const internalId = result.id;
                        const subsidiaryId = result.getValue({ name: 'subsidiarynohierarchy' });

                        if (!taxCodeMapping[subsidiaryId]) {
                            taxCodeMapping[subsidiaryId] = [];
                        }

                        taxCodeMapping[subsidiaryId].push({
                            entityName: MAIN_ENTITY.NAME,
                            name: taxCodeName,
                            description: description || '',
                            percentage: rate || '0'
                        });
                    });
                }

                log.debug({
                    title: title + ':: Tax Code Mapping',
                    details: 'taxCodeMapping: ' + JSON.stringify(taxCodeMapping)
                });

                return taxCodeMapping;

            } catch (e) {
                log.error({
                    title: 'Error fetching tax codes',
                    details: e.toString()
                });
                return {};
            }
        };
        const getJobsFromNS = () => {
            const title = 'getJobsFromNS(): ';
            try {
                const jobMapping = {};
                const jobSearchFilters = [
                    ['isinactive', 'is', 'F']
                ];

                const jobSearch = search.create({
                    type: 'job',
                    filters: jobSearchFilters,
                    columns: [
                        search.createColumn({ name: 'companyname' }),
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'subsidiary' })
                    ],
                });

                const jobSearchPagedData = jobSearch.runPaged({ pageSize: 1000 });

                for (let i = 0; i < jobSearchPagedData.pageRanges.length; i++) {
                    const jobSearchPage = jobSearchPagedData.fetch({ index: i });
                    jobSearchPage.data.forEach(function (result) {
                        const companyName = result.getValue({ name: 'companyname' });
                        const internalId = result.id;
                        const subsidiaryId = result.getValue({ name: 'subsidiary' });

                        if (!jobMapping[subsidiaryId]) {
                            jobMapping[subsidiaryId] = [];
                        }

                        jobMapping[subsidiaryId].push({
                            name: companyName || '',
                            code: internalId || ''
                        });
                    });
                }

                log.debug({
                    title: title + ':: Job Mapping',
                    details: 'jobMapping: ' + JSON.stringify(jobMapping)
                });

                return jobMapping;

            } catch (e) {
                log.error({
                    title: 'Error fetching jobs',
                    details: e.toString()
                });
                return {};
            }
        };
        const map = (context) => {
            try {

            } catch (e) {
                log.error('map Error', e.message);
            }
        };
      

        return {
            getInputData,
            map
        };

    });
