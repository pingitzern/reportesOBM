/**
 * Script de inicialización para configurar las propiedades del proyecto
 * Ejecutar esta función UNA VEZ desde el editor de Apps Script
 */
function initializeScriptProperties() {
  const properties = PropertiesService.getScriptProperties();
  
  const config = {
    SHEET_ID: '14_6UyAhZQqHz6EGMRhr7YyqQ-KHMBsjeU4M5a_SRhis',
    SHEET_NAME: 'Hoja 1',
    CLIENTES_SHEET_NAME: 'clientes',
    SOFTENER_SHEET_NAME: 'softener_mantenimiento'
  };
  
  properties.setProperties(config, true);
  
  Logger.log('✅ Propiedades configuradas correctamente:');
  Logger.log(JSON.stringify(config, null, 2));
  
  return {
    success: true,
    message: 'Propiedades del script configuradas correctamente',
    config: config
  };
}

/**
 * Verificar la configuración actual
 */
function verifyScriptProperties() {
  const properties = PropertiesService.getScriptProperties();
  const allProperties = properties.getProperties();
  
  Logger.log('📋 Propiedades actuales del script:');
  Logger.log(JSON.stringify(allProperties, null, 2));
  
  return allProperties;
}

/**
 * Verificar si existe la hoja softener_mantenimiento
 */
function verifySoftenerSheet() {
  try {
    const sheetId = '14_6UyAhZQqHz6EGMRhr7YyqQ-KHMBsjeU4M5a_SRhis';
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    
    Logger.log('📊 Hojas disponibles en el spreadsheet:');
    const sheets = spreadsheet.getSheets();
    sheets.forEach(function(sheet) {
      Logger.log('  - ' + sheet.getName());
    });
    
    const softenerSheet = spreadsheet.getSheetByName('softener_mantenimiento');
    
    if (softenerSheet) {
      Logger.log('✅ Hoja "softener_mantenimiento" encontrada');
      Logger.log('   Filas: ' + softenerSheet.getLastRow());
      Logger.log('   Columnas: ' + softenerSheet.getLastColumn());
      return {
        success: true,
        message: 'Hoja encontrada',
        rows: softenerSheet.getLastRow(),
        columns: softenerSheet.getLastColumn()
      };
    } else {
      Logger.log('❌ Hoja "softener_mantenimiento" NO encontrada');
      Logger.log('   Por favor, creá una hoja con ese nombre exacto (todo en minúsculas, con guión bajo)');
      return {
        success: false,
        message: 'Hoja no encontrada'
      };
    }
  } catch (error) {
    Logger.log('❌ Error al verificar: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test completo del sistema de guardado
 */
function testSoftenerSave() {
  try {
    Logger.log('🧪 Iniciando test de guardado de ablandador...');
    
    // 1. Verificar propiedades
    Logger.log('\n1️⃣ Verificando propiedades del script...');
    const props = verifyScriptProperties();
    
    // 2. Verificar hoja
    Logger.log('\n2️⃣ Verificando hoja softener_mantenimiento...');
    const sheetCheck = verifySoftenerSheet();
    
    if (!sheetCheck.success) {
      throw new Error('La hoja softener_mantenimiento no existe. Creala primero.');
    }
    
    // 3. Test de guardado con datos de prueba
    Logger.log('\n3️⃣ Probando guardado con datos de prueba...');
    
    const testPayload = {
      seccion_A_cliente: {
        nombre: 'Cliente Test',
        direccion: 'Calle Test 123',
        localidad: 'Ciudad Test',
        fecha_servicio: new Date().toISOString().split('T')[0],
        tecnico: 'Técnico Test'
      },
      seccion_B_equipo: {
        tipo: 'Ablandador Test',
        modelo: 'Modelo-123',
        volumen_resina: 50
      },
      seccion_C_parametros: {
        dureza_agua_cruda: 500,
        autonomia_recomendada: 150
      }
    };
    
    const result = OBM.SoftenerMaintenanceService.guardar(testPayload, 'test@test.com');
    
    Logger.log('\n✅ Test completado exitosamente!');
    Logger.log('Resultado: ' + JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    Logger.log('\n❌ Error en el test: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}
