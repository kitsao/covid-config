const { URL } = require('url');
const chalk = require('chalk');
const level = require('level');
const { v4: uuidv4 } = require('uuid');
const PouchDB = require('pouchdb-core');
PouchDB.plugin(require('pouchdb-adapter-http'));
PouchDB.plugin(require('pouchdb-mapreduce'));


const error = chalk.bold.red;
const warn = chalk.keyword('orange');
const info = chalk.white;
const CHANGES_LIMIT = 100;
const SLEEP_DELAY = 1000;
const triggerNotifications = false;
const EXCLUDED_KEYS = ['_id', '_rev', 'needs_sign_off', 'place_id', 'patient_id', 'parent', 'type', 'contact_type'];

if (!process.env.COUCH_URL) throw new Error('COUCH_URL env var not set.');

const cache = level('cache');


let COUCH_URL;
try {
    COUCH_URL = new URL(process.env.COUCH_URL);

    if (COUCH_URL.pathname !== '/medic') {
        COUCH_URL.pathname = '/medic';
    }
} catch (err) {
    console.log(error(`You need to define a valid COUCH_URL`));
    process.exit(-1);
}

const couchdb = new PouchDB(COUCH_URL.href);

const getUTCTimestamp = () => new Date(Date.now() + (new Date().getTimezoneOffset() * 60000)).getTime()

const getChangesAndLastSeq = async (db, seqNumber) => {
    const changes = await db.changes({ limit: CHANGES_LIMIT, since: seqNumber });
    return {
        changeSet: changes.results.filter(change => !change.deleted),
        seqNumber: changes.last_seq
    }
};

const getCases = async db => {
    const options = {
        include_docs: true,
        key: ['trace_case'],
    }

    const response = await db.query('medic-client/contacts_by_type', options);
    if (response.rows.length === 0) return {};

    const result = {};
    response.rows.forEach(row => {
        if (row.doc.kemr_uuid) {
            result[row.doc.kemr_uuid] = row.doc;
        }
    });
    return result;
}
const getCounties = async db => {
    const options = {
        include_docs: true,
        key: ['county_office'],
    }

    const result = await db.query('medic-client/contacts_by_type', options);
    if (result.rows.length === 0) return [];
    return result.rows.map(row => row.doc);
}

const getDocsFromChangeSet = async (db, changeSet) => {
    const options = {
        include_docs: true,
        keys: changeSet.map(change => change.id)
    }
    const docs = await db.allDocs(options)
    return docs.rows.map(row => row.doc)
};

const getSeqNumber = async cache => {
    let seqNumber;
    try {
        seqNumber = await cache.get('seqNumber')
    } catch (err) {
        seqNumber = '0';
    }
    return seqNumber;
}

const updateSeqNumber = async (cache, seqNumber) => {
    try {
        await cache.put('seqNumber', seqNumber);
    } catch (err) {
        throw err;
    }
};

const createNewCaseDocument = item => {
    const newCase = {
        _id: uuidv4(),
        kemr_uuid: item._id,
        type: 'contact',
        contact_type: 'forwarded_case',
        reported_date: item.reported_date
    };
    for (const key of Object.keys(item.fields)) {
        if (!EXCLUDED_KEYS.includes(key) && !!item.fields[key]) {
            newCase[key] = item.fields[key];
        }
    }
    newCase['contacts'] = item.contacts;
    return newCase;
};

const extractContactDetails = (item, retainReference) => {
    const contact = {
        _id: uuidv4(),
        type: 'contact',
        contact_type: 'trace_contact'
    };
    for (const key of Object.keys(item)) {
        if (![...EXCLUDED_KEYS, 'contacts'].includes(key) && !!item[key]) {
            contact[key] = item[key];
        }
        if (retainReference) {
            contact._id = item._id;
        }
    }
    return contact;
};

// adapted from medic-conf
const minifyLineage = lineage => {
    if (!lineage || !lineage._id) {
        return undefined;
    }

    const result = {
        _id: lineage._id,
        parent: minifyLineage(lineage.parent),
    };

    return JSON.parse(JSON.stringify(result));
};

const logPouchDBResults = results => {
    for (const result of results) {
        if (result.ok) {
            console.log(info(`Doc: ${result.id} saved successfully`));
        } else {
            console.log(error(`An error occurred while saving Doc: ${result.id}. Error: ${result.error}. Status: ${result.status}`));
        }
    }
};

const moveCasesToCounty = async (db, newCases, counties) => {
    const existingCases = await getCases(db);
    newCases.forEach(async item => {
        const docsToCreate = [];
        const covidCase = existingCases[item._id];
        const newCase = createNewCaseDocument(item);

        //delete report from EMR
        docsToCreate.push({ _id: item._id, _rev: item._rev, _deleted: true });

        if (!covidCase) {
            if (!newCase.county) {
                console.log(warn(`Case with KenyaEMR Reference: ${item._id} has no county set`));
                return;
            }
            const countyMatcher = new RegExp(newCase.county, 'i');

            const parent = counties.filter(county => countyMatcher.test(county.name))[0];

            if (!parent) {
                console.log(warn(`Parent not found for Case: <${item._id}>. County not found`));
                return;
            }


            newCase.parent = minifyLineage({ _id: parent._id, parent: parent.parent });
            // save case to database
            docsToCreate.push(newCase);

            console.log(info(`Effecing move for Case ID: <${newCase._id}> KEMR REF: <${newCase.kemr_uuid}> to <${parent.name}>`));
            const results = await db.bulkDocs(docsToCreate);
            logPouchDBResults(results);
        } else {
            console.log(info(`Found case ${covidCase._id} for KenyaEMR Reference: ${item._id}`));
            const contactLineage = minifyLineage(Object.assign({}, { _id: covidCase._id, parent: covidCase.parent }));
            if (newCase.contacts && newCase.contacts.length > 0) {
                newCase.contacts.forEach(newContact => {
                    const contact = extractContactDetails(newContact, true);
                    contact.parent = contactLineage;
                    contact.kemr_uuid = covidCase.kemr_uuid;
                    docsToCreate.push((contact));
                    docsToCreate.push(createMutingDocument(contact));
                });
                const results = await db.bulkDocs(docsToCreate);
                logPouchDBResults(results);
            }
        }
    });
};

const createMutingDocument = item => {
    return {
        _id: uuidv4(),
        fields: {
            patient_id: item._id,
            reported_date: getUTCTimestamp()
        },
        type: 'data_record',
        content_type: 'xml',
        form: 'trigger_muting',
        reported_date: getUTCTimestamp(),
    }
};

const effectAssignmentOfCases = async (db, cases) => {
    cases.forEach(async item => {
        const docsToCreate = [];
        if (!item.assignee) {
            console.log(warn(`Case ID: <${item._id}> KEMR REF: <${item.kemr_uuid}> Case Name: <${item.case_name}> not yet assined to a tracer`));
            return;
        };

        // delete the case we are moving
        docsToCreate.push({ _id: item._id, _rev: item._rev, _deleted: true });

        // get new parent
        const parentPlace = await db.get(item.assignee);
        const caseLineage = minifyLineage(Object.assign({}, { _id: parentPlace._id, parent: parentPlace.parent }));

        const allocatedCovidCase = {
            _id: uuidv4(),
            case_id: item.case_id,
            name: item.name,
            kemr_uuid: item.kemr_uuid,
            county: item.county,
            sub_county: item.subcounty,
            parent: caseLineage,
            type: 'contact',
            contact_type: 'trace_case',
            reported_date: item.reported_date,
        };

        const contactLineage = Object.assign({}, { _id: allocatedCovidCase._id, parent: caseLineage });

        docsToCreate.push(allocatedCovidCase);

        item.contacts.forEach(contactData => {
            const contact = extractContactDetails(contactData, true);
            contact.parent = contactLineage;
            contact.kemr_uuid = allocatedCovidCase.kemr_uuid;
            docsToCreate.push(contact);
        });
        docsToCreate.push(createMutingDocument(allocatedCovidCase));


        if (docsToCreate.length > 0) {
            console.log(info(`Effecting assignment of Case: ${allocatedCovidCase._id} with KEMR Reference: ${allocatedCovidCase.kemr_uuid}`))
            const results = await db.bulkDocs(docsToCreate);
            logPouchDBResults(results);
        }
    });
}


const updater = async () => {
    let seqNumber = await getSeqNumber(cache);
    const counties = await getCounties(couchdb);

    console.log(info(`Processing from Sequence Number: ${seqNumber.substring(0, 61)}`));

    const result = await getChangesAndLastSeq(couchdb, seqNumber);
    const docs = await getDocsFromChangeSet(couchdb, result.changeSet);

    const casesFromKEMR = docs.filter(doc => doc.type === 'data_record' && doc.form === 'case_information');
    await moveCasesToCounty(couchdb, casesFromKEMR, counties);

    const casesToAllocate = docs.filter(doc => doc.type === 'contact' && doc.contact_type === 'forwarded_case');
    await effectAssignmentOfCases(couchdb, casesToAllocate);

    await updateSeqNumber(cache, result.seqNumber);
    //console.log(`${seqNumber} ==>>> ${result.seqNumber}`);

    return new Promise((resolve, reject) => setTimeout(updater, SLEEP_DELAY));
};

(async () => {
    updater();
})();