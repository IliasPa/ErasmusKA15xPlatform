(function () {
  const STORAGE_KEY = "erasmusResidenceCountry";
  const COUNTRIES = [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
    "Turkey"
  ];

  let toastTimer = null;

  function createInitialState() {
    return {
      search: "",
      month: "all",
      projectType: "all",
      destination: "all",
      residence: getSavedResidenceCountry()
    };
  }

  function getSavedResidenceCountry() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function saveResidenceCountry(country) {
    try {
      if (!country) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, country);
    } catch (error) {
      return;
    }
  }

  function populateSelect(selectElement, values, defaultLabel, defaultValue) {
    if (!selectElement) {
      return;
    }

    selectElement.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = defaultValue;
    placeholderOption.textContent = defaultLabel;
    selectElement.appendChild(placeholderOption);

    values.forEach(function (value) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      selectElement.appendChild(option);
    });
  }

  function populateCountrySelect(selectElement, selectedValue, allowedCountries) {
    const countries = Array.isArray(allowedCountries) && allowedCountries.length
      ? allowedCountries.slice().sort(function (left, right) {
          return left.localeCompare(right);
        })
      : COUNTRIES;

    populateSelect(selectElement, countries, "Select your country", "");

    if (selectedValue && countries.indexOf(selectedValue) !== -1) {
      selectElement.value = selectedValue;
    }
  }

  function getUniqueValues(projects, key) {
    return Array.from(
      new Set(
        projects
          .map(function (project) {
            return project[key];
          })
          .filter(Boolean)
      )
    ).sort(function (left, right) {
      if (typeof left === "number" && typeof right === "number") {
        return right - left;
      }

      return String(left).localeCompare(String(right));
    });
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function buildMonthOption(date) {
    return {
      value: date.getFullYear() + "-" + padNumber(date.getMonth() + 1),
      label: date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric"
      })
    };
  }

  function getUpcomingMonths(count) {
    const baseDate = new Date();
    baseDate.setDate(1);
    const months = [];

    for (let index = 0; index < count; index += 1) {
      const monthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + index, 1);
      months.push(buildMonthOption(monthDate));
    }

    return months;
  }

  function getMonthRange(monthValue) {
    if (!monthValue || monthValue === "all") {
      return null;
    }

    const parts = monthValue.split("-");

    if (parts.length !== 2) {
      return null;
    }

    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;

    if (Number.isNaN(year) || Number.isNaN(monthIndex)) {
      return null;
    }

    return {
      start: new Date(year, monthIndex, 1),
      end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
    };
  }

  function parseProjectDate(value) {
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value + "T00:00:00");
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  function projectMatchesMonth(project, monthValue) {
    const monthRange = getMonthRange(monthValue);

    if (!monthRange) {
      return true;
    }

    const startDate = parseProjectDate(project.start_date);
    const endDate = parseProjectDate(project.end_date) || startDate;

    if (!startDate || !endDate) {
      return false;
    }

    return startDate <= monthRange.end && endDate >= monthRange.start;
  }

  function formatProjectDateRange(startDateValue, endDateValue) {
    const startDate = parseProjectDate(startDateValue);
    const endDate = parseProjectDate(endDateValue) || startDate;

    if (!startDate || !endDate) {
      return "Dates to be announced";
    }

    const sameMonth = startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear();
    const sameYear = startDate.getFullYear() === endDate.getFullYear();

    if (sameMonth) {
      return startDate.getDate() + " " + startDate.toLocaleDateString("en-GB", { month: "short" }) + " – " + endDate.getDate() + " " + endDate.toLocaleDateString("en-GB", { month: "short" }) + " " + endDate.getFullYear();
    }

    if (sameYear) {
      return startDate.getDate() + " " + startDate.toLocaleDateString("en-GB", { month: "short" }) + " – " + endDate.getDate() + " " + endDate.toLocaleDateString("en-GB", { month: "short" }) + " " + endDate.getFullYear();
    }

    return startDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }) + " – " + endDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function filterProjects(projects, state) {
    return projects.filter(function (project) {
      const matchesMonth = projectMatchesMonth(project, state.month);
      const matchesProjectType = state.projectType === "all" || project.ka_action === state.projectType;
      const matchesDestination = state.destination === "all" || project.destination_country === state.destination;
      const matchesResidence = !state.residence || Boolean(resolveApplicationForm(project, state.residence));
      const matchesSearch = !state.search || [
        project.title,
        project.summary,
        project.hosting_ngo,
        project.location_city,
        project.destination_country,
        project.ka_action
      ].some(function (field) {
        return normalize(field).includes(normalize(state.search));
      });

      return matchesMonth && matchesProjectType && matchesDestination && matchesResidence && matchesSearch;
    });
  }

  function resolveApplicationForm(project, residenceCountry) {
    if (!project || !residenceCountry) {
      return null;
    }

    return project.application_forms ? project.application_forms[residenceCountry] || null : null;
  }

  async function loadProjectsData() {
    const jsonPath = "data/projects.json";

    try {
      const response = await fetch(jsonPath, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Unable to load project data.");
      }

      return await response.json();
    } catch (fetchError) {
      if (window.location.protocol === "file:") {
        return loadProjectsDataFromIframe(jsonPath);
      }

      throw fetchError;
    }
  }

  function loadProjectsDataFromIframe(jsonPath) {
    return new Promise(function (resolve, reject) {
      const iframe = document.createElement("iframe");
      let isResolved = false;

      iframe.style.display = "none";
      iframe.src = jsonPath;

      const cleanup = function () {
        iframe.remove();
      };

      const fail = function () {
        cleanup();
        reject(new Error("Unable to read local project data. Open the site through GitHub Pages or a local static server if your browser blocks file access."));
      };

      iframe.addEventListener("load", function () {
        if (isResolved) {
          return;
        }

        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const rawText = doc.body ? doc.body.textContent : doc.documentElement.textContent;
          const parsed = JSON.parse(rawText);
          isResolved = true;
          cleanup();
          resolve(parsed);
        } catch (error) {
          fail();
        }
      });

      iframe.addEventListener("error", fail);
      document.body.appendChild(iframe);
    });
  }

  function showToast(message) {
    const toastElement = document.getElementById("toast");

    if (!toastElement) {
      return;
    }

    toastElement.textContent = message;
    toastElement.classList.add("is-visible");

    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(function () {
      toastElement.classList.remove("is-visible");
    }, 3000);
  }

  function createCountryDialog() {
    const dialog = document.getElementById("countryDialog");
    const select = document.getElementById("dialogCountrySelect");
    const confirmButton = document.getElementById("dialogConfirmButton");
    const cancelButton = document.getElementById("dialogCancelButton");

    if (!dialog || !select || !confirmButton || !cancelButton) {
      return {
        requestCountry: function () {
          return Promise.resolve("");
        }
      };
    }

    populateCountrySelect(select, getSavedResidenceCountry());

    return {
      requestCountry: function (selectedValue, allowedCountries) {
        populateCountrySelect(select, selectedValue || getSavedResidenceCountry(), allowedCountries);

        return new Promise(function (resolve) {
          let isSettled = false;

          const finalize = function (result) {
            if (isSettled) {
              return;
            }

            isSettled = true;
            cleanup();

            if (dialog.open) {
              dialog.close();
            }

            resolve(result);
          };

          const handleConfirm = function () {
            if (!select.value) {
              showToast("Please select your country of residence.");
              return;
            }

            finalize(select.value);
          };

          const handleCancel = function (event) {
            if (event) {
              event.preventDefault();
            }

            finalize("");
          };

          const handleNativeClose = function () {
            finalize("");
          };

          const cleanup = function () {
            confirmButton.removeEventListener("click", handleConfirm);
            cancelButton.removeEventListener("click", handleCancel);
            dialog.removeEventListener("cancel", handleCancel);
            dialog.removeEventListener("close", handleNativeClose);
          };

          confirmButton.addEventListener("click", handleConfirm);
          cancelButton.addEventListener("click", handleCancel);
          dialog.addEventListener("cancel", handleCancel);
          dialog.addEventListener("close", handleNativeClose);
          dialog.showModal();
        });
      }
    };
  }

  window.ErasmusFilters = {
    countries: COUNTRIES,
    createCountryDialog: createCountryDialog,
    createInitialState: createInitialState,
    filterProjects: filterProjects,
    formatProjectDateRange: formatProjectDateRange,
    getSavedResidenceCountry: getSavedResidenceCountry,
    getUpcomingMonths: getUpcomingMonths,
    getUniqueValues: getUniqueValues,
    loadProjectsData: loadProjectsData,
    parseProjectDate: parseProjectDate,
    projectMatchesMonth: projectMatchesMonth,
    populateCountrySelect: populateCountrySelect,
    populateSelect: populateSelect,
    resolveApplicationForm: resolveApplicationForm,
    saveResidenceCountry: saveResidenceCountry,
    showToast: showToast
  };
})();