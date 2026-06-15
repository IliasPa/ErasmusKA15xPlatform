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

  // Country name → ISO 3166-1 alpha-2 code, used to render a flag emoji next to
  // the country name in the dropdowns and lists. Covers the programme countries
  // plus the partner/neighbour countries that can show up as a destination.
  const COUNTRY_ISO = {
    "Austria": "AT", "Belgium": "BE", "Bulgaria": "BG", "Croatia": "HR",
    "Cyprus": "CY", "Czech Republic": "CZ", "Czechia": "CZ", "Denmark": "DK",
    "Estonia": "EE", "Finland": "FI", "France": "FR", "Germany": "DE",
    "Greece": "GR", "Hungary": "HU", "Iceland": "IS", "Ireland": "IE",
    "Italy": "IT", "Latvia": "LV", "Liechtenstein": "LI", "Lithuania": "LT",
    "Luxembourg": "LU", "Malta": "MT", "Netherlands": "NL", "Norway": "NO",
    "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Slovakia": "SK",
    "Slovenia": "SI", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH",
    "Turkey": "TR", "Türkiye": "TR", "United Kingdom": "GB",
    "North Macedonia": "MK", "Republic of North Macedonia": "MK", "Serbia": "RS",
    "Albania": "AL", "Montenegro": "ME", "Kosovo": "XK",
    "Bosnia and Herzegovina": "BA", "Moldova": "MD", "Ukraine": "UA",
    "Georgia": "GE", "Armenia": "AM", "Azerbaijan": "AZ", "Belarus": "BY",
    "Russia": "RU", "Morocco": "MA", "Tunisia": "TN", "Algeria": "DZ",
    "Egypt": "EG", "Jordan": "JO", "Lebanon": "LB", "Israel": "IL",
    "Palestine": "PS"
  };

  function countryFlag(name) {
    const code = COUNTRY_ISO[String(name || "").trim()];

    if (!code) {
      return "";
    }

    // Turn each letter into its regional-indicator symbol; the pair renders as a flag.
    return code.replace(/[A-Z]/g, function (letter) {
      return String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65);
    });
  }

  function withFlag(name) {
    const flag = countryFlag(name);
    return flag ? flag + " " + name : name;
  }

  let toastTimer = null;

  function createInitialState() {
    return {
      search: "",
      month: "all",
      projectType: "all",
      destination: "all",
      residence: getSavedResidenceCountry(),
      showPast: false
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

  function populateSelect(selectElement, values, defaultLabel, defaultValue, formatLabel) {
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
      // The value stays the plain country/name (filters match on it); only the
      // visible label is decorated, e.g. with a flag emoji.
      option.value = value;
      option.textContent = formatLabel ? formatLabel(value) : value;
      selectElement.appendChild(option);
    });
  }

  function populateCountrySelect(selectElement, selectedValue, allowedCountries) {
    const countries = Array.isArray(allowedCountries) && allowedCountries.length
      ? allowedCountries.slice().sort(function (left, right) {
          return left.localeCompare(right);
        })
      : COUNTRIES;

    populateSelect(selectElement, countries, "Select your country", "", withFlag);

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

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // A project is "past" once its finish date (or its start date, if no finish
  // date is set) is before today. Such projects are hidden unless the visitor
  // turns on the "show past projects" toggle.
  function isProjectPast(project) {
    const finishDate = parseProjectDate(project.end_date) || parseProjectDate(project.start_date);
    return finishDate ? finishDate < startOfToday() : false;
  }

  // True when the application deadline has already passed (used to tint the card).
  function isDeadlinePassed(project) {
    const deadline = parseProjectDate(project.application_deadline);
    return deadline ? deadline < startOfToday() : false;
  }

  function formatDeadline(value) {
    const deadline = parseProjectDate(value);

    if (!deadline) {
      return "";
    }

    return deadline.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function compareByStartDate(left, right) {
    // Sort by start date ascending; projects without a start date sink to the end.
    const leftKey = left.start_date || "9999-12-31";
    const rightKey = right.start_date || "9999-12-31";
    return leftKey.localeCompare(rightKey);
  }

  function filterProjects(projects, state) {
    return projects
      .filter(function (project) {
        const matchesPast = state.showPast || !isProjectPast(project);
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

        return matchesPast && matchesMonth && matchesProjectType && matchesDestination && matchesResidence && matchesSearch;
      })
      .sort(compareByStartDate);
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
    countryFlag: countryFlag,
    withFlag: withFlag,
    createCountryDialog: createCountryDialog,
    createInitialState: createInitialState,
    filterProjects: filterProjects,
    formatProjectDateRange: formatProjectDateRange,
    formatDeadline: formatDeadline,
    getSavedResidenceCountry: getSavedResidenceCountry,
    getUpcomingMonths: getUpcomingMonths,
    getUniqueValues: getUniqueValues,
    isProjectPast: isProjectPast,
    isDeadlinePassed: isDeadlinePassed,
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