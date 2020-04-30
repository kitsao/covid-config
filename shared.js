const DAYS_IN_YEAR = 365;
const getField = (report, fieldPath) => ['fields', ...(fieldPath || '').split('.')]
    .reduce((prev, fieldName) => {
        if (prev === undefined) return undefined;
        return prev[fieldName];
    }, report);

const differenceInDaysFromNow = (start) => Math.floor((new Date() - new Date(start)) / MS_IN_DAY);
const differenceInDays = (start, end) => Math.floor((new Date(end) - new Date(start)) / MS_IN_DAY);
const differenceInYears = (start, end) => Math.floor(differenceInDays(start, end) / DAYS_IN_YEAR);

const MS_IN_DAY = 24 * 60 * 60 * 1000;  // 1 day in ms
const now = new Date();

const sortReports = (a, b) => a.reported_date - b.reported_date;

const PNC_PERIOD_DAYS = 42;
const MAX_PREGNANCY_AGE_IN_WEEKS = 44;
const isEligibleForTasks = (contact) => !contact.muted && !contact.deceased;
const hasSymptoms = (c) => c.contact.fever === 'yes' || c.contact.difficulty_breathing === 'yes' || c.contact.cough === 'yes';

const isFormArraySubmittedInWindow = (reports, formArray, dueDate, event, count, sourceID) => {
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
};

const isSomeReportInWindow = (reports, formsArray, startTime, endTime) => {
    if (typeof formsArray === 'string') formsArray = [formsArray];
    if (formsArray)
        return formsArray.some(form => Utils.isFormSubmittedInWindow(reports, form, startTime, endTime));
};

const resolveIfClosure_isReportInEventWindow = formTitle => (contact, event, dueDate) => isSomeReportInWindow(
    contact.reports,
    formTitle,
    Utils.addDate(dueDate, -event.start).getTime(),
    Utils.addDate(dueDate, event.end + 1).getTime()
);

const calculateIndexOfEvent = (dueDateForEventsWithout, events, contact, report) => {
    if (!Array.isArray(events)) { throw new Error('Invalid argument events. Array expected'); }

    const now = Utils.now().getTime();
    return events.findIndex(event => {
        const dueDate = event.dueDate ? event.dueDate(event, contact, report) : toDate(dueDateForEventsWithout);
        const days = event.dueDate ? 0 : (event.days || 0);
        const lowerBound = Utils.addDate(dueDate, days - event.start);
        const upperBound = Utils.addDate(dueDate, days + event.end + 1);
        return now >= lowerBound.getTime() && now < upperBound.getTime();
    });
};

const calculateEventIndex = (events, contact, report) => (calculateIndexOfEvent(undefined, events, contact, report) + 1).toString();

const latestReportHasField = (contact, reportName, fieldName, fieldValue, mustBeMoreRecentThan) => {
    const latestReport = Utils.getMostRecentReport(contact.reports, reportName);
  
    // We frequently look at latest reports because we assume they are a potential previous response to the task.
    // This check optionally safeguards against looking at reports which are older than the original report.
    const isRecentEnough = !mustBeMoreRecentThan || !latestReport || !latestReport.fields || latestReport.reported_date > mustBeMoreRecentThan;
    const isFieldMatch = latestReport && !!latestReport.fields && latestReport.fields[fieldName] === fieldValue;
    return isFieldMatch && isRecentEnough;
  };

module.exports = {
    DAYS_IN_YEAR,
    getField,
    differenceInDays,
    differenceInYears,
    differenceInDaysFromNow,
    MS_IN_DAY,
    now,
    sortReports,
    PNC_PERIOD_DAYS,
    MAX_PREGNANCY_AGE_IN_WEEKS,
    isEligibleForTasks,
    isFormArraySubmittedInWindow,
    hasSymptoms,
    resolveIfClosure_isReportInEventWindow,
    calculateEventIndex,
    latestReportHasField
};