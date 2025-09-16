const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const SHEET_ID = SCRIPT_PROPERTIES.getProperty('SHEET_ID');
const SHEET_NAME = SCRIPT_PROPERTIES.getProperty('SHEET_NAME');

function initProperties() {
  PropertiesService.getScriptProperties().setProperties(
    {
      SHEET_ID: 'TU_ID_DE_HOJA',
      SHEET_NAME: 'Nombre de pestaña'
    },
    true
  );
}

const CAMPOS_ACTUALIZABLES = [
  'Cliente', 'Fecha_Servicio', 'Direccion', 'Tecnico_Asignado', 'Modelo_Equipo',
  'ID_Interna_Activo', 'Numero_Serie', 'Proximo_Mantenimiento', 'Fugas_Visibles_Found',
  'Fugas_Visibles_Left', 'Conductividad_Red_Found', 'Conductividad_Red_Left',
  'Conductividad_Permeado_Found', 'Conductividad_Permeado_Left', 'Rechazo_Ionico_Found',
  'Rechazo_Ionico_Left', 'Presion_Entrada_Found', 'Presion_Entrada_Left',
  'Caudal_Permeado_Found', 'Caudal_Permeado_Left', 'Caudal_Rechazo_Found',
  'Caudal_Rechazo_Left', 'Relacion_Rechazo_Permeado_Found', 'Relacion_Rechazo_Permeado_Left',
  'Precarga_Tanque_Found', 'Precarga_Tanque_Left', 'Test_Presostato_Alta_Found',
  'Test_Presostato_Alta_Left', 'Test_Presostato_Baja_Found', 'Test_Presostato_Baja_Left',
  'Etapa1_Detalles', 'Etapa1_Accion', 'Etapa2_Detalles', 'Etapa2_Accion',
  'Etapa3_Detalles', 'Etapa3_Accion', 'Etapa4_Detalles', 'Etapa4_Accion',
  'Etapa5_Detalles', 'Etapa5_Accion', 'Etapa6_Detalles', 'Etapa6_Accion',
  'Sanitizacion_Sistema', 'Resumen_Recomendaciones'
];

const SheetRepository = {
  getSheet() {
    if (!SHEET_ID || !SHEET_NAME) {
      throw new Error(
        'Configura las propiedades de script SHEET_ID y SHEET_NAME antes de ejecutar la API.'
      );
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`No se encontró la hoja ${SHEET_NAME} en el documento configurado.`);
    }

    return sheet;
  },
  getSheetData() {
    const sheet = this.getSheet();
    return {
      sheet,
      data: sheet.getDataRange().getValues()
    };
  }
};

const ResponseFactory = {
  success(data) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success', data }))
      .setMimeType(ContentService.MimeType.JSON);
  },
  error(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
};

const MantenimientoService = {
  guardar(data) {
    const sheet = SheetRepository.getSheet();
    const timestamp = new Date();
    const idUnico = Utilities.getUuid();

    const rowData = [
      data.cliente,
      data.fecha,
      data.direccion,
      data.tecnico,
      data.modelo,
      data.id_interna,
      data.n_serie,
      data.proximo_mant,
      data.fugas_found,
      data.fugas_left,
      data.cond_red_found || 0,
      data.cond_red_left || 0,
      data.cond_perm_found || 0,
      data.cond_perm_left || 0,
      data.rechazo_found || '',
      data.rechazo_left || '',
      data.presion_found || 0,
      data.presion_left || 0,
      data.caudal_perm_found || 0,
      data.caudal_perm_left || 0,
      data.caudal_rech_found || 0,
      data.caudal_rech_left || 0,
      data.relacion_found || '',
      data.relacion_left || '',
      data.precarga_found || 0,
      data.precarga_left || 0,
      data.presostato_alta_found,
      data.presostato_alta_left,
      data.presostato_baja_found,
      data.presostato_baja_left,
      data.etapa1_detalles,
      data.etapa1_accion,
      data.etapa2_detalles,
      data.etapa2_accion,
      data.etapa3_detalles,
      data.etapa3_accion,
      data.etapa4_detalles,
      data.etapa4_accion,
      data.etapa5_detalles,
      data.etapa5_accion,
      data.etapa6_detalles,
      data.etapa6_accion,
      data.sanitizacion,
      data.resumen,
      data.numero_reporte,
      timestamp,
      idUnico
    ];

    sheet.appendRow(rowData);
    return { id: idUnico, mensaje: 'Mantenimiento guardado correctamente' };
  },

  buscar(filtros) {
    const { data } = SheetRepository.getSheetData();
    const headers = data[0];
    const resultados = [];

    const clienteFiltro = filtros.cliente ? filtros.cliente.toLowerCase() : '';
    const tecnicoFiltro = filtros.tecnico ? filtros.tecnico.toLowerCase() : '';
    const fechaFiltro = filtros.fecha || '';

    for (let i = 1; i < data.length; i += 1) {
      const row = data[i];
      const mantenimiento = {};
      let coincide = true;

      for (let j = 0; j < headers.length; j += 1) {
        const header = headers[j];
        mantenimiento[header] = row[j];
      }

      if (clienteFiltro) {
        const cliente = mantenimiento.Cliente ? mantenimiento.Cliente.toLowerCase() : '';
        if (!cliente.includes(clienteFiltro)) {
          coincide = false;
        }
      }

      if (coincide && tecnicoFiltro) {
        const tecnico = mantenimiento.Tecnico_Asignado
          ? mantenimiento.Tecnico_Asignado.toLowerCase()
          : '';
        if (!tecnico.includes(tecnicoFiltro)) {
          coincide = false;
        }
      }

      if (coincide && fechaFiltro && mantenimiento.Fecha_Servicio !== fechaFiltro) {
        coincide = false;
      }

      if (coincide) {
        resultados.push(mantenimiento);
      }
    }

    return resultados;
  },

  actualizar(data) {
    const { sheet, data: allData } = SheetRepository.getSheetData();
    const headers = allData[0];

    const idIndex = headers.indexOf('ID_Unico');
    if (idIndex === -1) {
      throw new Error('Encabezado ID_Unico no encontrado');
    }

    let rowIndex = -1;
    for (let i = 1; i < allData.length; i += 1) {
      if (allData[i][idIndex] === data.id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Mantenimiento no encontrado');
    }

    CAMPOS_ACTUALIZABLES.forEach((campo) => {
      const colIndex = headers.indexOf(campo);
      if (colIndex === -1) {
        return;
      }

      const dataKey = campo.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(data, dataKey) && data[dataKey] !== undefined) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[dataKey]);
      }
    });

    return { mensaje: 'Mantenimiento actualizado correctamente' };
  },

  eliminar(data) {
    const { sheet, data: allData } = SheetRepository.getSheetData();
    const headers = allData[0];

    const idIndex = headers.indexOf('ID_Unico');
    if (idIndex === -1) {
      throw new Error('Encabezado ID_Unico no encontrado');
    }

    for (let i = 1; i < allData.length; i += 1) {
      if (allData[i][idIndex] === data.id) {
        sheet.deleteRow(i + 1);
        return { mensaje: 'Mantenimiento eliminado correctamente' };
      }
    }

    throw new Error('Mantenimiento no encontrado');
  }
};

const DashboardService = {
  obtenerDatos() {
    const { data } = SheetRepository.getSheetData();
    const headers = data[0];

    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const unMesDespues = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

    const total = data.length - 1;
    let esteMes = 0;
    let proximos = 0;
    const tecnicos = new Set();
    const mensual = new Array(12).fill(0);
    const tecnicosData = {};
    const proximosMantenimientos = [];

    for (let i = 1; i < data.length; i += 1) {
      const row = data[i];
      const mantenimiento = {};

      for (let j = 0; j < headers.length; j += 1) {
        const header = headers[j];
        mantenimiento[header] = row[j];
      }

      if (mantenimiento.Fecha_Servicio) {
        const fechaServicio = new Date(mantenimiento.Fecha_Servicio);
        if (fechaServicio >= inicioMes && fechaServicio < unMesDespues) {
          esteMes += 1;
        }

        if (fechaServicio.getFullYear() === ahora.getFullYear()) {
          mensual[fechaServicio.getMonth()] += 1;
        }
      }

      if (mantenimiento.Proximo_Mantenimiento) {
        const proximoMant = new Date(mantenimiento.Proximo_Mantenimiento);
        const diffTime = proximoMant.getTime() - ahora.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0 && diffDays <= 30) {
          proximos += 1;
          proximosMantenimientos.push({
            cliente: mantenimiento.Cliente,
            fecha: mantenimiento.Proximo_Mantenimiento,
            tecnico: mantenimiento.Tecnico_Asignado,
            dias_restantes: diffDays
          });
        }
      }

      if (mantenimiento.Tecnico_Asignado) {
        tecnicos.add(mantenimiento.Tecnico_Asignado);
        if (!tecnicosData[mantenimiento.Tecnico_Asignado]) {
          tecnicosData[mantenimiento.Tecnico_Asignado] = 0;
        }
        tecnicosData[mantenimiento.Tecnico_Asignado] += 1;
      }
    }

    proximosMantenimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const tecnicosArray = Object.keys(tecnicosData).map((tecnico) => ({
      tecnico,
      count: tecnicosData[tecnico]
    }));

    return {
      total,
      esteMes,
      proximos,
      tecnicos: tecnicos.size,
      mensual,
      tecnicosData: tecnicosArray,
      proximosMantenimientos: proximosMantenimientos.slice(0, 10)
    };
  }
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { action } = data;

    let result;
    switch (action) {
      case 'guardar':
        result = MantenimientoService.guardar(data);
        break;
      case 'buscar':
        result = MantenimientoService.buscar(data);
        break;
      case 'actualizar':
        result = MantenimientoService.actualizar(data);
        break;
      case 'eliminar':
        result = MantenimientoService.eliminar(data);
        break;
      case 'dashboard':
        result = DashboardService.obtenerDatos();
        break;
      default:
        throw new Error('Acción no válida');
    }

    return ResponseFactory.success(result);
  } catch (error) {
    return ResponseFactory.error(error);
  }
}

function doGet(e) {
  const { action } = e.parameter;

  try {
    const result = action === 'dashboard'
      ? DashboardService.obtenerDatos()
      : { message: 'API funcionando' };

    return ResponseFactory.success(result);
  } catch (error) {
    return ResponseFactory.error(error);
  }
}
