const REPORT_STORAGE_KEY = 'layer-zero-print-reports-v1';
const MAX_REPORTS = 200;

function safeParseReports(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function getPrintReports() {
    if (typeof window === 'undefined') return [];
    const reports = safeParseReports(localStorage.getItem(REPORT_STORAGE_KEY));
    return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function persistReports(reports) {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports.slice(0, MAX_REPORTS)));
}

export function savePrintReport(report) {
    if (typeof window === 'undefined' || !report) return { saved: false, reason: 'invalid' };
    const reports = getPrintReports();

    const duplicate = reports.find((item) => {
        if (!item || !report) return false;
        const sameFilename = item.filename === report.filename;
        const durationGap = Math.abs((item.durationSec || 0) - (report.durationSec || 0));
        const createdGap = Math.abs(new Date(item.createdAt).getTime() - new Date(report.createdAt).getTime());
        const costGap = Math.abs((item.cost?.total || 0) - (report.cost?.total || 0));
        const bothCompleted = (item.progress || 0) >= 99 && (report.progress || 0) >= 99;
        // 이중 저장 방지 목적만 유지: 같은 완료 리포트가 수초 내 중복 생성될 때만 차단
        return sameFilename && bothCompleted && durationGap <= 8 && costGap <= 10 && createdGap <= 2 * 60 * 1000;
    });

    if (duplicate) {
        return { saved: false, reason: 'duplicate', id: duplicate.id };
    }

    const next = [report, ...reports];
    persistReports(next);
    return { saved: true, id: report.id };
}

export function removePrintReport(reportId) {
    if (typeof window === 'undefined') return;
    const reports = getPrintReports().filter((report) => report.id !== reportId);
    persistReports(reports);
}

export function clearPrintReports() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(REPORT_STORAGE_KEY);
}

export { REPORT_STORAGE_KEY };
