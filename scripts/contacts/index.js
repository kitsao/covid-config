const { URL } = require('url');
const fs = require('fs');
const PouchDB = require('pouchdb-core');
PouchDB.plugin(require('pouchdb-adapter-http'));
PouchDB.plugin(require('pouchdb-mapreduce'));


if (!process.env.COUCH_URL) throw new Error('COUCH_URL env var not set.');

let COUCH_URL;
try {
    COUCH_URL = new URL(process.env.COUCH_URL);

    if (COUCH_URL.pathname !== '/medic') {
        COUCH_URL.pathname = '/medic';
    }
} catch (err) {
    console.error(`You need to define a valid COUCH_URL`);
    process.exit(-1);
}

(async () => {
    const getParents = async (DB) => {
        const options = {
            include_docs: true,
            startkey: ['sub_county_office'],
            endkey: ['sub_county_office\ufff0'],
        }

        const result = await DB.query('medic-client/contacts_by_type', options);
        if (result.rows.length === 0) return [];
        return result.rows.map(row => row.doc);
    }
    const getFormsFromKenyaEMR = async (DB) => {
        const options = {
            startkey: ['pregnancy'],
            endkey: ['pregnancy\ufff0'],
            include_docs: true,
            reduce: false
        };

        const result = await DB.query('medic-client/reports_by_form', options);
        if (result.rows.length === 0) return [];
        return result.rows.map(row => row.doc);
    }

    try {
        const DB = new PouchDB(COUCH_URL.href);
        const subcounties = await getParents(DB);
        const docsFromKenyaEMR = await getFormsFromKenyaEMR(DB);
        console.log(subcounties);

    } catch (err) {
        console.log(err);
    }


})();