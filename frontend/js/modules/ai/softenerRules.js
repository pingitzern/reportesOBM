/**
 * Reglas de negocio para validación de reportes de ablandadores.
 * Estas reglas se ejecutan LOCALMENTE (sin llamar a Gemini) para dar feedback instantáneo.
 * 
 * Estructura del payload de collectFormData():
 * - seccion_A: Cliente (nombre, direccion, telefono, etc.)
 * - seccion_B: Equipo (tipo, modelo, volumen_resina, prefiltro, etc.)
 * - seccion_B_parametros: (presion_entrada_as_found/left, dureza_salida, test_cloro)
 * - seccion_C: Autonomía (dureza_agua_cruda, autonomia_recomendada, etc.)
 * - seccion_D: Checklist (cambio_filtro_realizado, regeneracion_manual, etc.)
 * - seccion_E: Resumen (trabajo_realizado, recomendaciones, etc.)
 * - seccion_F: Condiciones (presion_entrada_as_found/left, presion_salida_as_found/left, nivel_sal, etc.)
 * - seccion_G: Conformidad
 */

// Constantes de umbrales
const THRESHOLDS = {
    MAX_DUREZA_SIN_ALERTA: 150, // ppm
    MAX_DIFERENCIA_PRESION: 1.0, // bar (entrada - salida)
};

/**
 * Verifica todas las reglas y retorna un array de alertas
 * @param {Object} data - Datos del formulario (resultado de collectFormData)
 * @returns {Array<{type: 'warning'|'error'|'tip', message: string, field?: string}>}
 */
export function checkSoftenerRules(data) {
    const alerts = [];

    // Extraer secciones
    const secA = data?.seccion_A || {};
    const secB = data?.seccion_B || {};
    const secC = data?.seccion_C || {};
    const secD = data?.seccion_D || {};
    const secE = data?.seccion_E || {};
    const secF = data?.seccion_F || {};

    // También verificar campos de nivel superior
    const clienteNombre = data?.cliente || secA?.nombre || '';

    // === REGLA 1: Campos obligatorios - Cliente ===
    if (!clienteNombre || clienteNombre.trim() === '') {
        alerts.push({
            type: 'error',
            message: 'Falta seleccionar el cliente.',
            field: 'cliente'
        });
    }

    // === REGLA 2: Dureza vs Autonomía ===
    const dureza = parseFloat(secC?.dureza_agua_cruda) || 0;
    const volumenResina = parseFloat(secB?.volumen_resina) || 0;
    const autonomia = parseFloat(secC?.autonomia_recomendada) || 0;

    if (dureza > 0 && volumenResina > 0 && autonomia > 0) {
        // Fórmula aproximada: Autonomía esperada = (volumen_resina * capacidad_resina) / dureza
        // Para resina standard: ~1500 granos/litro, 1 grano = 17.1 ppm
        const capacidadGranos = volumenResina * 1500;
        const autonomiaEsperada = (capacidadGranos * 17.1) / dureza;

        if (autonomia < autonomiaEsperada * 0.3) {
            alerts.push({
                type: 'warning',
                message: `La autonomía (${autonomia.toLocaleString()}L) parece muy baja para ${volumenResina}L de resina con dureza ${dureza}ppm.`,
                field: 'autonomia'
            });
        }
    }

    // === REGLA 3: Prefiltro vs Filtro Cambiado (modo simple) ===
    const prefiltroConfigurado = secB?.prefiltro || '';
    const seCambioFiltro = secD?.cambio_filtro_realizado === true;
    const filtroCambiado = secD?.filtro_tipo_instalado || '';

    if (seCambioFiltro && filtroCambiado && prefiltroConfigurado) {
        const prefiltroNorm = prefiltroConfigurado.toLowerCase().replace(/[^a-záéíóú]/g, '');
        const cambiadoNorm = filtroCambiado.toLowerCase().replace(/[^a-záéíóú]/g, '');

        if (prefiltroNorm !== cambiadoNorm &&
            !prefiltroNorm.includes('no') &&
            !cambiadoNorm.includes('no')) {
            alerts.push({
                type: 'warning',
                message: `El filtro configurado (${prefiltroConfigurado}) difiere del cambiado (${filtroCambiado}). ¿Es correcto?`,
                field: 'filtro'
            });
        }
    }

    // === REGLA 4: Presiones (seccion_F) ===
    const presionEntradaLeft = parseFloat(secF?.presion_entrada_as_left) || 0;
    const presionSalidaLeft = parseFloat(secF?.presion_salida_as_left) || 0;

    if (presionEntradaLeft > 0 && presionSalidaLeft > 0) {
        if (presionSalidaLeft > presionEntradaLeft) {
            alerts.push({
                type: 'error',
                message: `La presión de salida (${presionSalidaLeft} bar) es MAYOR que la de entrada (${presionEntradaLeft} bar). Esto es físicamente imposible.`,
                field: 'presion'
            });
        }

        const deltaPAlto = presionEntradaLeft - presionSalidaLeft;
        if (deltaPAlto > THRESHOLDS.MAX_DIFERENCIA_PRESION) {
            alerts.push({
                type: 'warning',
                message: `La caída de presión (${deltaPAlto.toFixed(2)} bar) es alta. Puede indicar obstrucción en el equipo.`,
                field: 'deltaP'
            });
        }
    }

    // === REGLA 5: Dureza alta sin tratamiento ===
    if (dureza > THRESHOLDS.MAX_DUREZA_SIN_ALERTA) {
        alerts.push({
            type: 'tip',
            message: `La dureza del agua (${dureza} ppm) es alta. Considerar aumentar frecuencia de regeneración.`,
            field: 'dureza'
        });
    }

    // === REGLA 6: Nivel de sal bajo ===
    const nivelSalLeft = (secF?.nivel_sal_as_left || '').toLowerCase();
    if (nivelSalLeft === 'bajo' || nivelSalLeft.includes('bajo')) {
        alerts.push({
            type: 'warning',
            message: 'El nivel de sal quedó BAJO. Recordar al cliente que debe reponer sal.',
            field: 'sal'
        });
    }

    // === REGLA 7: Trabajo realizado vacío ===
    const trabajoRealizado = secE?.trabajo_realizado || '';
    if (!trabajoRealizado.trim()) {
        alerts.push({
            type: 'tip',
            message: 'El campo "Trabajo Realizado" está vacío. Podés usar el botón ✨ para que la IA lo genere.',
            field: 'resumen'
        });
    }

    // === REGLA 8: Dureza de salida alta ===
    const durezaSalidaLeft = parseFloat(data?.seccion_B_parametros?.dureza_salida_as_left) || 0;
    if (durezaSalidaLeft > 10) {
        alerts.push({
            type: 'warning',
            message: `La dureza de salida (${durezaSalidaLeft} ppm) es alta. El ablandador podría no estar regenerando correctamente.`,
            field: 'dureza_salida'
        });
    }

    // === REGLA 9: Regeneración manual sin motivo ===
    const regeneracionManual = secD?.regeneracion_manual === true;
    const observaciones = secD?.observaciones || '';
    if (regeneracionManual && !observaciones.trim()) {
        alerts.push({
            type: 'tip',
            message: 'Se realizó regeneración manual. Considerar documentar el motivo en observaciones.',
            field: 'regeneracion'
        });
    }

    return alerts;
}

/**
 * Genera un prompt para que Gemini cree el resumen del reporte
 */
export function buildSummaryPrompt(data, memoryContext = []) {
    let memoryText = "";
    if (memoryContext.length > 0) {
        memoryText = "NOTAS ESPECIALES DE ESTE CLIENTE/EQUIPO:\n" +
            memoryContext.map(m => `- ${m}`).join('\n') + "\n\n";
    }

    const secA = data?.seccion_A || {};
    const secB = data?.seccion_B || {};
    const secC = data?.seccion_C || {};
    const secD = data?.seccion_D || {};
    const secF = data?.seccion_F || {};

    return `
Sos un técnico senior redactando el resumen de un reporte de mantenimiento de ablandador de agua.

${memoryText}

DATOS DEL REPORTE:
- Cliente: ${data?.cliente || secA?.nombre || 'No especificado'}
- Equipo: ${secB?.tipo || 'Ablandador'} - ${secB?.modelo || 'Standard'}
- Volumen resina: ${secB?.volumen_resina || '?'}L
- Dureza agua cruda: ${secC?.dureza_agua_cruda || '?'} ppm
- Autonomía configurada: ${secC?.autonomia_recomendada || '?'} litros
- Nivel sal dejado: ${secF?.nivel_sal_as_left || '?'}
- Se cambió filtro: ${secD?.cambio_filtro_realizado ? 'Sí' : 'No'}
- Regeneración manual: ${secD?.regeneracion_manual ? 'Sí' : 'No'}
- Presión entrada: ${secF?.presion_entrada_as_left || '?'} bar
- Presión salida: ${secF?.presion_salida_as_left || '?'} bar

GENERA:
1. Un párrafo de 2-3 oraciones describiendo el trabajo realizado.
2. Una recomendación breve para el cliente (si aplica).

Usá un tono profesional pero amigable. Sé conciso. No uses asteriscos ni formato markdown.
    `.trim();
}
