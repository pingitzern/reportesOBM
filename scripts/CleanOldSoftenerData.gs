/**
 * Script para limpiar registros antiguos de la hoja softener_mantenimiento
 * Mueve todos los registros antiguos (mal estructurados) a una hoja de backup
 * y deja solo la estructura correcta para empezar de cero
 */

// ID del spreadsheet - debe coincidir con el configurado en Codigo2025.gs
const SPREADSHEET_ID = '14_6UyAhZQqHz6EGMRhr7YyqQ-KHMBsjeU4M5a_SRhis';

function limpiarDatosAntiguos() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = 'softener_mantenimiento';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`No se encontró la hoja "${sheetName}"`);
    }
    
    Logger.log('=== INICIANDO LIMPIEZA DE DATOS ANTIGUOS ===\n');
    
    // 1. Crear backup de datos antiguos
    Logger.log('Paso 1: Creando backup de datos antiguos...');
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const backupName = `OLDDATA_softener_${timestamp}`;
    
    // Copiar toda la hoja actual
    const backupSheet = sheet.copyTo(ss);
    backupSheet.setName(backupName);
    Logger.log(`✅ Backup creado: ${backupName}\n`);
    
    // 2. Obtener información de la hoja actual
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    Logger.log(`Paso 2: Analizando datos actuales...`);
    Logger.log(`Filas totales: ${lastRow}`);
    Logger.log(`Columnas: ${lastCol}\n`);
    
    // 3. Identificar filas a eliminar (todas excepto header y primera fila de datos)
    if (lastRow <= 1) {
      Logger.log('⚠️ No hay datos para limpiar (solo headers)');
      return {
        success: true,
        backup: backupName,
        rowsDeleted: 0,
        message: 'No había datos para limpiar'
      };
    }
    
    // Verificar si existe la primera fila de datos correcta
    let startDeleteRow = 2;
    let keepFirstDataRow = false;
    
    if (lastRow > 1) {
      // Leer primera fila de datos para verificar si está correcta
      const firstDataRow = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
      const numeroReporte = firstDataRow[2]; // Columna C (índice 2)
      const idUnico = firstDataRow[3]; // Columna D (índice 3)
      
      // Si tiene datos en Numero_Reporte e ID_Unico, probablemente esté correcta
      if (numeroReporte && idUnico && typeof idUnico === 'string' && idUnico.length > 20) {
        Logger.log('✅ Primera fila de datos parece correcta, se mantendrá');
        Logger.log(`   Numero_Reporte: ${numeroReporte}`);
        Logger.log(`   ID_Unico: ${idUnico.substring(0, 20)}...\n`);
        keepFirstDataRow = true;
        startDeleteRow = 3;
      } else {
        Logger.log('⚠️ Primera fila de datos también será eliminada (estructura incorrecta)');
        Logger.log(`   Numero_Reporte: ${numeroReporte}`);
        Logger.log(`   ID_Unico: ${idUnico}\n`);
      }
    }
    
    // 4. Calcular cuántas filas se eliminarán
    const rowsToDelete = lastRow - startDeleteRow + 1;
    
    if (rowsToDelete <= 0) {
      Logger.log('✅ No hay filas antiguas para eliminar');
      return {
        success: true,
        backup: backupName,
        rowsDeleted: 0,
        rowsKept: keepFirstDataRow ? 1 : 0,
        message: 'No había filas antiguas para eliminar'
      };
    }
    
    Logger.log(`Paso 3: Eliminando filas antiguas...`);
    Logger.log(`Se eliminarán ${rowsToDelete} filas (desde fila ${startDeleteRow} hasta fila ${lastRow})`);
    
    // 5. Eliminar filas antiguas
    // Nota: deleteRows() elimina desde la fila startDeleteRow, numRows cantidad de filas
    sheet.deleteRows(startDeleteRow, rowsToDelete);
    
    Logger.log(`✅ ${rowsToDelete} filas eliminadas\n`);
    
    // 6. Verificación final
    const finalLastRow = sheet.getLastRow();
    Logger.log('Paso 4: Verificación final...');
    Logger.log(`Filas restantes: ${finalLastRow}`);
    Logger.log(`Estructura: 1 fila de headers${keepFirstDataRow ? ' + 1 fila de datos correcta' : ''}\n`);
    
    // 7. Resumen
    Logger.log('=== LIMPIEZA COMPLETADA ===');
    Logger.log(`✅ Backup creado: ${backupName}`);
    Logger.log(`✅ Filas eliminadas: ${rowsToDelete}`);
    Logger.log(`✅ Filas restantes: ${finalLastRow - 1} (datos)`);
    Logger.log(`✅ La hoja está lista para nuevos registros con estructura correcta\n`);
    
    return {
      success: true,
      backup: backupName,
      rowsDeleted: rowsToDelete,
      rowsKept: keepFirstDataRow ? 1 : 0,
      finalRows: finalLastRow - 1,
      message: 'Limpieza completada exitosamente'
    };
    
  } catch (error) {
    Logger.log('❌ ERROR durante la limpieza:');
    Logger.log(error.toString());
    Logger.log(error.stack);
    
    return {
      success: false,
      error: error.toString(),
      message: 'Error durante la limpieza'
    };
  }
}

/**
 * Función de test para verificar qué se va a hacer SIN ejecutar cambios
 */
function testLimpiezaPreview() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = 'softener_mantenimiento';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`❌ No se encontró la hoja "${sheetName}"`);
      return;
    }
    
    Logger.log('=== PREVIEW DE LIMPIEZA (SIN CAMBIOS) ===\n');
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    Logger.log(`📊 Estado actual:`);
    Logger.log(`   Filas totales: ${lastRow}`);
    Logger.log(`   Columnas: ${lastCol}\n`);
    
    if (lastRow <= 1) {
      Logger.log('⚠️ No hay datos para limpiar (solo headers)');
      return;
    }
    
    // Verificar primera fila de datos
    Logger.log('🔍 Verificando primera fila de datos (fila 2)...');
    const firstDataRow = sheet.getRange(2, 1, 1, Math.min(10, lastCol)).getValues()[0];
    const numeroReporte = firstDataRow[2];
    const idUnico = firstDataRow[3];
    
    Logger.log(`   Columna C (Numero_Reporte): ${numeroReporte || '(vacío)'}`);
    Logger.log(`   Columna D (ID_Unico): ${idUnico ? (typeof idUnico === 'string' && idUnico.length > 20 ? idUnico.substring(0, 30) + '...' : idUnico) : '(vacío)'}\n`);
    
    let keepFirstDataRow = false;
    let startDeleteRow = 2;
    
    if (numeroReporte && idUnico && typeof idUnico === 'string' && idUnico.length > 20) {
      Logger.log('✅ Primera fila parece CORRECTA - SE MANTENDRÁ');
      keepFirstDataRow = true;
      startDeleteRow = 3;
    } else {
      Logger.log('⚠️ Primera fila parece INCORRECTA - SERÁ ELIMINADA');
      startDeleteRow = 2;
    }
    
    const rowsToDelete = lastRow - startDeleteRow + 1;
    
    Logger.log(`\n📋 Plan de limpieza:`);
    Logger.log(`   ✅ Se creará backup: OLDDATA_softener_[timestamp]`);
    Logger.log(`   ✅ Se mantendrá: Fila 1 (headers)${keepFirstDataRow ? ' + Fila 2 (datos correctos)' : ''}`);
    
    if (rowsToDelete > 0) {
      Logger.log(`   🗑️ Se eliminarán: ${rowsToDelete} filas (desde fila ${startDeleteRow} hasta fila ${lastRow})`);
    } else {
      Logger.log(`   ℹ️ No hay filas para eliminar`);
    }
    
    Logger.log(`\n📊 Resultado esperado:`);
    Logger.log(`   Filas finales: ${keepFirstDataRow ? 2 : 1} (${keepFirstDataRow ? '1 header + 1 dato' : 'solo header'})`);
    Logger.log(`   Registros de datos: ${keepFirstDataRow ? 1 : 0}`);
    
    Logger.log(`\n💡 Para ejecutar la limpieza real, ejecuta: limpiarDatosAntiguos()`);
    
  } catch (error) {
    Logger.log('❌ ERROR:');
    Logger.log(error.toString());
  }
}

/**
 * Función para restaurar desde un backup específico
 * @param {string} backupSheetName - Nombre de la hoja de backup a restaurar
 */
function restaurarDesdeBackup(backupSheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const backupSheet = ss.getSheetByName(backupSheetName);
    
    if (!backupSheet) {
      Logger.log(`❌ No se encontró la hoja de backup "${backupSheetName}"`);
      Logger.log('\n📋 Hojas de backup disponibles:');
      ss.getSheets()
        .filter(s => s.getName().startsWith('OLDDATA_softener_') || s.getName().startsWith('BACKUP_softener_'))
        .forEach(s => Logger.log(`   - ${s.getName()}`));
      return;
    }
    
    Logger.log('=== RESTAURANDO DESDE BACKUP ===\n');
    Logger.log(`Backup: ${backupSheetName}`);
    
    // Eliminar hoja actual
    const currentSheet = ss.getSheetByName('softener_mantenimiento');
    if (currentSheet) {
      ss.deleteSheet(currentSheet);
      Logger.log('✅ Hoja actual eliminada');
    }
    
    // Copiar backup y renombrar
    const restoredSheet = backupSheet.copyTo(ss);
    restoredSheet.setName('softener_mantenimiento');
    Logger.log('✅ Backup restaurado como "softener_mantenimiento"');
    
    // Mover la hoja restaurada a la posición original
    ss.setActiveSheet(restoredSheet);
    ss.moveActiveSheet(1);
    
    Logger.log('\n✅ RESTAURACIÓN COMPLETADA');
    
  } catch (error) {
    Logger.log('❌ ERROR durante la restauración:');
    Logger.log(error.toString());
  }
}
