function myFunction() {
    var x = document.getElementById("myLinks");
    if (x.style.display === "block") {
      x.style.display = "none";
    } else {
      x.style.display = "block";
    }
  }

  // document.querySelectorAll().addEventListener('click',myFunction);

let btns = document.querySelectorAll('#myLinks a');

for (i of btns) {
  i.addEventListener('click', myFunction);
} 