const shared = require('./shared');
const {
    isFormArraySubmittedInWindow,
    getField,
    MS_IN_DAY,
    now,
    hasSymptoms,
    latestReportHasField,
    calculateEventIndex
} = shared;

module.exports = [
    {
        icon: 'icon-follow-up',
        name: 'case-investigation-registration',
        title: 'task.case_investigation.title',
        appliesTo: 'contacts',
        appliesToType: ['person'],
        appliesIf: (c) => hasSymptoms(c),
        actions: [{ form: 'case_investigation' }],
        events: [{ days: 0, start: 0, end: 7 }],
        resolvedIf: (c, report, event, dueDate) => isFormArraySubmittedInWindow(c.reports, ['case_investigation'], dueDate, event, null)
    },
    {
        icon: 'icon-follow-up',
        name: 'self-monitored-quarantine-registration',
        title: 'task.self_monitored_quarantine.title',
        appliesTo: 'contacts',
        appliesToType: ['person'],
        appliesIf: (c) => !hasSymptoms(c),
        actions: [{ form: 'self_quarantine' }],
        // events: [{days: 0, start:0, end: 1}],
        events: (() => {
            let contents = [];
            for (let i = 1; i <= 14; i++) {
                contents.push({
                    id: `self-monitoring-${i}`,
                    days: i,
                    start: 0,
                    end: 0,
                });
            }
            return contents;
        })(),
        resolvedIf: function (c, report, event, dueDate) {
            return isFormArraySubmittedInWindow(c.reports, ['self_quarantine'], dueDate, event, null) || 
            latestReportHasField(c, 'self_quarantine', 'has_symptoms', 'true');
        },
    },
    {
        icon: 'icon-follow-up',
        name: 'case-investigation-surveillance-symptomatic',
        title: 'task.case_investigation.title',
        appliesTo: 'reports',
        appliesToType: ['traveller_surveillance'],
        appliesIf: (c) => hasSymptoms(c),
        actions: [{ form: 'case_investigation' }],
        events: [{ days: 0, start: 0, end: 7 }],
        resolvedIf: (c, report, event, dueDate) => isFormArraySubmittedInWindow(c.reports, ['case_investigation'], dueDate, event, null, report._id)
    },
    {
        icon: 'icon-follow-up',
        name: 'self-monitored-quarantine-surveillance',
        title: 'task.self_monitored_quarantine.title',
        appliesTo: 'reports',
        appliesToType: ['traveller_surveillance'],
        appliesIf: (c) => !hasSymptoms(c),
        actions: [{ form: 'self_quarantine' }],
        // events: [{days: 0, start:0, end: 7}],
        events: (() => {
            let contents = [];
            for (let i = 1; i <= 14; i++) {
                contents.push({
                    id: `self-monitoring-${i}`,
                    days: i,
                    start: 0,
                    end: 0,
                });
            }
            return contents;
        })(),
        resolvedIf: (c, report, event, dueDate) => isFormArraySubmittedInWindow(c.reports, ['self_quarantine'], dueDate, event, null, report._id) ||
        latestReportHasField(c, 'self_quarantine', 'has_symptoms', 'true')        
    },
    {
        icon: 'icon-follow-up',
        name: 'self-monitored-quarantine-case-investigation',
        title: 'task.self_monitored_quarantine.title',
        appliesTo: 'reports',
        appliesToType: ['lab_results'],
        appliesIf: (c, report) => {
            return report.fields.covid_test_results === 'negative';
        },
        actions: [{ form: 'self_quarantine' }],
        // events: [{days: 0, start:0, end: 7}],
        events: (() => {
            let contents = [];
            for (let i = 1; i <= 14; i++) {
                contents.push({
                    id: `self-monitoring-${i}`,
                    days: i,
                    start: 0,
                    end: 0,
                });
            }
            return contents;
        })(),
        resolvedIf: (c, report, event, dueDate) => isFormArraySubmittedInWindow(c.reports, ['self_quarantine'], dueDate, event, null, report._id)
    },
    // contact follow up 
    {
        icon: 'icon-follow-up',
        name: 'contact-tracing-follow-up',
        title: 'task.contact_follow_up.title',
        appliesTo: 'contacts',
        appliesToType: ['person'],
        actions: [
            {
                form: 'contact_follow_up',
                modifyContent: function (content, contact) {
                    content.t_follow_up_count = calculateEventIndex(this.definition.events, contact);
                }
            }
        ],
        events: (() => {
            let contents = [];
            for (let i = 1; i <= 14; i++) {
                contents.push({
                    id: `contact-follow-up-${i}`,
                    dueDate: (event, c) => {
                        const ms = new Date(getField(c.contact.date_of_last_contact)).getTime() + MS_IN_DAY * i;
                        return new Date(ms);
                    },
                    start: 0,
                    end: 0,
                });
            }
            return contents;
        })(),
        resolvedIf: (c, report, event, dueDate) =>
            latestReportHasField(c, 'contact_follow_up', 'group_follow_up.patient_alive', 'no') ||
            isFormArraySubmittedInWindow(c.reports, ['contact_follow_up', 'case_investigation'], dueDate, event, null)
    },
    // Escallation workflow
    // missed contact follow up escalation - day 7
    {
        icon: 'icon-follow-up',
        name: 'contact-tracing-follow-up-missed-escalation-day7',
        title: 'task.contact_follow_up.title',
        appliesTo: 'contacts',
        appliesToType: ['person'],
        appliesIf: (c) => {
            const event = { start: 0, end: 3 };
            this.dueDate = new Date(new Date(getField(c.contact.date_of_last_contact)).getTime() + MS_IN_DAY * 7);

            return !!c.contact.date_of_last_contact &&
                !isFormArraySubmittedInWindow(c.reports, ['contact_follow_up'], this.dueDate, event, null) &&
                now > this.dueDate &&
                user.parent.type === 'health_center';
        },
        actions: [{ form: 'contact_follow_up' }],
        events: [{ dueDate: () => this.dueDate, start: 0, end: 3 }],
        resolvedIf: function (c, report, event, dueDate) {
            return isFormArraySubmittedInWindow(c.reports, ['contact_follow_up', 'case_investigation'], dueDate, event, null);
        },
    },
    // missed contact follow up escalation - day 14
    {
        icon: 'icon-follow-up',
        name: 'contact-tracing-follow-up-missed-escalation-day14',
        title: 'task.contact_follow_up.title',
        appliesTo: 'contacts',
        appliesToType: ['person'],
        appliesIf: (c) => {
            const event = { start: 14, end: 0 };
            this.dueDate = new Date(new Date(getField(c.contact.date_of_last_contact)).getTime() + MS_IN_DAY * 14);

            return !!c.contact.date_of_last_contact &&
                !isFormArraySubmittedInWindow(c.reports, ['contact_follow_up'], this.dueDate, event, null) &&
                now > this.dueDate &&
                user.parent.type === 'health_center';
        },
        actions: [{ form: 'contact_follow_up' }],
        events: [{ dueDate: () => this.dueDate, start: 0, end: 3 }],
        resolvedIf: function (c, report, event, dueDate) {
            return isFormArraySubmittedInWindow(c.reports, ['contact_follow_up', 'case_investigation'], dueDate, event, null);
        },
    },
    // symptomatic during follow up
    {
        icon: 'icon-follow-up',
        name: 'contact-follow-up-case-investigation',
        title: 'task.case_investigation.title',
        appliesTo: 'reports',
        appliesToType: ['contact_follow_up'],
        appliesIf: (c, report) => {
            return getField(report, 'has_symptoms') === 'true' && user.parent.contact_type === 'rapid_response_office';
        },
        actions: [
            { 
                form: 'case_investigation',
                modifyContent: (content, c, report) => {
                    content.t_id = getField(report, 'inputs.contact._id');
                    content.t_name = getField(report, 'inputs.contact.name');
                    content.t_patient_age_display = getField(report, 'patient_age_display');
                    content.t_date_of_birth = getField(report, 'inputs.contact.date_of_birth');
                    content.t_sex = getField(report, 'inputs.contact.sex');
                    content.t_primary_phone = getField(report, 'inputs.contact.primary_phone');
                    content.t_date_of_last_contact = getField(report, 'inputs.contact.date_of_last_contact');
                    content.t_family_name = getField(report, 'inputs.contact.family_name');
                    content.t_given_names = getField(report, 'inputs.contact.given_names');
                    content.t_country_of_residence = getField(report, 'inputs.contact.country_of_residence');
                    content.t_phone = getField(report, 'inputs.contact.phone');
                    content.t_alternate_phone = getField(report, 'inputs.contact.alternate_phone');
                    content.t_email = getField(report, 'inputs.contact.email');
                    content.t_reside_in_kenya = getField(report, 'inputs.contact.reside_in_kenya');
                    content.t_contact_person_name = getField(report, 'inputs.contact.contact_person_name');
                    content.t_place_location = getField(report, 'inputs.contact.place_location');
                    content.t_sublocation_estate = getField(report, 'inputs.contact.sublocation_estate');
                    content.t_county = getField(report, 'inputs.contact.county');
                    content.t_subcounty = getField(report, 'inputs.contact.subcounty');
                    content.t_town = getField(report, 'inputs.contact.town');
                    content.t_postal_address = getField(report, 'inputs.contact.postal_address');
                    content.t_reported_date = getField(report, 'inputs.contact.reported_date');
                    content.t_patient_id = getField(report, 'inputs.contact.patient_id');
                    content.t_type = getField(report, 'inputs.contact.type');
                    content.t_contact_type = getField(report, 'inputs.contact.contact_type');
                    content.t_parent = getField(report, 'inputs.contact.parent');
                    content.t_arrival_mode = getField(report, 'inputs.contact.arrival_mode');
                    content.t_arrival_date = getField(report, 'inputs.contact.arrival_date');
                    content.t_airline = getField(report, 'inputs.contact.airline');
                    content.t_flight_number = getField(report, 'inputs.contact.flight_number');
                    content.t_seat_number = getField(report, 'inputs.contact.seat_number');
                    content.t_destination_city = getField(report, 'inputs.contact.destination_city');
                    content.t_national_id = getField(report, 'inputs.contact.national_id');
                    content.t_passport_number = getField(report, 'inputs.contact.passport_number');
                    content.t_alien_id = getField(report, 'inputs.contact.alien_id');
                    content.t_c_id_type = getField(report, 'inputs.contact.c_id_type');
                    content.t_id_number =  getField(report, 'inputs.contact.id_number');
                    content.t_role =  getField(report, 'inputs.contact.role');
                }
            }
        ],
        contactLabel: (contact, report) => {
            return getField(report, 'inputs.contact.name');
        },
        events: [{ days: 0, start: 0, end: 7 }],
        resolvedIf: (c, report, event, dueDate) => isFormArraySubmittedInWindow(c.reports, ['case_investigation'], dueDate, event, null, report._id)
    },
];