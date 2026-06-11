(function() {
  var container = document.querySelector(".timeline-page");
  var loader = document.getElementById("timeline-loader");
  var button = document.getElementById("timeline-load-button");

  if (!container || !loader || !button) {
    return;
  }

  var pageSize = parseInt(container.getAttribute("data-page-size"), 10) || 12;
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-timeline-item]"));
  var nextIndex = 0;
  var loading = false;

  function revealNextPage() {
    if (loading || nextIndex >= items.length) {
      return;
    }

    loading = true;
    var endIndex = Math.min(nextIndex + pageSize, items.length);

    for (var index = nextIndex; index < endIndex; index += 1) {
      items[index].classList.add("is-visible");
    }

    nextIndex = endIndex;

    if (nextIndex >= items.length) {
      loader.classList.add("is-complete");
      window.removeEventListener("scroll", onScroll);
    }

    loading = false;
  }

  function onScroll() {
    var distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - window.pageYOffset;

    if (distanceToBottom < 320) {
      revealNextPage();
    }
  }

  button.addEventListener("click", revealNextPage);
  window.addEventListener("scroll", onScroll, { passive: true });

  revealNextPage();
})();
