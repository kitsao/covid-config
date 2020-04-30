const {
  hasExited,
  newestSelfQuarantineTimestamp,
} = require('./contact-summary-extras');

const fields = [
    { appliesToType: 'person', appliesIf: () => { return !!contact.patient_id; }, label: 'patient_id', value: contact.patient_id, width: 4 },
    { appliesToType: 'person', label: 'contact.age', value: contact.date_of_birth, width: 4, filter: 'age' },
    { appliesToType: 'person', label: 'contact.sex', value: 'contact.sex.' + contact.sex, translate: true, width: 4 },
    { appliesToType: 'person', label: 'contact.phone', value: contact.phone, width: 4 },
    { appliesToType: 'person', appliesIf: () => { return !!contact.alternate_phone; }, label: 'contact.alternate_phone', value: contact.alternate_phone, width: 4 },
    { appliesToType: 'person', appliesIf: () => { return !!contact.external_id; }, label: 'External ID', value: contact.external_id, width: 4 },
    { appliesToType: 'person', label: 'contact.parent', value: lineage, filter: 'lineage' },
    { appliesToType: '!person', appliesIf: () => { return contact.contact_type !== 'forwarded_case'; }, label: 'Contact', value: contact.contact && contact.contact.name, width: 4 },
    { appliesToType: '!person', appliesIf: () => { return contact.contact_type !== 'forwarded_case'; }, label: 'contact.phone', value: contact.contact && contact.contact.phone, width: 4 },
    { appliesToType: '!person', appliesIf: () => { return !!contact.external_id; }, label: 'External ID', value: contact.external_id, width: 4 },
    { appliesToType: '!person', appliesIf: () => { return contact.parent && lineage[0]; }, label: 'contact.parent', value: lineage, filter: 'lineage' },
    { appliesToType: '!person', appliesIf: () => { return contact.contact_type === 'trace_case' || contact.contact_type === 'forwarded_case' ; }, label: 'Case ID', value: contact.case_id, width: 4 },
    { appliesToType: '!person', appliesIf: () => { return contact.contact_type === 'trace_case' || contact.contact_type === 'forwarded_case'; }, label: 'Case Name', value: contact.name, width: 4 },
    { appliesToType: '!person', appliesIf: () => { return contact.contact_type === 'trace_case' || contact.contact_type === 'forwarded_case'; }, label: 'Case Confirmation Date', value: contact.case_confirmation_date, width: 4, filter: 'age' },
    { appliesToType: '!person', appliesIf: () => { return contact.contact_type === 'forwarded_case'; }, label: 'Assigned to tracer?', value: !contact.assignee? 'No' : 'Yes' },
		
];

const selfQuarantineForms = reports.filter(hasExited);

fields.push({
  appliesToType: 'person',
  appliesIf: () => selfQuarantineForms.length > 0,
  label: 'Exited',
  value: newestSelfQuarantineTimestamp(selfQuarantineForms),
  filter: 'simpleDate',
  translate: true
});

module.exports = {
    fields,
    cards: []
};