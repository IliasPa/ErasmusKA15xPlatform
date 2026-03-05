---
name: Project submission
about: Submit a new KA15x project (site also opens prefilled issue)
title: "Submission: "
labels: submission
assignees: []
---

Please paste a JSON payload describing the project in a fenced code block. Example:

```json
{
  "title": "KA15 - Example",
  "ngo_name": "My NGO",
  "ngo_contact_email": "contact@ngo.org",
  "year": "2025",
  "destination_country": "Greece",
  "eligible_residence_countries": "ALL",
  "infopack_url": "https://...",
  "application_form_url_default": "https://...",
  "application_form_urls_by_residence": "{\"Greece\":\"https://...\"}",
  "description": "Short description",
  "tags": "youth;exchange",
  "submitted_at": "2025-01-01T00:00:00Z",
  "status": "PENDING"
}
```

The site at /docs/submit.html will open a prefilled issue for you.
