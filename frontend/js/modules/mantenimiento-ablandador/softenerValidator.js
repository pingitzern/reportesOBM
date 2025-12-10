/**
 * Sistema de Validación Estática para Formulario de Ablandadores
 * Lee campos directamente del DOM y retorna alertas en tiempo real.
 */

// =========================================================================
// UTILIDADES
// =========================================================================

function getInputValue(id) {
    const el = document.getElementById(id);
    return el?.value?.trim() || '';
}

function getNumberValue(id) {
    const val = parseFloat(getInputValue(id));
    return isNaN(val) ? null : val;
}

function getSelectValue(id) {
    const el = document.getElementById(id);
    return el?.value || '';
}

function isCheckboxChecked(id) {
    const el = document.getElementById(id);
    return el instanceof HTMLInputElement && el.checked;
}

function isElementVisible(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    // Verificar si está visible (no tiene clase hidden y no está oculto por CSS)
    const container = el.closest('[class*="hidden"]');
    return !container;
}

// =========================================================================
// REGLAS DE VALIDACIÓN
// =========================================================================

/**
 * Ejecuta todas las reglas y retorna un array de alertas
 * @returns {Array<{type: 'error'|'warning'|'tip', message: string, fieldId?: string}>}
 */
export function validateSoftenerForm() {
    const alerts = [];

    // -------------------------------------------------------------------------
    // 🚨 ERRORES CRÍTICOS (Bloquean guardado)
    // -------------------------------------------------------------------------

    // 1. Cliente obligatorio
    const clienteNombre = getInputValue('softener-cliente-nombre') || getInputValue('softener-cliente-search');
    if (!clienteNombre) {
        alerts.push({
            type: 'error',
            message: 'Seleccioná un cliente antes de guardar.',
            fieldId: 'softener-cliente-search'
        });
    }

    // 2. Fecha de servicio obligatoria
    const fechaServicio = getInputValue('softener-fecha-servicio');
    if (!fechaServicio) {
        alerts.push({
            type: 'error',
            message: 'Indicá la fecha del servicio.',
            fieldId: 'softener-fecha-servicio'
        });
    }

    // 3. Presión salida > entrada (solo si hay manómetros)
    const tieneManometros = getSelectValue('softener-equipo-manometros');
    const presionesVisibles = tieneManometros && tieneManometros !== 'No cuenta con manómetros';

    if (presionesVisibles) {
        const presionEntradaLeft = getNumberValue('softener-presion-entrada-as-left');
        const presionSalidaLeft = getNumberValue('softener-presion-salida-as-left');

        if (presionEntradaLeft !== null && presionSalidaLeft !== null) {
            if (presionSalidaLeft > presionEntradaLeft) {
                alerts.push({
                    type: 'error',
                    message: `La presión de salida (${presionSalidaLeft} bar) no puede ser mayor que la de entrada (${presionEntradaLeft} bar).`,
                    fieldId: 'softener-presion-salida-as-left'
                });
            }
        }
    }

    // -------------------------------------------------------------------------
    // ⚠️ ADVERTENCIAS (Alertan pero no bloquean)
    // -------------------------------------------------------------------------

    // 4. Nivel de sal bajo al irse
    const nivelSalLeft = getSelectValue('softener-nivel-sal-as-left');
    if (nivelSalLeft === 'Bajo' || nivelSalLeft === 'Crítico') {
        alerts.push({
            type: 'warning',
            message: `El nivel de sal quedó "${nivelSalLeft}". Recordá al cliente que debe reponer.`,
            fieldId: 'softener-nivel-sal-as-left'
        });
    }

    // 5. Dureza de salida alta
    const durezaSalidaLeft = getNumberValue('softener-param-dureza-salida-left');
    if (durezaSalidaLeft !== null && durezaSalidaLeft > 10) {
        alerts.push({
            type: 'warning',
            message: `La dureza de salida (${durezaSalidaLeft} ppm) es alta. El ablandador podría no estar regenerando correctamente.`,
            fieldId: 'softener-param-dureza-salida-left'
        });
    }

    // 6. Alta caída de presión (ΔP > 1 bar)
    if (presionesVisibles) {
        const pEntrada = getNumberValue('softener-presion-entrada-as-left');
        const pSalida = getNumberValue('softener-presion-salida-as-left');

        if (pEntrada !== null && pSalida !== null && pEntrada > pSalida) {
            const deltaP = pEntrada - pSalida;
            if (deltaP > 1.0) {
                alerts.push({
                    type: 'warning',
                    message: `La caída de presión (ΔP = ${deltaP.toFixed(2)} bar) es alta. Puede indicar obstrucción.`,
                    fieldId: 'softener-deltaP-left'
                });
            }
        }
    }

    // 7. Dureza de entrada muy alta (límite de aplicación para ablandadores)
    const durezaEntrada = getNumberValue('softener-dureza-agua-cruda');
    if (durezaEntrada !== null && durezaEntrada >= 650) {
        alerts.push({
            type: 'error',
            message: `⚠️ Dureza del agua (${durezaEntrada} ppm) EXCEDE el límite de aplicación para ablandadores (650 ppm). El sistema puede no funcionar correctamente.`,
            fieldId: 'softener-dureza-agua-cruda'
        });
    }

    // 8. Seteo de autonomía debe coincidir con la recomendada (con o sin factor 20%)
    const autonomiaRecomendada = getNumberValue('softener-autonomia-recomendada');
    const autonomiaSeteo = getNumberValue('softener-autonomia-seteo-actual');
    const factorProteccion = isCheckboxChecked('softener-factor-proteccion');

    if (autonomiaSeteo !== null && autonomiaRecomendada !== null && autonomiaRecomendada > 0) {
        // Calcular los valores válidos (con y sin factor de protección)
        // Nota: autonomiaRecomendada ya tiene aplicado el factor si está tildado
        // Necesitamos calcular el valor sin factor si está aplicado, y viceversa
        const valorConFactor = factorProteccion ? autonomiaRecomendada : autonomiaRecomendada * 0.8;
        const valorSinFactor = factorProteccion ? autonomiaRecomendada / 0.8 : autonomiaRecomendada;

        // Tolerancia del 5% para redondeos
        const tolerancia = 0.05;
        const matchSinFactor = Math.abs(autonomiaSeteo - valorSinFactor) / valorSinFactor <= tolerancia;
        const matchConFactor = Math.abs(autonomiaSeteo - valorConFactor) / valorConFactor <= tolerancia;

        if (!matchSinFactor && !matchConFactor) {
            alerts.push({
                type: 'warning',
                message: `El seteo actual (${autonomiaSeteo} m³) no coincide con la autonomía recomendada. Esperado: ~${autonomiaRecomendada.toFixed(1)} m³${factorProteccion ? '' : ` o ~${valorConFactor.toFixed(1)} m³ (con 20% protección)`}.`,
                fieldId: 'softener-autonomia-seteo-actual'
            });
        }
    }

    // 9. Configuración del cabezal modificada (As Found ≠ As Left) - Requiere justificación
    // Excluye: hora del cabezal y hora de regeneración (esos son ajustes normales)
    // Incluye: P1-P4 y frecuencia en días
    const observacionesAdicionales = getInputValue('softener-condiciones-observaciones');
    const cambiosCabezal = [];

    // Verificar tiempos de ciclo P1-P4
    const ciclosNames = ['P1 Retrolavado', 'P2 Salmuera', 'P3 Enjuague', 'P4 Llenado salero'];
    for (let i = 1; i <= 4; i++) {
        const found = getNumberValue(`softener-cabezal-p${i}-found`);
        const left = getNumberValue(`softener-cabezal-p${i}-left`);
        if (found !== null && left !== null && found !== left) {
            cambiosCabezal.push(`${ciclosNames[i - 1]}: ${found} → ${left} min`);
        }
    }

    // Verificar frecuencia en días (solo si regeneración por tiempo)
    const tipoRegeneracion = getSelectValue('softener-equipo-regeneracion-tipo');
    if (tipoRegeneracion === 'Por Tiempo') {
        const frecFound = getNumberValue('softener-cabezal-frecuencia-dias-found');
        const frecLeft = getNumberValue('softener-cabezal-frecuencia-dias-left');
        if (frecFound !== null && frecLeft !== null && frecFound !== frecLeft) {
            cambiosCabezal.push(`Frecuencia: ${frecFound} → ${frecLeft} días`);
        }
    }

    // Si hay cambios en la configuración del cabezal
    if (cambiosCabezal.length > 0) {
        if (!observacionesAdicionales) {
            // Error si no hay observaciones
            alerts.push({
                type: 'error',
                message: `Se modificó la configuración del cabezal (${cambiosCabezal.join(', ')}). Justificá el cambio en "F. Observaciones adicionales".`,
                fieldId: 'softener-condiciones-observaciones'
            });
        } else {
            // Solo informativo si ya hay observaciones
            alerts.push({
                type: 'tip',
                message: `Cambios en cabezal: ${cambiosCabezal.join(', ')}. Verificá que esté documentado.`,
                fieldId: 'softener-cabezal-p1-left'
            });
        }
    }

    // -------------------------------------------------------------------------
    // 💡 TIPS / SUGERENCIAS
    // -------------------------------------------------------------------------

    // 10. Trabajo realizado vacío
    const trabajoRealizado = getInputValue('softener-resumen-trabajo');
    if (!trabajoRealizado) {
        alerts.push({
            type: 'tip',
            message: 'Completá el campo "Trabajo realizado" antes de guardar.',
            fieldId: 'softener-resumen-trabajo'
        });
    }

    // 11. Sin checklist marcado
    const checkboxIds = [
        'softener-check-fugas',
        'softener-check-limpieza-tanque',
        'softener-check-nivel-agua',
        'softener-check-carga-sal',
        'softener-check-regeneracion-manual',
        'softener-check-cambio-filtro'
    ];
    const algunoMarcado = checkboxIds.some(id => isCheckboxChecked(id));
    if (!algunoMarcado) {
        alerts.push({
            type: 'tip',
            message: '¿No realizaste ninguna tarea? Marcá al menos un ítem del checklist.',
            fieldId: 'softener-check-fugas'
        });
    }

    // 12. Regeneración manual sin observaciones
    const regeneracionManual = isCheckboxChecked('softener-check-regeneracion-manual');
    const observaciones = getInputValue('softener-condiciones-observaciones');
    if (regeneracionManual && !observaciones) {
        alerts.push({
            type: 'tip',
            message: 'Indicaste regeneración manual. Considerá agregar el motivo en observaciones.',
            fieldId: 'softener-condiciones-observaciones'
        });
    }

    // 13. Próximo servicio sin fecha
    const proximoServicio = getInputValue('softener-resumen-proximo-servicio');
    if (!proximoServicio) {
        alerts.push({
            type: 'tip',
            message: 'Considerá programar la fecha del próximo servicio.',
            fieldId: 'softener-resumen-proximo-servicio'
        });
    }

    // =========================================================================
    // SECCIÓN A: Cliente y Servicio
    // =========================================================================

    // 14. Email con formato inválido
    const email = getInputValue('softener-cliente-email');
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        alerts.push({
            type: 'warning',
            message: 'El formato del correo electrónico parece incorrecto.',
            fieldId: 'softener-cliente-email'
        });
    }

    // 15. CUIT con formato inválido (XX-XXXXXXXX-X)
    const cuit = getInputValue('softener-cliente-cuit');
    if (cuit && !cuit.match(/^\d{2}-\d{7,8}-\d$/)) {
        alerts.push({
            type: 'tip',
            message: 'El CUIT debería tener formato XX-XXXXXXXX-X.',
            fieldId: 'softener-cliente-cuit'
        });
    }

    // 16. Técnico no asignado
    const tecnico = getInputValue('softener-tecnico');
    if (!tecnico) {
        alerts.push({
            type: 'tip',
            message: 'Indicá el técnico responsable del servicio.',
            fieldId: 'softener-tecnico'
        });
    }

    // =========================================================================
    // SECCIÓN B: Información del Ablandador
    // =========================================================================

    // 17. Volumen de resina fuera de rango típico
    const volumenResina = getNumberValue('softener-volumen-resina');
    if (volumenResina !== null) {
        if (volumenResina < 5) {
            alerts.push({
                type: 'warning',
                message: `El volumen de resina (${volumenResina}L) es muy bajo. ¿Es correcto?`,
                fieldId: 'softener-volumen-resina'
            });
        } else if (volumenResina > 500) {
            alerts.push({
                type: 'warning',
                message: `El volumen de resina (${volumenResina}L) es muy alto. Verificá el valor.`,
                fieldId: 'softener-volumen-resina'
            });
        }
    }

    // 18. Prefiltro seleccionado pero sin cambio de filtro marcado
    const prefiltro = getSelectValue('softener-equipo-prefiltro');
    const cambioFiltro = isCheckboxChecked('softener-check-cambio-filtro');
    if (prefiltro && prefiltro !== 'No Aplica' && !cambioFiltro) {
        // Solo sugerir si el equipo tiene prefiltro pero no se marcó cambio
        alerts.push({
            type: 'tip',
            message: 'El equipo tiene prefiltro configurado. ¿Corresponde cambiar el filtro?',
            fieldId: 'softener-check-cambio-filtro'
        });
    }

    // 19. Sin protección de entrada instalada
    const proteccionEntrada = getSelectValue('softener-equipo-proteccion-entrada');
    if (proteccionEntrada === 'Sin Protección') {
        alerts.push({
            type: 'warning',
            message: 'El equipo no tiene protección de entrada. Recomendá instalar VRP.',
            fieldId: 'softener-equipo-proteccion-entrada'
        });
    }

    // =========================================================================
    // SECCIÓN C: Cabezal y Autonomía
    // =========================================================================

    // 20. Hora del cabezal no configurada (As Left)
    const horaCabezalLeft = getInputValue('softener-cabezal-hora-cabezal-left');
    const horaRegenLeft = getInputValue('softener-cabezal-hora-regeneracion-left');
    if (!horaCabezalLeft || !horaRegenLeft) {
        alerts.push({
            type: 'tip',
            message: 'Completá las horas del cabezal (As Left) para documentar la configuración final.',
            fieldId: 'softener-cabezal-hora-cabezal-left'
        });
    }

    // 21. Hora de regeneración en horario pico (6-22hs)
    if (horaRegenLeft) {
        const [hora] = horaRegenLeft.split(':').map(Number);
        if (hora >= 6 && hora <= 22) {
            alerts.push({
                type: 'tip',
                message: `La regeneración está programada a las ${horaRegenLeft}. Considerar horario nocturno (02:00-04:00).`,
                fieldId: 'softener-cabezal-hora-regeneracion-left'
            });
        }
    }

    // 22. Tiempos de ciclo fuera de rango típico
    for (let i = 1; i <= 4; i++) {
        const left = getNumberValue(`softener-cabezal-p${i}-left`);
        if (left !== null) {
            const limites = {
                1: { min: 5, max: 30, nombre: 'Retrolavado' },
                2: { min: 30, max: 90, nombre: 'Salmuera' },
                3: { min: 5, max: 20, nombre: 'Enjuague' },
                4: { min: 3, max: 15, nombre: 'Llenado salero' }
            };
            const limite = limites[i];
            if (left < limite.min || left > limite.max) {
                alerts.push({
                    type: 'warning',
                    message: `P${i} ${limite.nombre} (${left} min) está fuera del rango típico (${limite.min}-${limite.max} min).`,
                    fieldId: `softener-cabezal-p${i}-left`
                });
            }
        }
    }

    // 23. Autonomía restante muy baja con dureza alta encontrada
    const autonomiaRestante = getNumberValue('softener-autonomia-restante');
    const durezaSalidaFound = getNumberValue('softener-param-dureza-salida-found');
    if (autonomiaRestante !== null && autonomiaRestante > 5 && durezaSalidaFound !== null && durezaSalidaFound > 20) {
        alerts.push({
            type: 'warning',
            message: `Dureza de salida alta (${durezaSalidaFound} ppm) con autonomía restante (${autonomiaRestante} m³). Posible problema con la resina.`,
            fieldId: 'softener-param-dureza-salida-found'
        });
    }

    // 24. Se ajustó autonomía pero no se marcó el checkbox
    const autonomiaAjustada = isCheckboxChecked('softener-autonomia-ajustada');
    if (autonomiaRecomendada !== null && autonomiaSeteo !== null &&
        Math.abs(autonomiaRecomendada - autonomiaSeteo) > 0.5 && !autonomiaAjustada) {
        alerts.push({
            type: 'tip',
            message: 'El seteo difiere de la recomendación. ¿Ajustaste la autonomía en el cabezal?',
            fieldId: 'softener-autonomia-ajustada'
        });
    }

    // =========================================================================
    // SECCIÓN F: Condiciones de Operación
    // =========================================================================

    // 25. Cloro alto en entrada (problema para la resina)
    const cloroFound = getNumberValue('softener-param-test-cloro-found');
    if (cloroFound !== null && cloroFound > 0.5) {
        alerts.push({
            type: 'warning',
            message: `El cloro de entrada (${cloroFound} ppm) es alto. Puede dañar la resina. Verificar prefiltro de carbón.`,
            fieldId: 'softener-param-test-cloro-found'
        });
    }

    // 26. Estado del gabinete crítico
    const estadoGabinete = getSelectValue('softener-estado-gabinete');
    if (estadoGabinete === 'Crítico' || estadoGabinete === 'Regular') {
        alerts.push({
            type: 'warning',
            message: `El estado del gabinete es "${estadoGabinete}". Documentá las condiciones en observaciones.`,
            fieldId: 'softener-estado-gabinete'
        });
    }

    // 27. Presiones As Found sin completar (si hay manómetros)
    if (presionesVisibles) {
        const presionEntradaFound = getNumberValue('softener-presion-entrada-as-found');
        const presionSalidaFound = getNumberValue('softener-presion-salida-as-found');
        if (presionEntradaFound === null || presionSalidaFound === null) {
            alerts.push({
                type: 'tip',
                message: 'Completá las presiones "As Found" antes del mantenimiento.',
                fieldId: 'softener-presion-entrada-as-found'
            });
        }
    }

    // =========================================================================
    // SECCIÓN G: Cierre y Confirmación
    // =========================================================================

    // 28. Conformidad del cliente no indicada
    const conformidad = getSelectValue('softener-conformidad-cliente');
    if (!conformidad) {
        alerts.push({
            type: 'tip',
            message: 'Indicá la conformidad del cliente antes de cerrar el servicio.',
            fieldId: 'softener-conformidad-cliente'
        });
    }

    // 29. Firma en sitio sin representante
    const medioConfirmacion = getSelectValue('softener-medio-confirmacion');
    const representante = getInputValue('softener-representante-cliente');
    if (medioConfirmacion === 'Firma en sitio' && !representante) {
        alerts.push({
            type: 'warning',
            message: 'Seleccionaste "Firma en sitio" pero no indicaste el nombre del representante.',
            fieldId: 'softener-representante-cliente'
        });
    }

    // 30. Cliente no conforme sin observaciones
    const observacionesFinales = getInputValue('softener-observaciones-finales');
    if ((conformidad === 'Con observaciones' || conformidad === 'No conforme') && !observacionesFinales) {
        alerts.push({
            type: 'error',
            message: `El cliente está "${conformidad}". Documentá el motivo en observaciones finales.`,
            fieldId: 'softener-observaciones-finales'
        });
    }

    // 31. Requiere seguimiento sin especificar qué
    const requiereSeguimiento = isCheckboxChecked('softener-requiere-seguimiento');
    if (requiereSeguimiento && !observacionesFinales) {
        alerts.push({
            type: 'warning',
            message: 'Marcaste que requiere seguimiento. Especificá qué acciones en observaciones finales.',
            fieldId: 'softener-observaciones-finales'
        });
    }

    // =========================================================================
    // REGLAS DE COHERENCIA ENTRE SECCIONES
    // =========================================================================

    // 32. Cambio de filtro marcado pero sin materiales
    const materiales = getInputValue('softener-resumen-materiales');
    if (cambioFiltro && !materiales) {
        alerts.push({
            type: 'tip',
            message: 'Marcaste cambio de filtro. Registrá el material usado en "Materiales/repuestos".',
            fieldId: 'softener-resumen-materiales'
        });
    }

    // 33. Carga de sal marcada pero nivel sigue bajo
    const cargaSal = isCheckboxChecked('softener-check-carga-sal');
    if (cargaSal && (nivelSalLeft === 'Bajo' || nivelSalLeft === 'Crítico')) {
        alerts.push({
            type: 'warning',
            message: 'Marcaste "Carga de sal" pero el nivel quedó bajo. ¿Fue suficiente?',
            fieldId: 'softener-nivel-sal-as-left'
        });
    }

    // 34. Inspección de fugas marcada - verificar que no haya fugas left
    const checkFugas = isCheckboxChecked('softener-check-fugas');
    // (No hay campo de fugas As Left en el form actual, pero se podría agregar)

    return alerts;
}

/**
 * Verifica si hay errores críticos (bloquean guardado)
 */
export function hasBlockingErrors() {
    const alerts = validateSoftenerForm();
    return alerts.some(a => a.type === 'error');
}

/**
 * Obtiene solo los errores críticos
 */
export function getBlockingErrors() {
    const alerts = validateSoftenerForm();
    return alerts.filter(a => a.type === 'error');
}
