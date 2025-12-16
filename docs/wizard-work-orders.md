# Wizard de Creación de Work Orders

Documentación técnica del sistema de creación de Work Orders en el módulo de Agenda.

## 📁 Archivos Principales

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| `CreateWorkOrderModal.tsx` | `frontend/js/modules/agenda/` | Modal principal - UI y lógica del formulario |
| `createWOTypes.ts` | `frontend/js/modules/agenda/` | Tipos TypeScript y esquema de validación Zod |
| `createWOHooks.ts` | `frontend/js/modules/agenda/` | Hooks React para funcionalidad |

---

## ✨ Features Implementadas

### 🔍 1. Búsqueda de Clientes
- Autocomplete con búsqueda en tiempo real
- Normalización de texto (sin acentos) para mejor matching
- Dropdown con resultados que muestra razón social y dirección

### 📍 2. Google Places para Direcciones
- Integración con Google Places Autocomplete API
- Para direcciones alternativas o nuevos clientes
- Obtiene coordenadas (lat/lng) automáticamente
- Permite usar una dirección diferente a la del cliente

### 🔧 3. Selección Cascada de Servicios
El formulario permite seleccionar servicio en cascada:
1. **Sistema** → Carga los sistemas disponibles (filtrados por equipos del cliente)
2. **Catálogo de Servicios** → Filtrado por sistema seleccionado
3. **Duración estimada** → Se auto-calcula según el servicio

**Tipos de Tarea disponibles:**
| Código | Nombre |
|--------|--------|
| `MP` | Mantenimiento Preventivo |
| `CAL` | Calibración |
| `VAL` | Validación |
| `INSTA` | Instalación |
| `REP` | Reparación |

### 🏢 4. Equipos del Cliente
- Hook `useClientEquipments` para cargar equipos del cliente seleccionado
- Filtra automáticamente los sistemas disponibles según los equipos que tiene el cliente
- Muestra información del equipo: serie, modelo, tag_id

### ⚠️ 5. Sistema de Prioridades

| Prioridad | Color | Icono | Descripción |
|-----------|-------|-------|-------------|
| Baja | Azul | 🔵 | Trabajo normal, sin urgencia |
| Media | Amarillo | 🟡 | Default - prioridad estándar |
| Alta | Naranja | 🟠 | Urgente, requiere atención pronto |
| EMERGENCIA_COMODIN | Rojo | 🔴 | Máxima prioridad, requiere validación |

### 🃏 6. Validación del Comodín de Emergencia
- Hook `useComodinValidation(userId)`
- Cada usuario tiene un número limitado de usos de prioridad EMERGENCIA
- El sistema valida los usos restantes antes de permitir crear la WO
- Previene abuso del sistema de prioridad máxima

### ✅ 7. Validación del Formulario
Usa `react-hook-form` + `zod` para validación tipada en tiempo real.

**Campos del formulario:**
```typescript
{
  // Cliente (requerido)
  cliente_id: UUID,
  cliente_nombre: string,
  
  // Dirección (opcional - para direcciones alternativas)
  direccion?: string,
  lat?: number,
  lng?: number,
  
  // Servicio (opcional pero recomendado)
  sistema_id?: string,
  catalogo_servicio_id?: string,
  tipo_tarea?: 'MP' | 'CAL' | 'VAL' | 'INSTA' | 'REP',
  
  // Detalles (requeridos)
  titulo: string,          // mín. 5 caracteres
  descripcion?: string,
  tiempo_servicio_estimado: number,  // 15-480 minutos
  
  // Prioridad (requerido)
  prioridad: 'Baja' | 'Media' | 'Alta' | 'EMERGENCIA_COMODIN',
  
  // Notas internas (opcional)
  notas_internas?: string
}
```

### 🗑️ 8. Eliminación de Work Orders
- Hook `useDeleteWorkOrder`
- Permite eliminar WOs desde el backlog
- Confirmación antes de eliminar

---

## 🪝 Hooks Disponibles

### useClientSearch
```typescript
const { clients, searchClients, isLoading } = useClientSearch();
// searchClients(query: string) - busca clientes por nombre
```

### useCatalogoServicios
```typescript
const { 
  sistemas,           // Lista de sistemas
  servicios,          // Lista completa de servicios
  getServiciosBySistema,  // Filtra servicios por sistema
  getDuracionEstimada,    // Obtiene duración según servicio
  isLoading 
} = useCatalogoServicios();
```

### useClientEquipments
```typescript
const { 
  equipments,           // Equipos del cliente
  loadClientEquipments, // Carga equipos dado un cliente_id
  getClientSistemas     // Obtiene sistemas únicos del cliente
} = useClientEquipments();
```

### useComodinValidation
```typescript
const { 
  usosRestantes,    // Número de usos restantes del comodín
  validateComodin,  // Valida si puede usar el comodín
  isValidating 
} = useComodinValidation(userId);
```

### useCreateWorkOrder
```typescript
const { 
  createWorkOrder,  // Función para crear WO
  isCreating,       // Estado de loading
  error             // Error si hubo
} = useCreateWorkOrder();
```

### useDeleteWorkOrder
```typescript
const { 
  deleteWorkOrder,  // Función para eliminar WO
  isDeleting,
  error 
} = useDeleteWorkOrder();
```

### usePlacesAutocomplete
```typescript
const { 
  suggestions,      // Sugerencias de direcciones
  searchPlaces,     // Busca lugares
  getPlaceDetails,  // Obtiene detalles (lat/lng)
  isLoading 
} = usePlacesAutocomplete();
```

---

## 🔄 Flujo de Uso

```mermaid
flowchart TD
    A[Usuario hace clic en "Nueva OT"] --> B[Se abre CreateWorkOrderModal]
    B --> C[Busca y selecciona cliente]
    C --> D{¿Cambiar dirección?}
    D -->|Sí| E[Usa Google Places]
    D -->|No| F[Usa dirección del cliente]
    E --> G[Selecciona sistema]
    F --> G
    G --> H[Selecciona servicio del catálogo]
    H --> I[Duración se auto-calcula]
    I --> J[Ingresa título y descripción]
    J --> K{¿Prioridad EMERGENCIA?}
    K -->|Sí| L[Valida comodín]
    K -->|No| M[Continúa]
    L -->|OK| M
    L -->|Error| N[Muestra error]
    M --> O[Guarda WO]
    O --> P[WO aparece en Backlog como "pendiente"]
```

---

## 📊 Estados de Work Order

| Estado | Descripción |
|--------|-------------|
| `pendiente` | Recién creada, en backlog |
| `programada` | Asignada a técnico y fecha |
| `en_progreso` | El técnico la está ejecutando |
| `completada` | Finalizada |
| `cancelada` | Cancelada |

---

## 🔗 Dependencias

- `react-hook-form` - Manejo de formularios
- `@hookform/resolvers` - Integración con Zod
- `zod` - Validación de esquemas
- `lucide-react` - Iconos
- Google Places API - Autocompletado de direcciones

---

## 📅 Última actualización
Diciembre 2024
