# Erasmus KA15x Directory (Static GitHub Pages)

This repository implements a purely static site for listing Erasmus+ KA15x projects, intake via GitHub Issues, and an approval pipeline using GitHub Actions (no backend server).

Features
- Search and filter projects by year, destination country, and residence country.
- Per-project application form selection: per-residence mapping, global mapping, or default.
- NGOs submit projects via a form that opens a prefilled GitHub Issue (or use the issue template).
- Repository owner approves submissions by adding an `approve` label; workflow appends the project to `data/projects.csv`.

Repository structure
- /docs — GitHub Pages site (index.html, submit.html, admin.html, JS/CSS)
- /data/projects.csv — canonical dataset (approved and historic)
- /data/forms_by_residence_country.json — mapping for residence country -> form URL
- /.github/workflows — GitHub Actions for email and approval flows
- /.github/ISSUE_TEMPLATE — issue template to guide manual submissions

Quick setup
1. Enable GitHub Pages: Settings → Pages → Source: `gh-pages` or `main` (set to `docs` folder). Set to serve from `/docs`.
2. Update site config for issue creation (already set to this repo):
   - `docs/submit.html` has `OWNER` = `IliasPa` and `REPO` = `ErasmusKA15xPlatform`.
   - `docs/app.js` has `CONFIG.REPO_OWNER` = `IliasPa` and `CONFIG.REPO_NAME` = `ErasmusKA15xPlatform`.
   - Contact email defaults to `iliasparaskevas3@gmail.com` (workflows will use `secrets.OWNER_EMAIL` if set).
3. Secrets needed (Repository Settings → Secrets & variables → Actions):
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` — for sending email notifications.
   - `EMAIL_FROM` — from address for the notification email.
   - `OWNER_EMAIL` — the email address that receives submission notifications.
   - `OWNER_USERNAME` — GitHub username of the owner who can approve (used in approval workflow).
   - `GITHUB_TOKEN` will be available automatically to workflows; ensure default permissions allow contents: write.

   Approval and PR flow
   - When an issue is created the `issue_opened_email.yml` workflow emails the owner and includes quick action links to prefill a comment with `/approve` or `/reject`.
   - If the owner posts `/approve` (or adds the `approve` label), the repository will create a branch, append the approved project to `data/projects.csv`, regenerate `data/projects.json`, and open a pull request for review.
   - When the PR is merged the `pr_merged_process.yml` workflow will comment and close the originating issue.

How NGO submission works
1. NGO fills the form at `/docs/submit.html` and clicks submit.
2. The button opens a prefilled GitHub Issue creation page with label `submission` and a JSON payload in a code block.
3. When the issue is opened, a workflow (`issue_opened_email.yml`) sends an email to `OWNER_EMAIL` with the submission and instructions.

Approval flow (owner)
1. Open the issue created by the NGO.
2. If you want to approve, add the `approve` label. Only collaborators can label issues; the workflow also checks `OWNER_USERNAME`.
3. The `label_approval.yml` workflow runs, parses the JSON payload from the issue body, appends a properly escaped CSV row to `/data/projects.csv`, commits, and pushes the change.
4. The issue can be closed automatically by the workflow (customize as needed).

Notes and security
- No secrets are exposed to the client. The submission form only opens a GitHub Issue — the user must be logged into GitHub to submit.
- Approval requires repository collaborator permissions (labeling). The workflow additionally checks `OWNER_USERNAME` to avoid accidental processing.
- Email sending relies on SMTP credentials stored in repository secrets.

CSV schema (columns)
- id,title,ngo_name,ngo_contact_email,year,destination_country,eligible_residence_countries,infopack_url,application_form_url_default,application_form_urls_by_residence,description,tags,status,submitted_at,approved_at

Customization
- Update `/data/forms_by_residence_country.json` to change global mapping.
- Style and behavior live in `/docs/style.css` and `/docs/app.js`.

Developer notes
- The approval workflow uses a small Python snippet to append CSV rows using the `csv` module to ensure proper escaping.
- If you prefer PR-based intake, you can modify the submit flow to create a PR instead of an issue.
