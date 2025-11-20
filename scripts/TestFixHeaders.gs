/**
 * Script de prueba para ejecutar el diagnóstico y corrección de headers
 */

function testDiagnosticoHeaders() {
  Logger.log('=== INICIANDO DIAGNÓSTICO DE HEADERS ===');
  
  try {
    const result = diagnosticarSoftenerHeaders();
    
    Logger.log('\n--- RESULTADO DEL DIAGNÓSTICO ---');
    Logger.log('Estado: ' + (result.verification.ok ? 'OK' : 'NECESITA CORRECCIÓN'));
    
    if (result.verification.differences) {
      Logger.log('\nDiferencias encontradas: ' + result.verification.differences.length);
      Logger.log('Columnas actuales: ' + result.verification.totalColumns);
      Logger.log('Columnas esperadas: ' + result.verification.expectedColumns);
      
      if (result.verification.differences.length > 0) {
        Logger.log('\nPrimeras 10 diferencias:');
        result.verification.differences.slice(0, 10).forEach(function(diff) {
          Logger.log('  Posición ' + diff.position + ':');
          Logger.log('    Actual: ' + diff.current);
          Logger.log('    Esperado: ' + diff.expected);
        });
      }
    }
    
    Logger.log('\nMensaje: ' + result.message);
    
    return result;
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}

function testCorreccionHeaders() {
  Logger.log('=== INICIANDO CORRECCIÓN DE HEADERS ===');
  Logger.log('ADVERTENCIA: Esta función creará un backup y reorganizará las columnas');
  
  try {
    const result = corregirSoftenerHeaders();
    
    Logger.log('\n--- RESULTADO DE LA CORRECCIÓN ---');
    
    if (result.reorganization) {
      if (result.reorganization.ok) {
        Logger.log('✅ ÉXITO: ' + result.reorganization.message);
        Logger.log('Backup creado: ' + result.reorganization.backupName);
        Logger.log('Filas procesadas: ' + result.reorganization.rowsProcessed);
        Logger.log('Columnas reorganizadas: ' + result.reorganization.columnsReorganized);
      } else {
        Logger.log('❌ ERROR: ' + result.reorganization.error);
      }
    }
    
    return result;
    
  } catch (error) {
    Logger.log('ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}
