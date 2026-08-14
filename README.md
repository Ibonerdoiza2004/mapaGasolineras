# ⛽ Mapa de Gasolineras (GasStation App)

¡Bienvenido a **Mapa de Gasolineras**! Una aplicación web interactiva diseñada para la localización geoespacial de estaciones de servicio, análisis de tendencias de precios y planificación inteligente de rutas de viaje.

---

## 🎯 Objetivo del Proyecto

El objetivo principal de esta plataforma es ofrecer una herramienta avanzada para **optimizar el gasto y la logística en el repostaje de combustible**. 

A diferencia de los buscadores tradicionales, esta aplicación combina la potencia geoespacial de **PostGIS** con análisis de tendencias de mercado, gestión de usuarios para monitorización de precios y un **planificador de viajes con paradas personalizadas** exportable directamente a Google Maps.

---

## ✨ Funcionalidades Principales

* 🗺️ **Mapa Interactivo:** Explora el mapa de forma fluida (zoom, desplazamiento) con las estaciones de servicio integradas.
* 📍 **Geolocalización por Rango:** Añade tu ubicación actual para visualizar únicamente las gasolineras dentro del radio de distancia deseado.
* ⛽ **Filtro de Combustible:** Filtra al instante según el tipo de carburante que necesite tu vehículo (Diésel, Gasolina 95, Gasolina 98).
* 📈 **Análisis de Tendencias:**
  * **Tendencias Generales:** Visualización de la evolución global de los precios del combustible.
  * **Tendencias Locales:** Análisis de precios según el rango o zona geográfica seleccionada.
* 🔍 **Ficha Detallada:** Accede a la información completa y detallada de cada gasolinera (precios actualizados, horarios y servicios).
* 👤 **Gestión de Usuarios y Favoritos:**
  * Sistema de registro e inicio de sesión.
  * Guarda tus gasolineras habituales en favoritos para monitorizar la variación de sus precios de forma rápida y sencilla.
* 🚗 **Planificador de Rutas Inteligente (Punto A ➔ Punto B):**
  * Traza rutas de viaje especificando origen y destino.
  * Añade paradas en las gasolineras que elijas a lo largo del trayecto.
  * **Cálculo en Tiempo Real:** Observa cómo cambian la distancia total y el tiempo estimado de viaje al incluir o modificar paradas.
  * 📲 **Exportación a Google Maps:** Exporta la ruta final configurada con todas sus paradas directamente a Google Maps para iniciar la navegación.

---

## 🛠️ Tecnologías Utilizadas

### **Backend**
* **Java 21** & **Spring Boot 4.x**
* **Spring Data JPA** & **Hibernate 7** (soporte nativo para tipos geométricos y espaciales)
* **PostgreSQL** + **PostGIS** (Base de datos relacional y geoespacial)
* **Maven** (Gestor de dependencias)

### **Frontend**
* **Node.js 22**
* **JavaScript / TypeScript** + **Vite / React** *(o el framework de tu elección)*
* Bibliotecas de mapas (Leaflet / OpenStreetMap / Mapbox)

### **Infraestructura y Entorno**
* **Docker & Docker Compose** (para el despliegue del contenedor de PostGIS)
* **Conda** (gestión de versiones del entorno de desarrollo)

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu sistema:

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con integración WSL2 activada si usas Windows).
* [Conda](https://docs.conda.io/en/latest/) (Miniconda o Anaconda) para la gestión unificada de Java, Maven y Node.js.
* [Git](https://git-scm.com/).

---

## 🚀 Guía de Instalación y Puesta en Marcha

Sigue estos pasos para clonar e iniciar el proyecto en tu máquina local:

### 1. Clonar el Repositorio

```bash
git clone [https://github.com/TU_USUARIO/TU_REPOSITORIO.git](https://github.com/TU_USUARIO/TU_REPOSITORIO.git)
cd TU_REPOSITORIO

```

---

### 2. Configurar el Entorno de Desarrollo (Conda)

Crea y activa el entorno virtual con las versiones necesarias:

```bash
# Crear entorno con Java 21, Maven y Node.js 22
conda create -n gas -c conda-forge openjdk=21 maven nodejs=22 -y

# Activar entorno
conda activate gas
```

---

### 3. Levantar la Base de Datos (PostGIS)

Asegúrate de que Docker está corriendo e inicia el contenedor geoespacial:

```bash
# Opción A: Si usas Docker Compose (desde la raíz del proyecto)
docker compose up -d

# Opción B: Si ejecutas la imagen directamente con Docker
docker run --name postgis-gasolineras \
  -e POSTGRES_DB=gasolineras_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgrespassword \
  -p 5432:5432 \
  -d postgis/postgis
```

---

### 4. Arrancar el Backend (Spring Boot 4)

Navega a la carpeta del backend y ejecuta el servidor de desarrollo:

```bash
cd backend
./mvnw spring-boot:run
```

> ℹ️ La API del Backend estará disponible en **`http://localhost:8080`**.

---

### 5. Arrancar el Frontend

Abre una **nueva pestaña de la terminal**, activa el entorno y arranca el cliente:

```bash
# Activa el entorno en la nueva pestaña de terminal
conda activate gas

# Entra en el directorio del cliente
cd frontend
npm install
npm run dev
```

> ℹ️ La aplicación web estará accesible en **`http://localhost:5173`** (o el puerto asignado por Vite).

---

## 🗄️ Parámetros de Conexión a la Base de Datos (Dev)

Si deseas inspeccionar las tablas, datos o capas geoespaciales mediante **DBeaver** o **pgAdmin**:

| Parámetro | Valor |
| :--- | :--- |
| **Host** | `localhost` |
| **Puerto** | `5432` |
| **Database** | `gasolineras_dev` |
| **Usuario** | `postgres` |
| **Contraseña** | `postgrespassword` |

---

## 📁 Estructura del Proyecto

```text
.
├── backend/             # Proyecto Spring Boot 4
│   ├── src/             # Controladores REST, Entidades JPA, Repositorios Espaciales
│   ├── pom.xml          # Gestor de dependencias Maven
│   └── mvnw             # Maven Wrapper
├── frontend/            # Cliente web (Astro / React)
│   ├── src/             # Vistas, Componentes de Mapas y Servicios API
│   └── package.json     # Gestor de paquetes de Node.js
├── docker-compose.yml   # Definición del contenedor de PostGIS
└── README.md            # Documentación del proyecto
```

---

## 🔄 Flujo de Trabajo Diario y Comandos Útiles

### 1. Inicio Rápido Diario (Día a Día)

En tu rutina diaria de desarrollo, abre tu terminal y ejecuta:

```bash
# 1. Activa tu entorno Conda
conda activate gas

# 2. Asegúrate de que la base de datos esté encendida
docker compose up -d

# 3. Arrancar el Backend (en una pestaña de la terminal)
cd backend
./mvnw spring-boot:run

# 4. Arrancar el Frontend (en otra pestaña con conda activate gas)
cd frontend
npm run dev
```

---

### 2. Ejecución Limpia (*Clean Run*)

Si has hecho cambios grandes en el código, cambiado la base de datos o Maven no detecta algunos cambios, haz un reinicio limpio:

#### **Backend (Limpiar compilación y arrancar):**
```bash
cd backend
./mvnw clean spring-boot:run
```

#### **Base de Datos (Reiniciar o recrear desde cero):**
```bash
# Reiniciar el contenedor
docker compose restart

# Borrar datos y recrear el contenedor limpio
docker compose down -v
docker compose up -d
```

#### **Frontend (Limpiar caché y reinstalar nodos):**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

### 3. Actualización de Dependencias

#### **Backend (Maven):**
```bash
cd backend

# Forzar la descarga de dependencias actualizadas desde el repositorio
./mvnw clean compile -U

# Verificar dependencias desactualizadas
./mvnw versions:display-dependency-updates
```

#### **Frontend (npm):**
```bash
cd frontend

# Actualizar paquetes instalados según package.json
npm update

# Comprobar qué paquetes tienen versiones más recientes
npm outdated
```

---

### 4. Apagar el Entorno al Finalizar

Para cerrar la base de datos y liberar los puertos cuando termines de trabajar:

```bash
# Detener contenedores de Docker
docker compose down
```