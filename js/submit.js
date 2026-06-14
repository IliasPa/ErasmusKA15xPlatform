document.addEventListener("DOMContentLoaded", function () {
  const platform = window.ErasmusFilters;
  const countries = platform && platform.countries ? platform.countries.slice().sort(function (left, right) {
    return left.localeCompare(right);
  }) : [];
  const form = document.getElementById("projectSubmissionForm");
  const destinationSelect = document.getElementById("submissionDestinationCountry");
  const startDateInput = document.getElementById("submissionStartDate");
  const endDateInput = document.getElementById("submissionEndDate");
  const infopackUrlInput = document.getElementById("submissionInfopackUrl");
  const applicationFormsContainer = document.getElementById("applicationFormsContainer");
  const addApplicationFormButton = document.getElementById("addApplicationFormButton");
  const noApplicationFormsCheckbox = document.getElementById("noApplicationForms");
  const rowTemplate = document.getElementById("applicationFormRowTemplate");
  const formStatus = document.getElementById("formStatus");

  initialize();

  function initialize() {
    populateDestinationCountries();
    addApplicationFormRow();

    addApplicationFormButton.addEventListener("click", function () {
      addApplicationFormRow();
      syncApplicationFormsState();
    });

    noApplicationFormsCheckbox.addEventListener("change", syncApplicationFormsState);
    form.addEventListener("submit", handleSubmit);
    startDateInput.addEventListener("change", validateDateRange);
    endDateInput.addEventListener("change", validateDateRange);
    infopackUrlInput.addEventListener("input", clearStatus);
    syncApplicationFormsState();
  }

  function populateDestinationCountries() {
    countries.forEach(function (country) {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      destinationSelect.appendChild(option);
    });
  }

  function addApplicationFormRow() {
    const rowFragment = rowTemplate.content.cloneNode(true);
    const rowElement = rowFragment.querySelector(".application-form-row");
    const countrySelect = rowFragment.querySelector(".application-form-country");
    const removeButton = rowFragment.querySelector(".application-form-remove");

    countries.forEach(function (country) {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      countrySelect.appendChild(option);
    });

    removeButton.addEventListener("click", function () {
      rowElement.remove();
      if (!noApplicationFormsCheckbox.checked && applicationFormsContainer.children.length === 0) {
        addApplicationFormRow();
      }
      syncApplicationFormsState();
    });

    applicationFormsContainer.appendChild(rowFragment);
  }

  function syncApplicationFormsState() {
    const isDisabled = noApplicationFormsCheckbox.checked;
    const rows = getApplicationFormRows();

    rows.forEach(function (row) {
      row.querySelectorAll("select, input, button").forEach(function (control) {
        if (control.classList.contains("application-form-remove")) {
          control.disabled = isDisabled || rows.length === 1;
          return;
        }

        control.disabled = isDisabled;
      });
    });

    applicationFormsContainer.classList.toggle("is-disabled", isDisabled);
    addApplicationFormButton.disabled = isDisabled;
    clearStatus();
  }

  function getApplicationFormRows() {
    return Array.from(applicationFormsContainer.querySelectorAll(".application-form-row"));
  }

  function handleSubmit(event) {
    clearStatus();
    clearCustomErrors();

    const validationErrors = [];

    validateDateRange();
    validateOptionalUrl(infopackUrlInput, "Infopack URL must be a valid URL.", validationErrors);
    validateApplicationForms(validationErrors);

    if (!form.checkValidity() || validationErrors.length > 0) {
      event.preventDefault();
      formStatus.textContent = validationErrors[0] || "Please review the highlighted fields before submitting.";
      formStatus.className = "form-status is-error";
      form.reportValidity();
      return;
    }

    if (form.action.indexOf("your-form-id") !== -1) {
      event.preventDefault();
      formStatus.textContent = "Replace the placeholder form action URL with your Formspree or other form service endpoint before submitting. Configure it to send submissions to prinem@gmail.com.";
      formStatus.className = "form-status is-error";
    }
  }

  function validateDateRange() {
    endDateInput.setCustomValidity("");

    if (!startDateInput.value || !endDateInput.value) {
      return;
    }

    if (endDateInput.value < startDateInput.value) {
      endDateInput.setCustomValidity("End date must be on or after the start date.");
    }
  }

  function validateOptionalUrl(inputElement, message, errors) {
    inputElement.setCustomValidity("");

    if (!inputElement.value) {
      return;
    }

    if (!isValidUrl(inputElement.value)) {
      inputElement.setCustomValidity(message);
      errors.push(message);
    }
  }

  function validateApplicationForms(errors) {
    const rows = getApplicationFormRows();

    if (noApplicationFormsCheckbox.checked) {
      return;
    }

    if (rows.length === 0) {
      errors.push("Add at least one application form entry or mark that no country-specific forms are available yet.");
      return;
    }

    rows.forEach(function (row) {
      const countrySelect = row.querySelector(".application-form-country");
      const urlInput = row.querySelector(".application-form-url");

      countrySelect.setCustomValidity("");
      urlInput.setCustomValidity("");

      if (!countrySelect.value || !urlInput.value) {
        const message = "Each application form row must include both a country and a valid URL.";
        if (!countrySelect.value) {
          countrySelect.setCustomValidity(message);
        }
        if (!urlInput.value) {
          urlInput.setCustomValidity(message);
        }
        errors.push(message);
        return;
      }

      if (!isValidUrl(urlInput.value)) {
        const message = "Each application form URL must be a valid URL.";
        urlInput.setCustomValidity(message);
        errors.push(message);
      }
    });
  }

  function clearCustomErrors() {
    endDateInput.setCustomValidity("");
    infopackUrlInput.setCustomValidity("");

    getApplicationFormRows().forEach(function (row) {
      row.querySelector(".application-form-country").setCustomValidity("");
      row.querySelector(".application-form-url").setCustomValidity("");
    });
  }

  function clearStatus() {
    formStatus.textContent = "";
    formStatus.className = "form-status";
  }

  function isValidUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  }
});