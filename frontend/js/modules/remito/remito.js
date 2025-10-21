// remito.js (stub)
// Minimal, single-purpose stub that preserves the module API so other modules
// can import `createRemitoModule` without runtime errors while we reset remitos.

export function createRemitoModule(options = {}) {
    // keep `options` available for compatibility with callers
    void options;
    let lastSavedReport = null;

    function initialize() {
        // No UI initialization in the archived branch.
    }

    function handleMaintenanceSaved(report) {
        lastSavedReport = report ? JSON.parse(JSON.stringify(report)) : null;
    }

    function reset() {
        lastSavedReport = null;
    }

    function handleGenerarRemitoClick() {
        return false; // indicates action not performed
    }

    async function handleFinalizarRemitoClick() {
        return { result: 'archived', message: 'Remito functionality archived in this branch.' };
    }

    function setLastSavedReportForTests(data) {
        lastSavedReport = data ? JSON.parse(JSON.stringify(data)) : null;
    }

    function getLastSavedReportForTests() {
        return lastSavedReport;
    }

    return {
        initialize,
        handleMaintenanceSaved,
        reset,
        handleGenerarRemitoClick,
        handleFinalizarRemitoClick,
        setLastSavedReportForTests,
        getLastSavedReportForTests,
    };
}
