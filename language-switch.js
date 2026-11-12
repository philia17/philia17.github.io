const languageLinks = document.querySelectorAll("[data-language-link]");

function preserveSection() {
  for (const link of languageLinks) {
    link.hash = window.location.hash;
  }
}

preserveSection();
window.addEventListener("hashchange", preserveSection);
