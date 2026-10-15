"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Mobile navigation navigates to separate HTML pages; it does not scroll between sections.
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

  // Booking submits to WhatsApp rather than a mailto link, so Windows Outlook never launches.
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
        value("date") ? "Preferred date: " + value("date") : "",
        value("location") ? "Location: " + value("location") : "",
        value("budget") ? "Estimated budget: " + value("budget") : "",
        "",
        "Project details:",
        value("details")
      ].filter(Boolean);

      const whatsappUrl = "https://wa.me/233257407350?text=" + encodeURIComponent(fields.join("\n"));
      const status = document.getElementById("form-status");
      if (status) status.textContent = "Opening WhatsApp with your enquiry. Please review the message and press Send in WhatsApp.";
      window.location.assign(whatsappUrl);
    });
  }
});
