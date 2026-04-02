# Project: AI Data Services Platform

## Business Overview
A commercial website that offers four core AI/ML services to clients:
1. Dataset Collection — web scraping, file upload, API data ingestion
2. Model Training — custom model training, fine-tuning, transfer learning
3. Dataset Annotation — image/text/audio labeling, review workflows
4. Model Improvement Suggestions — accuracy diagnostics, retraining advice

## How the Business Works
- Visitors land on the website, browse services, and register their email 
  with a service requirement form (what they need, project scope, timeline, budget)
- The submission is emailed to the admin and stored in a database
- Admin reviews, processes, and responds to each request via an admin dashboard
- Once work is delivered, admin uploads deliverables and marks job complete
- Clients can log in to track their project status

## Pages Required
### Public Pages (no login needed)
- Home / Landing page — hero section, services overview, how it works, 
  stats, testimonials, CTA
- Services page — detailed breakdown of all 4 services with pricing tiers
- About page — team, mission, why choose us
- Contact page — contact form + address + social links
- Blog/Resources page — static blog listing with 2-3 placeholder articles
- Pricing page — Basic, Pro, Enterprise tiers per service
- Register/Request page — email + service selection + requirement form

### Client Portal (login required)
- Client login and signup
- Client dashboard — list of submitted projects, each with status badge
  (Submitted / In Review / In Progress / Delivered / Completed)
- Project detail page — timeline, uploaded deliverables, messages from admin
- Settings — update email, password

### Admin Dashboard (separate login, role-based)
- Admin login
- Request inbox — table of all client submissions, filterable by service/status
- Project management — Kanban or table view, assign status, upload deliverables
- Client management — list of all registered clients
- Team management — add/remove team members, assign roles
- Invoicing — create and send invoice to client email
- Analytics — charts for monthly requests, revenue, completion rate
- Notification center — email alerts on new submissions

## Tech Stack
- Frontend: React.js with Tailwind CSS
- Backend: Node.js with Express.js
- Database: PostgreSQL (with Prisma ORM)
- Auth: JWT-based authentication with role separation (client, admin)
- Email: Nodemailer with Gmail SMTP or SendGrid
- File Storage: Local filesystem with multer (or AWS S3 if possible)
- Deployment-ready: Add a Dockerfile and .env.example file

## Design Style
- Clean, modern, professional B2B SaaS look
- Color palette: deep navy (#0F172A) + electric blue accent (#3B82F6) + white
- Font: Inter for all text
- Mobile responsive across all pages
- Smooth animations using Framer Motion on landing page sections

## Folder Structure
/client         → React frontend
/server         → Node/Express backend
/prisma         → Database schema and migrations
README.md
Dockerfile
.env.example