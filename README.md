# ⛽ Mapa de Gasolineras (GasStation App)

> 🚀 **Aplicación web geoespacial avanzada para localización, análisis de precios y planificación inteligente de rutas de repostaje.**

¡Bienvenido a **Mapa de Gasolineras**! Una plataforma interactiva diseñada para optimizar el gasto y la logística en el repostaje de combustible. Combina la potencia geoespacial de **PostGIS** con análisis de tendencias de mercado, gestión de usuarios y un planificador de viajes inteligente.

---

## 📋 Tabla de Contenidos

- [✨ Funcionalidades](#-funcionalidades-principales)
- [🛠️ Tech Stack](#-tecnologías-utilizadas)
- [📋 Requisitos](#-requisitos-previos)
- [🏃 Inicio Rápido](#-inicio-rápido-local-dev)
- [📁 Estructura](#-estructura-del-proyecto)
- [🔄 Workflow Diario](#-flujo-de-trabajo-diario)
- [🧪 Testing](#-testing)
- [🚀 Despliegue Producción](#-despliegue-en-producción)
- [📚 Documentación API](#-documentación-de-api)
- [🐛 Troubleshooting](#-troubleshooting)
- [📄 Licencia](#-licencia)
- [🤝 Contribuir](#-contribuir)
- [🗺️ Roadmap](#-roadmap)

---

## ✨ Funcionalidades Principales

* 🗺️ **Mapa Interactivo** - Explora de forma fluida con zoom y desplazamiento suave
* 📍 **Geolocalización por Rango** - Visualiza gasolineras dentro de un radio específico
* ⛽ **Filtro de Combustible** - Búsqueda por tipo (Diésel, Gasolina 95, Gasolina 98)
* 📈 **Análisis de Tendencias** - Gráficos de evolución de precios (globales y locales)
* 🔍 **Ficha Detallada** - Información completa: precios, horarios, servicios
* 👤 **Sistema de Usuarios & Favoritos** - Registro, login y seguimiento de precios personalizados
* 🚗 **Planificador de Rutas Inteligente** - Diseña rutas con paradas optimizadas y exporta a Google Maps
* 📲 **Integración con Google Maps** - Exporta rutas directamente para navegación

---

## 🛠️ Tecnologías Utilizadas

### **Backend**
- **Java 21** + **Spring Boot 4.x** - Framework REST
- **Spring Data JPA** + **Hibernate 7** - ORM con soporte geoespacial nativo
- **PostgreSQL 15+** + **PostGIS** - BD relacional y geoespacial
- **Maven** - Gestor de dependencias

### **Frontend**
- **Node.js 22** - Runtime JavaScript
- **Astro 4.x** + **React 18** - Framework moderno con SSR
- **TypeScript** - Tipado estático
- **Leaflet / Mapbox** - Librerías de mapas

### **Infraestructura**
- **Docker & Docker Compose** - Containerización
- **PostgreSQL + PostGIS** (Docker) - BD local
- **Conda** - Gestor de entornos (Java, Maven, Node)
- **Cloudflare** - DNS, SSL/TLS y protección DDoS (plan gratuito)
- **Oracle Cloud Always Free** - Servidor producción (gratuito)

---

## 📋 Requisitos Previos

Asegúrate de tener instalado:

| Herramienta | Versión | Enlace |
| :--- | :--- | :--- |
| **Docker Desktop** | Latest | [Descargar](https://www.docker.com/products/docker-desktop/) |
| **Conda** | Miniconda/Anaconda | [Descargar](https://docs.conda.io/en/latest/) |
| **Git** | Latest | [Descargar](https://git-scm.com/) |

> **Nota para Windows:** Activa WSL2 en Docker Desktop para mejor rendimiento.

---

## 🏃 Inicio Rápido (Local - Dev)

### 1️⃣ Clonar Repositorio

```bash
git clone https://github.com/TU_USUARIO/mapaGasolineras.git
cd mapaGasolineras
```

### 2️⃣ Configurar credenciales de PostgreSQL

Si todavía no existe `backend/.env.local`, créalo a partir de la plantilla:

```bash
cp backend/.env.example backend/.env.local
```

Edita `backend/.env.local` y configura el usuario, contraseña, base de datos,
host y puerto que utilizará este entorno. El mismo usuario y contraseña se
utilizarán para crear PostgreSQL y para conectar el backend.

### 3️⃣ Arrancar los servicios con Docker Compose

El archivo `docker-compose.dev.yml` utiliza perfiles. Todos los comandos usan
las credenciales locales de `backend/.env.local`; el código se monta como
volumen, por lo que Spring Boot y Astro recargan los cambios durante el
desarrollo. La imagen de PostgreSQL se construye desde la imagen oficial y
funciona tanto en equipos AMD64 como ARM64 (por ejemplo, servidores Oracle
Cloud basados en Ampere).

| Necesidad | Comando |
| :--- | :--- |
| Solo PostgreSQL + PostGIS | `docker compose --env-file backend/.env.local -f docker-compose.dev.yml --profile db up -d` |
| Backend y su base de datos | `docker compose --env-file backend/.env.local -f docker-compose.dev.yml --profile backend up --build` |
| Solo frontend | `docker compose -f docker-compose.dev.yml --profile frontend up --build` |
| Aplicación completa | `docker compose --env-file backend/.env.local -f docker-compose.dev.yml --profile all up --build` |

La primera ejecución descarga las imágenes y dependencias. La aplicación
completa queda disponible en `http://localhost:4321` y el backend en
`http://localhost:8080`. En Compose, el backend conecta a PostgreSQL mediante
el nombre interno `db`; no hay que cambiar `POSTGRES_HOST=localhost` en el
archivo local, que se conserva para ejecutar el backend fuera de Docker.

Para detener los servicios y conservar los datos de PostgreSQL:

```bash
docker compose -f docker-compose.dev.yml --profile all down
```

Usa `docker compose -f docker-compose.dev.yml --profile all down --volumes`
solo si quieres eliminar también los datos locales de la base de datos.

---

## 🗄️ Credenciales Base de Datos (Dev)

Para inspeccionar BD con **DBeaver** o **pgAdmin**:

| Parámetro | Valor |
| :--- | :--- |
| **Host** | `localhost` |
| **Puerto** | Valor de `POSTGRES_PORT` en `backend/.env.local` |
| **Database** | Valor de `POSTGRES_DB` en `backend/.env.local` |
| **Usuario** | Valor de `POSTGRES_USER` en `backend/.env.local` |
| **Contraseña** | Valor de `POSTGRES_PASSWORD` en `backend/.env.local` |

---

## 📁 Estructura del Proyecto

```
mapaGasolineras/
├── 📂 backend/                    # Spring Boot 4
│   ├── src/
│   │   ├── main/java/com/example/gasolineras_api/
│   │   │   ├── controller/        # REST Controllers
│   │   │   ├── service/           # Lógica de negocio
│   │   │   ├── repository/        # Queries espaciales PostGIS
│   │   │   ├── domain/            # Entidades JPA del dominio
│   │   │   ├── dto/               # Objetos de transferencia de datos
│   │   │   ├── mapper/            # Conversiones dominio <-> DTO
│   │   │   ├── exception/         # Excepciones y manejo de errores
│   │   │   ├── config/            # Configuración de Spring
│   │   │   ├── client/            # Clientes de APIs externas
│   │   │   └── scheduler/         # Tareas programadas
│   │   └── resources/
│   │       ├── application.properties
│   │       ├── application-prod.properties
│   │       └── data.sql           # Datos iniciales
│   ├── pom.xml                    # Dependencias Maven
│   ├── mvnw                       # Maven Wrapper
│   └── Dockerfile.dev             # Imagen de desarrollo
│
├── 📂 frontend/                   # Astro + React
│   ├── src/
│   │   ├── components/            # Componentes React
│   │   ├── pages/                 # Rutas Astro
│   │   ├── layouts/               # Layouts
│   │   └── services/              # API client
│   ├── package.json
│   ├── tsconfig.json
│   ├── astro.config.mjs
│   └── Dockerfile.dev             # Imagen de desarrollo
│
├── 📄 docker-compose.dev.yml      # Servicios de desarrollo y perfiles
└── 📄 README.md                   # Este archivo
```

---

## 🔄 Flujo de Trabajo Diario

### ⚡ Inicio Rápido (Rutina Diaria)

```bash
# Arrancar base de datos, backend y frontend en primer plano.
docker compose --env-file backend/.env.local -f docker-compose.dev.yml --profile all up --build
```

### 🧹 Ejecución Limpia (Clean Run)

Si haces cambios grandes o Maven no detecta cambios:

```bash
# Detener los servicios y borrar también los datos locales de PostgreSQL.
docker compose --env-file backend/.env.local -f docker-compose.dev.yml --profile all down --volumes

# Reconstruir y volver a iniciar todo el entorno.
docker compose --env-file backend/.env.local -f docker-compose.dev.yml --profile all up --build
```

### 📦 Actualizar Dependencias

```bash
# Backend
cd backend
./mvnw clean compile -U
./mvnw versions:display-dependency-updates

# Frontend
cd frontend
npm update
npm outdated
```

### 🛑 Apagar Entorno

```bash
docker compose --env-file backend/.env.local -f docker-compose.dev.yml --profile all down
```

---

## 🧪 Testing

Los tests se ejecutan en contenedores desechables; no es necesario instalar
Node.js ni Java en el host. Desde la raíz del proyecto:

```bash
task test          # backend + frontend unitario + E2E (Playwright)
task test:backend  # solo backend (JUnit 5)
task test:frontend # solo frontend unitario (Vitest + React Testing Library)
task test:e2e      # solo E2E (Playwright, móvil y escritorio)
task lint          # ESLint + astro check
task check         # lint + tipado + tests + build (gate completo de CI local)
```

### Backend - JUnit 5 + Mockito

```bash
# Equivalente directo si prefieres correrlo sin Task:
cd backend
./mvnw verify
```

**Estructura de tests recomendada:**
```
src/test/java/com/example/gasolineras_api/
├── controller/
│   └── GasolinerasControllerTest.java
├── service/
│   └── GasolinerasServiceTest.java
└── repository/
    └── GasolinerasRepositoryTest.java
```

### Frontend - Vitest + React Testing Library + Playwright

Los tests de componentes usan Vitest y React Testing Library (interactúan con la
interfaz), y los flujos completos se cubren con Playwright en `frontend/e2e/`.

```bash
task test:frontend  # unitarios
task test:e2e       # navegador real
```

---

## 🚀 Despliegue en Producción

El despliegue está automatizado con GitHub Actions
(`.github/workflows/deploy-production.yml`):

- **Push/PR a `dev`**: tests y build de todo el proyecto.
- **PR a `main`**: tests y smoke test de producción (sin desplegar).
- **Push a `main` (o merge de PR)**: tests, smoke test y despliegue:
  - **Backend + BD** → servidor Oracle vía SSH (`docker compose up --build`).
  - **Frontend** → Cloudflare Pages (build estático de Astro).

### Topología

- Frontend estático en Cloudflare Pages (`https://tudominio.com`).
- API en el subdominio `https://api.tudominio.com`, servida por Caddy en Oracle
  y expuesta mediante Cloudflare. Caddy emite un certificado Let's Encrypt real
  (HTTPS automático). `PUBLIC_API_URL` apunta a `https://api.tudominio.com`.
- Mientras no haya dominio propio, puedes usar `nip.io` como alternativa
  temporal: `DOMAIN=api.<IP>.nip.io` y
  `PUBLIC_API_URL=https://api.<IP>.nip.io`.
- Caddy en Oracle hace `reverse_proxy` de todo el tráfico a `backend:8080`.

### Secretos y variables de GitHub

Configúralos en *Settings → Secrets and variables → Actions*:

| Secreto / variable | Descripción |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Token de Cloudflare con permiso `Pages:Edit`. |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador de la cuenta de Cloudflare. |
| `CLOUDFLARE_PROJECT_NAME` | Nombre del proyecto de Cloudflare Pages. |
| `ORACLE_HOST` | IP o hostname del servidor de Oracle. |
| `ORACLE_SSH_USER` | Usuario SSH del servidor (p. ej. `ubuntu` u `opc`). |
| `ORACLE_SSH_KEY` | Clave privada SSH de despliegue. |
| `POSTGRES_DB` | Nombre de la base de datos de producción. |
| `POSTGRES_USER` | Usuario de la base de datos de producción. |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos de producción. |
| `DOMAIN` | `api.tudominio.com` (subdominio de la API). |
| `PUBLIC_API_URL` *(variable)* | `https://api.tudominio.com`. |
| `PUBLIC_MAP_LIBRARY` *(variable)* | `leaflet`. |

### Preparación del servidor de Oracle

1. Instalar Docker y Compose v2:

   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   ```

2. Añadir la clave pública correspondiente a `ORACLE_SSH_KEY` en
   `~/.ssh/authorized_keys` del usuario de despliegue.

   No hace falta clonar el repositorio: GitHub Actions sube el código por SCP en
   cada despliegue.

### Preparación en Cloudflare

1. Crear un proyecto de **Cloudflare Pages mediante Direct Upload**. No lo
   conectes al repositorio de GitHub: GitHub Actions es el único sistema que
   compila y despliega el frontend. Usa como nombre exacto `mapagasolineras` y
   anota el *Account ID*.
2. Crear un token de API con permiso **Cloudflare Pages: Edit**.
3. Crear los registros DNS:
   - `@` y `www` → Cloudflare Pages.
   - `api` (tipo A) → IP pública del servidor Oracle, con proxy (nube naranja).
4. Configurar SSL/TLS en modo **Full (strict)** (Caddy emite certificado real).

### Despliegue manual (opcional)

Para desplegar el backend y la base de datos a mano en el servidor:

```bash
# En el servidor, con el código y el archivo .env.production ya copiados:
cd mapaGasolineras
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

Para verificar:

```bash
curl https://api.tudominio.com/actuator/health
```

---

## 🔐 Variables de Entorno (cuando sean necesarias)

El frontend y el backend reciben sus endpoints y credenciales mediante
variables de entorno. Las variables públicas del
frontend deberán añadirse en `frontend/.env.local` usando el prefijo `PUBLIC_`:

```bash
PUBLIC_API_URL=https://api.example.com
PUBLIC_MAP_LIBRARY=leaflet
```

Las variables de base de datos y del backend pertenecen a la configuración del
backend o al entorno de despliegue, no al frontend. Para desarrollo, copia
`backend/.env.example` como `backend/.env.local` y completa las variables de
PostgreSQL. `SERVER_PORT` usa `8080` si no se especifica; el host y las
credenciales de base de datos nunca tienen valores implícitos.

**Agregar a `.gitignore`:**

```
.env
.env.local
.env.*.local
*.key
*.pem
```

---

## 📚 Documentación de API

### Documentar con JavaDoc

En tus controllers, usa:

```java
@RestController
@RequestMapping("/api/gasolineras")
public class GasolinerasController {

    /**
     * Obtiene gasolineras dentro de un radio especificado
     * 
     * @param lat Latitud del punto central
     * @param lon Longitud del punto central
     * @param radio Radio en kilómetros
     * @return Lista de gasolineras cercanas
     * @throws GasolineraNotFoundException si no hay resultados
     */
    @GetMapping("/nearby")
    public ResponseEntity<List<GasolineraDTO>> getNearby(
        @RequestParam Double lat,
        @RequestParam Double lon,
        @RequestParam Double radio) {
        // implementación
    }
}
```

Generar documentación HTML:

```bash
cd backend
./mvnw javadoc:javadoc
# 📄 Abre: target/site/apidocs/index.html
```

---

## 💾 Datos Iniciales (Seeding)

### Opción 1: SQL Script

Crea `backend/src/main/resources/data.sql`:

```sql
-- Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS gasolineras (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    ubicacion GEOMETRY(Point, 4326) NOT NULL,
    combustible VARCHAR(50),
    precio DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de ejemplo
INSERT INTO gasolineras (nombre, ubicacion, combustible, precio) VALUES
('Gasolinera Centro', ST_GeomFromText('POINT(-3.7038 40.4168)', 4326), 'Gasolina95', 1.45),
('Gasolinera Norte', ST_GeomFromText('POINT(-3.6890 40.4520)', 4326), 'Diesel', 1.38);
```

### Opción 2: CommandLineRunner (Spring)

```java
@Component
public class DataLoader implements CommandLineRunner {
    @Autowired
    private GasolinerasRepository repo;

    @Override
    public void run(String... args) throws Exception {
        Gasolinera g1 = new Gasolinera();
        g1.setNombre("Gasolinera Centro");
        g1.setPrecio(1.45);
        // configurar más propiedades...
        repo.save(g1);
    }
}
```

---

## 🐛 Troubleshooting

### ❌ Backend no se conecta a BD

```bash
# Verificar que PostgreSQL está corriendo
docker ps | grep postgis

# Ver logs del contenedor
docker logs postgis-gasolineras

# Verificar credenciales en application.properties
cat backend/src/main/resources/application.properties
```

### ❌ Frontend no compila

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### ❌ Puerto ya está en uso

```bash
# Encontrar proceso en el puerto (8080, 5173, etc.)
lsof -i :8080

# Terminar proceso
kill -9 [PID]
```

### ❌ Errores de PostGIS

```bash
# Conectar a la BD
psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}"

# Dentro de psql, habilitar extensiones
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;

# Verificar
SELECT PostGIS_Version();
```

### ❌ Certificado SSL en Cloudflare

- Asegúrate que el SSL/TLS esté en "Full (Strict)"
- Cloudflare proporciona certificado automático gratuito

---

## 📄 Licencia

Este proyecto está bajo licencia **CC BY 4.0** (Creative Commons Atribución 4.0 Internacional).

### Puedes:
✅ Usar comercialmente  
✅ Modificar el código  
✅ Distribuir  
✅ Usar privadamente  

### Debes:
⚠️ Dar crédito al autor original  
⚠️ Indicar cambios realizados  
⚠️ Incluir la licencia  

📖 [Leer licencia completa](https://creativecommons.org/licenses/by/4.0/deed.es)

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Sigue estos pasos:

1. **Fork** el repositorio
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Abre un **Pull Request**

### Estándares de Código
- ✅ Sigue las convenciones del proyecto
- ✅ Documenta cambios y nuevas funciones
- ✅ Pasa todos los tests antes de hacer PR
- ✅ Usa nombres descriptivos en commits

---

## 📞 Contacto y Soporte

- 🐛 **Reportar bugs:** Abre un [Issue](https://github.com/tu-usuario/mapaGasolineras/issues)
- 💡 **Sugerir mejoras:** Crea una [Discusión](https://github.com/tu-usuario/mapaGasolineras/discussions)
- 📧 **Email:** [tu-email@example.com]

---

## 🗺️ Roadmap (Próximas Features)

- [ ] Integración con API pública de precios de gasolineras (MITMA)
- [ ] 🔔 Sistema de notificaciones (email/push) cuando baja precio
- [ ] 📊 Historial de precios y análisis avanzado de tendencias
- [ ] 📱 App móvil (React Native iOS/Android)
- [ ] 🛣️ Integración con APIs de tráfico (Google Directions)
- [ ] 🌍 Soporte multiidioma (i18n)
- [ ] 🎯 Recomendaciones basadas en IA (ML)
- [ ] 📈 Dashboard administrativo

---

## 📊 Estadísticas del Proyecto

- **Stack:** Java 21 + Spring Boot + Astro + React
- **BD:** PostgreSQL + PostGIS
- **Deployment:** Docker + Oracle Cloud + Cloudflare
- **Licencia:** CC BY 4.0
- **Estado:** En Desarrollo 🚧

---

**Hecho con ❤️ y ☕ - Última actualización: 2026-08-14**
