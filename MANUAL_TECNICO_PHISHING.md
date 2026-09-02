# Manual técnico de phishing educativo

## Carven2

**Proyectos:** `nestjs-procesos` y `proyecto-one`  
**Versión:** 1.0  
**Fecha:** 21/08/2026

> Uso exclusivo para capacitación y pruebas autorizadas. No deben utilizarse credenciales reales.

## 1. Propósito y alcance

### 1.1. Propósito

Documentar de forma rápida el funcionamiento del módulo Carven2, encargado de registrar visitas e intentos de una simulación educativa de phishing.

### 1.2. Alcance

Incluye únicamente:

- Frontend: `/carven2`, `/carven2/admin`, `Carven2.jsx`, `AdminPanel.jsx` y `App.jsx`.
- Backend: `src/phishing` y `phishing_registros.json`.

## 2. Funcionamiento general

```text
Usuario -> /carven2 -> POST /phishing/registrar -> phishing_registros.json

Administrador -> /carven2/admin -> consulta, exportación y eliminación
```

Al abrir `/carven2` se registra una visita. Al enviar el identificador de prueba, se registra un intento.

Los datos almacenados incluyen:

- ID.
- CH.
- IP.
- Navegador.
- Página.
- Fecha y hora.
- Tipo: `visita` o `intento`.

## 3. Puesta en marcha

### Backend

```powershell
npm install
npm run start:dev
```

### Frontend

```powershell
npm install
npm run dev
```

El frontend utiliza actualmente:

```text
http://localhost:3001
```

El backend usa `PORT` o, por defecto, el puerto `3001`. Debe existir un proxy o una configuración que alinee ambos puertos.

## 4. Rutas principales

| Método | Endpoint                  | Función                       |
| ------ | ------------------------- | ----------------------------- |
| POST   | `/phishing/registrar`     | Registrar visita o intento    |
| POST   | `/phishing/verify-admin`  | Validar acceso administrativo |
| GET    | `/phishing/registros`     | Consultar registros           |
| GET    | `/phishing/stats`         | Consultar estadísticas        |
| DELETE | `/phishing/delete/:id`    | Eliminar un registro          |
| DELETE | `/phishing/delete-all`    | Eliminar todos                |
| GET    | `/phishing/export/txt`    | Exportar TXT                  |
| GET    | `/phishing/export/excel`  | Exportar CSV                  |
| GET    | `/phishing/json`          | Ver registros en JSON         |
| GET    | `/phishing/download-json` | Descargar el JSON             |
| GET    | `/phishing/ver`           | Mostrar registros en HTML     |

## 5. Panel administrativo

Ruta:

```text
/carven2/admin
```

Muestra:

- Total de registros.
- Visitas.
- Intentos.
- Datos capturados.
- Opciones de exportación y eliminación.

La contraseña administrativa se configura mediante `PHISHING_ADMIN_PASSWORD` y no debe escribirse en el código ni en la documentación. El endpoint requiere una integración de autenticación y control de intentos antes de producción.

## 6. Persistencia

El servicio utiliza este archivo:

```text
<process.cwd()>/phishing_registros.json
```

La entidad TypeORM y `phishing_registros.db` no son la fuente principal utilizada actualmente.

Antes de eliminar registros, realiza un respaldo del JSON:

```text
phishing_registros_backup_YYYY-MM-DD.json
```

## 7. Riesgos importantes

- El módulo no almacena ni exporta contraseñas; los ejercicios deben usar identificadores ficticios.
- Los endpoints administrativos no tienen autenticación propia suficiente.
- `/phishing/ver` muestra registros sin pedir contraseña.
- La contraseña administrativa se obtiene exclusivamente desde el entorno.
- Los archivos CSV pueden quedar en `temp/`.
- No hay control de concurrencia para varias instancias del backend.

## 8. Checklist rápido

- [ ] El ejercicio fue autorizado.
- [ ] No se usan credenciales reales.
- [ ] Frontend y backend utilizan el host y puerto correctos.
- [ ] Existe respaldo de `phishing_registros.json`.
- [ ] `/carven2` registra visitas.
- [ ] `/carven2/admin` muestra estadísticas.
- [ ] Las exportaciones funcionan.
- [ ] Las eliminaciones están autorizadas.
- [ ] `/phishing/ver` está protegido o deshabilitado.
