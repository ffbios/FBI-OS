"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // Preserve the old homepage live URL while Live has its own page.
  const redirectLegacyLiveHash = () => {
    if (window.location.pathname === "/" && window.location.hash === "#live") {
      window.location.replace("/live.html");
    }
  };
  if (window.location.pathname === "/" && window.location.hash === "#live") {
    window.location.replace("/live.html");
    return;
  }
  window.addEventListener("hashchange", redirectLegacyLiveHash);

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Responsive navigation: each main item is a separate HTML page.
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");
  const closeMenu = () => {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    nav.classList.remove("open");
  };

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
      nav.classList.toggle("open", !isOpen);
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    });
    document.addEventListener("click", event => {
      if (!nav.classList.contains("open")) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });
  }

  // Portfolio filters on the dedicated Portfolio page.
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const workCards = Array.from(document.querySelectorAll(".work-card[data-category]"));
  filterButtons.forEach(button => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter || "all";
      filterButtons.forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      workCards.forEach(card => {
        card.hidden = !(filter === "all" || card.dataset.category === filter);
      });
    });
  });

  // Copy-to-clipboard for email addresses: do not launch a local mail application.
  document.querySelectorAll("[data-copy-email]").forEach(button => {
    button.addEventListener("click", async () => {
      const email = button.dataset.copyEmail || "filmbyfbi@gmail.com";
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(email);
          copied = true;
        }
      } catch {}
      if (!copied) {
        const input = document.createElement("textarea");
        input.value = email;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        try { copied = document.execCommand("copy"); } catch {}
        input.remove();
      }
      button.textContent = copied ? "Email copied" : email;
      button.setAttribute("aria-live", "polite");
    });
  });

  // The enquiry form prepares the requested details in WhatsApp instead of mailto/Outlook.
  const bookingForm = document.getElementById("project-enquiry-form");
  if (bookingForm) {
    bookingForm.addEventListener("submit", event => {
      event.preventDefault();
      if (!bookingForm.reportValidity()) return;
      const data = new FormData(bookingForm);
      const value = key => String(data.get(key) || "").trim();
      const fields = [
        "Hello FBI — Film Beyond Imagination. I would like to enquire about a project.",
        "",
        "PROJECT ENQUIRY",
        "Name: " + value("name"),
        "Phone / WhatsApp: " + value("phone"),
        value("email") ? "Email: " + value("email") : "",
        "Service: " + value("service"),
        value("date") ? "Preferred event / project date: " + value("date") : "",
        value("location") ? "Location: " + value("location") : "",
        value("budget") ? "Estimated budget: " + value("budget") : "",
        value("contactMethod") ? "Preferred contact method: " + value("contactMethod") : "",
        "",
        "Project details:",
        value("details")
      ].filter(Boolean);
      const whatsappUrl = "https://wa.me/233257407350?text=" + encodeURIComponent(fields.join("\n"));
      const status = document.getElementById("form-status");
      if (status) status.textContent = "Opening WhatsApp with your enquiry. Review the message and press Send in WhatsApp.";
      window.location.assign(whatsappUrl);
    });
  }
});
