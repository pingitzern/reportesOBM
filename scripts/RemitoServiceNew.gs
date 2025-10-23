// New scaffold for RemitoService server-side
// This file is a placeholder for the new remitos implementation.

const RemitoServiceNew = {
  crearRemito(reporteData, observaciones, usuarioMail, fotos) {
    // Minimal server-side contract:
    // - should validate inputs
    // - should store photos to Drive and produce a PDF (or Doc fallback)
    // For now, return a not-implemented response.
    return { message: 'RemitoServiceNew not implemented', implemented: false };
  },

  obtenerRemitos(page = 1, pageSize = 20) {
    return { remitos: [], page, pageSize };
  }
};
