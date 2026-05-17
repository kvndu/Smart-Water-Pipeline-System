<div align="center">

<img src="https://img.shields.io/badge/PipeGuard-Smart%20Water%20Pipeline%20System-00b4d8?style=for-the-badge&logo=water&logoColor=white" alt="PipeGuard Banner"/>

# 💧 PipeGuard — Smart Water Pipeline Monitoring System

**An AI-powered, full-stack web application for real-time monitoring, risk assessment, and predictive maintenance of water pipeline infrastructure.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-Map%20View-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License](https://img.shields.io/badge/License-Academic-blue)](LICENSE)

> **Final Year Research Project** | Full-Stack Web Application | IoT Integration | AI Risk Engine

</div>

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Database Schema](#-database-schema)
- [API Endpoints](#-api-endpoints)
- [Application Pages](#-application-pages)
- [Risk Engine](#-risk-engine)
- [User Roles & Authentication](#-user-roles--authentication)
- [IoT Integration](#-iot-integration)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Dataset](#-dataset)
- [Academic Info](#-academic-info)

---

## 🌐 Project Overview

**PipeGuard** is a comprehensive smart water pipeline monitoring system built as a Final Year Research Project. The system integrates a React-based frontend, a Python FastAPI backend, a Supabase (PostgreSQL) cloud database, and ESP32-based IoT sensors to deliver real-time pipeline health monitoring, AI-driven risk prediction, and proactive maintenance management.

The system is based on a real-world pipeline dataset from the **Region of Waterloo & Kitchener, Ontario, Canada**, containing **16,000+ pipeline records** with detailed physical condition, material, and criticality data.

### 🎯 Objectives

| Objective | Description |
|-----------|-------------|
| 🔍 **Early Detection** | Detect high-risk pipelines before failure using multi-factor risk scoring |
| 📉 **Reduce Water Loss** | Proactively identify leak-prone segments to minimize wastage |
| 🗺️ **Visualization** | Display pipeline locations and risk levels on an interactive live map |
| 🤖 **AI Prediction** | Compute Likelihood of Failure (LoF) × Consequence of Failure (CoF) scores |
| 🛠️ **Maintenance Management** | Track repair history, assign engineers, and manage workflow |
| 📊 **Data-Driven Reporting** | Export CSV reports and analytics dashboards for decision-making |
| 📡 **IoT Monitoring** | Integrate real-time ESP32 sensor data for live flow and pressure readings |

---

## ✨ Key Features

### 🖥️ Frontend (React + Vite)
- **📊 Main Dashboard** — KPI cards (total pipelines, high-risk count, active alerts, maintenance pending), real-time charts, predictive insights, and recommendation panels
- **🗺️ Interactive Map View** — Leaflet.js map with color-coded pipeline risk overlays, cluster markers, and real GeoJSON data
- **⚠️ Alerts Panel** — Real-time alert feed with priority levels (High/Medium/Low), type filtering, and resolution workflow
- **🛠️ Maintenance Tracker** — Full maintenance workflow: Pending → In Progress → Completed, with cost logging and engineer assignment
- **🔬 Risk Calculator** — Detailed per-pipeline engineering risk report (LoF, CoF, health score, remaining life, 30/90-day projections)
- **📡 IoT Monitoring** — Live ESP32 sensor dashboard with flow rate, pressure, temperature, and leak detection readings
- **📈 Analytics** — Dataset-level charts: material distribution, risk distribution, condition score trends, pressure zone analysis
- **📋 Pipeline Registry** — Full searchable/filterable table of 16,000+ pipelines with pagination
- **➕ Add Pipeline** — Form to manually register new pipeline entries
- **📂 Reports** — CSV export of pipeline data and maintenance records
- **🔧 System Hub** — Decision support center for high-priority pipelines
- **👨‍💼 Admin Dashboard** — Administrator-only overview with system health metrics

### 🔐 Admin Panel
- **👥 Engineer Management** — Add, edit, deactivate field engineers with profile photos, NIC, shift, and area details
- **🔒 Access Control** — Toggle user permissions per module; role-based access for Admin vs. Engineer
- **📜 Audit Logs** — Track all system activity: logins, data edits, status changes
- **🚨 System Issues** — Report, track, and resolve platform-level bugs and issues

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│   React 19 + Vite 8  │  React Router v7  │  Recharts  │  Leaflet   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP / REST
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│  FastAPI Backend│   │  Supabase Direct │   │  IoT Layer (ESP32)   │
│  (Python 3.x)   │   │  (JS SDK calls)  │   │  Water Flow Sensors  │
│                 │   │                  │   │  Pressure Sensors    │
│  Risk Engine    │   │  PostgreSQL DB   │   │  Temperature Sensors │
│  AI Scoring     │   │  Row-Level Sec.  │   │  Leak Detectors      │
└────────┬────────┘   └────────┬─────────┘   └──────────┬───────────┘
         │                     │                         │
         └─────────────────────▼─────────────────────────┘
                        ┌──────────────┐
                        │   Supabase   │
                        │  PostgreSQL  │
                        │  (Cloud DB)  │
                        └──────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI Framework |
| **Vite** | 8.0 | Build Tool & Dev Server |
| **React Router DOM** | 7.13.0 | Client-Side Routing |
| **Recharts** | 3.8.1 | Charts & Data Visualization |
| **Leaflet / React-Leaflet** | 1.9.4 / 5.0.0 | Interactive Map |
| **React-Leaflet-Cluster** | 4.0.0 | Map Marker Clustering |
| **Lucide React** | 1.14.0 | Icon Library |
| **Axios** | 1.13.6 | HTTP Client |
| **Vanilla CSS** | — | Custom Styling |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.x | Backend Language |
| **FastAPI** | Latest | REST API Framework |
| **Pydantic** | v2 | Data Validation |
| **Uvicorn** | Latest | ASGI Server |
| **Supabase Python SDK** | Latest | Database Client |

### Database & Cloud
| Technology | Purpose |
|------------|---------|
| **Supabase** | Managed PostgreSQL Database |
| **PostgreSQL** | Relational Data Storage |
| **Row Level Security (RLS)** | Database-level Access Control |

### IoT Hardware
| Component | Purpose |
|-----------|---------|
| **ESP32 Microcontroller** | Main IoT processing unit |
| **Water Flow Sensor (YF-S201)** | Measures flow rate (L/min) |
| **Pressure Sensor** | Monitors pipeline pressure |
| **Temperature Sensor** | Environmental monitoring |
| **Leak Detection Module** | Binary leak detection |

---

## 🗄️ Database Schema

### `pipelines` (Imported from GeoJSON Dataset)
| Column | Type | Description |
|--------|------|-------------|
| `WATMAINID` | TEXT PK | Unique pipeline identifier |
| `OBJECTID` | INTEGER | GIS object ID |
| `STATUS` | TEXT | Active / Abandoned / Retired |
| `PRESSURE_ZONE` | TEXT | Water pressure zone |
| `MAP_LABEL` | TEXT | Geographic label |
| `CATEGORY` | TEXT | Pipeline category |
| `PIPE_SIZE` | FLOAT | Diameter in mm |
| `MATERIAL` | TEXT | Pipe material (CI, DI, PVC, HDPE…) |
| `LINED` | TEXT | Whether pipe is lined (Yes/No) |
| `CONDITION_SCORE` | FLOAT | Physical condition score (0–10) |
| `CRITICALITY` | FLOAT | Criticality value (0–10) |
| `Shape__Length` | FLOAT | Pipe length in metres |
| `risk_score` | FLOAT | Computed AI risk score (0–1) |
| `risk_level` | TEXT | High / Medium / Low |
| `failure_probability` | INTEGER | Failure probability % |
| `risk_30_day` | FLOAT | Projected 30-day risk |
| `risk_90_day` | FLOAT | Projected 90-day risk |
| `estimated_life_months` | INTEGER | Remaining useful life estimate |
| `start_lat / start_lng` | FLOAT | GPS start coordinates |
| `end_lat / end_lng` | FLOAT | GPS end coordinates |

### `maintenance_logs`
Stores completed repair records: `watmainid`, `repair_type`, `cost`, `old_risk → new_risk`, `completed_by`, `completed_at`

### `maintenance_status`
Per-pipeline workflow tracking: `PENDING → IN_PROGRESS → COMPLETED`

### `incidents`
Field-reported incidents: `pipeline_id`, `type`, `risk`, `note`, `status (OPEN/RESOLVED)`

### `engineers`
Engineer profiles: `name`, `email`, `phone`, `nic`, `area`, `department`, `designation`, `experience`, `shift`, `status`

### `audit_logs`
System activity tracking: `user_name`, `role`, `action`, `module`, `status`, `created_at`

### `system_issues`
Admin issue tickets: `title`, `type`, `priority`, `status`, `reported_by`, `description`

---

## 🔌 API Endpoints

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/pipelines` | Get pipelines (with risk enrichment) |
| `GET` | `/pipelines/{id}` | Get single pipeline with full details |
| `POST` | `/pipelines` | Create a new pipeline record |
| `GET` | `/predict/{id}` | Full engineering risk report for a pipeline |
| `GET` | `/pipelines-with-risk` | All pipelines with computed risk scores |
| `POST` | `/pipelines/{id}/repair-complete` | Mark a pipeline repair as complete |
| `GET` | `/alerts` | Get all system alerts |
| `GET` | `/maintenance` | Get maintenance records |
| `GET` | `/maintenance/stats` | Maintenance statistics summary |
| `GET` | `/weather` | Current weather data |
| `GET` | `/iot-sensors` | Live IoT sensor readings |

---

## 📱 Application Pages

| Route | Page | Role | Description |
|-------|------|------|-------------|
| `/login` | Login | All | Role-based login (Admin / Engineer) |
| `/forgot-password` | Forgot Password | All | Password reset flow |
| `/dashboard` | Main Dashboard | Engineer | KPIs, charts, alerts, predictions |
| `/pipelines` | Pipeline Registry | Engineer | Browse 16,000+ pipelines |
| `/pipelines/add` | Add Pipeline | Engineer | Register new pipeline |
| `/pipelines/:id` | Pipeline Detail | Engineer | Individual pipeline info |
| `/analytics` | Analytics | Engineer | Dataset-wide charts and trends |
| `/alerts` | Alerts | Engineer | Real-time alert management |
| `/maintenance` | Maintenance | Engineer | Maintenance workflow tracker |
| `/risk-calculator` | Risk Calculator | Engineer | Detailed AI risk analysis |
| `/map-view` | Map View | Engineer | Interactive GIS pipeline map |
| `/iot-monitoring` | IoT Monitoring | Engineer | Live ESP32 sensor dashboard |
| `/reports` | Reports | Engineer | CSV export and reporting |
| `/system-hub` | System Hub | Engineer | Decision support for critical pipes |
| `/admin-dashboard` | Admin Dashboard | Admin | System-wide admin overview |
| `/engineer-management` | Engineer Management | Admin | Manage field engineer profiles |
| `/system-issues` | System Issues | Admin | Platform bug/issue tracking |
| `/access-control` | Access Control | Admin | User roles and permissions |
| `/audit-logs` | Audit Logs | Admin | Full system activity log |

---

## 🤖 Risk Engine

The backend implements a two-factor **Engineering Risk Assessment** model:

### Likelihood of Failure (LoF)
```
LoF = (Condition Risk × 0.35) + (Age Risk × 0.25) + (Material Risk × 0.15)
    + (Environment Risk × 0.15) + (Status Risk × 0.10)
```

### Consequence of Failure (CoF)
```
CoF = (Criticality Risk × 0.40) + (Pipe Size Impact × 0.25)
    + (Length Impact × 0.20) + (Location Impact × 0.15)
```

### Final Risk Score
```
Risk Score = LoF × CoF   →   Classified as High (≥0.7) / Medium (≥0.4) / Low (<0.4)
```

### Material Risk Factors
| Material | Risk Score |
|----------|-----------|
| PVC / HDPE | 0.20 (Low) |
| Ductile Iron (DI) | 0.35 (Medium) |
| Cast Iron (CI) | 0.60 (High) |
| Asbestos Cement (AC) | 0.70 (Very High) |
| Steel | 0.65 (High) |

### Predictive Projections
- **30-Day Risk** = Current Score + 0.03
- **90-Day Risk** = Current Score + 0.08
- **Remaining Life** = Based on material design life × condition factor × risk factor

---

## 🔐 User Roles & Authentication

The system supports **two user roles** with separate access levels:

### 👑 Administrator
```
Email:    admin@waterflow.com
Password: admin123
```
**Access:** Admin Dashboard, Engineer Management, System Issues, Access Control, Audit Logs + all Engineer pages

### 👷 Field Engineer
```
Email:    engineer@waterflow.com
Password: engineer123
```
**Access:** Dashboard, Pipelines, Alerts, Maintenance, Analytics, Reports, Risk Calculator, Map, IoT Monitoring

> **Note:** Authentication uses localStorage-based session management (demo implementation). Role-based route protection is enforced via `ProtectedRoute` components.

---

## 📡 IoT Integration

The system integrates with **ESP32-based physical water sensors** via Supabase Realtime:

### Sensor Data Flow
```
ESP32 Sensors → WiFi → Supabase Table → React UI (Real-time updates)
```

### Monitored Parameters
| Parameter | Sensor | Unit |
|-----------|--------|------|
| Flow Rate | YF-S201 Flow Sensor | L/min |
| Water Pressure | Pressure Transducer | PSI |
| Temperature | Temperature Sensor | °C |
| Leak Detection | Leak Detection Module | Binary (0/1) |
| Water Quality | TDS Sensor | ppm |

### Alert Thresholds
- **Flow Rate Drop > 20%** → Possible Leak Alert
- **Pressure < 20 PSI** → Low Pressure Warning
- **Leak Detected = 1** → Critical Leak Alert

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18.x
- **Python** ≥ 3.10
- **Supabase** account with project URL and API keys

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/smart-water-pipeline-system.git
cd smart-water-pipeline-system
```

### 2. Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
Frontend will run on → `http://localhost:5173`

### 3. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
source venv/bin/activate    # Linux/Mac

# Install dependencies
pip install fastapi uvicorn supabase python-dotenv pydantic

# Create .env file (see Environment Variables section)

# Start the API server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
API will run on → `http://localhost:8000`

### 4. Database Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in the Supabase dashboard
3. Run the migration file:
```bash
# Copy contents of supabase_migration.sql and paste into Supabase SQL Editor
```
4. Import the pipeline dataset (GeoJSON → CSV → Supabase `pipelines` table)

### 5. Build for Production
```bash
npm run build
```

---

## 🔑 Environment Variables

### Frontend — `.env` (root directory)
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_BACKEND_URL=http://localhost:8000
```

### Backend — `backend/.env`
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
```

---

## 📂 Project Structure

```
smart-water-pipeline-system/
│
├── 📁 src/                          # React Frontend Source
│   ├── 📁 pages/                    # Application Pages (20 pages)
│   │   ├── Dashboard.jsx            # Main engineer dashboard
│   │   ├── AdminDashboard.jsx       # Admin overview
│   │   ├── Pipelines.jsx            # Pipeline registry (16k+ records)
│   │   ├── PipelineDetail.jsx       # Single pipeline detail view
│   │   ├── AddPipeline.jsx          # New pipeline registration form
│   │   ├── Analytics.jsx            # Dataset-wide analytics & charts
│   │   ├── Alerts.jsx               # Real-time alert management
│   │   ├── Maintenance.jsx          # Maintenance workflow tracker
│   │   ├── RiskCalculator.jsx       # AI engineering risk report
│   │   ├── MapView.jsx              # Interactive Leaflet map
│   │   ├── IoTMonitoring.jsx        # Live ESP32 sensor dashboard
│   │   ├── Reports.jsx              # CSV reporting module
│   │   ├── SystemHub.jsx            # Decision support hub
│   │   ├── EngineerManagement.jsx   # Admin: engineer CRUD
│   │   ├── SystemIssues.jsx         # Admin: issue tracking
│   │   ├── AccessControl.jsx        # Admin: role/permission control
│   │   ├── AuditLogs.jsx            # Admin: activity log
│   │   ├── Login.jsx                # Role-based authentication
│   │   ├── ForgotPassword.jsx       # Password reset request
│   │   └── ResetPassword.jsx        # Password reset confirmation
│   │
│   ├── 📁 components/               # Reusable UI Components
│   │   ├── AlertPanel.jsx           # Alert display widget
│   │   ├── DatasetCharts.jsx        # Analytics chart components
│   │   ├── KPIGrid.jsx              # KPI card grid
│   │   ├── PipelineMapPlaceholder.jsx
│   │   ├── PipelineTable.jsx        # Sortable pipeline data table
│   │   ├── PredictiveInsights.jsx   # AI insight display panel
│   │   ├── RecommendationBox.jsx    # Action recommendation card
│   │   └── Toast.jsx                # Toast notification component
│   │
│   ├── 📁 layouts/
│   │   └── AppLayout.jsx            # Sidebar navigation layout
│   │
│   ├── 📁 utils/                    # Utility Modules
│   │   ├── api.js                   # Axios API client config
│   │   ├── authService.js           # Authentication logic
│   │   ├── databaseService.js       # Supabase query functions
│   │   ├── exportUtils.js           # CSV export utilities
│   │   ├── pipelineMapper.js        # GeoJSON data normalization
│   │   ├── pipelineService.js       # Pipeline data service layer
│   │   └── supabaseClient.js        # Supabase JS client init
│   │
│   ├── App.jsx                      # Root component & route definitions
│   ├── main.jsx                     # React entry point
│   └── index.css                    # Global stylesheet (18KB)
│
├── 📁 backend/                      # Python FastAPI Backend
│   ├── main.py                      # API routes & business logic (967 lines)
│   ├── risk_engine.py               # LoF × CoF risk calculation engine
│   ├── recommendation_engine.py     # Maintenance recommendation logic
│   ├── db.py                        # Supabase Python client init
│   ├── test_db.py                   # Database connection test
│   └── .env                         # Backend environment variables
│
├── 📁 public/                       # Static assets
├── 📁 dist/                         # Production build output
├── supabase_migration.sql           # Database schema & seed data
├── package.json                     # Node.js dependencies
├── vite.config.js                   # Vite configuration
├── eslint.config.js                 # ESLint configuration
├── index.html                       # HTML entry point
└── README.md                        # This file
```

---

## 📊 Dataset

| Property | Details |
|----------|---------|
| **Source** | Region of Waterloo & Kitchener, Ontario Open Data |
| **Format** | GeoJSON → CSV → Supabase PostgreSQL |
| **Records** | 16,000+ water main pipeline segments |
| **Coverage** | Waterloo & Kitchener, Ontario, Canada |
| **Key Fields** | `WATMAINID`, `MATERIAL`, `PIPE_SIZE`, `CONDITION_SCORE`, `CRITICALITY`, `STATUS`, `PRESSURE_ZONE`, `Shape__Length` |

---

## 🎓 Academic Info

| Item | Details |
|------|---------|
| **Project Type** | Final Year Research Project |
| **System Name** | PipeGuard — Smart Water Pipeline Monitoring System |
| **Domain** | Smart Infrastructure / IoT / AI |
| **Tech Focus** | Full-Stack Web App + IoT Integration + AI Risk Engine |
| **Dataset** | Waterloo/Kitchener Water Mains (Real-World Open Data) |

### Research Contributions
1. **Multi-Factor Risk Engine** — Engineering-grade LoF × CoF pipeline risk model with 30/90-day predictive projections
2. **Real-Time IoT Integration** — ESP32 sensor data pipeline with live Supabase Realtime updates
3. **Scalable Architecture** — System handles 16,000+ pipeline records with paginated queries and cluster map rendering
4. **Role-Based Management System** — Complete admin and engineer role separation with audit trail

---

## 📜 License

This project is developed for **academic research purposes** as a Final Year Project submission.

---

<div align="center">

**Built with ❤️ using React, FastAPI, Supabase & ESP32**

*PipeGuard — Protecting Water Infrastructure Through Intelligence*

</div>
