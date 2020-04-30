const shared = require('./shared');
const {
    getField,
    differenceInYears,
    MS_IN_DAY,
    now,
    sortReports,
    isEligibleForTasks
} = shared;

function isFormArraySubmittedInWindow(reports, formArray, dueDate, event, count, sourceID) {
    var found = false;
    var reportCount = 0;

    const start = Utils.addDate(dueDate, -event.start).getTime();
    const end = Utils.addDate(dueDate, event.end + 1).getTime();

    reports.forEach(function (report) {
        if (formArray.includes(report.form)) {
            if (report.reported_date >= start && report.reported_date <= end) {
                if (sourceID) {
                    if (getField(report, 'inputs.source_id') === sourceID) {
                        found = true;

                        if (count) {
                            reportCount++;
                        }
                    }
                } else {
                    found = true;

                    if (count) {
                        reportCount++;
                    }
                }
            }
        }
    });

    if (count) { return reportCount >= count; }
    return found;
}

function getNextAncVisitDate(event, c, report) {
    if (report.form === 'monthly_screening' && !!report.fields.group_anc.next_anc_visit_date) {
        return new Date(report.fields.group_anc.next_anc_visit_date);
    }
}

function getNextAncFollowUpDate(event, c, report) {
    if (report.form === 'monthly_screening' && !!report.fields.group_anc.next_anc_follow_up_date) {
        let delta = parseInt(report.fields.group_anc.anc_follow_up_delta);
        // Add one day if the follow up date is less than two days into the future
        return new Date(new Date(report.fields.group_anc.next_anc_follow_up_date).getTime() + (delta < 2 ? MS_IN_DAY: 0));
    }
}

function getNewestPregnancyTimestamp(c) {
    return Utils.getMostRecentTimestamp(c.reports, 'pregnancy');
}

function getNewestPregnancyVisitTimestamp(c) {
    return Utils.getMostRecentTimestamp(c.reports, 'pregnancy_follow_up');
}

function getNewestImmVisitTimestamp(c) {
    return Utils.getMostRecentTimestamp(c.reports, 'immunization_and_growth_monitoring');
}

function isNewestPregnancy(c, r) {
    return r.form === 'pregnancy' && r.reported_date === getNewestPregnancyTimestamp(c);
}

function getNewestDeliveryTimestamp(c) {
    var newestDelivery = Utils.getMostRecentReport(c.reports, 'delivery');
    return newestDelivery ? newestDelivery.reported_date : 0;
}

function isNewestPregnancyVisit(c, r) {
    return r.form === 'pregnancy_follow_up' && r.reported_date === getNewestPregnancyVisitTimestamp(c);
}

function getNewestEdd(c) {
    //TODO: Fix form references
    // Defaulted to empty object to bypass null errors
    var newestPregnancy = Utils.getMostRecentReport(c.reports, 'pregnancy') || {};
    var newestPregnancyVisit = Utils.getMostRecentReport(c.reports, 'pregnancy_follow_up') || {};
    //console.log(newestPregnancy, newestPregnancyVisit);
    return newestPregnancyVisit.reported_date > newestPregnancy.reported_date && getField(newestPregnancyVisit, 'edd') !== '' ? getField(newestPregnancyVisit, 'edd') : getField(newestPregnancy, 'edd');
}

const isUnder5 = (contact) => differenceInYears(contact.date_of_birth, now) < 5;

const isMalnourished = (reports) => {
    const malnutritionReports = [];
    malnutritionReports.push(Utils.getMostRecentReport(reports, 'malnutrition_screening') || {});
    malnutritionReports.push(Utils.getMostRecentReport(reports, 'malnutrition_referral_follow_up') || {});
    malnutritionReports.push(Utils.getMostRecentReport(reports, 'malnutrition_follow_up') || {});

    const assessment = reports.filter((report) =>
        report.form === 'assessment' &&
        getField(report, 'group_malnutrition.on_malnutrition_follow_up') === 'yes'
    ).sort(sortReports).pop();

    malnutritionReports.push(assessment);

    const mostRecentReport = malnutritionReports.sort(sortReports).pop();

    if (!mostRecentReport) return false;
    if (mostRecentReport.form === 'malnutrition_screening') {
        return getField(mostRecentReport, 'group_screening.on_follow_up') === 'yes';
    } else if (['group_follow_up', 'malnutrition_referral_follow_up'].includes(mostRecentReport.form)) {
        if (getField(mostRecentReport, 'group_follow_up.visited') === 'yes') {
            if (getField(mostRecentReport, 'group_follow_up.nutrition') === 'malnutritioned' ||
                getField(mostRecentReport, 'group_follow_up.outcome') === 'follow_up') {
                return true;
            }
        }
        // if they did not visit the facility, consider them as still malnourished
        return true;
    } else if (mostRecentReport.form === 'assessment') {
        return true;
    }
};

const needsReferral = (reports) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfThisMonth = new Date(today.setDate(1));
    const hadAssessmentReferral = reports.some((report) => {
        report.form === 'assessment' &&
        report.reported_date >= firstOfThisMonth.getTime() &&
        (getField(report, 'group_assessment.has_assessment_danger_signs') === 'true' ||
            getField(report, 'group_malnutrition.has_malnutrition_danger_signs') === 'true' ||
            getField(report,'group_newborn_danger_signs.has_newborn_danger_signs') === 'true'
        );
    });

    const hadMalnutritionReferral = reports.some((report) =>
        report.form === 'malnutrition_screening' &&
        report.reported_date >= firstOfThisMonth.getTime() &&
        getField(report, 'group_screening.needs_referral') === 'true'
    );

    return hadAssessmentReferral || hadMalnutritionReferral;
};



function isNewestImmVisit(c, r) {
    return r.form === 'immunization_and_growth_monitoring' && r.reported_date === getNewestImmVisitTimestamp(c);
}

module.exports = {
    isEligibleForTasks,
    isFormArraySubmittedInWindow,
    getNextAncFollowUpDate,
    getNextAncVisitDate,
    getField,
    getNewestPregnancyTimestamp,
    isNewestPregnancy,
    getNewestDeliveryTimestamp,
    isNewestPregnancyVisit,
    now,
    MS_IN_DAY,
    getNewestEdd,
    isUnder5,
    isNewestImmVisit,
    isMalnourished,
    needsReferral
};