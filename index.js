// Configuration object for typing effect
const TYPING_CONFIG = {
  texts: [
    "am a data enthusiast passionate about uncovering insights",
    "like exploring data to solve problems and support decisions",
    "turn numbers into stories that inspire action",
  ],
  typingDelay: 120,
  erasingDelay: 60,
  newTextDelay: 2000,
};

// Debounce utility function
function debounce(func, delay) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);
  };
}

// Safe menu toggle with debouncing
const debouncedMyFunction = debounce(function myFunction() {
  const myLinks = document.getElementById("myLinks");
  if (!myLinks) return; // Error boundary
  if (myLinks.style.display === "block") {
    myLinks.style.display = "none";
  } else {
    myLinks.style.display = "block";
  }
}, 100);

// Attach event listeners with error handling
document.addEventListener("DOMContentLoaded", function () {
  try {
    const menuToggle = document.querySelector(".menu .icon");
    if (menuToggle) {
      menuToggle.addEventListener("click", debouncedMyFunction);
    }

    const btns = document.querySelectorAll("#myLinks a");
    btns.forEach((btn) => {
      btn.addEventListener("click", debouncedMyFunction);
    });
  } catch (error) {
    console.warn("Menu initialization warning:", error);
  }
});

// Typing effect with error boundary
const typedTextSpan = document.querySelector(".typed-text");
const cursorSpan = document.querySelector(".cursor");

// Error boundary: check if required elements exist
if (!typedTextSpan || !cursorSpan) {
  console.warn("Typing effect elements not found. Typing effect disabled.");
} else {
  const textArray = TYPING_CONFIG.texts;
  const typingDelay = TYPING_CONFIG.typingDelay;
  const erasingDelay = TYPING_CONFIG.erasingDelay;
  const newTextDelay = TYPING_CONFIG.newTextDelay;

  let textArrayIndex = 0;
  let charIndex = 0;

  function type() {
    if (charIndex < textArray[textArrayIndex].length) {
      if (!cursorSpan.classList.contains("typing"))
        cursorSpan.classList.add("typing");
      typedTextSpan.textContent += textArray[textArrayIndex].charAt(charIndex);
      charIndex++;
      setTimeout(type, typingDelay);
    } else {
      cursorSpan.classList.remove("typing");
      setTimeout(erase, newTextDelay);
    }
  }

  function erase() {
    if (charIndex > 0) {
      if (!cursorSpan.classList.contains("typing"))
        cursorSpan.classList.add("typing");
      typedTextSpan.textContent = textArray[textArrayIndex].substring(
        0,
        charIndex - 1,
      );
      charIndex--;
      setTimeout(erase, erasingDelay);
    } else {
      cursorSpan.classList.remove("typing");
      textArrayIndex++;
      if (textArrayIndex >= textArray.length) textArrayIndex = 0;
      setTimeout(type, typingDelay + 1100);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    // On DOM Load initiate the effect
    if (textArray.length) setTimeout(type, newTextDelay + 250);
  });
}

AOS.init();
