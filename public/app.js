document.getElementById("year").textContent = new Date().getFullYear();

const nav=document.querySelector(".nav");
const toggle=document.querySelector(".menu-toggle");
if(toggle){
  toggle.addEventListener("click",()=>nav.classList.toggle("open"));
  document.querySelectorAll(".nav-links a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
}

const email = window.FBI_CONTACT_EMAIL || "";
const emailButton = document.querySelector(".contact-card a.btn");
if(emailButton && email){
  emailButton.href = "mailto:" + email;
}
