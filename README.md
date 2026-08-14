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

### 2️⃣ Crear Entorno Conda

```bash
# Crear entorno con todas las herramientas necesarias
conda create -n gas -c conda-forge openjdk=21 maven nodejs=22 -y

# Activar entorno
conda activate gas
```

### 3️⃣ Levantar Base de Datos (PostgreSQL + PostGIS)

```bash
# Opción A: Usar Docker Compose (RECOMENDADO)
docker compose up -d

# Opción B: Ejecutar directamente con Docker
docker run --name postgis-gasolineras \
  -e POSTGRES_DB=gasolineras_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -p 5432:5432 \
  -d postgis/postgis
```

✅ **PostgreSQL está listo en:** `localhost:5432`

### 4️⃣ Arrancar Backend (Spring Boot)

```bash
cd backend
./mvnw spring-boot:run
```

✅ **API disponible en:** `http://localhost:8080`

### 5️⃣ Arrancar Frontend (Astro + React)

En **otra terminal** con `conda activate gas`:

```bash
cd frontend
npm install
npm run dev
```

✅ **App web en:** `http://localhost:5173`

---

## 🗄️ Credenciales Base de Datos (Dev)

Para inspeccionar BD con **DBeaver** o **pgAdmin**:

| Parámetro | Valor |
| :--- | :--- |
| **Host** | `localhost` |
| **Puerto** | `5432` |
| **Database** | `gasolineras_dev` |
| **Usuario** | `postgres` |
| **Contraseña** | `postgrespassword` |

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
│   │   │   └── entity/            # Modelos JPA
│   │   └── resources/
│   │       ├── application.properties
│   │       ├── application-prod.properties
│   │       └── data.sql           # Datos iniciales
│   ├── pom.xml                    # Dependencias Maven
│   ├── mvnw                       # Maven Wrapper
│   └── Dockerfile                 # Para producción
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
│   └── Dockerfile                 # Para producción
│
├── 📄 docker-compose.yml          # Dev: PostgreSQL + PostGIS
├── 📄 docker-compose.prod.yml     # Prod: Backend + Frontend + BD
├── 📄 .env.example                # Template variables entorno
└── 📄 README.md                   # Este archivo
```

---

## 🔄 Flujo de Trabajo Diario

### ⚡ Inicio Rápido (Rutina Diaria)

```bash
# 1. Activar entorno
conda activate gas

# 2. Levantar base de datos
docker compose up -d

# 3. Iniciar Backend (Terminal 1)
cd backend && ./mvnw spring-boot:run

# 4. Iniciar Frontend (Terminal 2)
cd frontend && npm run dev
```

### 🧹 Ejecución Limpia (Clean Run)

Si haces cambios grandes o Maven no detecta cambios:

```bash
# Backend
cd backend && ./mvnw clean spring-boot:run

# Frontend
cd frontend && rm -rf node_modules package-lock.json && npm install && npm run dev

# Base de Datos (recrear desde cero)
docker compose down -v
docker compose up -d
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
docker compose down
conda deactivate
```

---

## 🧪 Testing

### Backend - JUnit 5 + Mockito

```bash
cd backend

# Ejecutar tests
./mvnw test

# Con reporte de cobertura
./mvnw clean test jacoco:report
# 📊 Abre: target/site/jacoco/index.html
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

### Frontend - Vitest + React Testing Library

```bash
cd frontend

# Instalar herramientas (primera vez)
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom

# Ejecutar tests
npm run test

# Con cobertura
npm run test:coverage
```

---

## 🚀 Despliegue en Producción

### 1️⃣ Build para Producción

#### Backend (JAR ejecutable)

```bash
cd backend
./mvnw clean package -DskipTests

# Output: backend/target/gasolineras-api-*.jar
```

#### Frontend (Build Astro optimizado)

```bash
cd frontend
npm run build

# Output: frontend/dist/
npm run preview  # Verificar localmente
```

### 2️⃣ Comprar Dominio en Cloudflare

1. Ve a [Cloudflare.com](https://www.cloudflare.com)
2. **Registra tu dominio** (o usa uno existente)
3. Apunta los nameservers a Cloudflare
4. Espera propagación DNS (~5-30 min)

### 3️⃣ Configurar DNS en Cloudflare

Crea estos registros A en Cloudflare Dashboard:

| Tipo | Nombre | Contenido | TTL | Proxy |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` | IP Oracle Cloud VM | Auto | ☁️ Proxied |
| **A** | `www` | IP Oracle Cloud VM | Auto | ☁️ Proxied |
| **A** | `api` | IP Oracle Cloud VM | Auto | ☁️ Proxied |

> **IP Oracle Cloud:** Obtén de Oracle Cloud Console → Instances → Public IP Address

### 4️⃣ Habilitar Seguridad en Cloudflare ✅ GRATIS

**Automáticamente activado en plan gratuito:**
- 🛡️ **Protección DDoS** - Defensa básica incluida
- 📦 **Caching** - Archivos estáticos cacheados automáticamente
- 🔒 **SSL/TLS** - Certificado HTTPS automático
- 🔐 **Firewall** - Reglas básicas de seguridad

**Configuración recomendada:**
```
Caching Level:     Cache Everything
Browser Cache TTL: 30 minutes
SSL/TLS:           Full (Strict)
```

### 5️⃣ Preparar Oracle Cloud VM

Conéctate a tu VM por SSH:

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker, Compose y Git
sudo apt install -y docker.io docker-compose git

# Agregar usuario al grupo docker (sin sudo)
sudo usermod -aG docker $USER
newgrp docker

# Iniciar Docker automáticamente
sudo systemctl enable docker
sudo systemctl start docker

# Verificar instalación
docker --version
```

### 6️⃣ Configurar Variables de Entorno

En tu VM:

```bash
cd /home/ubuntu  # o tu usuario
git clone https://github.com/TU_USUARIO/mapaGasolineras.git
cd mapaGasolineras

# Crear archivo .env
cat > .env << EOF
# Backend
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080
JAVA_OPTS=-Xmx512m -Xms256m

# PostgreSQL (Producción)
POSTGRES_DB=gasolineras_prod
POSTGRES_USER=postgres
POSTGRES_PASSWORD=TU_PASSWORD_SEGURO_AQUI
POSTGRES_HOST=postgres-db
POSTGRES_PORT=5432

# Frontend
VITE_API_URL=https://api.tudominio.com
VITE_MAP_LIBRARY=leaflet
EOF
```

> ⚠️ **IMPORTANTE:** Cambia la contraseña a algo seguro

### 7️⃣ Crear Docker Compose para Producción

Crea archivo `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres-db:
    image: postgis/postgis:latest
    container_name: postgis-prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - gasolineras-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gasolineras-backend
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD}
      SPRING_PROFILES_ACTIVE: prod
      JAVA_OPTS: ${JAVA_OPTS}
    depends_on:
      postgres-db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - gasolineras-net

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL}
    container_name: gasolineras-frontend
    ports:
      - "3000:3000"
    restart: unless-stopped
    networks:
      - gasolineras-net

volumes:
  postgres_data:

networks:
  gasolineras-net:
    driver: bridge
```

### 8️⃣ Crear Dockerfiles

**`backend/Dockerfile`:**

```dockerfile
FROM eclipse-temurin:21-jdk-alpine

WORKDIR /app
COPY . .

RUN ./mvnw clean package -DskipTests

EXPOSE 8080
ENTRYPOINT ["java", "-jar"]
CMD ["target/gasolineras-api-*.jar"]
```

**`frontend/Dockerfile`:**

```dockerfile
FROM node:22-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g http-server
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["http-server", "dist", "-p", "3000"]
```

### 9️⃣ Iniciar Servicios en Producción

```bash
# Levantar todos los contenedores
docker compose -f docker-compose.prod.yml --env-file .env up -d

# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f

# Ver logs de un servicio específico
docker compose -f docker-compose.prod.yml logs -f backend

# Detener servicios
docker compose -f docker-compose.prod.yml down
```

### 🔟 Configurar Nginx Reverse Proxy (Opcional)

Para servir en puertos 80/443:

```bash
sudo apt install -y nginx

# Crear configuración
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
upstream backend {
    server 127.0.0.1:8080;
}

upstream frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    # SSL gestionado por Cloudflare
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.tudominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 1️⃣1️⃣ Verificar Despliegue

```bash
# Ver contenedores activos
docker ps

# Verificar conectividad Backend
curl http://localhost:8080/api/health

# Verificar conectividad Frontend
curl http://localhost:3000
```

---

## 🔐 Variables de Entorno (.env)

Crea `.env` en la raíz (no incluir en Git):

```bash
# ===== DESARROLLO =====
NODE_ENV=development
VITE_API_URL=http://localhost:8080
VITE_MAP_LIBRARY=leaflet

# ===== PRODUCCIÓN =====
# NODE_ENV=production
# VITE_API_URL=https://api.tudominio.com

# ===== BASE DE DATOS =====
POSTGRES_DB=gasolineras_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgrespassword
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# ===== BACKEND =====
SPRING_PROFILES_ACTIVE=dev
SERVER_PORT=8080

# ===== APIs EXTERNAS (Opcional) =====
MAPBOX_TOKEN=
GOOGLE_MAPS_API_KEY=
```

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
psql -U postgres -d gasolineras_dev -h localhost

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
