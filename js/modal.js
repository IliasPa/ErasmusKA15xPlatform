document.addEventListener("DOMContentLoaded", function () {
  const modal = document.getElementById("suggestionsModal");
  const closeButton = document.getElementById("closeSuggestionsModalButton");
  const form = document.getElementById("suggestionsForm");
  const formStatus = document.getElementById("suggestionsFormStatus");
  const firstInput = document.getElementById("suggestionsName") || document.getElementById("suggestionsMessage");
  const openButtons = Array.from(document.querySelectorAll("[data-open-suggestions-modal]"));
  const toast = document.getElementById("toast");
  let previousFocusedElement = null;
  let toastTimer = null;

  if (!modal || !closeButton || !form) {
    return;
  }

  openButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      previousFocusedElement = document.activeElement;
      formStatus.textContent = "";
      formStatus.className = "form-status";
      modal.showModal();
      window.setTimeout(function () {
        if (firstInput) {
          firstInput.focus();
        }
      }, 0);
    });
  });

  closeButton.addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  modal.addEventListener("cancel", function () {
    restoreFocus();
  });

  modal.addEventListener("close", function () {
    restoreFocus();
  });

  form.addEventListener("submit", async function (event) {
    const submitButton = form.querySelector('[type="submit"]');

    event.preventDefault();
    formStatus.textContent = "";
    formStatus.className = "form-status";

    if (form.action.indexOf("your-form-id") !== -1) {
      formStatus.textContent = "Replace the placeholder form action URL with your form service endpoint before submitting.";
      formStatus.className = "form-status is-error";
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch(form.action, {
        method: form.method || "POST",
        body: new FormData(form),
        headers: {
          Accept: "application/json"
        }
      });

      closeModal();

      if (!response.ok) {
        showToast("error", "Something went wrong. Please try again later.");
        return;
      }

      form.reset();
      showToast("success", "Thank you! Your message has been sent.");
    } catch (error) {
      closeModal();
      showToast("error", "Something went wrong. Please try again later.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });

  function closeModal() {
    if (modal.open) {
      modal.close();
    }
  }

  function restoreFocus() {
    if (previousFocusedElement && typeof previousFocusedElement.focus === "function") {
      previousFocusedElement.focus();
    }
  }

  function showToast(type, message) {
    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.remove("toast--success", "toast--error");
    toast.classList.add("toast--feedback", type === "success" ? "toast--success" : "toast--error", "is-visible");

    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible", "toast--feedback", "toast--success", "toast--error");
    }, 3000);
  }
});