const shared = require('./shared');
const {
  differenceInDaysFromNow
} = shared;

module.exports = [
  {
    id: 'travellers-surveilled-this-month',
    type: 'count',
    icon: 'icon-calendar',
    goal: 1,
    translation_key: 'targets.surveilled.percent',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.contact && (!c.contact.outbreak_case_id || !c.contact.relation_to_case),
    date: 'reported'
  },
  {
    id: 'travellers-contact-listing-this-month',
    type: 'count',
    icon: 'icon-healthcare',
    goal: 1,
    translation_key: 'targets.contact_listing.count',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.contact && (c.contact.outbreak_case_id !== '' || c.contact.relation_to_case !== ''),
    date: 'reported'
  },
  // TODO .. add this field to the forms
  {
    id: 'travellers-referred-this-month',
    type: 'percent',
    icon: 'icon-healthcare',
    goal: 100,
    translation_key: 'targets.contact_follow_up.percent',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.reports.some((report) => report.form === 'contact_follow_up' && 
      differenceInDaysFromNow(Utils.getField(report,'date_of_last_contact')) < 15),
    passesIf: (c) => c.contact && c.reports.some((report) => report.form === 'contact_follow_up' &&
      Utils.getField(report, 'group_follow_up.is_available') === 'yes'),
    date: 'reported'
  },
  {
    id: 'travellers-with-symptoms',
    type: 'percent',
    icon: 'icon-healthcare',
    goal: 100,
    translation_key: 'targets.travellers_with_symptoms.percent',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.contact && c.reports.some((report) => report.form === 'contact_follow_up' &&
      differenceInDaysFromNow(Utils.getField(report,'date_of_last_contact')) < 15),
    passesIf: (c) => c.reports.some((report) => report.form === 'contact_follow_up' && 
      Utils.getField(report,'has_symptoms_only') === 'true'),
    date: 'reported'
  },
  // 6
  {
    id: 'travellers-without-symptoms',
    type: 'count',
    icon: 'icon-healthcare',
    goal: 1,
    translation_key: 'targets.traveller_no_symptoms.count',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: undefined,
    emitCustom: (emitTargetInstance, instance, contact) => {
      if (c.contact.type === 'person' && c.contact.has_symptoms === 'false'){
        instance._id = contact.contact._id + '-' + 'travellers-without-symptoms';
        emitTargetInstance(instance);
      }
      const travellerSurveillanceReports = contact.reports.filter(report => report.form === 'traveller_surveillance' &&  Utils.getField(report,'has_symptoms') === 'false');
      for (let report of travellerSurveillanceReports){
        instance._id = report._id + '-' + 'travellers-without-symptoms';
        emitTargetInstance(instance);
      }
      const labReports = contact.reports.filter(report => report.form === 'laboratory_information' &&  Utils.getField(report,'lab_information.preliminary_results') === 'neg');
      for (let report of labReports){
        instance._id = report._id + '-' + 'travellers-without-symptoms';
        emitTargetInstance(instance);
      }
    },
    date: 'reported'
  },
  {
    id: 'travellers-on-self-quarantine',
    type: 'percent',
    icon: 'icon-healthcare',
    goal: 100,
    translation_key: 'targets.self_quarantine.percent',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.contact && c.reports.some((report) => report.form === 'self_quarantine'),
    passesIf: (c) => c.reports.some((report) => report.form === 'self_quarantine' && 
      differenceInDaysFromNow(Utils.getField(report.reported_date)) <= 3),
    date: 'reported'
  },
  {
    id: 'travellers-on-self-quarantine-symptomatic',
    type: 'percent',
    icon: 'icon-healthcare',
    goal: 100,
    translation_key: 'targets.self_quarantine_symptomatic.percent',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.contact && c.reports.some((report) => report.form === 'self_quarantine'
    && parseInt(Utils.getField(report,'group_follow_up.days_in_quarantine')) < 15 && Utils.getField(report,'exited') === 'false'),
    passesIf: (c) => c.reports.some((report) => report.form === 'self_quarantine' && 
      Utils.getField(report,'has_symptoms') === 'true'),
    date: 'reported'
  },
  {
    id: 'travellers-exited',
    type: 'count',
    icon: 'icon-healthcare',
    goal: 1,
    translation_key: 'targets.self_quarantine_exited.count',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.contact && c.reports.some((report) => report.form === 'self_quarantine' &&
      Utils.getField(report,'exited') === 'true'),
    date: 'reported'
  },
  {
    id: 'travellers-identified-with-symptoms',
    type: 'count',
    icon: 'icon-healthcare',
    goal: 1,
    translation_key: 'targets.persons_identified.count',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: undefined,
    emitCustom: (emitTargetInstance, instance, contact) => {
      if (c.contact.type === 'person' && c.contact.has_symptoms === 'true'){
        instance._id = contact.contact._id + '-' + 'travellers-identified-with-symptoms';
        emitTargetInstance(instance);
      }
      const symptomsReports = contact.reports.filter(report => (report.form === 'traveller_surveillance' || report.form === 'self_quarantine' || report.form === 'contact_follow_up') &&  Utils.getField(report,'has_symptoms') === 'true');
      for (let report of symptomsReports){
        instance._id = report._id + '-' + 'travellers-identified-with-symptoms';
        emitTargetInstance(instance);
      }
    },
    date: 'reported'
  },
  {
    id: 'travellers-investigated',
    type: 'percent',
    icon: 'icon-healthcare',
    goal: 100,
    translation_key: 'targets.case_investigation.percent',
    subtitle_translation_key: 'targets.this_month.subtitle',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: (c) => c.contact && c.reports.some((report) => report.form === 'case_investigation'),
    passesIf: (c) => c.reports.some((report) => report.form === 'case_investigation' && 
      Utils.getField(report,'group_laboratory_information.was_specimen_collected') === 'yes'),
    date: 'reported'
  },   
];


