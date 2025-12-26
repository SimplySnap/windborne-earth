// libs/projection_state.js

// Default projection; should match your initial globe projection
window.currentProjectionType = "O";  // Orthographic by default

function setProjectionTypeFromElement(el) {
  var id = el.id;
  if (id === "atlantis")                  window.currentProjectionType = "A";
  else if (id === "azimuthalequidistant") window.currentProjectionType = "AE";
  else if (id === "conicequidistant")     window.currentProjectionType = "CE";
  else if (id === "equirectangular")      window.currentProjectionType = "E";
  else if (id === "orthographic")         window.currentProjectionType = "O";
  else if (id === "stereographic")        window.currentProjectionType = "S";
  else if (id === "waterman")             window.currentProjectionType = "WB";
  else if (id === "winkel3")              window.currentProjectionType = "W3";
}

// Attach listeners after the page (and menu) is loaded
window.addEventListener("load", function () {
  var projButtons = document.querySelectorAll("#menu .proj.text-button");
  Array.prototype.forEach.call(projButtons, function (btn) {
    btn.addEventListener("click", function () {
      setProjectionTypeFromElement(btn);
    });
  });
});
