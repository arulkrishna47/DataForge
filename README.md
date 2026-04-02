# Cortexa - AI/ML Data & Training Services Platform

## Project Overview
Cortexa is a premium, full-stack AI data services platform designed to manage the end-to-end lifecycle of machine learning data. From large-scale web scraping to high-precision annotation and model fine-tuning, Cortexa provides the infrastructure needed by top-tier AI research labs.

### **Tech Stack**
-   **Frontend**: React 19, Vite 8, Tailwind CSS v4, Framer Motion, Lucide React.
-   **Backend**: Node.js, Express, Prisma 7 (PostgreSQL), JWT, Multer.
-   **Infrastructure**: Docker, Docker Compose.

---

## **Installation & Setup**

### **1. Prerequisites**
-   Node.js v20+
-   PostgreSQL (Local or Docker)
-   Docker Desktop (Optional, for containerized deployment)

### **2. Backend Configuration**
1.  Navigate to `/server`.
2.  Copy `.env.example` to `.env`.
3.  Configure `DATABASE_URL` (e.g., `postgresql://user:password@localhost:5432/cortexa`).
4.  Run `npm install`.
5.  Migrate the database: `npx prisma migrate dev --name init`.
6.  Seed the admin user: `npm run seed`.
7.  Start server: `npm run dev`.

### **3. Frontend Configuration**
1.  Navigate to `/client`.
2.  Run `npm install`.
3.  Start dev server: `npm run dev`.
4.  Access the platform at `http://localhost:5173`.

---

## **Key Features**
-   **Public Landing Page**: Premium responsive design with interactive service cards and CTA flows.
-   **Service Requests**: Clients can submit technical briefs which are automatically converted to project pipelines by admins.
-   **Client Portal**: Secure dashboard to track project status, view production logs, and download final deliverables.
-   **Admin Command Center**: Complete control over all platform project lifecycles, client registries, and file deployments.
-   **Role-Based Security**: HttpOnly cookie-based JWT authentication with strict `client` vs `admin` guarding.

---

## **Deployment**
To deploy the entire stack using Docker:
```bash
docker-compose up --build -d
```
The platform will automatically provision the PostgreSQL database, backend API, and a production-grade frontend build.
