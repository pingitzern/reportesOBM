/**
 * Script para corregir y reorganizar los headers de la hoja softener_mantenimiento
 * Este script es seguro y hace backup antes de hacer cambios
 */

(function(global) {
  (function(ns) {
    'use strict';

    /**
     * Orden correcto de columnas según SoftenerMaintenanceService.gs
     */
    const CORRECT_HEADERS = [
      // Metadata básica
      'Fecha_Registro',
      'Registrado_Por',
      'Numero_Reporte',
      'ID_Unico',
      
      // Sección A - Cliente y Servicio
      'Cliente_Nombre',
      'Cliente_Direccion',
      'Cliente_Localidad',
      'Cliente_Contacto',
      'Cliente_Telefono',
      'Cliente_Email',
      'Cliente_CUIT',
      'Servicio_Fecha',
      'Servicio_Tecnico',
      
      // Sección B - Equipo
      'Equipo_Tipo',
      'Equipo_Modelo',
      'Equipo_NumeroSerie',
      'Equipo_Ubicacion',
      'Equipo_VolumenResina',
      'Equipo_TipoRegeneracion',
      'Equipo_Prefiltro',
      'Equipo_ProteccionEntrada',
      'Equipo_Manometros',
      'Equipo_Notas',
      
      // Sección C - Parámetros de Autonomía
      'Parametros_DurezaAguaCruda',
      'Parametros_AutonomiaRestante',
      'Parametros_SeteoAutonomia',
      'Parametros_AplicarProteccion20',
      'Parametros_AutonomiaRecomendada',
      'Parametros_AjustadaValorCalculado',
      
      // Sección C - Cabezal
      'Cabezal_HoraCabezal_AsFound',
      'Cabezal_HoraCabezal_AsLeft',
      'Cabezal_HoraRegeneracion_AsFound',
      'Cabezal_HoraRegeneracion_AsLeft',
      'Cabezal_P1_Retrolavado_Found',
      'Cabezal_P1_Retrolavado_Left',
      'Cabezal_P2_Salmuera_Found',
      'Cabezal_P2_Salmuera_Left',
      'Cabezal_P3_Enjuague_Found',
      'Cabezal_P3_Enjuague_Left',
      'Cabezal_P4_LlenadoSalero_Found',
      'Cabezal_P4_LlenadoSalero_Left',
      'Cabezal_FrecuenciaDias_Found',
      'Cabezal_FrecuenciaDias_Left',
      
      // Sección D - Checklist
      'Checklist_InspeccionFugas',
      'Checklist_CambioFiltroRealizado',
      'Checklist_FiltroTipoInstalado',
      'Checklist_FiltroLoteSerie',
      'Checklist_LimpiezaTanqueSal',
      'Checklist_VerificacionNivelAgua',
      'Checklist_CargaSal',
      'Checklist_VerificacionHora',
      'Checklist_VerificacionParametrosCiclo',
      'Checklist_AjusteAutonomia',
      'Checklist_RegeneracionManual',
      'Checklist_Otros',
      'Checklist_Observaciones',
      
      // Sección E - Resumen
      'Resumen_TrabajoRealizado',
      'Resumen_Recomendaciones',
      'Resumen_ProximoServicio',
      'Resumen_Materiales',
      'Resumen_ComentariosCliente',
      
      // Sección F - Condiciones de Operación
      'Condiciones_PresionEntrada_Found',
      'Condiciones_PresionEntrada_Left',
      'Condiciones_PresionSalida_Found',
      'Condiciones_PresionSalida_Left',
      'Condiciones_NivelSal_Found',
      'Condiciones_NivelSal_Left',
      'Condiciones_TemperaturaAmbiente',
      'Condiciones_EstadoGabinete',
      'Condiciones_Observaciones',
      
      // Parámetros de Operación (desde Sección B)
      'Parametros_PresionEntrada_Found',
      'Parametros_PresionEntrada_Left',
      'Parametros_TestCloro_Found',
      'Parametros_TestCloro_Left',
      'Parametros_DurezaSalida_Found',
      'Parametros_DurezaSalida_Left',
      
      // Sección G - Cierre y Confirmación
      'Cierre_ConformidadCliente',
      'Cierre_RepresentanteCliente',
      'Cierre_MedioConfirmacion',
      'Cierre_RequiereSeguimiento',
      'Cierre_ObservacionesFinales',
      
      // Campos de compatibilidad con remitos
      'Cliente',
      'Direccion',
      'Cliente_Telefono_Remito',
      'Cliente_Email_Remito',
      'Cliente_CUIT_Remito',
      'Numero_Reporte_Remito',
      
      // Payload completo
      'Datos_Adicionales'
    ];

    /**
     * Verificar si los headers actuales coinciden con los correctos
     */
    function verificarHeaders() {
      try {
        const sheet = ns.SoftenerSheetRepository.getSheet();
        if (!sheet) {
          return { ok: false, error: 'No se pudo obtener la hoja softener_mantenimiento' };
        }

        const lastColumn = sheet.getLastColumn();
        if (lastColumn === 0) {
          return { 
            ok: false, 
            error: 'La hoja está vacía',
            needsHeaders: true
          };
        }

        const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
        
        // Comparar headers
        const differences = [];
        const maxLength = Math.max(currentHeaders.length, CORRECT_HEADERS.length);
        
        for (let i = 0; i < maxLength; i++) {
          const current = currentHeaders[i] || '(vacío)';
          const correct = CORRECT_HEADERS[i] || '(no esperado)';
          
          if (current !== correct) {
            differences.push({
              position: i + 1,
              current: current,
              expected: correct
            });
          }
        }

        return {
          ok: differences.length === 0,
          totalColumns: currentHeaders.length,
          expectedColumns: CORRECT_HEADERS.length,
          differences: differences,
          currentHeaders: currentHeaders,
          needsReorganization: differences.length > 0
        };

      } catch (error) {
        return {
          ok: false,
          error: 'Error al verificar headers: ' + error.message
        };
      }
    }

    /**
     * Crear backup de la hoja antes de modificarla
     */
    function crearBackup() {
      try {
        const sheet = ns.SoftenerSheetRepository.getSheet();
        if (!sheet) {
          throw new Error('No se pudo obtener la hoja para backup');
        }

        const ss = sheet.getParent();
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
        const backupName = 'BACKUP_softener_' + timestamp;
        
        // Copiar la hoja
        const backup = sheet.copyTo(ss);
        backup.setName(backupName);
        
        // Mover el backup al final
        ss.moveActiveSheet(ss.getNumSheets());
        
        return {
          ok: true,
          backupName: backupName,
          message: 'Backup creado exitosamente: ' + backupName
        };

      } catch (error) {
        return {
          ok: false,
          error: 'Error al crear backup: ' + error.message
        };
      }
    }

    /**
     * Reorganizar las columnas para que coincidan con el orden correcto
     */
    function reorganizarColumnas() {
      try {
        // Primero crear backup
        const backupResult = crearBackup();
        if (!backupResult.ok) {
          return backupResult;
        }

        const sheet = ns.SoftenerSheetRepository.getSheet();
        const lastRow = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();

        if (lastRow === 0 || lastColumn === 0) {
          return {
            ok: false,
            error: 'La hoja está vacía, no hay nada que reorganizar'
          };
        }

        // Obtener todos los datos actuales (incluyendo header)
        const allData = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
        const currentHeaders = allData[0];

        // Crear mapeo de columna actual a nueva posición
        const columnMapping = new Map();
        
        // Para cada header correcto, buscar dónde está en los headers actuales
        CORRECT_HEADERS.forEach((correctHeader, newIndex) => {
          const currentIndex = currentHeaders.indexOf(correctHeader);
          if (currentIndex !== -1) {
            columnMapping.set(currentIndex, newIndex);
          }
        });

        // Crear array de datos reorganizados
        const reorganizedData = [];
        
        for (let rowIndex = 0; rowIndex < allData.length; rowIndex++) {
          const currentRow = allData[rowIndex];
          const newRow = new Array(CORRECT_HEADERS.length).fill('');
          
          // Si es el header, usar los headers correctos
          if (rowIndex === 0) {
            reorganizedData.push(CORRECT_HEADERS);
          } else {
            // Para filas de datos, reorganizar según el mapeo
            columnMapping.forEach((newIndex, oldIndex) => {
              newRow[newIndex] = currentRow[oldIndex];
            });
            reorganizedData.push(newRow);
          }
        }

        // Limpiar la hoja
        sheet.clear();

        // Escribir los datos reorganizados
        if (reorganizedData.length > 0) {
          sheet.getRange(1, 1, reorganizedData.length, CORRECT_HEADERS.length)
            .setValues(reorganizedData);
        }

        // Formatear el header
        const headerRange = sheet.getRange(1, 1, 1, CORRECT_HEADERS.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#4285f4');
        headerRange.setFontColor('#ffffff');

        return {
          ok: true,
          message: 'Columnas reorganizadas exitosamente',
          backupName: backupResult.backupName,
          rowsProcessed: reorganizedData.length - 1,
          columnsReorganized: CORRECT_HEADERS.length
        };

      } catch (error) {
        return {
          ok: false,
          error: 'Error al reorganizar columnas: ' + error.message
        };
      }
    }

    /**
     * Función principal: diagnosticar y opcionalmente corregir
     */
    function diagnosticarYCorregir(autoFix) {
      const verification = verificarHeaders();
      
      const result = {
        verification: verification,
        timestamp: new Date().toISOString()
      };

      if (!verification.ok && !verification.needsReorganization) {
        // Error crítico
        result.action = 'none';
        result.message = verification.error;
        return result;
      }

      if (verification.ok) {
        // Todo está bien
        result.action = 'none';
        result.message = 'Los headers están correctos, no se necesita reorganización';
        return result;
      }

      if (verification.needsReorganization && autoFix) {
        // Reorganizar
        result.action = 'reorganize';
        result.reorganization = reorganizarColumnas();
        return result;
      }

      // Solo diagnóstico
      result.action = 'diagnostic_only';
      result.message = 'Se encontraron diferencias. Ejecutar con autoFix=true para corregir.';
      return result;
    }

    // Exportar funciones
    ns.FixSoftenerHeaders = {
      verificar: verificarHeaders,
      crearBackup: crearBackup,
      reorganizar: reorganizarColumnas,
      diagnosticar: function() { return diagnosticarYCorregir(false); },
      corregir: function() { return diagnosticarYCorregir(true); }
    };

  })(global.OBM = global.OBM || {});
})(this);

/**
 * Función global para ejecutar desde el editor de Apps Script
 * Solo diagnóstico, no modifica nada
 */
function diagnosticarSoftenerHeaders() {
  const result = OBM.FixSoftenerHeaders.diagnosticar();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Función global para corregir los headers
 * ESTA FUNCIÓN HACE CAMBIOS - Crear backup primero
 */
function corregirSoftenerHeaders() {
  const result = OBM.FixSoftenerHeaders.corregir();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
