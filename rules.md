# Agent Rules and Constraints

1. Never assume or hallucinate — if you are unsure about a requirement, 
   stop and ask before proceeding.

2. Always create an implementation plan with a task list before writing 
   any code. Wait for approval before starting.

3. Write production-quality code — no placeholder comments like 
   "add logic here". Every function must be fully implemented.

4. Every page must be fully connected — no dead links, no broken routes, 
   no hardcoded dummy data except for blog posts.

5. All forms must validate inputs on both frontend and backend.

6. Auth must be properly secured — JWT stored in httpOnly cookies, 
   passwords hashed with bcrypt, role checks on all protected routes.

7. The admin dashboard and client portal must be completely separate 
   route groups with their own middleware guards.

8. Always create a .env.example file listing every environment variable 
   needed, with placeholder values and comments explaining each one.

9. After building each major section, use the browser agent to open it, 
   test it, and take a screenshot as an artifact before moving to the next.

10. After the full build, generate a README.md with:
    - Project overview
    - How to install and run locally
    - How to set up the database
    - How to configure environment variables
    - How to deploy to a VPS or cloud platform

11. Do not use any deprecated libraries. Use the latest stable versions.

12. Every API endpoint must return proper HTTP status codes and 
    structured JSON error messages.

13. The final codebase must be deployable — include a Dockerfile and 
    docker-compose.yml that runs frontend + backend + PostgreSQL together.
```

---

## Master Prompt (send this after saving both files)
```
Please read the instructions.md and rules.md files carefully.

You are building a full production-ready commercial website for an AI/ML 
data services company. The complete specification is in instructions.md. 
All constraints and quality rules are in rules.md.

Follow this exact build order:

PHASE 1 — Setup and scaffolding
Create the full folder structure for /client and /server. 
Set up React with Tailwind, Express with Prisma, and PostgreSQL schema. 
Create .env.example and Dockerfile.

PHASE 2 — Database and auth
Create Prisma schema with models: User (client), Admin, Project, 
ServiceRequest, Invoice, BlogPost, Notification. 
Implement JWT auth with role-based middleware for client and admin.

PHASE 3 — Backend API
Build all REST API endpoints for:
- Auth (register, login, logout, reset password)
- Service requests (create, list, update status)
- Projects (CRUD, assign status, upload deliverable)
- Admin (all client management and analytics endpoints)
- Invoicing (create, send via email)
- File uploads (multer middleware)

PHASE 4 — Public frontend
Build all public-facing pages: Home, Services, Pricing, About, 
Contact, Blog, and the Request/Register page. 
Make them fully responsive and visually polished.

PHASE 5 — Client portal
Build the client login, signup, dashboard, project detail, 
and settings pages with full API integration.

PHASE 6 — Admin dashboard
Build the complete admin panel with all sections: 
request inbox, project management, client list, team management, 
invoicing, analytics charts, and notifications.

PHASE 7 — Testing and verification
Use the browser agent to open and test every page. 
Submit a test service request and verify it appears in the admin inbox. 
Log in as a client and verify project status updates reflect correctly.

PHASE 8 — Final polish
Generate README.md with full setup, run, and deployment instructions. 
Verify docker-compose.yml runs the entire stack cleanly.

Use Planning Mode for each phase. Show me the task list and 
implementation plan before executing each phase. 
After completing each phase, show me a browser screenshot artifact 
before moving to the next phase.