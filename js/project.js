document.addEventListener("DOMContentLoaded", function () {
  const platform = window.ErasmusFilters;
  const countryDialog = platform.createCountryDialog();
  const selectedProjectId = new URLSearchParams(window.location.search).get("id");
  const residenceSelect = document.getElementById("detailResidenceFilter");
  const projectDetails = document.getElementById("projectDetails");
  const projectSidebar = projectDetails.querySelector(".detail-card__sidebar");
  const applyButton = document.getElementById("projectApplyButton");
  const infopackButton = document.getElementById("projectInfopackButton");
  const acceptedCountriesList = document.getElementById("acceptedCountriesList");
  let selectedProject = null;

  initialize().catch(function () {
    showNotFound();
  });

  async function initialize() {
    const projects = await platform.loadProjectsData();
    selectedProject = projects.find(function (project) {
      return project.id === selectedProjectId;
    }) || null;

    if (!selectedProject) {
      showNotFound();
      return;
    }

    renderProject(selectedProject);
    bindEvents();
  }

  function bindEvents() {
    residenceSelect.addEventListener("change", function (event) {
      platform.saveResidenceCountry(event.target.value);
    });

    applyButton.addEventListener("click", async function () {
      let selectedCountry = residenceSelect.value;
      const acceptedCountries = getAcceptedCountries(selectedProject);

      if (!selectedCountry) {
        selectedCountry = await countryDialog.requestCountry(platform.getSavedResidenceCountry(), acceptedCountries);

        if (!selectedCountry) {
          return;
        }

        residenceSelect.value = selectedCountry;
        platform.saveResidenceCountry(selectedCountry);
      }

      const applicationUrl = platform.resolveApplicationForm(selectedProject, selectedCountry);

      if (!applicationUrl) {
        platform.showToast("This project does not accept applications from your country.");
        return;
      }

      window.open(applicationUrl, "_blank", "noopener");
    });
  }

  function renderProject(project) {
    const acceptedCountries = getAcceptedCountries(project);

    document.title = project.title + " | Erasmus+ Youth Opportunities";
    document.getElementById("projectActionBadge").textContent = project.ka_action;
    document.getElementById("projectTitle").textContent = project.title;
    document.getElementById("projectSummary").textContent = project.summary;
    document.getElementById("projectKaAction").textContent = project.ka_action;
    document.getElementById("projectNgo").textContent = project.hosting_ngo;
    document.getElementById("projectLocationLine").textContent = "📍 " + project.location_city + ", " + project.destination_country;
    document.getElementById("projectDatesLine").textContent = "📅 " + platform.formatProjectDateRange(project.start_date, project.end_date);
    infopackButton.href = project.infopack_url;
    platform.populateCountrySelect(residenceSelect, platform.getSavedResidenceCountry(), acceptedCountries);

    acceptedCountriesList.innerHTML = acceptedCountries
      .map(function (country) {
        return "<li>" + escapeHtml(country) + "</li>";
      })
      .join("");

    projectSidebar.hidden = false;
  }

  function showNotFound() {
    document.title = "Project Not Found | Erasmus+ Youth Opportunities";
    document.getElementById("projectActionBadge").textContent = "Project not found";
    document.getElementById("projectTitle").textContent = "We could not find that project.";
    document.getElementById("projectSummary").textContent = "The project may have been removed or the URL may be incorrect.";
    document.getElementById("projectKaAction").textContent = "Unavailable";
    document.getElementById("projectNgo").textContent = "Please return to the catalog.";
    document.getElementById("projectLocationLine").textContent = "";
    document.getElementById("projectDatesLine").textContent = "";
    acceptedCountriesList.innerHTML = "";
    projectSidebar.hidden = true;
  }

  function getAcceptedCountries(project) {
    return Object.keys(project.application_forms || {}).sort(function (left, right) {
      return left.localeCompare(right);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
});