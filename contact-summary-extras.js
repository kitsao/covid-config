const { getField } = require('./shared');

module.exports = {
	hasExited: report => report && (report.form === 'self_quarantine' && getField(report, 'exited') === 'true'),
	newestSelfQuarantineTimestamp: SelfQuarantineReports => SelfQuarantineReports.reduce((previous, report) => Math.max(report.reported_date, previous), -1)
};