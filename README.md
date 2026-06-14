# Erasmus+ Youth Opportunities

This project is a pure static website for browsing Erasmus+ youth projects such as youth exchanges and training courses. It reads all project data from a local JSON file and can be hosted on GitHub Pages without any backend, database, or build step.

## What the project does

- Displays Erasmus+ youth projects from `data/projects.json`
- Lets visitors search projects by keyword
- Filters by month, project type, destination country, and residence-country eligibility
- Opens the correct application form based on the visitor's country of residence
- Shows a dedicated details page for each project
- Includes a static-friendly NGO submission page with repeatable country/application form rows and client-side validation
- Includes a lightweight static suggestions page for feedback, corrections, and missing project suggestions

## Project structure

```text
erasmus-projects-platform/
  index.html
  project.html
  submit.html
  suggest.html
  css/
    style.css
  js/
    app.js
    filters.js
    project.js
    submit.js
  data/
    projects.json
  assets/
    logo.png
  README.md
```

## How data works

The site reads project entries from `data/projects.json`.

Each project object uses this structure:

```json
{
  "id": "proj-001",
  "title": "Youth Exchange in Lisbon",
  "ka_action": "KA152 – Youth Exchange",
  "location_city": "Lisbon",
  "destination_country": "Portugal",
  "start_date": "2026-07-15",
  "end_date": "2026-07-24",
  "hosting_ngo": "Example NGO",
  "infopack_url": "https://example.org/infopack.pdf",
  "summary": "A youth exchange about sustainability and green innovation.",
  "application_forms": {
    "Greece": "https://example.org/forms/greece",
    "Italy": "https://example.org/forms/italy",
    "Spain": "https://example.org/forms/spain"
  }
}
```

`application_forms` maps country of residence to the correct form URL.
Projects are shown on the homepage only when they match the selected month and, if `My Country` is set, when an application form exists for that country.

## How to add a new project

To add a project:

1. Open `data/projects.json`
2. Add a new object at the end of the array
3. Commit the change

Make sure each project has:

- A unique `id`
- A `ka_action` value that matches one of the supported project types
- A valid `location_city`, `start_date`, and `end_date`
- A valid `infopack_url`
- A complete `application_forms` object for supported countries

## NGO submission form

The site includes `submit.html`, a static-friendly submission form for NGOs.

- The form is ready for Formspree-style integration
- Configure your form service endpoint to send submissions to `prinem@gmail.com`
- Replace the placeholder `action` URL in `submit.html` with your actual form service endpoint
- Repeatable country/application-form rows are managed in `js/submit.js`
- Client-side validation checks required fields, date order, and URL fields

### File uploads

File uploads cannot work with plain static HTML alone. They require a third-party form service that supports multipart form uploads.

- If your form service supports uploads, keep the file input enabled and use `multipart/form-data`
- If it does not, use the Infopack URL field instead

## Suggestions form

The site also includes `suggest.html`, a lightweight page for normal users to send platform feedback, corrections, missing project suggestions, or general comments.

- It uses a simple static form structure with optional name and email fields
- Replace the placeholder form `action` URL with your preferred form service endpoint
- No backend is required

## Deployment on GitHub Pages

If this folder is the root of your repository:

1. Push the files to GitHub
2. Open the repository settings
3. Go to Pages
4. Set the source to deploy from the `main` branch and the root folder
5. Save the settings

If you keep this project inside a larger repository, publish the contents of `erasmus-projects-platform` as the GitHub Pages site directory.

## Local usage

Open `index.html` in a modern browser to browse the catalog.

Some browsers apply extra security rules to local JSON files when using the `file://` protocol. If that happens on your machine, the same project will work without changes on GitHub Pages or any simple static server.

## Maintenance notes

- Styling is centralized in `css/style.css`
- Shared filtering, country, and data-loading helpers are in `js/filters.js`
- Homepage behavior is in `js/app.js`
- Single-project page behavior is in `js/project.js`
- Submission form behavior is in `js/submit.js`
- No build tools or package managers are required