document.addEventListener("DOMContentLoaded", function () {
  const platform = window.ErasmusFilters;
  const selectedProjectId = new URLSearchParams(window.location.search).get(
    "id",
  );
  const residenceSelect = document.getElementById("detailResidenceFilter");
  const projectDetails = document.getElementById("projectDetails");
  const projectSidebar = projectDetails.querySelector(".detail-card__sidebar");
  const applyButton = document.getElementById("projectApplyButton");
  const infopackButton = document.getElementById("projectInfopackButton");
  const acceptedCountriesList = document.getElementById(
    "acceptedCountriesList",
  );
  const applicationIntro = document.getElementById("applicationIntro");
  const applicationTitle = document.getElementById("applicationTitle");
  const residenceField = document.getElementById("residenceField");
  const acceptedCountriesBlock = document.getElementById(
    "acceptedCountriesBlock",
  );
  let selectedProject = null;

  initialize().catch(function () {
    showNotFound();
  });

  async function initialize() {
    const projects = await platform.loadProjectsData();
    selectedProject =
      projects.find(function (project) {
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

    applyButton.addEventListener("click", function () {
      const acceptedCountries = getAcceptedCountries(selectedProject);
      let selectedCountry;

      if (acceptedCountries.length === 1) {
        // Only one eligible country: there is just one form, so open it
        // directly without asking the visitor to pick.
        selectedCountry = acceptedCountries[0];
      } else {
        // Several countries: open the form for whichever one is picked in the
        // dropdown. If nothing is picked yet, prompt the visitor to choose.
        selectedCountry = residenceSelect.value;

        if (!selectedCountry) {
          platform.showToast("Please select your country of residence.");
          return;
        }

        platform.saveResidenceCountry(selectedCountry);
      }

      const applicationUrl = platform.resolveApplicationForm(
        selectedProject,
        selectedCountry,
      );

      if (!applicationUrl) {
        platform.showToast(
          "This project does not accept applications from your country.",
        );
        return;
      }

      window.open(applicationUrl, "_blank", "noopener");
    });
  }

  function renderProject(project) {
    const acceptedCountries = getAcceptedCountries(project);

    document.title = project.title + " | Erasmus+ Youth Opportunities";
    document.getElementById("projectActionBadge").textContent =
      project.ka_action;
    document.getElementById("projectTitle").textContent = project.title;
    document.getElementById("projectSummary").textContent = project.summary;
    document.getElementById("projectKaAction").textContent = project.ka_action;
    document.getElementById("projectNgo").textContent = project.hosting_ngo;
    document.getElementById("projectLocationLine").textContent =
      "📍 " + project.location_city + ", " + project.destination_country;
    document.getElementById("projectDatesLine").textContent =
      "📅 " +
      platform.formatProjectDateRange(project.start_date, project.end_date);
    infopackButton.href = project.infopack_url;
    platform.populateCountrySelect(
      residenceSelect,
      platform.getSavedResidenceCountry(),
      acceptedCountries,
    );

    acceptedCountriesList.innerHTML = acceptedCountries
      .map(function (country) {
        return "<li>" + escapeHtml(country) + "</li>";
      })
      .join("");

    applyApplicationLayout(acceptedCountries);

    projectSidebar.hidden = false;
  }

  // Show only what makes sense for how many application forms the project has:
  //   0 countries → no form exists. Hide the dropdown, the Apply button, the
  //                 intro line and the "Accepted residence countries" list, and
  //                 turn the block into an infopack-only block ("Infopack").
  //   1 country   → one form only. Hide the dropdown and the list; the intro
  //                 names the single country and Apply opens its form directly.
  //   2+ countries → keep the title, intro, dropdown, Apply and list as before.
  function applyApplicationLayout(acceptedCountries) {
    const count = acceptedCountries.length;

    // The dropdown only matters when there are 2+ countries to choose between.
    residenceField.hidden = count < 2;
    // Apply is pointless when there is no form to open.
    applyButton.hidden = count === 0;
    // The accepted-countries list is only shown for 2+ countries.
    acceptedCountriesBlock.hidden = count < 2;

    if (count === 0) {
      applicationTitle.textContent = "Infopack";
      applicationIntro.hidden = true;
    } else if (count === 1) {
      applicationTitle.textContent = "Application";
      applicationIntro.hidden = false;
      // Show the country as the same pill used in the accepted list so it stands out.
      applicationIntro.innerHTML =
        "This project accepts applicants from " +
        countryTag(acceptedCountries[0]) +
        "";
    } else {
      applicationTitle.textContent = "Application";
      applicationIntro.hidden = false;
      applicationIntro.textContent =
        "Select one of the accepted residence countries to open the correct application form for this project.";
    }
  }

  function countryTag(country) {
    return '<span class="country-tag">' + escapeHtml(country) + "</span>";
  }

  function showNotFound() {
    document.title = "Project Not Found | Erasmus+ Youth Opportunities";
    document.getElementById("projectActionBadge").textContent =
      "Project not found";
    document.getElementById("projectTitle").textContent =
      "We could not find that project.";
    document.getElementById("projectSummary").textContent =
      "The project may have been removed or the URL may be incorrect.";
    document.getElementById("projectKaAction").textContent = "Unavailable";
    document.getElementById("projectNgo").textContent =
      "Please return to the catalog.";
    document.getElementById("projectLocationLine").textContent = "";
    document.getElementById("projectDatesLine").textContent = "";
    acceptedCountriesList.innerHTML = "";
    projectSidebar.hidden = true;
  }

  function getAcceptedCountries(project) {
    return Object.keys(project.application_forms || {}).sort(
      function (left, right) {
        return left.localeCompare(right);
      },
    );
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
